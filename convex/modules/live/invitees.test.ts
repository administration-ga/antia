// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/invitees.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, outillage `fixtures.setup.ts` du module) ; sessions POSÉES en base et passage en live joué par `openConferenceToInviteesAtGoLive` comme `sessions.goLive` l'appelle (ligne d'AVANT le passage), au lieu de `sessions.create`/`goLive` (lot des sessions) ; exclusion, délégation et rétrogradation posées en base au lieu de `moderation.ban`, `delegations.grant`, `speakers.demote` (lot de la scène) ; portes de lecture (page, découverte, rediffusion) jugées par leurs gardes communes (`assertVisibleDirectSession`, `directReplayAccessDecision`) au lieu de `sessions.get`/`listLive`/`listReplays` ; codes et règles au lieu des libellés ; audience « organisation » → `followers` (V39 : abonné de la page au lieu de l'agent de l'administration) ; « compte citoyen » → ancien membre parti du réseau (V35), et pour SEC-04 → personne dont l'effacement est demandé (encore membre, elle ne franchit plus son invitation) ; « devient citoyen » → quitte le réseau fermé de la conférence (V38), la conférence vue par ailleurs étant celle d'un autre réseau ; fil « de poste » (SEC-03) → fil en SUPPRESSION (la portée de poste n'existe pas dans le moteur) ; création qui refuse plus de 200 invités ou 7 intervenants → mêmes bornes à l'ajout (`add`) ; bloquer par `graph/connections.blockPerson` ; cloches lues dans la table `notifications` du réseau ; l'annonce refusée à « Invités seulement » jugée sur `sessions.create` du moteur (règle `LIVE_INVITEES_NOT_ANNOUNCED`). Assertions RETIRÉES de ce fichier : la cloche `live_replay_published` et la cloche d'audience `live_started` du passage en live (et son rejeu `started: false`) — écrites et rendues par le lot des sessions ; l'URL de la rediffusion servie par `sessions.get`. Cas NEUFS : refus indistinct (autre réseau, inconnue, hors audience), débit `live.inviteesAdd`, conférence terminée (`LIVE_ENDED`), vérification bornée (`LIVE_INVITEE_CHECK_TOO_MANY`), page retirée qui ne convie plus personne.
/**
 * LES INVITÉS NOMINATIFS d'une conférence (ADR-0150) — la matrice.
 *
 * Ce que ce fichier tient, dans l'ordre :
 *
 *  1. **L'invité VOIT**, par les portes d'une session : la lecture, le jeton,
 *     la rediffusion. Le non-invité d'une conférence « Invités seulement »
 *     reçoit le refus INDISTINCT.
 *  2. **L'invitation ne franchit JAMAIS** un blocage, une exclusion, un départ
 *     du réseau, un effacement — ni l'audience `followers`.
 *  3. **Un invité vivant est exempté du plafond de spectateurs.**
 *  4. **Les bornes** : 200 invités, 7 intervenants.
 *  5. **L'éligibilité** : connexion acceptée dans le réseau OU co-appartenance
 *     vivante au fil source, prouvée pour l'hôte ET l'invité.
 *  6. **Le passage en live promeut l'intervenant invité et le sonne UNE fois.**
 *  7. **Retirer ferme**, et coupe qui ne voit plus la conférence sans son
 *     invitation.
 *  8. **Gérer la liste** = hôte, ou `changeAudienceOrReplay` (jamais délégué).
 *  9. **Le sélecteur** est borné et ne propose ni non-membres ni bloqués.
 */
import { engineErrorRule } from "@antsia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { assertVisibleDirectSession, directReplayAccessDecision, readerIsLiveInvitee } from "./access"
import {
  assertInviteeCapacity,
  DIRECT_MAX_INVITEES,
  DIRECT_MAX_SPEAKER_INVITEES,
  effectiveReplayVisibility,
  isInviteeAudience,
  isReplayVisibilityAllowed,
  planDirectInvitees,
} from "./domain"
import { ban, caught, codeOf, connect, enter, followPage, groupThread, insertPage, insertSession, joinAlso, type Person, ruleOf, seed, type SessionInput, type T, T0, tick } from "./fixtures.setup"
import { openConferenceToInviteesAtGoLive } from "./invitees"

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

type Cast = {
  t: T
  root: Id<"networks">
  testClosed: Id<"networks">
  /** Page ACTIVE de la racine, dont l'hôte est administrateur vivant. */
  pageId: Id<"pages">
  host: Person
  /** Connexion de l'hôte, hors du cercle de la page. */
  friend: Person
  /** Seconde connexion, jamais invitée. */
  peer: Person
  /** Connexion de l'hôte ET abonnée de la page. */
  colleague: Person
  /** Co-membre d'un fil avec l'hôte, SANS connexion. */
  threadmate: Person
  /** Membre sans aucun lien avec l'hôte. */
  outsider: Person
  /** Second inconnu (capacité). */
  stranger: Person
  /** Connexion de l'hôte PARTIE du réseau : plus membre. */
  departed: Person
  /** A réuni l'hôte et le co-membre dans un fil (connexion de l'hôte). */
  animator: Person
  threadId: Id<"groupThreads">
  /** Un fil dont l'hôte n'est PAS membre. */
  foreignThreadId: Id<"groupThreads">
}

async function setStatus(t: T, networkId: Id<"networks">, person: Person, status: Doc<"networkMemberships">["status"]): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (!row) throw new Error("adhésion inconnue")
    await ctx.db.patch(row._id, { status })
  })
}

async function setup(): Promise<Cast> {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const host = await enter(t, root, "host")
  const friend = await enter(t, root, "friend")
  const peer = await enter(t, root, "peer")
  const colleague = await enter(t, root, "colleague")
  const threadmate = await enter(t, root, "threadmate")
  const outsider = await enter(t, root, "outsider")
  const stranger = await enter(t, root, "stranger")
  const departed = await enter(t, root, "departed")
  const animator = await enter(t, root, "animator")
  const pageId = await insertPage(t, root, host, "page-invites")
  await followPage(t, pageId, colleague)
  for (const person of [friend, peer, colleague, departed]) await connect(t, root, host, person)
  await setStatus(t, root, departed, "partie")
  const threadId = await groupThread(t, root, animator, [host, threadmate], "fil-hote")
  const foreignThreadId = await groupThread(t, root, threadmate, [outsider, stranger], "fil-etranger")
  return { t, root, testClosed, pageId, host, friend, peer, colleague, threadmate, outsider, stranger, departed, animator, threadId, foreignThreadId }
}

/** Une conférence de l'hôte, PROGRAMMÉE par défaut (les invités s'ajoutent avant le live). */
async function conference(c: Cast, audience: NonNullable<SessionInput["audience"]>, opts: Partial<SessionInput> = {}): Promise<Id<"liveSessions">> {
  return await insertSession(c.t, {
    networkId: c.root,
    host: c.host,
    audience,
    status: "scheduled",
    ...(audience === "followers" ? { pageId: c.pageId } : {}),
    ...opts,
  })
}

/**
 * Le passage en live, tel que `sessions.goLive` le joue : la session passe
 * `live`, puis les invités sont ouverts sur la ligne d'AVANT le passage.
 */
async function goLive(t: T, sessionId: Id<"liveSessions">): Promise<string[]> {
  return await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    const now = Date.now()
    await ctx.db.patch(session._id, { status: "live", startedAt: now, updatedAt: now })
    return [...(await openConferenceToInviteesAtGoLive(ctx, session))]
  })
}

async function add(c: Cast, by: Person, sessionId: Id<"liveSessions">, target: Person, stageRole: "viewer" | "speaker" = "viewer", networkId: Id<"networks"> = c.root) {
  return await by.as.mutation(INVITEES.add, { networkId, sessionId, personId: target.personId, stageRole })
}

async function revoke(c: Cast, by: Person, sessionId: Id<"liveSessions">, target: Person, networkId: Id<"networks"> = c.root) {
  return await by.as.mutation(INVITEES.revoke, { networkId, sessionId, personId: target.personId })
}

async function token(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

/** La garde de lecture d'une session (celle de la page, de la découverte et du jeton), sans la lever. */
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

/** Les genres de cloche reçus par une personne pour UNE session, dans le réseau de la session. */
async function bellKinds(t: T, person: Person, sessionId: Id<"liveSessions">): Promise<string[]> {
  return await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", session.networkId).eq("recipientPersonId", person.personId))
      .take(100)
    return rows
      .filter((row) => row.subjectLiveSessionId === sessionId)
      .map((row) => row.kind)
      .sort()
  })
}

/** LA cloche `live_invite` d'une personne pour une session. */
async function inviteBell(t: T, person: Person, sessionId: Id<"liveSessions">): Promise<Doc<"notifications">> {
  const bells = await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", session.networkId).eq("recipientPersonId", person.personId))
      .take(100)
    return rows.filter((row) => row.kind === "live_invite" && row.subjectLiveSessionId === sessionId)
  })
  expect(bells).toHaveLength(1)
  const bell = bells[0]
  if (bell === undefined) throw new Error("cloche attendue absente")
  return bell
}

async function scheduled(t: T) {
  return await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect())
}

/** Les coupures SFU planifiées pour une personne (salles visées). */
async function kicksFor(t: T, person: Person): Promise<string[]> {
  const subject = (await t.run(async (ctx) => ctx.db.get(person.personId)))?.authUserId
  return (await scheduled(t))
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

/** Les intervenants VIVANTS d'une session (l'antenne). */
async function speakerIds(t: T, sessionId: Id<"liveSessions">): Promise<Id<"persons">[]> {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("liveSpeakers")
        .withIndex("by_session_removedAt", (q) => q.eq("sessionId", sessionId).eq("removedAt", undefined))
        .take(20)
    ).map((row) => row.personId),
  )
}

/** La règle enfreinte ET ses bornes, ou `null`. */
async function ruleWithParams(promise: Promise<unknown>) {
  return engineErrorRule(await caught(promise))
}

/** Des personnes posées en base (sans profil ni adhésion) — pour remplir une liste jusqu'à sa borne. */
async function bulkPersons(t: T, prefix: string, count: number): Promise<Id<"persons">[]> {
  return await t.run(async (ctx) => {
    const ids: Id<"persons">[] = []
    for (let index = 0; index < count; index += 1) {
      ids.push(await ctx.db.insert("persons", { authUserId: `${prefix}-${index}`, createdAt: 1, updatedAt: 1 }))
    }
    return ids
  })
}

/** Des lignes d'invités vivants posées en base. */
async function bulkInvite(t: T, sessionId: Id<"liveSessions">, personIds: Id<"persons">[], stageRole: "viewer" | "speaker"): Promise<void> {
  await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    for (const personId of personIds) {
      await ctx.db.insert("liveInvitees", { networkId: session.networkId, sessionId, personId, invitedByPersonId: session.hostPersonId, stageRole, createdAt: 1 })
    }
  })
}

describe("Invités — le domaine pur (bornes, forme, replay)", () => {
  it("dédoublonne, ignore l'hôte, et le rôle intervenant l'emporte", () => {
    expect(
      planDirectInvitees(
        [
          { personId: "a", stageRole: "viewer" },
          { personId: "host", stageRole: "speaker" },
          { personId: "a", stageRole: "speaker" },
          { personId: "b", stageRole: "viewer" },
        ],
        "host",
      ),
    ).toEqual([
      { personId: "a", stageRole: "speaker" },
      { personId: "b", stageRole: "viewer" },
    ])
  })

  it("borne 200 invités et 7 intervenants", () => {
    expect(DIRECT_MAX_INVITEES).toBe(200)
    expect(DIRECT_MAX_SPEAKER_INVITEES).toBe(7)
    expect(() => assertInviteeCapacity({ invitees: 200, speakerInvitees: 7 })).not.toThrow()
    expect(() => assertInviteeCapacity({ invitees: 201, speakerInvitees: 0 })).toThrow("LIVE_INVITEES_TOO_MANY")
    expect(() => assertInviteeCapacity({ invitees: 8, speakerInvitees: 8 })).toThrow("LIVE_SPEAKER_INVITEES_TOO_MANY")
  })

  it("« Invités seulement » garde un replay réservé, qu'on ne peut ni ouvrir ni viser", () => {
    expect(isInviteeAudience("invitees")).toBe(true)
    expect(isInviteeAudience("connections")).toBe(false)
    expect(effectiveReplayVisibility({ audience: "invitees", replayVisibility: "public" })).toBe("invitees")
    expect(isReplayVisibilityAllowed("invitees", "connections")).toBe(false)
    expect(isReplayVisibilityAllowed("public", "invitees")).toBe(false)
    expect(isReplayVisibilityAllowed("invitees", "invitees")).toBe(true)
  })
})

describe("Invités — « Invités seulement » : les portes", () => {
  it("l'invité voit, reçoit un jeton et relit le replay ; le non-invité reçoit le refus indistinct", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend)
    await goLive(c.t, sessionId)

    expect((await token(c.host, c.root, sessionId)).role).toBe("speaker")
    expect((await token(c.friend, c.root, sessionId)).role).toBe("viewer")
    // Une connexion NON invitée n'entre pas : l'audience n'est pas `connections`.
    for (const denied of [c.peer, c.outsider]) {
      expect(await codeOf(token(denied, c.root, sessionId))).toBe("notFound")
      expect(await visible(c.t, c.root, denied, sessionId)).toBe(false)
    }
    expect(await visible(c.t, c.root, c.friend, sessionId)).toBe(true)
    expect(await c.t.run(async (ctx) => readerIsLiveInvitee(ctx, c.friend.personId, (await ctx.db.get(sessionId)) as Doc<"liveSessions">))).toBe(true)

    // Le replay : réservé à l'hôte et à l'invité, une fois PUBLIÉ par l'hôte (ADR-0158).
    await c.t.run(async (ctx) => ctx.db.patch(sessionId, { status: "ended", endedAt: Date.now(), replayStatus: "ready", replayPublication: "published" }))
    const replayDecision = (person: Person) =>
      c.t.run(async (ctx) => directReplayAccessDecision(ctx, person.personId, (await ctx.db.get(sessionId)) as Doc<"liveSessions">))
    expect(await replayDecision(c.friend)).toBe("allowed")
    expect(await replayDecision(c.peer)).toBe("outside_audience")
    // La réserve ne s'ouvre pas après coup.
    expect(isReplayVisibilityAllowed("invitees", "connections")).toBe(false)

    // Une cloche nominative ; personne d'autre n'est sonné.
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])
    expect(await bellKinds(c.t, c.peer, sessionId)).toEqual([])
  }, 30_000)

  it("blocage et exclusion ferment malgré l'invitation", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend)
    await add(c, c.host, sessionId, c.peer)
    await goLive(c.t, sessionId)
    await c.host.as.mutation(api.modules.graph.connections.blockPerson, { networkId: c.root, targetPersonId: c.friend.personId })
    await ban(c.t, sessionId, c.peer)

    expect(await codeOf(token(c.friend, c.root, sessionId))).toBe("notFound")
    expect(await ruleOf(token(c.peer, c.root, sessionId))).toBe("LIVE_EXCLUDED")
    expect(await visible(c.t, c.root, c.friend, sessionId)).toBe(false)
    expect(await visible(c.t, c.root, c.peer, sessionId)).toBe(false)

    // Le blocage COUPE aussi la connexion déjà établie : la continuation
    // planifiée par le blocage examine « Invités seulement » (SEC-01).
    const revocations = (await scheduled(c.t)).filter((job) => job.name === "modules/live/revocation:revokeConnectionDirects")
    expect(revocations.map((job) => job.args[0])).toEqual([{ firstPersonId: c.host.personId, secondPersonId: c.friend.personId }])
    await c.t.mutation(internal.modules.live.revocation.kickUserFromConnectionDirects, { revokedPersonId: c.friend.personId, hostPersonId: c.host.personId, cursor: null })
    expect(await kicksFor(c.t, c.friend)).toContain(await roomOf(c.t, sessionId))
  }, 30_000)

  it("une conférence publique n'est pas coupée par le blocage (hors de ce passage)", async () => {
    const c = await setup()
    const sessionId = await conference(c, "public")
    await add(c, c.host, sessionId, c.friend)
    await goLive(c.t, sessionId)
    await c.host.as.mutation(api.modules.graph.connections.blockPerson, { networkId: c.root, targetPersonId: c.friend.personId })
    await c.t.mutation(internal.modules.live.revocation.kickUserFromConnectionDirects, { revokedPersonId: c.friend.personId, hostPersonId: c.host.personId, cursor: null })
    expect(await kicksFor(c.t, c.friend)).not.toContain(await roomOf(c.t, sessionId))
  }, 30_000)

  it("un invité qui quitte le réseau de la conférence ne franchit plus son invitation, et sa connexion est coupée (V38)", async () => {
    const c = await setup()
    // La conférence réservée vit dans le réseau FERMÉ ; celle qu'il voit par
    // ailleurs (publique) vit à la racine, qu'il ne quitte pas.
    for (const person of [c.host, c.friend]) await joinAlso(c.t, c.testClosed, person)
    await connect(c.t, c.testClosed, c.host, c.friend)
    const sessionId = await insertSession(c.t, { networkId: c.testClosed, host: c.host, audience: "invitees", status: "scheduled" })
    await add(c, c.host, sessionId, c.friend, "viewer", c.testClosed)
    const publicId = await conference(c, "public")
    await add(c, c.host, publicId, c.friend)
    await goLive(c.t, sessionId)
    await goLive(c.t, publicId)
    expect((await token(c.friend, c.testClosed, sessionId)).role).toBe("viewer")
    expect((await token(c.friend, c.root, publicId)).role).toBe("viewer")

    await c.friend.as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: c.testClosed })
    expect(await codeOf(token(c.friend, c.testClosed, sessionId))).toBe("notFound")
    expect(await visible(c.t, c.testClosed, c.friend, sessionId)).toBe(false)

    // Le départ planifie la coupure des directs du réseau ; jouée, elle coupe
    // la conférence réservée, jamais la publique d'un autre réseau.
    const jobs = (await scheduled(c.t)).filter((job) => job.name === "modules/live/revocation:kickUserFromNetworkDirects")
    expect(jobs.map((job) => job.args[0])).toEqual([{ personId: c.friend.personId, networkId: c.testClosed, cursor: null }])
    await c.t.mutation(internal.modules.live.revocation.kickUserFromNetworkDirects, { personId: c.friend.personId, networkId: c.testClosed, cursor: null })
    const kicked = await kicksFor(c.t, c.friend)
    expect(kicked).toContain(await roomOf(c.t, sessionId))
    expect(kicked).not.toContain(await roomOf(c.t, publicId))
  }, 30_000)
})

describe("Invités — ce que l'invitation ne franchit pas", () => {
  it("followers : un invité hors du cercle de la page est refusé, un abonné est accepté", async () => {
    const c = await setup()
    const sessionId = await conference(c, "followers")
    expect(await ruleOf(add(c, c.host, sessionId, c.friend))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")
    expect(await add(c, c.host, sessionId, c.colleague, "speaker")).toEqual({ added: true, updated: false })
    await goLive(c.t, sessionId)
    expect((await token(c.colleague, c.root, sessionId)).role).toBe("speaker")
    expect(await codeOf(token(c.friend, c.root, sessionId))).toBe("notFound")
  }, 30_000)

  it("un ancien membre (parti du réseau) n'est jamais conviable, même encore relié", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    expect(await ruleOf(add(c, c.host, sessionId, c.departed))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")
    const checked = await c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.departed.personId, c.friend.personId] })
    expect(checked.eligible.map((row) => row.personId)).toEqual([c.friend.personId])
  }, 30_000)

  it("l'annonce sur le fil est refusée à « Invités seulement »", async () => {
    const c = await setup()
    const created = c.host.as.mutation(api.modules.live.sessions.create, {
      networkId: c.root,
      title: "Conférence invitees",
      audience: "invitees",
      chatMode: "open",
      invitees: [{ personId: c.friend.personId, stageRole: "speaker" }],
      announce: true,
    })
    expect(await ruleOf(created)).toBe("LIVE_INVITEES_NOT_ANNOUNCED")
  }, 30_000)
})

describe("Invités — capacité et bornes", () => {
  it("un invité vivant est exempté du plafond de spectateurs", async () => {
    const c = await setup()
    const sessionId = await conference(c, "public", { maxViewers: 1 })
    await add(c, c.host, sessionId, c.friend)
    await goLive(c.t, sessionId)

    expect((await token(c.outsider, c.root, sessionId)).role).toBe("viewer")
    expect(await ruleOf(token(c.stranger, c.root, sessionId))).toBe("LIVE_FULL")
    expect((await token(c.friend, c.root, sessionId)).role).toBe("viewer")
  }, 30_000)

  it("une invitation qu'une personne ne peut plus franchir n'exempte plus du plafond (SEC-04)", async () => {
    const c = await setup()
    const sessionId = await conference(c, "public", { maxViewers: 1 })
    await add(c, c.host, sessionId, c.friend)
    await goLive(c.t, sessionId)
    // L'effacement de l'invitée est demandé : sa ligne survit, elle ne la franchit plus.
    await c.t.run(async (ctx) => ctx.db.patch(c.friend.personId, { deletionRequestedAt: Date.now() }))
    expect((await token(c.outsider, c.root, sessionId)).role).toBe("viewer")
    expect(await ruleOf(token(c.friend, c.root, sessionId))).toBe("LIVE_FULL")
    expect(await c.t.run(async (ctx) => readerIsLiveInvitee(ctx, c.friend.personId, (await ctx.db.get(sessionId)) as Doc<"liveSessions">))).toBe(false)
  }, 30_000)

  it("la liste vivante refuse un 201ᵉ invité et un 8ᵉ intervenant (mêmes bornes que la création)", async () => {
    const c = await setup()
    const crowded = await conference(c, "invitees")
    await bulkInvite(c.t, crowded, await bulkPersons(c.t, "foule", DIRECT_MAX_INVITEES), "viewer")
    expect(await ruleWithParams(add(c, c.host, crowded, c.friend))).toEqual({ rule: "LIVE_INVITEES_TOO_MANY", params: { max: DIRECT_MAX_INVITEES } })

    const stage = await conference(c, "invitees")
    await bulkInvite(c.t, stage, await bulkPersons(c.t, "voix", DIRECT_MAX_SPEAKER_INVITEES), "speaker")
    expect(await ruleWithParams(add(c, c.host, stage, c.friend, "speaker"))).toEqual({ rule: "LIVE_SPEAKER_INVITEES_TOO_MANY", params: { max: DIRECT_MAX_SPEAKER_INVITEES } })
    // Un spectateur de plus tient encore dans la liste.
    expect(await add(c, c.host, stage, c.friend, "viewer")).toEqual({ added: true, updated: false })
  }, 60_000)
})

describe("Invités — éligibilité par fil de groupe", () => {
  it("un co-membre du fil source est conviable sans connexion, et promu à l'antenne au passage en live", async () => {
    const c = await setup()
    // Sans le fil : ni connexion ni fil prouvé, refus indistinct.
    const withoutThread = await conference(c, "invitees")
    expect(await ruleOf(add(c, c.host, withoutThread, c.threadmate, "speaker"))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")

    const sessionId = await conference(c, "invitees", { sourceThreadId: c.threadId })
    expect(await add(c, c.host, sessionId, c.threadmate, "speaker")).toEqual({ added: true, updated: false })
    // Rien n'est écrit sur l'antenne avant le live.
    expect(await speakerIds(c.t, sessionId)).toEqual([c.host.personId])
    await goLive(c.t, sessionId)
    expect(await speakerIds(c.t, sessionId)).toContain(c.threadmate.personId)
    expect((await token(c.threadmate, c.root, sessionId)).role).toBe("speaker")
  }, 30_000)

  it("hors fil et hors connexion : refusé ; un fil dont l'hôte n'est pas membre : refus indistinct du fil", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees", { sourceThreadId: c.threadId })
    expect(await ruleOf(add(c, c.host, sessionId, c.outsider))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")
    expect(await codeOf(c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.outsider.personId], sourceThreadId: c.foreignThreadId }))).toBe("notFound")
    expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sourceThreadId: c.foreignThreadId }))).toBe("notFound")
  }, 30_000)

  it("un fil en suppression ne prouve plus aucun lien (SEC-03 : la portée de poste n'existe pas dans le moteur)", async () => {
    const c = await setup()
    // Non-régression : le fil vivant rend le co-membre conviable…
    const before = await c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.threadmate.personId], sourceThreadId: c.threadId })
    expect(before.eligible.map((row) => row.personId)).toEqual([c.threadmate.personId])
    const sessionId = await conference(c, "invitees", { sourceThreadId: c.threadId })
    await add(c, c.host, sessionId, c.threadmate)

    // …un fil en suppression, non.
    await c.t.run(async (ctx) => ctx.db.patch(c.threadId, { deletingAt: Date.now() }))
    expect(await ruleOf(add(c, c.host, sessionId, c.threadmate, "speaker"))).toBe("LIVE_INVITEE_NOT_ELIGIBLE")
    expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sourceThreadId: c.threadId }))).toBe("notFound")
    expect(await codeOf(c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.threadmate.personId], sourceThreadId: c.threadId }))).toBe("notFound")
    // La session née du fil ne le repropose plus.
    const fromSession = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sessionId })
    expect(fromSession.candidates.map((row) => row.personId)).not.toContain(c.threadmate.personId)
  }, 30_000)
})

describe("Invités — vérifier une liste pré-remplie", () => {
  it("rend les seuls éligibles avec leur profil, sans rien dire des autres", async () => {
    const c = await setup()
    const result = await c.host.as.query(INVITEES.checkEligibility, {
      networkId: c.root,
      personIds: [c.friend.personId, c.friend.personId, c.host.personId, c.outsider.personId, c.departed.personId, c.threadmate.personId],
    })
    expect(result.eligible).toEqual([{ personId: c.friend.personId, displayName: "friend", handle: "friend", avatarUrl: null }])
    const withThread = await c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.threadmate.personId, c.outsider.personId], sourceThreadId: c.threadId })
    expect(withThread.eligible.map((row) => row.personId)).toEqual([c.threadmate.personId])
    await c.host.as.mutation(api.modules.graph.connections.blockPerson, { networkId: c.root, targetPersonId: c.friend.personId })
    const afterBlock = await c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.friend.personId] })
    expect(afterBlock.eligible).toEqual([])
    expect(await codeOf(c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: [c.outsider.personId], sourceThreadId: c.foreignThreadId }))).toBe("notFound")
  }, 30_000)
})

describe("Invités — passage en live : promotion et cloche unique", () => {
  it("le passage en live promeut l'invité intervenant, le sonne une seule fois, et rend les invités que l'audience saute", async () => {
    const c = await setup()
    const sessionId = await conference(c, "connections")
    await add(c, c.host, sessionId, c.friend, "speaker")
    expect(await goLive(c.t, sessionId)).toEqual([c.friend.personId])

    expect((await token(c.friend, c.root, sessionId)).role).toBe("speaker")
    expect(await speakerIds(c.t, sessionId)).toContain(c.friend.personId)
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])

    const invitees = await c.host.as.query(INVITEES.listForSession, { networkId: c.root, sessionId })
    expect(invitees.invitees[0]?.notifiedAt).toEqual(expect.any(Number))

    // Rejouer l'ouverture ne re-sonne rien.
    const replayed = await c.t.run(async (ctx) => [...(await openConferenceToInviteesAtGoLive(ctx, (await ctx.db.get(sessionId)) as Doc<"liveSessions">))])
    expect(replayed).toEqual([c.friend.personId])
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])
  }, 30_000)

  it("un invité exclu avant le live n'est ni promu ni sonné", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend, "speaker")
    await ban(c.t, sessionId, c.friend)
    await goLive(c.t, sessionId)
    expect(await speakerIds(c.t, sessionId)).not.toContain(c.friend.personId)
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual([])
  }, 30_000)
})

describe("Invités — ajouter, changer de rôle, retirer", () => {
  it("retirer pendant le live ferme la conférence à qui ne la voyait que par son invitation", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend, "speaker")
    await goLive(c.t, sessionId)
    expect((await token(c.friend, c.root, sessionId)).role).toBe("speaker")

    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: true })
    expect(await codeOf(token(c.friend, c.root, sessionId))).toBe("notFound")
    expect(await speakerIds(c.t, sessionId)).not.toContain(c.friend.personId)
    expect(await visible(c.t, c.root, c.friend, sessionId)).toBe(false)
    expect(await kicksFor(c.t, c.friend)).toContain(await roomOf(c.t, sessionId))
    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: false })

    // Ré-inviter ROUVRE la ligne, et la re-sonne.
    expect(await add(c, c.host, sessionId, c.friend)).toEqual({ added: true, updated: false })
    tick()
    expect((await token(c.friend, c.root, sessionId)).role).toBe("viewer")
    const rows = await c.t.run(async (ctx) =>
      ctx.db
        .query("liveInvitees")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", c.friend.personId))
        .take(5),
    )
    expect(rows).toHaveLength(1)
  }, 30_000)

  it("retirer l'invitation d'une connexion la garde dans la salle, mais la fait redescendre de l'antenne", async () => {
    const c = await setup()
    const sessionId = await conference(c, "connections")
    await add(c, c.host, sessionId, c.friend, "speaker")
    await goLive(c.t, sessionId)
    expect(await speakerIds(c.t, sessionId)).toContain(c.friend.personId)

    await revoke(c, c.host, sessionId, c.friend)
    expect(await speakerIds(c.t, sessionId)).not.toContain(c.friend.personId)
    expect((await token(c.friend, c.root, sessionId)).role).toBe("viewer")
    expect(await kicksFor(c.t, c.friend)).toEqual([])
  }, 30_000)

  it("ajouter est idempotent, changer le rôle met à jour, et un intervenant ajouté pendant le live est promu et sonné", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await goLive(c.t, sessionId)

    expect(await add(c, c.host, sessionId, c.friend)).toEqual({ added: true, updated: false })
    expect(await add(c, c.host, sessionId, c.friend)).toEqual({ added: false, updated: false })
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])

    expect(await add(c, c.host, sessionId, c.friend, "speaker")).toEqual({ added: false, updated: true })
    expect(await speakerIds(c.t, sessionId)).toContain(c.friend.personId)

    await add(c, c.host, sessionId, c.friend, "viewer")
    expect(await speakerIds(c.t, sessionId)).not.toContain(c.friend.personId)
    // Changer de rôle ne re-sonne personne.
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])
  }, 30_000)

  it("un intervenant invité descendu de l'antenne est signalé, et redemander « intervenant » le fait remonter (R3)", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend, "speaker")
    await goLive(c.t, sessionId)
    const listed = async () => (await c.host.as.query(INVITEES.listForSession, { networkId: c.root, sessionId })).invitees[0]
    expect(await listed()).toMatchObject({ stageRole: "speaker", onStage: true })

    // Rétrogradé par la console : la ligne d'antenne est close (écriture durable de `speakers.demote`).
    await c.t.run(async (ctx) => {
      const row = await ctx.db
        .query("liveSpeakers")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", c.friend.personId))
        .unique()
      if (!row) throw new Error("intervenant absent")
      await ctx.db.patch(row._id, { grantEpoch: row.grantEpoch + 1, sfuAppliedAt: undefined, removedAt: Date.now() })
    })
    expect(await speakerIds(c.t, sessionId)).not.toContain(c.friend.personId)
    expect(await listed()).toMatchObject({ stageRole: "speaker", onStage: false })

    expect(await add(c, c.host, sessionId, c.friend, "speaker")).toEqual({ added: false, updated: true })
    expect(await speakerIds(c.t, sessionId)).toContain(c.friend.personId)
    expect(await listed()).toMatchObject({ stageRole: "speaker", onStage: true })
    // Relancer la promotion ne re-sonne personne, et ne rejoue rien de plus.
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual(["live_invite"])
    expect(await add(c, c.host, sessionId, c.friend, "speaker")).toEqual({ added: false, updated: false })
  }, 30_000)

  it("gérer la liste est réservé à l'hôte (changeAudienceOrReplay, jamais délégué)", async () => {
    const c = await setup()
    const sessionId = await conference(c, "connections")
    await add(c, c.host, sessionId, c.colleague)
    await goLive(c.t, sessionId)
    // Un COHÔTE portant tous les drapeaux ne gère pas la portée.
    await c.t.run(async (ctx) =>
      ctx.db.insert("liveDelegations", {
        networkId: c.root,
        sessionId,
        personId: c.friend.personId,
        kind: "cohost",
        canAdmitToStage: true,
        canExclude: true,
        canEndOrTransfer: true,
        grantedByPersonId: c.host.personId,
        grantedAt: Date.now(),
      }),
    )
    for (const person of [c.friend, c.peer]) {
      expect(await codeOf(add(c, person, sessionId, c.threadmate))).toBe("liveRoleRequired")
      expect(await codeOf(revoke(c, person, sessionId, c.colleague))).toBe("liveRoleRequired")
    }
    // Qui ne voit pas la conférence reçoit le refus indistinct.
    expect(await codeOf(add(c, c.outsider, sessionId, c.threadmate))).toBe("notFound")

    const hostList = await c.host.as.query(INVITEES.listForSession, { networkId: c.root, sessionId })
    expect(hostList.canManage).toBe(true)
    expect(hostList.invitees.map((row) => row.personId)).toEqual([c.colleague.personId])
    const inviteeList = await c.colleague.as.query(INVITEES.listForSession, { networkId: c.root, sessionId })
    expect(inviteeList.canManage).toBe(false)
    expect(inviteeList.invitees.map((row) => row.personId)).toEqual([c.colleague.personId])
    expect(await c.friend.as.query(INVITEES.listForSession, { networkId: c.root, sessionId })).toEqual({ canManage: false, invitees: [] })
  }, 30_000)
})

describe("Invités — le sélecteur de candidats", () => {
  it("propose connexions et co-membres du fil, sans moi, sans non-membre ni bloqué, filtré par la recherche", async () => {
    const c = await setup()
    await c.host.as.mutation(api.modules.graph.connections.blockPerson, { networkId: c.root, targetPersonId: c.peer.personId })

    const all = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sourceThreadId: c.threadId })
    const byId = new Map(all.candidates.map((row) => [row.personId, row.source]))
    expect(byId.get(c.threadmate.personId)).toBe("thread")
    expect(byId.get(c.friend.personId)).toBe("connection")
    expect(byId.get(c.colleague.personId)).toBe("connection")
    expect(byId.has(c.host.personId)).toBe(false)
    expect(byId.has(c.departed.personId)).toBe(false)
    expect(byId.has(c.peer.personId)).toBe(false)
    expect(byId.has(c.outsider.personId)).toBe(false)

    const searched = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, search: "@FRIEND" })
    expect(searched.candidates.map((row) => row.personId)).toEqual([c.friend.personId])

    // Un fil dont je ne suis pas membre : refus du fil.
    expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sourceThreadId: c.foreignThreadId }))).toBe("notFound")
    // Pour une conférence : la portée est à l'hôte seul.
    const sessionId = await conference(c, "connections")
    expect(await codeOf(c.friend.as.query(INVITEES.searchCandidates, { networkId: c.root, sessionId }))).toBe("liveRoleRequired")
    // Conférence réservée aux abonnés d'une page : seul son cercle est proposé.
    const pageSession = await conference(c, "followers")
    const pageCandidates = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sessionId: pageSession })
    expect(pageCandidates.candidates.map((row) => row.personId)).toEqual([c.colleague.personId])
  }, 30_000)

  it("rend au plus cinquante candidats", async () => {
    const c = await setup()
    await c.t.run(async (ctx) => {
      for (let index = 0; index < 60; index += 1) {
        const personId = await ctx.db.insert("persons", { authUserId: `lot-${index}`, createdAt: 1, updatedAt: 1 })
        await ctx.db.insert("networkMemberships", { networkId: c.root, personId, status: "declaree", role: "member", joinedAt: 1, statusChangedAt: 1 })
        const [low, high] = personId < c.host.personId ? [personId, c.host.personId] : [c.host.personId, personId]
        await ctx.db.insert("connections", { networkId: c.root, personIdLow: low, personIdHigh: high, requestedByPersonId: c.host.personId, recipientPersonId: personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
      }
    })
    const result = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root })
    expect(result.candidates).toHaveLength(50)
  }, 30_000)

  it("la recherche ne s'épuise pas sur qui ne correspond pas : une connexion au-delà de la 250ᵉ se trouve par son nom (R5)", async () => {
    const c = await setup()
    const target = await enter(c.t, c.root, "cible-lointaine")
    await c.t.run(async (ctx) => {
      for (let index = 0; index < 260; index += 1) {
        const personId = await ctx.db.insert("persons", { authUserId: `foule-${index}`, createdAt: 1, updatedAt: 1 })
        // ⚠️ Paire volontairement NON canonique (hôte toujours en `low`) : le
        // sélecteur lit les deux côtés dans l'ordre `low` puis `high`, ce qui
        // place la cible — seule en `high` — APRÈS la foule, à coup sûr.
        await ctx.db.insert("connections", { networkId: c.root, personIdLow: c.host.personId, personIdHigh: personId, requestedByPersonId: c.host.personId, recipientPersonId: personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
      }
      await ctx.db.insert("connections", { networkId: c.root, personIdLow: target.personId, personIdHigh: c.host.personId, requestedByPersonId: c.host.personId, recipientPersonId: target.personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
    })
    const result = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, search: "cible-lointaine" })
    expect(result.candidates.map((row) => row.personId)).toEqual([target.personId])
  }, 60_000)

  it("pour une conférence, ni l'exclu ni l'invité déjà vivant ne se reproposent (R7)", async () => {
    const c = await setup()
    const sessionId = await conference(c, "connections")
    await add(c, c.host, sessionId, c.colleague)
    await ban(c.t, sessionId, c.peer)
    const result = await c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sessionId })
    const ids = result.candidates.map((row) => row.personId)
    expect(ids).toContain(c.friend.personId)
    expect(ids).not.toContain(c.peer.personId)
    expect(ids).not.toContain(c.colleague.personId)
  }, 30_000)
})

describe("Invités — retirer solde la cloche (CH-094)", () => {
  it("retirer résout `cancelled` ; ré-inviter pendant le live rouvre la MÊME cloche", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend)
    await goLive(c.t, sessionId)
    expect((await inviteBell(c.t, c.friend, sessionId)).resolution).toBeUndefined()

    tick()
    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: true })
    const retiree = await inviteBell(c.t, c.friend, sessionId)
    expect(retiree.resolution).toBe("cancelled")
    expect(retiree.resolvedAt).toEqual(expect.any(Number))
    expect(retiree.readAt).toBe(retiree.resolvedAt)

    // Rejouer le retrait ne réécrit rien.
    tick()
    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: false })
    expect((await inviteBell(c.t, c.friend, sessionId)).resolvedAt).toBe(retiree.resolvedAt)

    // Ré-inviter pendant le live re-sonne : invitation neuve, cloche rouverte.
    await add(c, c.host, sessionId, c.friend)
    const reopened = await inviteBell(c.t, c.friend, sessionId)
    expect(reopened._id).toBe(retiree._id)
    expect(reopened.resolution).toBeUndefined()
    expect(reopened.readAt).toBeUndefined()
  }, 30_000)

  it("retirer l'invité d'une conférence PROGRAMMÉE n'invente aucune cloche", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    await add(c, c.host, sessionId, c.friend)
    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: true })
    expect(await bellKinds(c.t, c.friend, sessionId)).toEqual([])
  }, 30_000)
})

describe("Invités — refus du moteur (cas neufs des adaptations)", () => {
  it("une session d'un autre réseau, inconnue ou hors audience : le MÊME `notFound`, sur chaque porte", async () => {
    const c = await setup()
    await joinAlso(c.t, c.testClosed, c.host)
    const elsewhere = await insertSession(c.t, { networkId: c.testClosed, host: c.host, audience: "public", status: "scheduled" })
    const gone = await conference(c, "public")
    await c.t.run(async (ctx) => ctx.db.delete(gone))
    const reserved = await conference(c, "invitees")
    // La session du réseau fermé, gérée au nom de la racine : introuvable, même pour son hôte.
    for (const sessionId of [elsewhere, gone]) {
      expect(await codeOf(add(c, c.host, sessionId, c.friend))).toBe("notFound")
      expect(await codeOf(revoke(c, c.host, sessionId, c.friend))).toBe("notFound")
      expect(await codeOf(c.host.as.query(INVITEES.listForSession, { networkId: c.root, sessionId }))).toBe("notFound")
      expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, sessionId }))).toBe("notFound")
    }
    expect(await codeOf(c.friend.as.query(INVITEES.listForSession, { networkId: c.root, sessionId: reserved }))).toBe("notFound")
  }, 30_000)

  it("débit `live.inviteesAdd` (D14) : au-delà de la rafale, `rateLimited` ; retirer ne consomme rien", async () => {
    const c = await setup()
    const sessionId = await conference(c, "invitees")
    for (let attempt = 0; attempt < 20; attempt += 1) await add(c, c.host, sessionId, c.friend)
    expect(await codeOf(add(c, c.host, sessionId, c.friend))).toBe("rateLimited")
    expect(await revoke(c, c.host, sessionId, c.friend)).toEqual({ revoked: true })
  }, 30_000)

  it("une conférence terminée ne convie plus (`LIVE_ENDED`) ; une page retirée ne convie plus personne", async () => {
    const c = await setup()
    const ended = await conference(c, "public", { status: "ended" })
    expect(await ruleOf(add(c, c.host, ended, c.friend))).toBe("LIVE_ENDED")

    const pageSession = await conference(c, "followers")
    await c.t.run(async (ctx) => ctx.db.patch(c.pageId, { status: "inactive", deactivatedAt: Date.now() }))
    // La conférence disparaît pour tous, hôte compris : sa gestion aussi.
    expect(await codeOf(add(c, c.host, pageSession, c.colleague))).toBe("notFound")
  }, 30_000)

  it("vérifier une liste est borné à deux cents personnes (`LIVE_INVITEE_CHECK_TOO_MANY`)", async () => {
    const c = await setup()
    const many = await bulkPersons(c.t, "verif", DIRECT_MAX_INVITEES + 1)
    expect(await ruleOf(c.host.as.query(INVITEES.checkEligibility, { networkId: c.root, personIds: many }))).toBe("LIVE_INVITEE_CHECK_TOO_MANY")
  }, 30_000)
})


describe("F3c — invités du brouillon followers", () => {
  it("ne propose plus de page officielle après perte de l'identité forte", async () => {
    const c = await setup()
    expect((await c.host.as.query(api.modules.pages.pages.myPages, { networkId: c.root })).some((page) => page.pageId === c.pageId)).toBe(true)
    await c.t.run(async (ctx) => { await ctx.db.patch(c.pageId, { trust: "official", ownerKind: "institution" }) })
    expect(await c.host.as.query(api.modules.pages.pages.myPages, { networkId: c.root })).toEqual([])
    expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.root, followersPageId: c.pageId }))).toBe("pageRoleRequired")
  })
  it("rejuge le cercle avant la création, puis après le désabonnement", async () => {
    const c = await setup()
    const args = { networkId: c.root, followersPageId: c.pageId }
    expect((await c.host.as.query(INVITEES.searchCandidates, args)).candidates.map((person) => person.personId)).toEqual([c.colleague.personId])
    expect((await c.host.as.query(INVITEES.checkEligibility, { ...args, personIds: [c.friend.personId, c.colleague.personId] })).eligible.map((person) => person.personId)).toEqual([c.colleague.personId])
    await c.colleague.as.mutation(api.modules.pages.pages.unfollow, { networkId: c.root, pageId: c.pageId })
    expect((await c.host.as.query(INVITEES.checkEligibility, { ...args, personIds: [c.colleague.personId] })).eligible).toEqual([])
  })
  it("refuse le contexte de page à un non-signataire et depuis un autre réseau", async () => {
    const c = await setup()
    expect(await codeOf(c.friend.as.query(INVITEES.searchCandidates, { networkId: c.root, followersPageId: c.pageId }))).toBe("pageRoleRequired")
    expect(await codeOf(c.friend.as.query(INVITEES.checkEligibility, { networkId: c.root, followersPageId: c.pageId, personIds: [c.colleague.personId] }))).toBe("pageRoleRequired")
    await joinAlso(c.t, c.testClosed, c.host)
    expect(await codeOf(c.host.as.query(INVITEES.searchCandidates, { networkId: c.testClosed, followersPageId: c.pageId }))).toBe("notFound")
  })
})
