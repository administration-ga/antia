// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/moderation.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, personnes entrées dans la racine, relations ACCEPTÉES posées par l'outillage, nom publié distinct de l'identifiant posé sur la personne pour le panneau) ; conférences POSÉES EN BASE et en direct par l'outillage de la fondation (`insertSession`) au lieu de `sessions.create` + `goLive` ; jeton par `access.authorizeToken` au nom de la personne ; cibles en `targetPersonId`, DTO du panneau en `personId` ; gestes des autres lots appelés sous leur nom du moteur (`sessions.setChatMode`, `sessions.end`, `sessions.setReplayVisibility`, `comments.send`/`list`/`remove`, `antenna.*`) ; codes au lieu des libellés (`liveRoleRequired`, `notFound`, `LIVE_EXCLUDED`, `LIVE_HOST_NOT_MODERATABLE`, `LIVE_CHAT_CLOSED`, `LIVE_CHAT_MUTED`, `LIVE_HOST_STAYS_ON_STAGE`) ; instant de lecture fourni à la console de l'antenne (`now`, D16) ; cas NEUFS : l'exclusion planifie la sortie de la salle sur le SUJET d'authentification de la personne, une conférence d'un autre réseau ne se modère pas depuis celui-ci (`notFound`, hôte compris), une personne qui a quitté le réseau sort du panneau (V35), un profil retiré reste gérable sous le nom NEUTRE (`displayName: null`).
/**
 * MODÉRATION du direct (D-11, ADR-0144) — ce que ce fichier tient :
 *
 *  1. **Une personne SILENCIEUSE est gérable** : `listAdmitted` la montre, et
 *     l'exclusion ne passe plus par une ligne de commentaire.
 *  2. **Retirer de l'antenne ≠ exclure** : le rétrogradé garde son jeton
 *     spectateur, l'exclu ne l'obtient plus.
 *  3. **La réintégration rend l'ACCÈS, jamais un rôle** — pas de re-promotion.
 *  4. **La sourdine tait UNE personne**, pas la salle ; `chatMode: closed`
 *     tait la salle, hôte compris.
 *  5. **Le délégué ne peut que ce que son drapeau dit**, et un refus de droit
 *     est EXPLICITE quand un refus d'audience reste indistinct.
 *  6. **Personne ne modère l'HÔTE**, quel que soit le drapeau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { codeOf, connect, enter, insertSession, joinAlso, type Person, ruleOf, seed, type T, T0 } from "./fixtures.setup"

const M = api.modules.live.moderation
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

async function authorize(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

/** Une conférence EN COURS, posée en base (le passage en direct est du lot des sessions). */
async function liveDirect(t: T, networkId: Id<"networks">, host: Person, audience: "public" | "connections" = "public"): Promise<Id<"liveSessions">> {
  return await insertSession(t, { networkId, host, audience, title: "Séance publique" })
}

const PAGE = { numItems: 20, cursor: null }

/**
 * Une salle : Alice héberge, Bob et Carl sont en relation avec elle et ENTRÉS
 * comme spectateurs — Carl sans jamais écrire une ligne. C'est lui, le cas du
 * constat : avant ce lot, personne ne pouvait le gérer.
 */
async function salle() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carl = await enter(t, root, "carl")
  await connect(t, root, alice, bob)
  await connect(t, root, alice, carl)
  const sessionId = await liveDirect(t, root, alice)
  await authorize(bob, root, sessionId)
  await authorize(carl, root, sessionId)
  return { t, root, testClosed, sessionId, alice, bob, carl }
}

/** Le délégué reçoit sa délégation de l'hôte, avec les drapeaux demandés. */
async function deleguer(
  root: Id<"networks">,
  host: Person,
  sessionId: Id<"liveSessions">,
  target: Person,
  kind: "cohost" | "moderator",
  flags: Partial<{ canAdmitToStage: boolean; canExclude: boolean; canEndOrTransfer: boolean }> = {},
): Promise<void> {
  await host.as.mutation(api.modules.live.delegations.grant, { networkId: root, sessionId, targetPersonId: target.personId, kind, ...flags })
}

const admisVus = (root: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) => person.as.query(M.listAdmitted, { networkId: root, sessionId, paginationOpts: PAGE })

async function setMembershipStatus(t: T, networkId: Id<"networks">, person: Person, status: "partie" | "suspendue") {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (!row) throw new Error("adhésion inconnue")
    await ctx.db.patch(row._id, { status })
  })
}

describe("le panneau des participants — la personne silencieuse est gérable", () => {
  it("liste les admis, avec leur état, pour qui modère", async () => {
    const { t, root, sessionId, alice, bob, carl } = await salle()
    await t.run(async (ctx) => ctx.db.patch(carl.personId, { displayName: "Nom publié carl" }))
    const page = await admisVus(root, alice, sessionId)
    const ids = page.page.map((row) => row.personId).sort()
    expect(ids).toEqual([bob.personId, carl.personId].sort())
    const line = page.page.find((row) => row.personId === carl.personId)
    expect(line).toMatchObject({
      displayName: "Nom publié carl",
      onStage: false,
      banned: false,
      muted: false,
      delegation: null,
    })
  })

  it("un SPECTATEUR ne lit pas la salle — ce serait un annuaire des présents", async () => {
    const { root, sessionId, bob } = await salle()
    expect(await codeOf(admisVus(root, bob, sessionId))).toBe("liveRoleRequired")
  })

  it("un tiers HORS AUDIENCE reçoit le refus indistinct — l'anti-énumération tient", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const dora = await enter(t, root, "dora")
    const sessionId = await liveDirect(t, root, alice, "connections")
    expect(await codeOf(admisVus(root, dora, sessionId))).toBe("notFound")
  })

  it("un modérateur SANS `canExclude` voit quand même la salle (il y coupe des chats)", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator")
    const page = await admisVus(root, bob, sessionId)
    expect(page.page.length).toBeGreaterThan(0)
  })

  it("un modérateur EXCLUT une personne qui n'a jamais écrit un mot", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator", { canExclude: true })

    await expect(bob.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ banned: true })
    expect(await ruleOf(authorize(carl, root, sessionId))).toBe("LIVE_EXCLUDED")
    const page = await admisVus(root, bob, sessionId)
    expect(page.page.find((row) => row.personId === carl.personId)).toMatchObject({ banned: true })
  })

  it("NEUF — une personne qui a QUITTÉ le réseau sort du panneau (V35)", async () => {
    const { t, root, sessionId, alice, bob, carl } = await salle()
    await setMembershipStatus(t, root, carl, "partie")
    const page = await admisVus(root, alice, sessionId)
    // Sa ligne d'admission survit en base ; la salle, elle, ne la compte plus parmi les siens.
    expect(page.page.map((row) => row.personId)).toEqual([bob.personId])
  })

  it("NEUF — un profil retiré reste gérable, sous le nom NEUTRE (`displayName: null`, l'écran le traduit)", async () => {
    const { t, root, sessionId, alice, carl } = await salle()
    await t.run(async (ctx) => ctx.db.patch(carl.personId, { withdrawnAt: Date.now() }))
    const page = await admisVus(root, alice, sessionId)
    expect(page.page.find((row) => row.personId === carl.personId)).toMatchObject({ displayName: null, handle: null, banned: false })
    await expect(alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ banned: true })
  })
})

describe("exclure, réintégrer — l'accès revient, pas le rôle", () => {
  it("l'exclusion rétrograde ET planifie la sortie de la salle", async () => {
    const { t, root, sessionId, alice, bob } = await salle()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    const speaker = await t.run(async (ctx) =>
      ctx.db
        .query("liveSpeakers")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
        .unique(),
    )
    expect(speaker?.removedAt).toBeGreaterThan(0)
    // L'époque a avancé : tout jeton speaker encore signé devient caduc.
    expect(speaker?.grantEpoch).toBe(2)
  })

  it("NEUF — la sortie de la salle vise le SUJET d'authentification de la personne exclue", async () => {
    const { t, root, sessionId, alice, bob } = await salle()
    await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    const session = await t.run(async (ctx) => ctx.db.get(sessionId))
    const jobs = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(200))
    const kick = jobs.find((job) => job.name === "modules/live/livekitActions:applyDirectSfuState" && job.args[0]?.mode === "kick")
    expect(kick?.args[0]).toEqual({ roomName: session?.roomName, subject: "auth-bob", mode: "kick" })
  })

  it("RETIRER DE L'ANTENNE n'exclut pas : le jeton spectateur tient toujours", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    await alice.as.mutation(api.modules.live.speakers.demote, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
  })

  it("réintégrer rouvre la porte, sans remettre personne à l'antenne", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    await expect(alice.as.mutation(M.reinstate, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ reinstated: true })

    // Le jeton repasse — en SPECTATEUR : une réintégration n'est pas une
    // re-promotion, et l'antenne se redemande.
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
    // Idempotente.
    await expect(alice.as.mutation(M.reinstate, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ reinstated: false })
  })

  it("ré-exclure après réintégration ROUVRE la même ligne, jamais une seconde", async () => {
    const { t, root, sessionId, alice, bob } = await salle()
    for (let round = 0; round < 2; round += 1) {
      await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
      await alice.as.mutation(M.reinstate, { networkId: root, sessionId, targetPersonId: bob.personId })
    }
    await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("liveBans")
        .withIndex("by_session_banned", (q) => q.eq("sessionId", sessionId).eq("bannedPersonId", bob.personId))
        .take(10),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.liftedAt).toBeUndefined()
  })

  it("exclure un délégué lui RETIRE sa délégation", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true })
    await alice.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    await alice.as.mutation(M.reinstate, { networkId: root, sessionId, targetPersonId: bob.personId })
    // Réintégré, il redevient un spectateur ordinaire : la police ne revient
    // pas avec l'accès.
    expect(await codeOf(bob.as.query(api.modules.live.antenna.hostState, { networkId: root, sessionId, now: Date.now() }))).toBe("liveRoleRequired")
  })

  it("personne ne modère l'HÔTE, même armé de tous les drapeaux", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true, canExclude: true, canEndOrTransfer: true })
    expect(await ruleOf(bob.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_NOT_MODERATABLE")
    expect(await ruleOf(bob.as.mutation(M.muteChat, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_NOT_MODERATABLE")
  })

  it("un SPECTATEUR n'exclut personne, et le refus est explicite", async () => {
    const { root, sessionId, bob, carl } = await salle()
    expect(await codeOf(bob.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: carl.personId }))).toBe("liveRoleRequired")
  })

  it("un INTERVENANT n'exclut personne non plus — publier n'est pas gérer", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(await codeOf(bob.as.mutation(M.ban, { networkId: root, sessionId, targetPersonId: carl.personId }))).toBe("liveRoleRequired")
  })

  it("NEUF — une conférence d'un AUTRE réseau ne se modère pas depuis celui-ci (`notFound`, hôte compris)", async () => {
    const { t, root, testClosed, alice, bob } = await salle()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const elsewhere = await liveDirect(t, testClosed, alice)
    await authorize(bob, testClosed, elsewhere)

    expect(await codeOf(alice.as.mutation(M.ban, { networkId: root, sessionId: elsewhere, targetPersonId: bob.personId }))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(M.muteChat, { networkId: root, sessionId: elsewhere, targetPersonId: bob.personId }))).toBe("notFound")
    expect(await codeOf(admisVus(root, alice, elsewhere))).toBe("notFound")
    // Depuis son réseau, le même geste passe.
    await expect(alice.as.mutation(M.ban, { networkId: testClosed, sessionId: elsewhere, targetPersonId: bob.personId })).resolves.toEqual({ banned: true })
  })
})

describe("la conversation — fermée pour tous, ou coupée pour une seule", () => {
  it("`setChatMode` ferme puis rouvre ; fermée, personne n'écrit, hôte compris", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await expect(alice.as.mutation(api.modules.live.sessions.setChatMode, { networkId: root, sessionId, chatMode: "closed" })).resolves.toEqual({ updated: true })

    for (const who of [alice, bob]) {
      expect(await ruleOf(who.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Bonjour" }))).toBe("LIVE_CHAT_CLOSED")
    }

    await alice.as.mutation(api.modules.live.sessions.setChatMode, { networkId: root, sessionId, chatMode: "open" })
    await expect(bob.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Bonjour" })).resolves.toMatchObject({ commentId: expect.anything() })
  })

  it("un modérateur SANS drapeau peut fermer la conversation ; un spectateur non", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator")
    await expect(bob.as.mutation(api.modules.live.sessions.setChatMode, { networkId: root, sessionId, chatMode: "closed" })).resolves.toEqual({ updated: true })
    expect(await codeOf(carl.as.mutation(api.modules.live.sessions.setChatMode, { networkId: root, sessionId, chatMode: "open" }))).toBe("liveRoleRequired")
  })

  it("la SOURDINE tait UNE personne, et elle seule", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator")
    await expect(bob.as.mutation(M.muteChat, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ muted: true })

    expect(await ruleOf(carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Encore moi" }))).toBe("LIVE_CHAT_MUTED")
    // La salle, elle, continue d'écrire.
    await expect(alice.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "La séance continue" })).resolves.toMatchObject({ commentId: expect.anything() })

    await expect(bob.as.mutation(M.unmuteChat, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ unmuted: true })
    await expect(carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Merci" })).resolves.toMatchObject({ commentId: expect.anything() })
  })

  it("la sourdine ne se lit QUE par qui modère", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Une question" })
    await alice.as.mutation(M.muteChat, { networkId: root, sessionId, targetPersonId: carl.personId })
    const forHost = await alice.as.query(api.modules.live.comments.list, { networkId: root, sessionId })
    expect(forHost[0]?.mutedForChat).toBe(true)
    // Pour la salle, la sanction n'est pas publique.
    const forViewer = await bob.as.query(api.modules.live.comments.list, { networkId: root, sessionId })
    expect(forViewer[0]?.mutedForChat).toBe(false)
  })

  it("un délégué retire le commentaire d'autrui ; un spectateur, seulement le sien", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator")
    const own = await carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Message de Carl" })
    await expect(alice.as.mutation(api.modules.live.comments.remove, { networkId: root, commentId: own.commentId }).then(() => "ok")).resolves.toBe("ok")

    const second = await carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Second message" })
    await expect(bob.as.mutation(api.modules.live.comments.remove, { networkId: root, commentId: second.commentId })).resolves.toEqual({ removed: true })
  })

  it("un SPECTATEUR ne retire pas le commentaire d'autrui — refus indistinct", async () => {
    const { root, sessionId, bob, carl } = await salle()
    const own = await carl.as.mutation(api.modules.live.comments.send, { networkId: root, sessionId, body: "Message de Carl" })
    expect(await codeOf(bob.as.mutation(api.modules.live.comments.remove, { networkId: root, commentId: own.commentId }))).toBe("notFound")
  })
})

describe("ce qu'un délégué ne peut PAS, drapeau ou pas", () => {
  it("un modérateur sans `canEndOrTransfer` ne termine pas la conférence", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "moderator", { canExclude: true })
    expect(await codeOf(bob.as.mutation(api.modules.live.sessions.end, { networkId: root, sessionId }))).toBe("liveRoleRequired")
  })

  it("aucun délégué ne touche à la visibilité du REPLAY", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true, canExclude: true, canEndOrTransfer: true })
    expect(await codeOf(bob.as.mutation(api.modules.live.sessions.setReplayVisibility, { networkId: root, sessionId, visibility: "connections" }))).toBe("liveRoleRequired")
  })

  it("`canEndOrTransfer` ouvre bien la fin de la conférence", async () => {
    const { root, sessionId, alice, bob } = await salle()
    await deleguer(root, alice, sessionId, bob, "cohost", { canEndOrTransfer: true })
    await expect(bob.as.mutation(api.modules.live.sessions.end, { networkId: root, sessionId })).resolves.toEqual({ ended: true })
  })

  it("`canAdmitToStage` accepte une main levée ; sans le drapeau, refus explicite", async () => {
    const { t, root, sessionId, alice, bob, carl } = await salle()
    await carl.as.mutation(api.modules.live.antenna.raiseHand, { networkId: root, sessionId })
    const requestId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("liveAntennaRequests")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", carl.personId))
        .unique()
      if (!row) throw new Error("main levée attendue")
      return row._id
    })

    await deleguer(root, alice, sessionId, bob, "moderator")
    expect(await codeOf(bob.as.mutation(api.modules.live.antenna.respondToRequest, { networkId: root, requestId, response: "accepted" }))).toBe("liveRoleRequired")

    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true })
    await expect(bob.as.mutation(api.modules.live.antenna.respondToRequest, { networkId: root, requestId, response: "accepted" })).resolves.toEqual({ changed: true, promoted: true })
    // ⚠️ La RELATION exigée reste celle de l'HÔTE (ADR-0061) : Carl est en
    // relation avec Alice, pas avec Bob, et il monte quand même.
    expect((await authorize(carl, root, sessionId)).role).toBe("speaker")
  })

  it("un cohôte porteur du drapeau RETIRE de l'antenne, mais jamais l'hôte", async () => {
    const { root, sessionId, alice, bob, carl } = await salle()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: carl.personId })
    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true })
    await expect(bob.as.mutation(api.modules.live.speakers.demote, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ demoted: true })
    expect(await ruleOf(bob.as.mutation(api.modules.live.speakers.demote, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_STAYS_ON_STAGE")
  })
})
