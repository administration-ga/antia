// @vitest-environment edge-runtime
// Réécrit d'après socle/convex/modules/direct/organisationAccess.test.ts @ ad2e7fdc2 — l'audience « organisation » (membres validés d'une administration, page de l'organisation) devient `followers` (V36) : le CERCLE d'une page du moteur — abonnés et signataires vivants, l'hôte compris ; « membership validée obligatoire » → abonnement ou signature ACCEPTÉE ; « révoquer la membership » → se désabonner, perdre sa signature, quitter le réseau, être suspendu ; « désactiver la page » → retrait par la console (`pages/admin.setPageStatus`, `closePageDirects`) ; la matrice publique / connexions du socle est tenue par la fondation (`access.test.ts`) et n'est reprise ici que pour une conférence publique AU NOM d'une page ; jeton par `access.authorizeToken` (personne de l'identité, réseau en argument), lecture par `assertVisibleDirectSession`, rediffusion par `directReplayAccessDecision`, au lieu de `sessions.get`/`listLive`/`listReplays`/`listMine`/`antenna.hostState` ; l'invitation et le rôle d'intervenant d'une relation hors du cercle jugés sur `invitees.add`/`searchCandidates` au lieu de `antenna.inviteByHandle`/`speakers.promote`. Cas RETIRÉS de ce fichier : les cloches d'audience d'une conférence d'administration (`direct_started`, `direct_replay_published` aux membres validés) — sonnées par le lot des sessions, aux abonnés de la page (`notifications/fanout.ts`) ; le refus de l'action LiveKit AVANT sa configuration (`requestDirectToken`, lot des médias) ; l'hôte révoqué qui termine encore sa conférence (`sessions.end`, lot des sessions).
/**
 * L'ACCÈS PAR LA PAGE — l'audience `followers`, de bout en bout.
 *
 * La même règle décide la lecture, le jeton, la rediffusion et l'invitation ;
 * les liens sont relus à CHAQUE acte. Ce que ce fichier tient :
 *
 *  1. le cercle d'une page — ses abonnés et ses signataires VIVANTS (habilitation
 *     acceptée, membres actifs du réseau), l'hôte compris — et lui seul voit une
 *     conférence `followers` ; blocage et exclusion s'appliquent ensuite ;
 *  2. une invitation nominative ne franchit JAMAIS ce cercle ;
 *  3. sortir du cercle (désabonnement, signature retirée, départ du réseau,
 *     suspension) referme aussitôt lecture et jeton ; retirer la page referme la
 *     conférence pour tous, et la termine ;
 *  4. la rediffusion ne sort pas du cercle ; une conférence PUBLIQUE au nom
 *     d'une page reste publique.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { assertVisibleDirectSession, directReplayAccessDecision } from "./access"
import { ban, block, codeOf, connect, enter, followPage, insertPage, insertSession, invite, joinAlso, type Person, ruleOf, seed, type T, T0 } from "./fixtures.setup"

const INVITEES = api.modules.live.invitees
const authorizeToken = internal.modules.live.access.authorizeToken
const SFU_STATE = "modules/live/livekitActions:applyDirectSfuState"

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function token(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

async function visible(t: T, networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">): Promise<boolean> {
  return await t.run(async (ctx) => {
    try {
      await assertVisibleDirectSession(ctx, { networkId, personId: person.personId }, sessionId)
      return true
    } catch {
      return false
    }
  })
}

async function replayDecision(t: T, person: Person, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) => directReplayAccessDecision(ctx, person.personId, (await ctx.db.get(sessionId)) as Doc<"liveSessions">))
}

async function kicksFor(t: T, person: Person): Promise<string[]> {
  const subject = (await t.run(async (ctx) => ctx.db.get(person.personId)))?.authUserId
  return (await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect()))
    .filter((job) => {
      const args = job.args[0] as { subject?: string; mode?: string }
      return job.name === SFU_STATE && args.subject === subject && args.mode === "kick"
    })
    .map((job) => (job.args[0] as { roomName: string }).roomName)
}

async function roomOf(t: T, sessionId: Id<"liveSessions">): Promise<string> {
  const row = await t.run(async (ctx) => ctx.db.get(sessionId))
  if (!row) throw new Error("session inconnue")
  return row.roomName
}

/** Pose une habilitation de signataire (acceptée ou non). */
async function signatory(t: T, pageId: Id<"pages">, person: Person, accepted: boolean): Promise<Id<"pageSignatories">> {
  return await t.run(async (ctx) => {
    const page = await ctx.db.get(pageId)
    if (!page) throw new Error("page inconnue")
    return await ctx.db.insert("pageSignatories", { networkId: page.networkId, pageId, personId: person.personId, role: "signatory", ...(accepted ? { acceptedAt: 1 } : {}), createdAt: 1, updatedAt: 1 })
  })
}

async function dropSignatory(t: T, pageId: Id<"pages">, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("pageSignatories")
      .withIndex("by_page_person", (q) => q.eq("pageId", pageId).eq("personId", person.personId))
      .unique()
    if (row) await ctx.db.delete(row._id)
  })
}

async function operatorIn(t: T, root: Id<"networks">): Promise<Person> {
  const operator = await enter(t, root, "console")
  await t.run(async (ctx) => ctx.db.insert("operators", { personId: operator.personId, role: "platform_operator", grantedAt: 1 }))
  return operator
}

/** Le décor : une page de la racine dont l'hôte est administrateur, un abonné, un signataire, un inconnu. */
async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const host = await enter(t, root, "host")
  const follower = await enter(t, root, "follower")
  const signer = await enter(t, root, "signer")
  const outsider = await enter(t, root, "outsider")
  const pageId = await insertPage(t, root, host, "page-acces")
  await followPage(t, pageId, follower)
  await signatory(t, pageId, signer, true)
  return { t, root, testClosed, host, follower, signer, outsider, pageId }
}

describe("followers — le cercle de la page, et lui seul", () => {
  it("l'hôte signataire, un abonné, un signataire vivant entrent ; hors du cercle et bloqué : `notFound` ; exclu : `LIVE_EXCLUDED`", async () => {
    const { t, root, host, follower, signer, outsider, pageId } = await cast()
    const blocked = await enter(t, root, "blocked")
    const banned = await enter(t, root, "banned")
    for (const person of [blocked, banned]) await followPage(t, pageId, person)
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    await block(t, root, host, blocked)
    await ban(t, sessionId, banned)

    expect((await token(host, root, sessionId)).role).toBe("speaker")
    expect((await token(follower, root, sessionId)).role).toBe("viewer")
    expect((await token(signer, root, sessionId)).role).toBe("viewer")
    for (const denied of [outsider, blocked]) {
      expect(await codeOf(token(denied, root, sessionId))).toBe("notFound")
      expect(await visible(t, root, denied, sessionId)).toBe(false)
    }
    expect(await ruleOf(token(banned, root, sessionId))).toBe("LIVE_EXCLUDED")
    expect(await visible(t, root, banned, sessionId)).toBe(false)
    for (const allowed of [host, follower, signer]) expect(await visible(t, root, allowed, sessionId)).toBe(true)
  }, 30_000)

  it("une habilitation non acceptée ne donne rien ; acceptée, elle ouvre ; retirée, elle referme", async () => {
    const { t, root, host, outsider, pageId } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    const invitationId = await signatory(t, pageId, outsider, false)
    expect(await codeOf(token(outsider, root, sessionId))).toBe("notFound")

    await t.run(async (ctx) => ctx.db.patch(invitationId, { acceptedAt: Date.now() }))
    expect((await token(outsider, root, sessionId)).role).toBe("viewer")

    await dropSignatory(t, pageId, outsider)
    expect(await codeOf(token(outsider, root, sessionId))).toBe("notFound")
    expect(await visible(t, root, outsider, sessionId)).toBe(false)
  }, 30_000)

  it("une invitation nominative ne franchit jamais le cercle : `add` la refuse, le sélecteur ne la propose pas, une ligne posée n'ouvre rien", async () => {
    const { t, root, host, follower, pageId } = await cast()
    const friend = await enter(t, root, "friend")
    for (const person of [friend, follower]) await connect(t, root, host, person)
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId })

    expect(await ruleOf(host.as.mutation(INVITEES.add, { networkId: root, sessionId, personId: friend.personId, stageRole: "speaker" }))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")
    const candidates = await host.as.query(INVITEES.searchCandidates, { networkId: root, sessionId })
    expect(candidates.candidates.map((row) => row.personId)).toEqual([follower.personId])
    // Une ligne d'invité posée quand même ne franchit pas le cercle.
    await invite(t, sessionId, friend)
    expect(await codeOf(token(friend, root, sessionId))).toBe("notFound")
    expect(await visible(t, root, friend, sessionId)).toBe(false)

    // Abonnée, la même personne entre — par le cercle — et se convie.
    await followPage(t, pageId, friend)
    expect((await token(friend, root, sessionId)).role).toBe("viewer")
    expect(await host.as.mutation(INVITEES.add, { networkId: root, sessionId, personId: friend.personId, stageRole: "speaker" })).toEqual({ added: false, updated: true })
  }, 30_000)
})

describe("followers — sortir du cercle referme aussitôt", () => {
  it("se désabonner retire lecture et jeton, et la coupure de la salle vise la connexion établie", async () => {
    const { t, root, host, follower, pageId } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    expect((await token(follower, root, sessionId)).role).toBe("viewer")

    await follower.as.mutation(api.modules.pages.pages.unfollow, { networkId: root, pageId })
    expect(await codeOf(token(follower, root, sessionId))).toBe("notFound")
    expect(await visible(t, root, follower, sessionId)).toBe(false)
    await t.mutation(internal.modules.live.revocation.kickUserFromPageDirects, { personId: follower.personId, pageId, cursor: null })
    expect(await kicksFor(t, follower)).toEqual([await roomOf(t, sessionId)])
  }, 30_000)

  it("l'hôte qui sort du cercle (signature retirée, sans abonnement) perd la conférence comme un autre", async () => {
    const { t, root, host, pageId } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    expect((await token(host, root, sessionId)).role).toBe("speaker")

    await dropSignatory(t, pageId, host)
    expect(await codeOf(token(host, root, sessionId))).toBe("notFound")
    expect(await visible(t, root, host, sessionId)).toBe(false)
    expect(await codeOf(host.as.query(INVITEES.listForSession, { networkId: root, sessionId }))).toBe("notFound")
    await t.mutation(internal.modules.live.revocation.kickUserFromPageDirects, { personId: host.personId, pageId, cursor: null })
    expect(await kicksFor(t, host)).toEqual([await roomOf(t, sessionId)])
  }, 30_000)

  it("quitter le réseau de la page, être suspendu à la racine : abonné et signataire perdent la conférence", async () => {
    const { t, root, testClosed, host, follower, signer } = await cast()
    for (const person of [host, follower, signer]) await joinAlso(t, testClosed, person)
    const pageId = await insertPage(t, testClosed, host, "page-fermee")
    await followPage(t, pageId, follower)
    await signatory(t, pageId, signer, true)
    const sessionId = await insertSession(t, { networkId: testClosed, host, audience: "followers", pageId })
    expect((await token(follower, testClosed, sessionId)).role).toBe("viewer")
    expect((await token(signer, testClosed, sessionId)).role).toBe("viewer")

    await follower.as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: testClosed })
    expect(await codeOf(token(follower, testClosed, sessionId))).toBe("notFound")
    expect(await visible(t, testClosed, follower, sessionId)).toBe(false)

    const operator = await operatorIn(t, root)
    await operator.as.mutation(api.modules.people.memberships.suspendEverywhere, { personId: signer.personId, reason: "Suspension après examen." })
    expect(await codeOf(token(signer, testClosed, sessionId))).toBe("membershipSuspended")
    expect(await visible(t, testClosed, signer, sessionId)).toBe(false)
  }, 30_000)
})

describe("followers — la page retirée, la rediffusion, la page qui signe une conférence publique", () => {
  it("page retirée : plus personne, hôte compris ; sa fermeture termine la conférence (`revoked`) ; une conférence programmée reste invisible", async () => {
    const { t, root, host, follower, pageId } = await cast()
    const live = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    const programmed = await insertSession(t, { networkId: root, host, audience: "followers", pageId, status: "scheduled" })
    const operator = await operatorIn(t, root)

    await operator.as.mutation(api.modules.pages.admin.setPageStatus, { pageId, status: "inactive", reason: "Page retirée après examen." })
    for (const person of [host, follower]) {
      expect(await codeOf(token(person, root, live))).toBe("notFound")
      expect(await visible(t, root, person, live)).toBe(false)
      expect(await visible(t, root, person, programmed)).toBe(false)
    }
    await t.mutation(internal.modules.live.revocation.closePageDirects, { pageId, cursor: null, revokedAt: Date.now() })
    expect(await t.run(async (ctx) => ctx.db.get(live))).toMatchObject({ status: "ended", endReason: "revoked" })
    expect((await t.run(async (ctx) => ctx.db.get(programmed)))?.status).toBe("scheduled")
  }, 30_000)

  it("la rediffusion reste au cercle, même `replayVisibility: public`, et se referme pour qui se désabonne", async () => {
    const { t, root, host, follower, outsider, pageId } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host, audience: "followers", pageId, status: "ended" })
    await t.run(async (ctx) => ctx.db.patch(sessionId, { replayStatus: "ready", replayPublication: "published", replayVisibility: "public" }))

    expect(await replayDecision(t, follower, sessionId)).toBe("allowed")
    expect(await replayDecision(t, outsider, sessionId)).toBe("outside_audience")
    await follower.as.mutation(api.modules.pages.pages.unfollow, { networkId: root, pageId })
    expect(await replayDecision(t, follower, sessionId)).toBe("outside_audience")
  }, 30_000)

  it("une conférence PUBLIQUE au nom d'une page reste publique ; le retrait de la page la termine quand même", async () => {
    const { t, root, host, outsider, pageId } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host, audience: "public", pageId })
    expect((await token(outsider, root, sessionId)).role).toBe("viewer")

    await t.mutation(internal.modules.live.revocation.closePageDirects, { pageId, cursor: null, revokedAt: Date.now() })
    expect(await t.run(async (ctx) => ctx.db.get(sessionId))).toMatchObject({ status: "ended", endReason: "revoked" })
    // Terminée : plus de jeton ; la page du direct reste lisible de son audience (la rediffusion y vit).
    expect(await codeOf(token(outsider, root, sessionId))).toBe("notFound")
    expect(await visible(t, root, outsider, sessionId)).toBe(true)
  }, 30_000)

  it("une page absente ou d'un autre réseau ne désigne personne : la conférence est introuvable, sa gestion aussi", async () => {
    const { t, root, testClosed, host } = await cast()
    await joinAlso(t, testClosed, host)
    const foreignPageId = await insertPage(t, testClosed, host, "page-ailleurs")
    const foreign = await insertSession(t, { networkId: root, host, audience: "followers", pageId: foreignPageId })
    const pageless = await insertSession(t, { networkId: root, host, audience: "followers" })
    for (const sessionId of [foreign, pageless]) {
      expect(await codeOf(token(host, root, sessionId))).toBe("notFound")
      expect(await visible(t, root, host, sessionId)).toBe(false)
      expect(await codeOf(host.as.query(INVITEES.searchCandidates, { networkId: root, sessionId }))).toBe("notFound")
      expect(await codeOf(host.as.query(INVITEES.listForSession, { networkId: root, sessionId }))).toBe("notFound")
    }
  }, 30_000)
})
