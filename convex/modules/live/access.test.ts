// @vitest-environment edge-runtime
/**
 * Les GARDES du direct (fondation du module `live`, `access.ts`) — tests NEUFS,
 * écrits pour le moteur : ils tiennent les ADAPTATIONS de la fondation. Les cas
 * du socle qui exercent ces gardes à travers des mutations (`direct.test`,
 * `organisationAccess.test` à réécrire sur la page, `invitees.test`,
 * `antenna.test`, `replayPublication.test`…) viennent avec les lots qui portent
 * ces mutations ; les sessions sont ici POSÉES EN BASE (`fixtures.setup.ts`).
 *
 * Ce que ce fichier tient, dans l'ordre d'importance :
 *  1. voir une session exige d'être membre ACTIF de son réseau (V35) ; une
 *     session d'un autre réseau est introuvable, comme une session inconnue ;
 *  2. l'audience `followers` (ex-« organisation », V36) s'ouvre au seul cercle
 *     de la page — abonnés et signataires vivants, l'hôte compris —, et se
 *     referme sur tous quand la page est retirée ; une invitation ne la franchit
 *     jamais ;
 *  3. le jeton n'écrit PAS la session (D28) : une admission, une ligne, et la
 *     capacité jugée sur les présents recomptés ;
 *  4. refus à code : `notFound` indistinct, `liveRoleRequired`, `LIVE_EXCLUDED`,
 *     `LIVE_FULL`, débit `live.token`.
 */
import { DIRECT_PRESENCE_TTL_MS } from "@antsia/social-domain/live/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import {
  assertVisibleDirectSession,
  countPresentViewers,
  countViewerGrants,
  directReplayAccessDecision,
  directSessionAccessDecision,
  isEligibleDirectInvitee,
  isInviteeAccountEligible,
  readerInviteeSessionIds,
  requireDirectPermission,
  sessionCountersOf,
} from "./access"
import {
  ban,
  block,
  caught,
  codeOf,
  connect,
  deactivatePage,
  enter,
  followPage,
  grantAt,
  grantsOf,
  groupThread,
  insertPage,
  insertSession,
  invite,
  joinAlso,
  type Person,
  promote,
  ruleOf,
  seed,
  sessionDoc,
  type T,
  T0,
  tick,
} from "./fixtures.setup"

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

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carol = await enter(t, root, "carol")
  return { t, root, testClosed, alice, bob, carol }
}

async function decisionFor(t: T, person: Person, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    return await directSessionAccessDecision(ctx, person.personId, session)
  })
}

async function replayDecisionFor(t: T, person: Person, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) => {
    const session = await ctx.db.get(sessionId)
    if (!session) throw new Error("session inconnue")
    return await directReplayAccessDecision(ctx, person.personId, session)
  })
}

async function visibleFrom(t: T, networkId: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) => assertVisibleDirectSession(ctx, { networkId, personId: person.personId }, sessionId))
}

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

async function token(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

describe("voir une session — l'adhésion d'abord (V35)", () => {
  it("public : tout membre ACTIF du réseau de la session voit ; un non-membre, un membre suspendu ou parti ne voient pas", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    const inRoot = await insertSession(t, { networkId: root, host: alice })
    expect(await decisionFor(t, bob, inRoot)).toBe("allowed")

    // Une session d'un réseau FERMÉ dont bob n'est pas membre : hors audience, même publique.
    await joinAlso(t, testClosed, alice)
    const inClosed = await insertSession(t, { networkId: testClosed, host: alice })
    expect(await decisionFor(t, bob, inClosed)).toBe("outside_audience")
    await joinAlso(t, testClosed, bob)
    expect(await decisionFor(t, bob, inClosed)).toBe("allowed")

    await setMembershipStatus(t, root, carol, "suspendue")
    expect(await decisionFor(t, carol, inRoot)).toBe("outside_audience")
    await setMembershipStatus(t, root, carol, "partie")
    expect(await decisionFor(t, carol, inRoot)).toBe("outside_audience")
  })

  it("une session d'un AUTRE réseau, inconnue, ou hors audience : le MÊME `notFound`, hôte compris", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    const inClosed = await insertSession(t, { networkId: testClosed, host: alice })
    // Lue depuis la racine, la session du réseau fermé n'existe pas — pas même pour son hôte.
    expect(await codeOf(visibleFrom(t, root, alice, inClosed))).toBe("notFound")
    expect((await visibleFrom(t, testClosed, alice, inClosed))._id).toBe(inClosed)

    const gone = await insertSession(t, { networkId: root, host: alice })
    await t.run(async (ctx) => ctx.db.delete(gone))
    expect(await codeOf(visibleFrom(t, root, bob, gone))).toBe("notFound")

    const reserved = await insertSession(t, { networkId: root, host: alice, audience: "connections" })
    expect(await codeOf(visibleFrom(t, root, bob, reserved))).toBe("notFound")
  })

  it("connections : la relation acceptée DANS LE RÉSEAU de la session ouvre ; celle d'un autre réseau non", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    await connect(t, root, alice, bob)
    const inClosed = await insertSession(t, { networkId: testClosed, host: alice, audience: "connections" })
    expect(await decisionFor(t, bob, inClosed)).toBe("outside_audience")
    await connect(t, testClosed, alice, bob)
    expect(await decisionFor(t, bob, inClosed)).toBe("allowed")
  })

  it("un invité ne franchit son invitation que non effacé et membre actif du réseau ; préchargement par réseau", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    expect(await t.run(async (ctx) => isInviteeAccountEligible(ctx, root, bob.personId))).toBe(true)
    expect(await t.run(async (ctx) => isInviteeAccountEligible(ctx, testClosed, bob.personId))).toBe(false)
    await t.run(async (ctx) => ctx.db.patch(carol.personId, { deletionRequestedAt: Date.now() }))
    expect(await t.run(async (ctx) => isInviteeAccountEligible(ctx, root, carol.personId))).toBe(false)

    const session = await insertSession(t, { networkId: root, host: alice, audience: "invitees" })
    await invite(t, session, bob)
    // Le harnais sérialise la valeur rendue (valeur Convex) : l'ensemble sort en liste.
    const preloaded = (networkId: Id<"networks">) =>
      t.run(async (ctx) => {
        const ids = await readerInviteeSessionIds(ctx, { networkId, personId: bob.personId })
        return ids === undefined ? null : [...ids]
      })
    expect(await preloaded(root)).toEqual([session])
    // Pas membre du réseau fermé : l'ensemble préchargé y est vide (aucune invitation à franchir).
    expect(await preloaded(testClosed)).toEqual([])
  })
})

describe("audience `followers` — le cercle de la page qui signe (V36)", () => {
  it("abonné ou signataire VIVANT voit ; une invitation ne franchit pas ; page retirée : plus personne, hôte compris", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const dave = await enter(t, root, "dave")
    const pageId = await insertPage(t, root, alice)
    const session = await insertSession(t, { networkId: root, host: alice, audience: "followers", pageId })

    expect(await decisionFor(t, alice, session)).toBe("allowed")
    expect(await decisionFor(t, bob, session)).toBe("outside_audience")
    // L'invitation nominative ne franchit JAMAIS le cercle de la page.
    await invite(t, session, bob)
    expect(await decisionFor(t, bob, session)).toBe("outside_audience")
    await followPage(t, pageId, bob)
    expect(await decisionFor(t, bob, session)).toBe("allowed")

    // Un signataire VIVANT voit sans suivre ; une habilitation non acceptée ne donne rien.
    await t.run(async (ctx) => ctx.db.insert("pageSignatories", { networkId: root, pageId, personId: carol.personId, role: "signatory", acceptedAt: 1, createdAt: 1, updatedAt: 1 }))
    expect(await decisionFor(t, carol, session)).toBe("allowed")
    await t.run(async (ctx) => ctx.db.insert("pageSignatories", { networkId: root, pageId, personId: dave.personId, role: "signatory", createdAt: 1, updatedAt: 1 }))
    expect(await decisionFor(t, dave, session)).toBe("outside_audience")

    await deactivatePage(t, pageId)
    expect(await decisionFor(t, alice, session)).toBe("outside_audience")
    expect(await decisionFor(t, bob, session)).toBe("outside_audience")
  })

  it("sans page, l'audience `followers` ne désigne personne : même l'hôte ne la voit pas", async () => {
    const { t, root, alice } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice, audience: "followers" })
    expect(await decisionFor(t, alice, session)).toBe("outside_audience")
  })

  it("la rediffusion d'une conférence réservée aux abonnés reste au cercle de la page", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const pageId = await insertPage(t, root, alice)
    await followPage(t, pageId, bob)
    const session = await insertSession(t, { networkId: root, host: alice, audience: "followers", pageId, status: "ended" })
    await t.run(async (ctx) => ctx.db.patch(session, { replayPublication: "published", replayVisibility: "public" }))
    expect(await replayDecisionFor(t, bob, session)).toBe("allowed")
    // `replayVisibility: public` ne rouvre RIEN : la copie durable garde le cercle de la page.
    expect(await replayDecisionFor(t, carol, session)).toBe("outside_audience")
  })
})

describe("après l'audience : blocage, exclusion, publication de la rediffusion", () => {
  it("bloqué → `blocked`, exclu → `banned`, l'exclusion levée rouvre la porte", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    await block(t, root, alice, bob)
    expect(await decisionFor(t, bob, session)).toBe("blocked")
    const banId = await ban(t, session, carol)
    expect(await decisionFor(t, carol, session)).toBe("banned")
    await t.run(async (ctx) => ctx.db.patch(banId, { liftedAt: Date.now(), liftedByPersonId: alice.personId }))
    expect(await decisionFor(t, carol, session)).toBe("allowed")
  })

  it("tant que l'hôte n'a pas publié, personne d'autre ne revoit ; une copie refermée sur les relations reste à l'invité", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice, status: "ended" })
    await t.run(async (ctx) => ctx.db.patch(session, { replayPublication: "undecided" }))
    expect(await replayDecisionFor(t, alice, session)).toBe("allowed")
    expect(await replayDecisionFor(t, bob, session)).toBe("outside_audience")

    await t.run(async (ctx) => ctx.db.patch(session, { replayPublication: "published", replayVisibility: "connections" }))
    expect(await replayDecisionFor(t, bob, session)).toBe("outside_audience")
    await invite(t, session, bob)
    expect(await replayDecisionFor(t, bob, session)).toBe("allowed")
    await connect(t, root, alice, carol)
    expect(await replayDecisionFor(t, carol, session)).toBe("allowed")
  })
})

describe("gestion — `requireDirectPermission`", () => {
  it("l'hôte a tout ; un délégué selon ses drapeaux ; sans droit, le refus EXPLICITE `liveRoleRequired`", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    await t.run(async (ctx) =>
      ctx.db.insert("liveDelegations", {
        networkId: root,
        sessionId: session,
        personId: bob.personId,
        kind: "moderator",
        canAdmitToStage: false,
        canExclude: false,
        canEndOrTransfer: false,
        grantedByPersonId: alice.personId,
        grantedAt: Date.now(),
      }),
    )
    const check = (person: Person, key: Parameters<typeof requireDirectPermission>[3]) =>
      t.run(async (ctx) => {
        const doc = await ctx.db.get(session)
        if (!doc) throw new Error("session inconnue")
        return await requireDirectPermission(ctx, doc, person.personId, key)
      })
    expect((await check(alice, "delegate")).delegate).toBe(true)
    expect((await check(bob, "moderateChat")).moderateChat).toBe(true)
    expect(await codeOf(check(bob, "exclude"))).toBe("liveRoleRequired")
    expect(await codeOf(check(carol, "moderateChat"))).toBe("liveRoleRequired")
  })
})

describe("jeton — `authorizeToken`", () => {
  it("l'hôte et l'intervenant publient, le spectateur regarde ; la personne voyage, le nom vient du profil publié", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    await promote(t, session, bob)
    const roomName = (await sessionDoc(t, session))?.roomName

    expect(await token(alice, root, session)).toEqual({ roomName, role: "speaker", personId: alice.personId, displayName: "alice" })
    expect((await token(bob, root, session)).role).toBe("speaker")
    expect(await token(carol, root, session)).toEqual({ roomName, role: "viewer", personId: carol.personId, displayName: "carol" })
    // Les intervenants n'ont pas de ligne d'admission ; le spectateur, une.
    expect((await grantsOf(t, session)).map((row) => row.personId)).toEqual([carol.personId])

    // Un profil retiré : plus de nom affiché (l'action n'en pose pas), jamais un état civil.
    await t.run(async (ctx) => ctx.db.patch(carol.personId, { withdrawnAt: Date.now() }))
    tick()
    expect((await token(carol, root, session)).displayName).toBeNull()
  })

  it("D28 : l'admission n'écrit PAS la session ; une reconnexion, un retour ne comptent pas une seconde personne", async () => {
    const { t, root, alice, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    const before = await sessionDoc(t, session)

    await token(carol, root, session)
    tick()
    await token(carol, root, session)
    expect(await sessionDoc(t, session)).toEqual(before)
    expect(await grantsOf(t, session)).toHaveLength(1)
    expect(await t.run(async (ctx) => countViewerGrants(ctx, session))).toBe(1)

    // Parti puis revenu : la même ligne, la même personne comptée une fois.
    await t.run(async (ctx) => {
      const [row] = await ctx.db
        .query("liveViewerGrants")
        .withIndex("by_session_person", (q) => q.eq("sessionId", session).eq("personId", carol.personId))
        .take(1)
      if (row) await ctx.db.patch(row._id, { leftAt: Date.now() })
    })
    tick()
    await token(carol, root, session)
    const [grant] = await grantsOf(t, session)
    expect(grant?.leftAt).toBeUndefined()
    expect(await t.run(async (ctx) => countViewerGrants(ctx, session))).toBe(1)
    expect(await sessionDoc(t, session)).toEqual(before)
  })

  it("capacité jugée sur les PRÉSENTS recomptés : salle comble `LIVE_FULL`, un départ libère la place, l'invité vivant est exempté", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const dave = await enter(t, root, "dave")
    const session = await insertSession(t, { networkId: root, host: alice, maxViewers: 1 })

    await token(bob, root, session)
    expect(await ruleOf(token(carol, root, session))).toBe("LIVE_FULL")

    // Le bail de bob s'éteint (plus de battement depuis 90 s) : la place revient à la file.
    vi.setSystemTime(Date.now() + DIRECT_PRESENCE_TTL_MS + 1_000)
    expect((await token(carol, root, session)).role).toBe("viewer")
    expect(await ruleOf(token(bob, root, session))).toBe("LIVE_FULL")

    // Un invité VIVANT n'est pas refoulé parce que le public est venu nombreux.
    await invite(t, session, dave)
    expect((await token(dave, root, session)).role).toBe("viewer")
  })

  it("refus : session inconnue, d'un autre réseau, programmée ou terminée → `notFound` ; hors audience → `notFound` ; exclu → `LIVE_EXCLUDED`", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    const live = await insertSession(t, { networkId: root, host: alice })
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const elsewhere = await insertSession(t, { networkId: testClosed, host: alice })
    const scheduled = await insertSession(t, { networkId: root, host: alice, status: "scheduled" })
    const ended = await insertSession(t, { networkId: root, host: alice, status: "ended" })
    const reserved = await insertSession(t, { networkId: root, host: alice, audience: "connections" })

    // La session du réseau fermé, demandée au nom de la racine : introuvable (bob est pourtant membre des deux).
    expect(await codeOf(token(bob, root, elsewhere))).toBe("notFound")
    expect(await codeOf(token(bob, root, scheduled))).toBe("notFound")
    expect(await codeOf(token(bob, root, ended))).toBe("notFound")
    expect(await codeOf(token(bob, root, reserved))).toBe("notFound")
    await ban(t, live, carol)
    expect(await ruleOf(token(carol, root, live))).toBe("LIVE_EXCLUDED")
    // Aucun refus n'a laissé d'admission derrière lui.
    expect(await grantsOf(t, live)).toEqual([])
  })

  it("un membre en attente n'entre pas dans la salle (`statusInsufficient`) ; un non-membre du réseau, `notFound`", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    await setMembershipStatus(t, root, bob, "en_attente")
    expect(await codeOf(token(bob, root, session))).toBe("statusInsufficient")

    await joinAlso(t, testClosed, alice)
    const inClosed = await insertSession(t, { networkId: testClosed, host: alice })
    expect(await codeOf(token(carol, testClosed, inClosed))).toBe("notFound")
  })

  it("débit `live.token` (D14) : au-delà de la rafale, `rateLimited`, avant tout réveil du serveur multimédia", async () => {
    const { t, root, alice } = await cast()
    const session = await insertSession(t, { networkId: root, host: alice })
    for (let attempt = 0; attempt < 20; attempt += 1) await token(alice, root, session)
    const refused = await caught(token(alice, root, session))
    expect(refused).not.toBeNull()
    expect(await codeOf(token(alice, root, session))).toBe("rateLimited")
  })
})

describe("compteurs (D28) — lus ici, écrits par le seul `reap`", () => {
  it("ligne absente = zéros ; seuls les baux VIVANTS sans départ sont présents", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const dave = await enter(t, root, "dave")
    const erin = await enter(t, root, "erin")
    const session = await insertSession(t, { networkId: root, host: alice })
    expect(await t.run(async (ctx) => sessionCountersOf(ctx, session))).toEqual({ viewerGrantCount: 0, viewerPresentCount: 0, commentCount: 0, reactionCount: 0 })

    const now = Date.now()
    await grantAt(t, session, bob, now)
    await grantAt(t, session, carol, now - DIRECT_PRESENCE_TTL_MS - 1)
    await grantAt(t, session, dave, now, now)
    await grantAt(t, session, erin, undefined)
    expect(await t.run(async (ctx) => countPresentViewers(ctx, session, now))).toBe(1)

    await t.run(async (ctx) =>
      ctx.db.insert("liveSessionCounters", { networkId: root, sessionId: session, viewerGrantCount: 4, viewerPresentCount: 1, commentCount: 7, reactionCount: 12, updatedAt: now }),
    )
    expect(await t.run(async (ctx) => sessionCountersOf(ctx, session))).toEqual({ viewerGrantCount: 4, viewerPresentCount: 1, commentCount: 7, reactionCount: 12 })
  })
})

describe("invités — `isEligibleDirectInvitee`", () => {
  it("relation acceptée OU co-membre vivant du fil source ; jamais l'hôte, jamais à travers un blocage, jamais hors du réseau", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    const dave = await enter(t, root, "dave")
    const eligible = (target: Person, sourceThreadId: Id<"groupThreads"> | null = null, networkId: Id<"networks"> = root) =>
      t.run(async (ctx) => isEligibleDirectInvitee(ctx, { networkId, hostPersonId: alice.personId, targetPersonId: target.personId, sourceThreadId, followersPage: null }))

    await connect(t, root, alice, bob)
    expect(await eligible(bob)).toBe(true)
    expect(await eligible(alice)).toBe(false)
    expect(await eligible(carol)).toBe(false)

    // Un fil où alice et carol sont co-membres SANS être en relation (dave les a réunies).
    const threadId = await groupThread(t, root, dave, [alice, carol])
    expect(await eligible(carol, threadId)).toBe(true)
    // Le même lien ne vaut rien dans un autre réseau, ni à travers un blocage.
    await joinAlso(t, testClosed, alice)
    expect(await eligible(carol, threadId, testClosed)).toBe(false)
    await block(t, root, carol, alice)
    expect(await eligible(carol, threadId)).toBe(false)
  })

  it("audience `followers` : l'invité doit être du cercle de la page", async () => {
    const { t, root, alice, bob } = await cast()
    const pageId = await insertPage(t, root, alice)
    await connect(t, root, alice, bob)
    const withPage = () =>
      t.run(async (ctx) => {
        const page = await ctx.db.get(pageId)
        return await isEligibleDirectInvitee(ctx, { networkId: root, hostPersonId: alice.personId, targetPersonId: bob.personId, sourceThreadId: null, followersPage: page })
      })
    expect(await withPage()).toBe(false)
    await followPage(t, pageId, bob)
    expect(await withPage()).toBe(true)
  })
})
