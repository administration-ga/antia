// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/antenna.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, personnes entrées dans la racine, relations ACCEPTÉES posées par l'outillage, blocage par `graph.connections.blockPerson`) ; conférences POSÉES EN BASE et en direct par l'outillage de la fondation (`insertSession`) au lieu de `sessions.create` + `goLive`, et fin posée en base au lieu de `sessions.end` (gestes du lot des sessions, testés là-bas) ; jeton par `access.authorizeToken` au nom de la personne (identité de l'action, réseau en argument) ; codes et règles au lieu des libellés (`notFound`, `rateLimited`, `LIVE_*`) ; instant de lecture fourni aux queries (`now`, D16) ; cloche lue dans `notifications` (genre `live_antenna_invite`, sujet `subjectLiveSessionId`) ; action SFU planifiée sous `modules/live/livekitActions:applyDirectSfuState`, sujet = `authUserId` de la personne ; nom publié distinct de l'identifiant posé sur la personne pour la recherche par nom ; « audience organisation (D-10) » RÉÉCRIT sur l'audience `followers` (V36 : une relation hors du cercle de la page n'est pas invitable) ; cas NEUFS : conférence d'un autre réseau introuvable (main, console, invitation, réponse), main d'un membre parti du réseau retirée de la console (V35), débit `live.antennaInvite` par hôte (D14), instant de lecture de l'écran (D16), cible membre EN ATTENTE ni proposée par la console ni invitable (refus du même code, aucune ligne, aucune cloche) jusqu'à son adhésion déclarée.
/**
 * L'ANTENNE participative d'un direct — régressions de sécurité.
 *
 * Ce que ce fichier tient, dans l'ordre d'importance :
 *  1. une main ne se lève, ne se lit et ne se tranche que DANS l'audience
 *     (refus indistinct), depuis le réseau de la conférence ;
 *  2. accepter ouvre un rôle DURABLE, puis planifie l'expulsion de l'ancienne
 *     identité — jamais un JWT viewer transformé à chaud ;
 *  3. l'invitation ne s'élargit pas (relation acceptée avec l'HÔTE, audience,
 *     blocage, exclusion), et la console dit l'état de chaque personne ;
 *  4. la cloche d'une invitation suit sa réponse (CH-094).
 *
 * ⚠️ Comme au socle, on ne fait JAMAIS tourner le planificateur : on lit
 * `_scheduled_functions`, la seule chose qu'une mutation puisse promettre.
 */
import { DIRECT_INVITATION_TTL_MS } from "@antsia/social-domain/live/domain"
import type { FunctionReturnType } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { codeOf, connect, enter, followPage, insertPage, insertSession, joinAlso, type Person, ruleOf, seed, type T, T0 } from "./fixtures.setup"

const A = api.modules.live.antenna
const S = api.modules.live.speakers
const authorizeToken = internal.modules.live.access.authorizeToken

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

/** La graine, l'hôte (alice) et un spectateur (bob), entrés dans la racine. */
async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  return { t, root, testClosed, alice, bob }
}

/** Une conférence EN COURS, posée en base (le passage en direct est du lot des sessions). */
async function liveDirect(t: T, networkId: Id<"networks">, host: Person, audience: "public" | "connections" = "public"): Promise<Id<"liveSessions">> {
  return await insertSession(t, { networkId, host, audience, title: "Antenne citoyenne" })
}

/** La conférence se termine — posée en base (`sessions.end` a ses propres tests). */
async function endSession(t: T, sessionId: Id<"liveSessions">): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.patch(sessionId, { status: "ended", endedAt: now, endReason: "host", updatedAt: now })
  })
}

/** Autorisation serveur du jeton, sans construire un vrai JWT LiveKit. */
async function authorize(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

const hostStateOf = (networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) => person.as.query(A.hostState, { networkId, sessionId, now: Date.now() })
const myStateOf = (networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) => person.as.query(A.myState, { networkId, sessionId, now: Date.now() })

async function setMembershipStatus(t: T, networkId: Id<"networks">, person: Person, status: "en_attente" | "declaree" | "suspendue" | "partie") {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (!row) throw new Error("adhésion inconnue")
    await ctx.db.patch(row._id, { status })
  })
}

async function requestRow(t: T, sessionId: Id<"liveSessions">, person: Person) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("liveAntennaRequests")
      .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", person.personId))
      .unique(),
  )
}

async function speakerRow(t: T, sessionId: Id<"liveSessions">, person: Person) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("liveSpeakers")
      .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", person.personId))
      .unique(),
  )
}

async function invitationRowOf(t: T, sessionId: Id<"liveSessions">, person: Person) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("liveAntennaInvitations")
      .withIndex("by_session_invitee", (q) => q.eq("sessionId", sessionId).eq("inviteePersonId", person.personId))
      .unique(),
  )
}

async function scheduledSfuJobs(t: T) {
  const jobs = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(200))
  return jobs.filter((job) => job.name === "modules/live/livekitActions:applyDirectSfuState")
}

/** Des intervenants de remplissage — personnes posées en base, sans profil ni adhésion. */
async function fillSpeakers(t: T, sessionId: Id<"liveSessions">, count: number): Promise<void> {
  await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    for (let index = 0; index < count; index += 1) {
      const personId = await ctx.db.insert("persons", { authUserId: `remplissage-${index}`, createdAt: 1, updatedAt: 1 })
      await ctx.db.insert("liveSpeakers", {
        networkId: session.networkId,
        sessionId,
        personId,
        role: "speaker",
        grantEpoch: 1,
        addedAt: Date.now() + index,
      })
    }
  })
}

/** Les cloches d'invitation à l'antenne d'une personne pour une session. */
async function antennaBells(t: T, networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", networkId).eq("recipientPersonId", person.personId))
      .take(100)
    return rows.filter((row) => row.kind === "live_antenna_invite" && row.subjectLiveSessionId === sessionId)
  })
}

describe("antenne participative — demande spectateur", () => {
  it("ne crée ni ne révèle de demande hors audience", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice, "connections")

    expect(await codeOf(authorize(bob, root, sessionId))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(A.raiseHand, { networkId: root, sessionId }))).toBe("notFound")
    expect(await codeOf(myStateOf(root, bob, sessionId))).toBe("notFound")
    expect(await requestRow(t, sessionId, bob)).toBeNull()
  })

  it("exige une admission viewer, déduplique, annule et borne le débit", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)

    expect(await ruleOf(bob.as.mutation(A.raiseHand, { networkId: root, sessionId }))).toBe("LIVE_JOIN_AS_VIEWER_FIRST")

    await authorize(bob, root, sessionId)
    const first = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    const replay = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    expect(replay.requestId).toBe(first.requestId)
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("liveAntennaRequests")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
        .take(10),
    )
    expect(rows).toHaveLength(1)

    await expect(bob.as.mutation(A.cancelHand, { networkId: root, sessionId })).resolves.toEqual({ cancelled: true })
    await expect(bob.as.mutation(A.cancelHand, { networkId: root, sessionId })).resolves.toEqual({ cancelled: false })

    // capacité 2 : la première levée a consommé un jeton ; la réouverture,
    // un second. Une troisième intention après annulation est refusée.
    await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await bob.as.mutation(A.cancelHand, { networkId: root, sessionId })
    expect(await codeOf(bob.as.mutation(A.raiseHand, { networkId: root, sessionId }))).toBe("rateLimited")
  })

  it("accepte atomiquement un viewer public et exige un nouveau jeton speaker", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })

    await expect(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: true })
    await expect(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" })).resolves.toEqual({ changed: false, promoted: false })

    expect((await authorize(bob, root, sessionId)).role).toBe("speaker")
    const mine = await myStateOf(root, bob, sessionId)
    expect(mine).toMatchObject({
      request: { requestId, status: "accepted" },
      shouldJoinAsSpeaker: true,
    })

    const jobs = await scheduledSfuJobs(t)
    const promotion = jobs.find((job) => job.args[0]?.speakerId !== undefined)
    // Le sujet visé est celui de l'identité de l'action du jeton : `authUserId`.
    expect(promotion?.args[0]).toMatchObject({ mode: "rejoin", disconnectRole: "viewer", subject: "auth-bob" })
    expect(must(await requestRow(t, sessionId, bob)).status).toBe("accepted")
  })

  it("refuse sans promouvoir et interdit toute décision après la fin", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "declined" })
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
    expect(must(await requestRow(t, sessionId, bob)).status).toBe("declined")

    // Nouvelle demande, puis clôture : aucune transition résiduelle.
    await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await endSession(t, sessionId)
    expect(await ruleOf(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "declined" }))).toBe("LIVE_ENDED")
    expect(await ruleOf(bob.as.mutation(A.cancelHand, { networkId: root, sessionId }))).toBe("LIVE_ENDED")
  })

  it("tient le plafond de huit sans trancher la demande en cas d'échec", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })

    // L'hôte existe déjà ; sept lignes vivantes remplissent exactement les
    // huit places. L'acceptation et son changement de statut sont une seule
    // transaction : si le rôle refuse, la demande reste pending.
    await fillSpeakers(t, sessionId, 7)
    expect(await ruleOf(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" }))).toBe("LIVE_STAGE_FULL")
    expect(must(await requestRow(t, sessionId, bob)).status).toBe("pending")
  })

  it("retire de la file une main déjà satisfaite par la promotion Direct existante", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })

    await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(await scheduledSfuJobs(t)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: [expect.objectContaining({ mode: "rejoin", disconnectRole: "viewer" })],
        }),
      ]),
    )
    const stateBeforeResponse = await hostStateOf(root, alice, sessionId)
    expect(stateBeforeResponse.requests).toHaveLength(0)

    await expect(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "declined" })).resolves.toEqual({ changed: true, promoted: false })
    expect(must(await requestRow(t, sessionId, bob)).status).toBe("accepted")
    await expect(bob.as.mutation(A.cancelHand, { networkId: root, sessionId })).resolves.toEqual({ cancelled: false })
  })

  it("invalide une action SFU dès qu'une époque plus récente change le rôle", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const session = must(await t.run(async (ctx) => ctx.db.get(sessionId)))

    await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    const promoted = must(await speakerRow(t, sessionId, bob))
    const transition = {
      speakerId: promoted._id,
      epoch: promoted.grantEpoch,
      roomName: session.roomName,
      subject: "auth-bob",
    }
    const isCurrent = internal.modules.live.speakers.isSfuRejoinCurrent
    await expect(t.query(isCurrent, { ...transition, disconnectRole: "viewer" })).resolves.toBe(true)

    await alice.as.mutation(S.demote, { networkId: root, sessionId, targetPersonId: bob.personId })
    const demoted = must(await speakerRow(t, sessionId, bob))
    await expect(t.query(isCurrent, { ...transition, disconnectRole: "viewer" })).resolves.toBe(false)
    await expect(t.query(isCurrent, { ...transition, epoch: demoted.grantEpoch, disconnectRole: "speaker" })).resolves.toBe(true)

    await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    await expect(t.query(isCurrent, { ...transition, epoch: demoted.grantEpoch, disconnectRole: "speaker" })).resolves.toBe(false)
  })

  it("NEUF — la main d'un membre qui a QUITTÉ le réseau sort de la console, et il ne la retouche plus (V35)", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    expect((await hostStateOf(root, alice, sessionId)).requests.map((row) => row.personId)).toEqual([bob.personId])

    await setMembershipStatus(t, root, bob, "partie")
    // Relu comme s'il demandait maintenant : hors du réseau, hors de la salle.
    expect((await hostStateOf(root, alice, sessionId)).requests).toEqual([])
    expect(await codeOf(bob.as.mutation(A.cancelHand, { networkId: root, sessionId }))).toBe("notFound")
  })
})

describe("antenne participative — invitations et révocation", () => {
  it("invite une relation par handle, déduplique la cloche et conserve la réponse", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const hand = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })

    const first = await alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "bob" })
    const replay = await alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "bob" })
    expect(replay.invitationId).toBe(first.invitationId)
    const mine = await myStateOf(root, bob, sessionId)
    expect(mine.invitation).toEqual({ invitationId: first.invitationId, status: "pending" })

    const bells = await antennaBells(t, root, bob, sessionId)
    expect(bells).toHaveLength(1)
    expect(bells[0]).toMatchObject({ actorPersonId: alice.personId, subjectLiveSessionId: sessionId })

    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId: first.invitationId, response: "accepted" })).resolves.toEqual({
      changed: true,
      promoted: true,
    })
    expect((await authorize(bob, root, sessionId)).role).toBe("speaker")
    expect(must(await requestRow(t, sessionId, bob))).toMatchObject({ _id: hand.requestId, status: "accepted" })
    const host = await hostStateOf(root, alice, sessionId)
    expect(host.requests).toHaveLength(0)
    expect(host.invitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invitationId: first.invitationId,
          status: "accepted",
          profile: expect.objectContaining({ handle: "bob" }),
        }),
      ]),
    )
  })

  it("rend le refus explicite, mais bloque les cibles hors du lien sûr", async () => {
    const { t, root, alice, bob } = await cast()
    await enter(t, root, "carla")
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)

    for (const handle of ["alice", "carla", "fantome"]) {
      expect(await ruleOf(alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
    }

    const invitation = await alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "bob" })
    await bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId: invitation.invitationId, response: "declined" })
    let host = await hostStateOf(root, alice, sessionId)
    expect(host.invitations[0]?.status).toBe("declined")

    // Rouvrir garde la même ligne ; bloquer referme la session et retire la
    // cible de la console sans révéler si elle y avait une invitation.
    const reopened = await alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "bob" })
    expect(reopened.invitationId).toBe(invitation.invitationId)
    await bob.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: alice.personId })
    expect(await codeOf(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId: invitation.invitationId, response: "accepted" }))).toBe("notFound")
    host = await hostStateOf(root, alice, sessionId)
    expect(host.invitations).toHaveLength(0)
  })

  it("filtre un viewer banni et protège l'hôte et la sortie speaker", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    const host = await hostStateOf(root, alice, sessionId)
    expect(host.requests).toHaveLength(0)
    expect(await codeOf(myStateOf(root, bob, sessionId))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(A.cancelHand, { networkId: root, sessionId }))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" }))).toBe("notFound")
    expect(await ruleOf(alice.as.mutation(A.leaveAntenna, { networkId: root, sessionId }))).toBe("LIVE_HOST_STAYS_ON_STAGE")
    expect(await ruleOf(alice.as.mutation(S.demote, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_STAYS_ON_STAGE")
  })

  it("sort un intervenant, révoque l'ancien speaker et rend le prochain jeton viewer", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const request = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await alice.as.mutation(A.respondToRequest, { networkId: root, requestId: request.requestId, response: "accepted" })
    await expect(bob.as.mutation(A.leaveAntenna, { networkId: root, sessionId })).resolves.toEqual({ left: true })
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
    expect(await ruleOf(bob.as.mutation(A.leaveAntenna, { networkId: root, sessionId }))).toBe("LIVE_NOT_ON_STAGE")

    const jobs = await scheduledSfuJobs(t)
    expect(jobs.some((job) => job.args[0]?.mode === "rejoin" && job.args[0]?.disconnectRole === "speaker")).toBe(true)
  })

  it("NEUF — une conférence d'un AUTRE réseau est introuvable depuis celui-ci : main, console, invitation, réponse", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    await connect(t, testClosed, alice, bob)
    const elsewhere = await liveDirect(t, testClosed, alice)
    await authorize(bob, testClosed, elsewhere)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: testClosed, sessionId: elsewhere })

    // Demandée au nom de la racine, la conférence du réseau fermé n'existe pas — pas même pour son hôte.
    expect(await codeOf(bob.as.mutation(A.raiseHand, { networkId: root, sessionId: elsewhere }))).toBe("notFound")
    expect(await codeOf(hostStateOf(root, alice, elsewhere))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId: elsewhere, handle: "bob" }))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" }))).toBe("notFound")
    // Depuis son réseau, le même geste passe.
    await expect(alice.as.mutation(A.respondToRequest, { networkId: testClosed, requestId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: true })
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
 * D-10 — QUI l'hôte peut inviter, et ce que l'écran a le droit d'en dire
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La console tirait un annuaire de groupe (200 lignes, aucun état) dans un
 * `<datalist>` : elle proposait donc des personnes que le serveur refusait
 * ensuite, sans motif. Ces tests gardent les deux moitiés du correctif — la
 * liste DIT l'état, et l'éligibilité ne s'élargit pas.
 */

const PAGE = { cursor: null, numItems: 50 }

async function inviteCandidates(networkId: Id<"networks">, host: Person, sessionId: Id<"liveSessions">, query = "") {
  const pages = await Promise.all(
    (["low", "high"] as const).map((side) => host.as.query(A.searchInviteCandidates, { networkId, sessionId, side, query, now: Date.now(), paginationOpts: PAGE })),
  )
  return pages.flatMap((result) => result.page)
}

async function stateOf(networkId: Id<"networks">, host: Person, sessionId: Id<"liveSessions">, person: Person): Promise<string | undefined> {
  const rows = await inviteCandidates(networkId, host, sessionId)
  return rows.find((row) => row.personId === person.personId)?.state
}

describe("antenne participative — candidats à l'invitation (D-10)", () => {
  it("rend l'état de chaque relation, et n'expose JAMAIS une non-relation", async () => {
    const { t, root, alice, bob } = await cast()
    const carla = await enter(t, root, "carla")
    const dora = await enter(t, root, "dora")
    const elie = await enter(t, root, "elie")
    const fara = await enter(t, root, "fara")
    for (const person of [bob, dora, elie, fara]) await connect(t, root, alice, person)
    const sessionId = await liveDirect(t, root, alice)

    // dora : invitée, sans réponse. elie : déjà à l'antenne. fara : main levée.
    await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: dora.personId })
    await authorize(elie, root, sessionId)
    const elieHand = await elie.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await alice.as.mutation(A.respondToRequest, { networkId: root, requestId: elieHand.requestId, response: "accepted" })
    await authorize(fara, root, sessionId)
    await fara.as.mutation(A.raiseHand, { networkId: root, sessionId })

    const rows = await inviteCandidates(root, alice, sessionId)
    const states = new Map(rows.map((row) => [row.personId, row.state]))
    expect(states.get(bob.personId)).toBe("eligible")
    expect(states.get(dora.personId)).toBe("invited_pending")
    expect(states.get(elie.personId)).toBe("on_stage")
    expect(states.get(fara.personId)).toBe("hand_raised")
    // ⚠️ Carla est publiée et le direct est PUBLIC : elle peut le regarder.
    // Elle n'est pas une relation, donc elle n'est pas proposée — même en la
    // cherchant par son nom. C'est ADR-0061, et rien ne l'élargit ici.
    expect(states.has(carla.personId)).toBe(false)
    expect(await inviteCandidates(root, alice, sessionId, "carla")).toHaveLength(0)
    // L'invitation en cours est rendue AVEC son identifiant : sans lui, la
    // console ne saurait pas quoi retirer.
    expect(rows.find((row) => row.personId === dora.personId)?.invitationId).not.toBeNull()

    // Une exclusion se voit, elle aussi — et le bouton ne sera pas proposé.
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(await stateOf(root, alice, sessionId, bob)).toBe("banned")
  })

  it("cherche par nom comme par identifiant, sans casse ni arobase", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    // Le nom publié se distingue de l'identifiant : la recherche porte sur les deux.
    await t.run(async (ctx) => ctx.db.patch(bob.personId, { displayName: "Nom publié bob" }))
    const sessionId = await liveDirect(t, root, alice)

    for (const query of ["BOB", "@bob", "nom publié bob", "  bob "]) {
      const rows = await inviteCandidates(root, alice, sessionId, query)
      expect(rows.map((row) => row.personId)).toEqual([bob.personId])
    }
    expect(await inviteCandidates(root, alice, sessionId, "zzz")).toEqual([])
  })

  it("pagine par côté sans jamais rendre deux fois la même personne", async () => {
    const { t, root, alice } = await cast()
    const expected: string[] = []
    for (let index = 0; index < 5; index += 1) {
      const pair = await enter(t, root, `pair-${index}`)
      await connect(t, root, alice, pair)
      expected.push(pair.personId)
    }
    const sessionId = await liveDirect(t, root, alice)

    // Deux par page, curseur natif suivi jusqu'au bout — sur les DEUX côtés de
    // la paire canonique, puisqu'une exécution ne porte qu'une pagination.
    const seen: string[] = []
    for (const side of ["low", "high"] as const) {
      let cursor: string | null = null
      for (let guard = 0; guard < 10; guard += 1) {
        // Annotation explicite : `cursor` est réassigné depuis `page`, ce qui
        // boucle l'inférence de l'initialiseur (TS7022) sans elle.
        const page: FunctionReturnType<typeof A.searchInviteCandidates> = await alice.as.query(A.searchInviteCandidates, {
          networkId: root,
          sessionId,
          side,
          query: "",
          now: Date.now(),
          paginationOpts: { cursor, numItems: 2 },
        })
        for (const row of page.page) seen.push(row.personId)
        if (page.isDone) break
        cursor = page.continueCursor
      }
    }
    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort()).toEqual([...expected].sort())
  })

  it("est la console de l'HÔTE : un spectateur ne l'obtient pas", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)

    expect(await codeOf(bob.as.query(A.searchInviteCandidates, { networkId: root, sessionId, side: "low", query: "", now: Date.now(), paginationOpts: PAGE }))).toBe("notFound")
    expect(await codeOf(bob.as.query(A.inviteStatesForUsers, { networkId: root, sessionId, personIds: [bob.personId], now: Date.now() }))).toBe("notFound")
  })

  it("inviteUser refuse EXACTEMENT ce que refusait inviteByHandle", async () => {
    const { t, root, alice, bob } = await cast()
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)

    // Soi-même, une non-relation : le même refus indistinct qu'au handle.
    for (const target of [alice, carla]) {
      expect(await ruleOf(alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: target.personId }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
    }

    const first = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    // Rejouer ne crée rien et ne resonne pas — invariant du premier jour.
    const replay = await alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "bob" })
    expect(replay.invitationId).toBe(first.invitationId)
    expect(await antennaBells(t, root, bob, sessionId)).toHaveLength(1)

    // Déjà à l'antenne : plus rien à proposer.
    await bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId: first.invitationId, response: "accepted" })
    expect(await stateOf(root, alice, sessionId, bob)).toBe("on_stage")
    expect(await ruleOf(alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
  })

  it("retirer une invitation n'est pas un refus de l'invité, et ne libère rien", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(alice.as.mutation(A.revokeInvitation, { networkId: root, invitationId })).resolves.toEqual({ changed: true })
    // Idempotente : retirer deux fois n'écrit qu'une fois.
    await expect(alice.as.mutation(A.revokeInvitation, { networkId: root, invitationId })).resolves.toEqual({ changed: false })

    const host = await hostStateOf(root, alice, sessionId)
    expect(host.invitations[0]).toMatchObject({ invitationId, status: "revoked" })
    // ⚠️ « Retirée » n'est PAS « Refusée » : l'invité n'a rien dit.
    expect(host.invitations[0]?.status).not.toBe("declined")
    const mine = await myStateOf(root, bob, sessionId)
    expect(mine.invitation?.status).toBe("revoked")
    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId, response: "accepted" })).resolves.toEqual({ changed: false, promoted: false })
    // La personne redevient invitable : l'historique n'occupe pas de place.
    expect(await stateOf(root, alice, sessionId, bob)).toBe("eligible")
    expect(host.speakers.filter((row) => !row.isHost)).toHaveLength(0)
  })

  it("une invitation sans réponse expire — et l'expiration se dit, elle ne se devine pas", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    await t.run(async (ctx) => ctx.db.patch(invitationId, { updatedAt: Date.now() - DIRECT_INVITATION_TTL_MS - 1 }))

    // Lue AVANT toute écriture : la console et l'invité voient le même fait.
    const host = await hostStateOf(root, alice, sessionId)
    expect(host.invitations[0]?.status).toBe("expired")
    const mine = await myStateOf(root, bob, sessionId)
    expect(mine.invitation?.status).toBe("expired")
    expect(await stateOf(root, alice, sessionId, bob)).toBe("eligible")

    expect(await ruleOf(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId, response: "accepted" }))).toBe("LIVE_INVITATION_EXPIRED")
    // ⚠️ La LIGNE reste `pending` en base, et c'est voulu : une mutation qui
    // refuse annule ses écritures, donc « marquer expirée puis lever » ne
    // marquerait rien. L'expiration est dérivée à la lecture — aucune des
    // trois surfaces ci-dessus ne croit ce `pending`.
    expect(must(await invitationRowOf(t, sessionId, bob)).status).toBe("pending")

    // Relancer repart de la MÊME ligne, avec une nouvelle cloche.
    const relance = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(relance.invitationId).toBe(invitationId)
    expect(await stateOf(root, alice, sessionId, bob)).toBe("invited_pending")
  })

  it("NEUF — l'instant de lecture vient de l'ÉCRAN (D16) : la même ligne est ouverte avant son délai, expirée après, sans écriture", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    const at = (now: number) => bob.as.query(A.myState, { networkId: root, sessionId, now })

    expect((await at(Date.now())).invitation).toEqual({ invitationId, status: "pending" })
    expect((await at(Date.now() + DIRECT_INVITATION_TTL_MS)).invitation).toEqual({ invitationId, status: "expired" })
    expect(must(await invitationRowOf(t, sessionId, bob)).status).toBe("pending")
  })

  it("deux admissions pour la DERNIÈRE place : le serveur tranche, l'autre reste en attente", async () => {
    const { t, root, alice, bob } = await cast()
    const dora = await enter(t, root, "dora")
    await connect(t, root, alice, bob)
    await connect(t, root, alice, dora)
    const sessionId = await liveDirect(t, root, alice)
    const invitations = {
      bob: (await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })).invitationId,
      dora: (await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: dora.personId })).invitationId,
    }
    // L'hôte occupe déjà une place ; six remplissages laissent la DERNIÈRE.
    await fillSpeakers(t, sessionId, 6)

    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId: invitations.bob, response: "accepted" })).resolves.toEqual({
      changed: true,
      promoted: true,
    })
    expect(await ruleOf(dora.as.mutation(A.respondToInvitation, { networkId: root, invitationId: invitations.dora, response: "accepted" }))).toBe("LIVE_STAGE_FULL")

    // Le refus n'a rien écrit : l'invitation de dora est intacte, donc
    // rejouable dès qu'une place se libère.
    expect(must(await invitationRowOf(t, sessionId, dora)).status).toBe("pending")
    expect(await stateOf(root, alice, sessionId, dora)).toBe("invited_pending")
    expect(await stateOf(root, alice, sessionId, bob)).toBe("on_stage")
  })

  it("l'état d'un commentateur vient du SERVEUR, jamais d'un handle deviné", async () => {
    const { t, root, alice, bob } = await cast()
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)

    // Carla commente un direct PUBLIC sans être une relation : c'est le cas
    // exact où l'écran offrait « Inviter à l'antenne » pour rien.
    const states = await alice.as.query(A.inviteStatesForUsers, {
      networkId: root,
      sessionId,
      personIds: [bob.personId, carla.personId, carla.personId],
      now: Date.now(),
    })
    expect(states).toEqual([
      { personId: bob.personId, state: "eligible" },
      { personId: carla.personId, state: "not_connected" },
    ])
  })

  it("NEUF — un membre EN ATTENTE voit la conférence, mais la console ne le propose pas", async () => {
    const { t, root, alice, bob } = await cast()
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, bob)
    await connect(t, root, alice, carla)
    await setMembershipStatus(t, root, carla, "en_attente")
    const sessionId = await liveDirect(t, root, alice)

    // Elle voit la conférence : l'attente compte comme adhésion pour regarder…
    expect((await myStateOf(root, carla, sessionId)).live).toBe(true)
    // …mais elle ne pourrait pas répondre : ni ligne de la console, ni résultat de recherche.
    expect((await inviteCandidates(root, alice, sessionId)).map((row) => row.personId)).toEqual([bob.personId])
    expect(await inviteCandidates(root, alice, sessionId, "carla")).toEqual([])
    // L'état ponctuel (auteur de commentaire) ne la dit pas invitable, sans en dire la raison.
    expect(await alice.as.query(A.inviteStatesForUsers, { networkId: root, sessionId, personIds: [carla.personId], now: Date.now() })).toEqual([
      { personId: carla.personId, state: "no_profile" },
    ])
  })

  it("NEUF — un membre EN ATTENTE n'est pas invitable : même code de refus, aucune ligne, aucune cloche ; déclaré, il le redevient", async () => {
    const { t, root, alice } = await cast()
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, carla)
    await setMembershipStatus(t, root, carla, "en_attente")
    const sessionId = await liveDirect(t, root, alice)

    // Par identifiant comme par handle : le refus de toute cible non invitable.
    expect(await ruleOf(alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: carla.personId }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
    expect(await ruleOf(alice.as.mutation(A.inviteByHandle, { networkId: root, sessionId, handle: "carla" }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
    expect(await invitationRowOf(t, sessionId, carla)).toBeNull()
    expect(await antennaBells(t, root, carla, sessionId)).toEqual([])

    // Son adhésion déclarée, la même personne redevient invitable — et sa cloche sonne.
    await setMembershipStatus(t, root, carla, "declaree")
    expect(await stateOf(root, alice, sessionId, carla)).toBe("eligible")
    await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: carla.personId })
    expect(await antennaBells(t, root, carla, sessionId)).toHaveLength(1)
  })

  it("NEUF — débit `live.antennaInvite` par HÔTE (D14) : au-delà de la rafale, `rateLimited`, sans ligne ni cloche ; une invitation ouverte rejouée ne consomme rien", async () => {
    const { t, root, alice } = await cast()
    const targets: Person[] = []
    for (let index = 0; index < 5; index += 1) {
      const target = await enter(t, root, `cible-${index}`)
      await connect(t, root, alice, target)
      targets.push(target)
    }
    const [first, second, third, fourth, fifth] = targets
    if (!first || !second || !third || !fourth || !fifth) throw new Error("cinq cibles attendues")
    const sessionId = await liveDirect(t, root, alice)

    // Capacité 4 : quatre invitations neuves passent, le rejeu d'une invitation ouverte ne compte pas.
    for (const target of [first, second, third, fourth]) {
      await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: target.personId })
    }
    await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: first.personId })
    expect(await codeOf(alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: fifth.personId }))).toBe("rateLimited")
    expect(await invitationRowOf(t, sessionId, fifth)).toBeNull()
    expect(await antennaBells(t, root, fifth, sessionId)).toEqual([])
  })
})

/**
 * L'audience `followers` (ex-« organisation », V36) est le SEUL cas où une
 * relation acceptée ne suffit pas : la conférence est réservée au CERCLE de la
 * page qui la signe — ses abonnés et ses signataires vivants. C'est aussi le
 * seul état de refus que la liste des relations ne peut pas produire toute
 * seule — d'où cet outillage minimal (page, abonnement), volontairement réduit
 * à ce que ce test exige.
 */
describe("antenne participative — audience `followers` (D-10, V36)", () => {
  it("ne propose jamais une relation HORS du cercle de la page qui signe la conférence", async () => {
    const { t, root, alice, bob } = await cast()
    const carla = await enter(t, root, "carla")
    const pageId = await insertPage(t, root, alice)
    await connect(t, root, alice, bob)
    await connect(t, root, alice, carla)
    // Bob suit la page ; Carla est une relation personnelle de l'hôte, hors du cercle.
    await followPage(t, pageId, bob)
    const sessionId = await insertSession(t, { networkId: root, host: alice, audience: "followers", pageId, title: "Séance des abonnés" })

    const states = new Map((await inviteCandidates(root, alice, sessionId)).map((row) => [row.personId, row.state]))
    expect(states.get(bob.personId)).toBe("eligible")
    // ⚠️ Relation de l'hôte, publiée, et pourtant hors audience : la ligne
    // reste VISIBLE (c'est une relation de l'hôte, il la connaît) mais elle
    // n'est pas invitable, et le client regroupe ce motif avec les autres
    // refus sensibles.
    expect(states.get(carla.personId)).toBe("outside_audience")
    expect(await ruleOf(alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: carla.personId }))).toBe("LIVE_ANTENNA_NOT_INVITABLE")
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
 * CH-094 — la cloche d'une invitation d'antenne suit sa réponse
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Lu » n'a jamais voulu dire « traité » : la mutation qui tranche résout la
 * notification `live_antenna_invite` du destinataire dans SA transaction —
 * accepter, refuser, retirer. Aucun écran ne nettoie à sa place.
 */

/** LA cloche d'invitation à l'antenne d'une personne pour une session. */
async function antennaBell(t: T, networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) {
  const bells = await antennaBells(t, networkId, person, sessionId)
  // Toujours UNE ligne : la réouverture rafraîchit, elle n'empile pas.
  expect(bells).toHaveLength(1)
  return must(bells[0])
}

describe("antenne participative — la cloche suit la réponse (CH-094)", () => {
  it("accepter résout la cloche `accepted`, lue d'office", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    const ouverte = await antennaBell(t, root, bob, sessionId)
    expect(ouverte.resolution).toBeUndefined()
    expect(ouverte.readAt).toBeUndefined()

    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: true })
    const tranchee = await antennaBell(t, root, bob, sessionId)
    expect(tranchee.resolution).toBe("accepted")
    expect(tranchee.resolvedAt).toEqual(expect.any(Number))
    expect(tranchee.readAt).toBe(tranchee.resolvedAt)
  })

  it("refuser résout `declined` ; relancer rouvre la MÊME cloche, non résolue", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId, response: "declined" })).resolves.toEqual({ changed: true, promoted: false })
    const refusee = await antennaBell(t, root, bob, sessionId)
    expect(refusee.resolution).toBe("declined")
    expect(refusee.readAt).toBe(refusee.resolvedAt)

    // L'hôte relance : invitation neuve, cloche rouverte — jamais dupliquée.
    const relance = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(relance.invitationId).toBe(invitationId)
    const rouverte = await antennaBell(t, root, bob, sessionId)
    expect(rouverte._id).toBe(refusee._id)
    expect(rouverte.resolution).toBeUndefined()
    expect(rouverte.resolvedAt).toBeUndefined()
    expect(rouverte.readAt).toBeUndefined()
  })

  it("retirer résout `cancelled` ; un retrait rejoué ne réécrit rien", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(alice.as.mutation(A.revokeInvitation, { networkId: root, invitationId })).resolves.toEqual({ changed: true })
    const retiree = await antennaBell(t, root, bob, sessionId)
    expect(retiree.resolution).toBe("cancelled")
    expect(retiree.readAt).toBe(retiree.resolvedAt)

    await expect(alice.as.mutation(A.revokeInvitation, { networkId: root, invitationId })).resolves.toEqual({ changed: false })
    expect((await antennaBell(t, root, bob, sessionId)).resolvedAt).toBe(retiree.resolvedAt)
  })

  it("une main acceptée par l'hôte solde AUSSI l'invitation en attente — le point unique", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    await authorize(bob, root, sessionId)
    const { requestId } = await bob.as.mutation(A.raiseHand, { networkId: root, sessionId })
    await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(alice.as.mutation(A.respondToRequest, { networkId: root, requestId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: true })
    expect(must(await invitationRowOf(t, sessionId, bob)).status).toBe("accepted")
    expect((await antennaBell(t, root, bob, sessionId)).resolution).toBe("accepted")
  })

  it("« déjà à l'antenne » par une autre porte : répondre résout encore `accepted`", async () => {
    const { t, root, alice, bob } = await cast()
    await connect(t, root, alice, bob)
    const sessionId = await liveDirect(t, root, alice)
    const { invitationId } = await alice.as.mutation(A.inviteUser, { networkId: root, sessionId, targetPersonId: bob.personId })
    // La promotion historique (`speakers.promote`) ne passe pas par l'antenne.
    await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(bob.as.mutation(A.respondToInvitation, { networkId: root, invitationId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: false })
    expect((await antennaBell(t, root, bob, sessionId)).resolution).toBe("accepted")
  })
})
