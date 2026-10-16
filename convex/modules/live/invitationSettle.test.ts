// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/invitationSettle.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, outillage `fixtures.setup.ts` du module) ; cloche du moteur (table `notifications` du RÉSEAU de la session, genres `live_invite`, `live_antenna_invite`, `live_started`, sujet `liveSession`) posée par la porte unique (`notifyPerson`, `resolveNotifications`) ; conférence posée en base et passage en live joué par `openConferenceToInviteesAtGoLive` (comme `sessions.goLive` l'appelle), invitations d'antenne et leurs réponses posées en base (au lieu de `sessions.create`/`goLive` et `antenna.inviteUser`/`respondToInvitation`, lots des sessions et de la scène) ; les trois fins sont celles du moteur (`sessions.end`, `reap.reapStaleDirects`, `revocation.closePageDirects`) ; invités nominatifs MEMBRES du réseau (un compte « agent » rattaché n'a plus de sens) ; drainage sous l'horloge simulée du fichier. Cas NEUF : le solde résout dans le réseau de la session (conférence d'un réseau fermé).
/**
 * SOLDER les invitations d'une conférence terminée (CH-094).
 *
 * Ce que ce fichier tient, dans l'ordre :
 *
 *  1. **Les trois fins d'un direct EN LIVE planifient le solde** — l'hôte
 *     (`sessions.end`), la récolte (`reap.reapStaleDirects`), la page retirée
 *     (`revocation.closePageDirects`) —, en job, jamais inline. Un direct
 *     jamais démarré ne planifie rien : aucune cloche n'a sonné avant le live.
 *  2. **Après drainage, l'attente expire, les réponses restent** : les
 *     `live_invite` des invités vivants et les `live_antenna_invite` encore
 *     `pending` passent `expired` à l'instant de la fin ; une invitation
 *     acceptée, refusée ou retirée GARDE sa résolution.
 *  3. **Le job est idempotent, borné, gardé et chaîné** : rejouer n'écrit
 *     rien, un direct encore live n'est jamais soldé, au-delà d'une page la
 *     suite part en continuation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { testConvex } from "../../test.setup"
import { notifyPerson, resolveNotifications } from "../notifications/notify"
import { connect, enter, insertPage, insertSession, invite, joinAlso, type Person, seed, type T, T0, tick } from "./fixtures.setup"
import { DIRECT_INVITATION_SETTLE_PAGE } from "./invitationSettle"
import { openConferenceToInviteesAtGoLive } from "./invitees"

type BellKind = "live_invite" | "live_antenna_invite" | "live_started"

const SETTLE_JOB = "modules/live/invitationSettle:expireSessionInvitations"
const settle = internal.modules.live.invitationSettle.expireSessionInvitations

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function must<V>(value: V | null | undefined): V {
  if (value === null || value === undefined) {
    throw new Error("ligne attendue absente")
  }
  return value
}

/** LA cloche d'un genre, pour une personne et une session — une seule. */
async function bell(t: T, person: Person, kind: BellKind, sessionId: Id<"liveSessions">): Promise<Doc<"notifications">> {
  const rows = await t.run(async (ctx) => {
    const session = must(await ctx.db.get(sessionId))
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", session.networkId).eq("recipientPersonId", person.personId))
      .take(100)
    return all.filter((row) => row.kind === kind && row.subjectLiveSessionId === sessionId)
  })
  expect(rows).toHaveLength(1)
  return must(rows[0])
}

/** Les jobs de solde planifiés, dans l'ordre. */
async function settleJobs(t: T) {
  const jobs = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect())
  return jobs.filter((job) => job.name === SETTLE_JOB)
}

/** Joue `action`, puis draine ce qu'elle a planifié : les jobs ne partent qu'ici, jamais pendant les assertions. */
async function drainAfter(t: T, action: () => Promise<unknown>): Promise<void> {
  await action()
  await t.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Une invitation d'antenne posée en base, sa cloche sonnée par l'hôte, et la réponse éventuelle de l'invité. */
async function antennaInvitation(
  ctx: MutationCtx,
  session: Doc<"liveSessions">,
  invitee: Person,
  answer: "pending" | "accepted" | "declined",
): Promise<Id<"liveAntennaInvitations">> {
  const now = Date.now()
  const invitationId = await ctx.db.insert("liveAntennaInvitations", {
    networkId: session.networkId,
    sessionId: session._id,
    inviterPersonId: session.hostPersonId,
    inviteePersonId: invitee.personId,
    status: answer,
    createdAt: now,
    updatedAt: now,
  })
  await notifyPerson(ctx, { networkId: session.networkId, recipientPersonId: invitee.personId, actorPersonId: session.hostPersonId, kind: "live_antenna_invite", subject: { liveSession: session._id } })
  if (answer !== "pending") {
    await resolveNotifications(ctx, { networkId: session.networkId, recipientPersonId: invitee.personId, kind: "live_antenna_invite", subject: { liveSession: session._id }, resolution: answer, at: now })
  }
  return invitationId
}

type Conference = {
  t: T
  root: Id<"networks">
  host: Person
  sessionId: Id<"liveSessions">
  /** Invité à l'antenne, sans réponse. */
  bob: Person
  /** Invité à l'antenne, a ACCEPTÉ. */
  carl: Person
  /** Invité à l'antenne, a REFUSÉ. */
  fay: Person
  /** Invité nominatif, toujours vivant. */
  dan: Person
  /** Invité nominatif, RETIRÉ pendant le live. */
  eve: Person
  bobInvitation: Id<"liveAntennaInvitations">
}

/** Une conférence EN LIVE où chaque sorte d'invitation a son état. */
async function conferenceEnCours(): Promise<Conference> {
  const t = testConvex()
  const { root } = await seed(t)
  const host = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carl = await enter(t, root, "carl")
  const fay = await enter(t, root, "fay")
  const dan = await enter(t, root, "dan")
  const eve = await enter(t, root, "eve")
  for (const person of [bob, carl, fay, dan, eve]) await connect(t, root, host, person)

  const sessionId = await insertSession(t, { networkId: root, host, audience: "connections", status: "scheduled" })
  for (const person of [dan, eve]) {
    await host.as.mutation(api.modules.live.invitees.add, { networkId: root, sessionId, personId: person.personId, stageRole: "viewer" })
  }
  // Le passage en live, tel que `sessions.goLive` le joue — avec la cloche
  // d'audience de bob, qui n'est pas une invitation.
  const bobInvitation = await t.run(async (ctx) => {
    const session = must(await ctx.db.get(sessionId))
    const now = Date.now()
    await ctx.db.patch(session._id, { status: "live", startedAt: now, updatedAt: now })
    await openConferenceToInviteesAtGoLive(ctx, session)
    await notifyPerson(ctx, { networkId: root, recipientPersonId: bob.personId, actorPersonId: host.personId, kind: "live_started", subject: { liveSession: sessionId } })
    const live = must(await ctx.db.get(sessionId))
    const invitationId = await antennaInvitation(ctx, live, bob, "pending")
    await antennaInvitation(ctx, live, carl, "accepted")
    await antennaInvitation(ctx, live, fay, "declined")
    return invitationId
  })
  tick()
  await host.as.mutation(api.modules.live.invitees.revoke, { networkId: root, sessionId, personId: eve.personId })
  tick()
  return { t, root, host, sessionId, bob, carl, fay, dan, eve, bobInvitation }
}

/** Les réponses déjà données survivent au solde — et le démarrage n'est pas une invitation. */
async function expectAnswersKept(c: Conference): Promise<void> {
  expect((await bell(c.t, c.carl, "live_antenna_invite", c.sessionId)).resolution).toBe("accepted")
  expect((await bell(c.t, c.fay, "live_antenna_invite", c.sessionId)).resolution).toBe("declined")
  expect((await bell(c.t, c.eve, "live_invite", c.sessionId)).resolution).toBe("cancelled")
  expect((await bell(c.t, c.bob, "live_started", c.sessionId)).resolution).toBeUndefined()
}

describe("solde des invitations — les trois fins d'un direct en live", () => {
  it("la fin par l'hôte : job planifié, l'attente expire à l'instant de la fin, les réponses restent", async () => {
    const c = await conferenceEnCours()
    // Rien n'est soldé tant que la conférence vit.
    expect((await bell(c.t, c.bob, "live_antenna_invite", c.sessionId)).resolution).toBeUndefined()
    expect((await bell(c.t, c.dan, "live_invite", c.sessionId)).resolution).toBeUndefined()
    expect(await settleJobs(c.t)).toHaveLength(0)

    await drainAfter(c.t, () => c.host.as.mutation(api.modules.live.sessions.end, { networkId: c.root, sessionId: c.sessionId }))

    const endedAt = must(must(await c.t.run(async (ctx) => ctx.db.get(c.sessionId))).endedAt)
    const jobs = await settleJobs(c.t)
    expect(jobs.map((job) => job.args[0])).toEqual([{ sessionId: c.sessionId, endedAt }])
    expect(jobs[0]?.state.kind).toBe("success")

    expect(await bell(c.t, c.bob, "live_antenna_invite", c.sessionId)).toMatchObject({ resolution: "expired", resolvedAt: endedAt, readAt: endedAt })
    expect(await bell(c.t, c.dan, "live_invite", c.sessionId)).toMatchObject({ resolution: "expired", resolvedAt: endedAt, readAt: endedAt })
    await expectAnswersKept(c)
    // La LIGNE d'invitation n'est pas réécrite : son expiration reste dérivée.
    expect(must(await c.t.run(async (ctx) => ctx.db.get(c.bobInvitation))).status).toBe("pending")
  }, 30_000)

  it("annuler un direct PROGRAMMÉ ne planifie aucun solde", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const host = await enter(t, root, "alice")
    const sessionId = await insertSession(t, { networkId: root, host, audience: "connections", status: "scheduled" })
    await expect(host.as.mutation(api.modules.live.sessions.end, { networkId: root, sessionId })).resolves.toEqual({ ended: true })
    expect(await settleJobs(t)).toHaveLength(0)
  }, 30_000)

  it("la récolte (durée maximale) solde de même ; le programmé oublié ne planifie rien", async () => {
    const c = await conferenceEnCours()
    const forgotten = await insertSession(c.t, { networkId: c.root, host: c.host, audience: "connections", status: "scheduled" })
    await c.t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.patch(c.sessionId, { startedAt: now - 5 * 60 * 60_000 })
      await ctx.db.patch(forgotten, { createdAt: now - 25 * 60 * 60_000 })
    })

    await drainAfter(c.t, () => c.t.mutation(internal.modules.live.reap.reapStaleDirects, {}))

    const [live, oublie] = await c.t.run(async (ctx) => [must(await ctx.db.get(c.sessionId)), must(await ctx.db.get(forgotten))])
    expect(live).toMatchObject({ status: "ended", endReason: "max_duration" })
    expect(oublie).toMatchObject({ status: "ended", endReason: "never_started" })
    expect((await settleJobs(c.t)).map((job) => job.args[0])).toEqual([{ sessionId: c.sessionId, endedAt: live.endedAt }])

    expect(await bell(c.t, c.bob, "live_antenna_invite", c.sessionId)).toMatchObject({ resolution: "expired", resolvedAt: live.endedAt })
    expect(await bell(c.t, c.dan, "live_invite", c.sessionId)).toMatchObject({ resolution: "expired", resolvedAt: live.endedAt })
    await expectAnswersKept(c)
  }, 30_000)

  it("retirer la page ferme ses directs et les solde à l'instant de la révocation", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const host = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const dan = await enter(t, root, "dan")
    const pageId = await insertPage(t, root, host, "page-solde")
    const sessionId = await insertSession(t, { networkId: root, host, audience: "public", pageId })
    await invite(t, sessionId, dan)
    await t.run(async (ctx) => {
      const session = must(await ctx.db.get(sessionId))
      await notifyPerson(ctx, { networkId: root, recipientPersonId: dan.personId, actorPersonId: host.personId, kind: "live_invite", subject: { liveSession: sessionId } })
      await antennaInvitation(ctx, session, bob, "pending")
    })

    await drainAfter(t, () => t.mutation(internal.modules.live.revocation.closePageDirects, { pageId, cursor: null, revokedAt: 42 }))

    expect(must(await t.run(async (ctx) => ctx.db.get(sessionId)))).toMatchObject({ status: "ended", endedAt: 42, endReason: "revoked" })
    const jobs = await settleJobs(t)
    expect(jobs.map((job) => job.args[0])).toEqual([{ sessionId, endedAt: 42 }])
    expect(jobs[0]?.state.kind).toBe("success")
    expect(await bell(t, bob, "live_antenna_invite", sessionId)).toMatchObject({ resolution: "expired", resolvedAt: 42, readAt: 42 })
    expect(await bell(t, dan, "live_invite", sessionId)).toMatchObject({ resolution: "expired", resolvedAt: 42, readAt: 42 })
  }, 30_000)

  it("le solde résout dans le RÉSEAU de la session : une conférence d'un réseau fermé solde la cloche de ce réseau", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const host = await enter(t, root, "alice")
    const dan = await enter(t, root, "dan")
    for (const person of [host, dan]) await joinAlso(t, testClosed, person)
    const sessionId = await insertSession(t, { networkId: testClosed, host, audience: "invitees", status: "ended" })
    await invite(t, sessionId, dan)
    await t.run(async (ctx) => {
      // Deux cloches de même genre et de même sujet ne peuvent vivre que dans
      // le réseau de la session ; une ligne posée à la racine n'est pas la sienne.
      await notifyPerson(ctx, { networkId: testClosed, recipientPersonId: dan.personId, actorPersonId: host.personId, kind: "live_invite", subject: { liveSession: sessionId } })
      await notifyPerson(ctx, { networkId: root, recipientPersonId: dan.personId, actorPersonId: host.personId, kind: "live_invite", subject: { liveSession: sessionId } })
    })

    await expect(t.mutation(settle, { sessionId, endedAt: 7 })).resolves.toMatchObject({ invitees: 1, resolved: 1, done: true })
    const rows = await t.run(async (ctx) =>
      Promise.all(
        [testClosed, root].map(async (networkId) =>
          must(
            (
              await ctx.db
                .query("notifications")
                .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", networkId).eq("recipientPersonId", dan.personId))
                .take(10)
            ).find((row) => row.subjectLiveSessionId === sessionId),
          ),
        ),
      ),
    )
    expect(rows.map((row) => row.resolution ?? "ouverte")).toEqual(["expired", "ouverte"])
  }, 30_000)
})

describe("solde des invitations — idempotent, gardé, chaîné", () => {
  it("rien sur un direct encore live ; au-delà d'une page, la suite est chaînée ; rejouer n'écrit rien", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const host = await enter(t, root, "alice")
    const total = DIRECT_INVITATION_SETTLE_PAGE + 1
    const sessionId = await insertSession(t, { networkId: root, host, audience: "public" })
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < total; index += 1) {
        // Des membres DÉCLARÉS du réseau : la porte de la cloche ne sonne jamais un non-membre.
        const personId = await ctx.db.insert("persons", { authUserId: `invite-${index}`, createdAt: now, updatedAt: now })
        await ctx.db.insert("networkMemberships", { networkId: root, personId, status: "declaree", role: "member", joinedAt: now, statusChangedAt: now })
        await ctx.db.insert("liveAntennaInvitations", {
          networkId: root,
          sessionId,
          inviterPersonId: host.personId,
          inviteePersonId: personId,
          status: "pending",
          createdAt: now,
          updatedAt: now + index,
        })
        await notifyPerson(ctx, { networkId: root, recipientPersonId: personId, actorPersonId: host.personId, kind: "live_antenna_invite", subject: { liveSession: sessionId } })
      }
    })
    const resolutions = async () =>
      (
        await t.run(async (ctx) =>
          ctx.db
            .query("notifications")
            .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", root))
            .take(500),
        )
      )
        .filter((row) => row.subjectLiveSessionId === sessionId)
        .map((row) => ({ resolution: row.resolution ?? "ouverte", resolvedAt: row.resolvedAt, readAt: row.readAt }))
    const run = () => t.mutation(settle, { sessionId, endedAt: 777 })

    // Gardé : un appel égaré sur un direct encore live ne ferme rien.
    await expect(run()).resolves.toEqual({ invitees: 0, antennaInvitations: 0, resolved: 0, done: true })
    expect(new Set((await resolutions()).map((row) => row.resolution))).toEqual(new Set(["ouverte"]))

    await t.run(async (ctx) => ctx.db.patch(sessionId, { status: "ended", endedAt: 777 }))
    await expect(run()).resolves.toEqual({
      invitees: 0,
      antennaInvitations: DIRECT_INVITATION_SETTLE_PAGE,
      resolved: DIRECT_INVITATION_SETTLE_PAGE,
      done: false,
    })
    const planned = await settleJobs(t)
    const continuation = planned[planned.length - 1]
    expect(continuation?.args[0]).toMatchObject({ sessionId, endedAt: 777, cursor: expect.any(String) })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const settled = await resolutions()
    expect(settled).toHaveLength(total)
    expect(new Set(settled.map((row) => row.resolution))).toEqual(new Set(["expired"]))

    // Rejouer : zéro écriture, sur la page comme sur sa suite.
    tick()
    await expect(run()).resolves.toMatchObject({ resolved: 0 })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await resolutions()).every((row) => row.resolvedAt === 777 && row.readAt === 777)).toBe(true)
  }, 60_000)
})
