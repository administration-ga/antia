// @vitest-environment edge-runtime
/**
 * Tranche verticale : entrer (personne), choisir son identifiant, rejoindre la
 * racine, publier, lire le fil, réagir — avec les gardes du moteur (adhésion,
 * refus indistinct, débit, règles du domaine, compteurs fragmentés).
 */
import { engineErrorRule } from "@antsia/social-contracts/errors"
import { describe, expect, it } from "vitest"

import { api, internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { devToolsAllowed, isLocalDeployment } from "../lib/devTools"
import { REACTION_SHARDS, shardOf } from "../modules/posts/counters"
import { SEED_CONFIRMATION } from "../seeds/foundations"
import { testConvex } from "../test.setup"

type T = ReturnType<typeof testConvex>

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

/** Le parcours d'entrée complet, par les fonctions publiques : personne, consentement, profil, racine. */
async function enter(t: T, subject: string, handle: string, displayName = handle) {
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName })
  const root = await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })
  if (!root) throw new Error("racine absente")
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root._id })
  return { as, personId, rootId: root._id }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

const code = (error: unknown) => (error as { data?: { code?: string } } | null)?.data?.code ?? null

describe("profil : identifiant et nom affiché", () => {
  it("propose des identifiants tirés du nom saisi, avec leur disponibilité", async () => {
    const t = testConvex()
    await seed(t)
    await enter(t, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const as = t.withIdentity({ subject: "auth-paul" })
    await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    const suggestions = await as.query(api.modules.people.profile.suggestHandles, { displayName: "Lynda Onanga" })
    expect(suggestions.slice(0, 2).map((s) => s.handle).sort()).toEqual(["lynda.onanga", "onanga.lynda"])
    expect(suggestions.find((s) => s.handle === "lynda.onanga")?.available).toBe(false)
    expect(suggestions.find((s) => s.handle === "onanga.lynda")?.available).toBe(true)
  })

  it("un identifiant pris, ou porté naguère par une autre personne, est indisponible", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const paul = t.withIdentity({ subject: "auth-paul" })
    await paul.mutation(api.modules.people.persons.ensureMyPerson, {})
    expect(code(await caught(paul.mutation(api.modules.people.profile.publishMyProfile, { handle: "Lynda.Onanga", displayName: "Paul" })))).toBe(
      "handleUnavailable",
    )
    // Lynda change d'identifiant : l'ancien lui reste réservé.
    await lynda.as.mutation(api.modules.people.profile.publishMyProfile, { handle: "lynda", displayName: "Lynda" })
    expect(code(await caught(paul.mutation(api.modules.people.profile.publishMyProfile, { handle: "lynda.onanga", displayName: "Paul" })))).toBe(
      "handleUnavailable",
    )
    // …et elle peut le reprendre.
    await expect(lynda.as.mutation(api.modules.people.profile.publishMyProfile, { handle: "lynda.onanga", displayName: "Lynda" })).resolves.toEqual({
      handle: "lynda.onanga",
    })
  })

  it("une règle du domaine enfreinte rend son code et ses bornes", async () => {
    const t = testConvex()
    await seed(t)
    const as = t.withIdentity({ subject: "auth-x" })
    await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    const error = await caught(as.mutation(api.modules.people.profile.publishMyProfile, { handle: "ab", displayName: "X" }))
    expect(code(error)).toBe("invalidArgument")
    expect(engineErrorRule(error)).toEqual({ rule: "HANDLE_LENGTH", params: { min: 3, max: 30 } })
  })

  it("dit si un identifiant choisi est libre POUR la personne : pris, ancien d'une autre, le sien, forme invalide", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    await lynda.as.mutation(api.modules.people.profile.publishMyProfile, { handle: "lynda", displayName: "Lynda" })
    const paul = t.withIdentity({ subject: "auth-paul" })
    await paul.mutation(api.modules.people.persons.ensureMyPerson, {})
    const available = (as: typeof paul, handle: string) => as.query(api.modules.people.profile.isHandleAvailable, { handle })
    expect(await available(paul, "Paul.Mba")).toEqual({ available: true })
    expect(await available(paul, "lynda")).toEqual({ available: false })
    // L'ancien identifiant de Lynda lui reste réservé : libre pour elle, pas pour Paul.
    expect(await available(paul, "lynda.onanga")).toEqual({ available: false })
    expect(await available(lynda.as, "lynda.onanga")).toEqual({ available: true })
    const error = await caught(available(paul, "a!"))
    expect(code(error)).toBe("invalidArgument")
    expect(engineErrorRule(error)?.rule).toBe("HANDLE_LENGTH")
  })
})

describe("publier et lire le fil", () => {
  it("une publication publique se lit dans le fil de tout membre du réseau, réactions comprises", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const paul = await enter(t, "auth-paul", "paul.ndong", "Paul Ndong")
    const { postId } = await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "  Bonjour #Libreville @paul.ndong  " })

    const page = await paul.as.query(api.modules.posts.posts.feed, { networkId: paul.rootId, paginationOpts: { numItems: 10, cursor: null } })
    expect(page.page).toHaveLength(1)
    expect(page.page[0]).toMatchObject({
      _id: postId,
      body: "Bonjour #Libreville @paul.ndong",
      audience: "public",
      visibility: "network",
      isMine: false,
      author: { handle: "lynda.onanga", displayName: "Lynda Onanga", badges: ["community"] },
      reactions: { total: 0, mine: null },
    })
    const stored = await t.run(async (ctx) => ctx.db.get(postId))
    expect(stored?.tags).toEqual(["libreville"])
    expect(stored?.mentionedPersonIds).toEqual([paul.personId])
  })

  it("une publication réservée aux connexions n'est lue que par son auteur tant que le graphe n'existe pas", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const paul = await enter(t, "auth-paul", "paul.ndong")
    await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Entre nous", audience: "connections" })
    const forPaul = await paul.as.query(api.modules.posts.posts.feed, { networkId: paul.rootId, paginationOpts: { numItems: 10, cursor: null } })
    const forLynda = await lynda.as.query(api.modules.posts.posts.feed, { networkId: lynda.rootId, paginationOpts: { numItems: 10, cursor: null } })
    expect(forPaul.page).toHaveLength(0)
    expect(forLynda.page.map((item) => item.body)).toEqual(["Entre nous"])
  })

  it("un non-membre ne lit ni ne publie : refus indistinct", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const stranger = t.withIdentity({ subject: "auth-stranger" })
    await stranger.mutation(api.modules.people.persons.ensureMyPerson, {})
    expect(code(await caught(stranger.query(api.modules.posts.posts.feed, { networkId: lynda.rootId, paginationOpts: { numItems: 5, cursor: null } })))).toBe(
      "notFound",
    )
    expect(code(await caught(stranger.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Je passe" })))).toBe("notFound")
  })

  it("une publication vide est refusée par la règle du domaine ; l'idempotence ne double rien", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    expect(engineErrorRule(await caught(lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "   " })))).toEqual({
      rule: "POST_EMPTY",
      params: {},
    })
    const first = await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Une fois", idempotencyKey: "cle-1" })
    const again = await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Une fois", idempotencyKey: "cle-1" })
    expect(again.postId).toEqual(first.postId)
  })

  it("la publication d'un membre déclaré sans badge fort est bornée au seuil renforcé", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const codes: (string | null)[] = []
    for (let index = 0; index < 12; index += 1) {
      codes.push(code(await caught(lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: `Billet ${index}` }))))
    }
    expect(codes.slice(0, 3)).toEqual([null, null, null])
    expect(codes.slice(3).every((value) => value === "rateLimited")).toBe(true)
  })
})

describe("réagir", () => {
  it("une réaction par personne : changer de genre remplace, rejouer retire ; le compte se lit dans les fragments", async () => {
    const t = testConvex()
    await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const paul = await enter(t, "auth-paul", "paul.ndong")
    const awa = await enter(t, "auth-awa", "awa.mba")
    const { postId } = await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Réagissez" })

    expect(await paul.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: paul.rootId, postId, kind: "like" })).toEqual({
      mine: "like",
    })
    expect(await awa.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: awa.rootId, postId, kind: "bravo" })).toEqual({
      mine: "bravo",
    })
    expect(await paul.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: paul.rootId, postId, kind: "soutien" })).toEqual({
      mine: "soutien",
    })

    const seenByPaul = await paul.as.query(api.modules.posts.posts.feed, { networkId: paul.rootId, paginationOpts: { numItems: 5, cursor: null } })
    expect(seenByPaul.page[0]?.reactions).toEqual({ counts: { like: 0, bravo: 1, soutien: 1, instructif: 0 }, total: 2, mine: "soutien" })

    expect(await awa.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: awa.rootId, postId, kind: "bravo" })).toEqual({ mine: null })
    const seenByLynda = await lynda.as.query(api.modules.posts.posts.feed, { networkId: lynda.rootId, paginationOpts: { numItems: 5, cursor: null } })
    expect(seenByLynda.page[0]?.reactions).toEqual({ counts: { like: 0, bravo: 0, soutien: 1, instructif: 0 }, total: 1, mine: null })

    // La publication elle-même n'est JAMAIS réécrite par l'engagement.
    const post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post?.updatedAt).toEqual(post?.createdAt)
    const shards = await t.run(async (ctx) => ctx.db.query("postReactionShards").take(20))
    expect(shards.every((shard) => shard.shard >= 0 && shard.shard < REACTION_SHARDS)).toBe(true)
  })

  it("réagir à une publication d'un autre réseau, ou inexistante, rend le même refus", async () => {
    const t = testConvex()
    const seeded = await seed(t)
    const lynda = await enter(t, "auth-lynda", "lynda.onanga")
    const { postId } = await lynda.as.mutation(api.modules.posts.posts.publish, { networkId: lynda.rootId, body: "Ici" })
    const closedId: Id<"networks"> = seeded.testClosed
    expect(
      code(await caught(lynda.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: closedId, postId, kind: "like" }))),
    ).toBe("notFound")
  })
})

describe("garde-fous de développement", () => {
  it("les outils de développement exigent la variable ET un backend local", () => {
    expect(devToolsAllowed({})).toBe(false)
    expect(devToolsAllowed({ ANTSIA_DEV_TOOLS: "true" })).toBe(false)
    expect(devToolsAllowed({ ANTSIA_DEV_TOOLS: "true", CONVEX_CLOUD_URL: "https://exemple.convex.cloud" })).toBe(false)
    expect(devToolsAllowed({ ANTSIA_DEV_TOOLS: "true", CONVEX_CLOUD_URL: "http://127.0.0.1:3210" })).toBe(true)
    expect(isLocalDeployment({ CONVEX_CLOUD_URL: "http://localhost:3210" })).toBe(true)
  })

  it("hors outils ouverts, aucun code ne s'enregistre ni ne se lit", async () => {
    const t = testConvex()
    await t.mutation(internal.modules.platform.devTools.recordOtp, { email: "a@exemple.test", code: "123456", expiresAt: 1 })
    expect(await t.query(api.modules.platform.devTools.latestOtp, { email: "a@exemple.test" })).toBeNull()
    expect(await t.run(async (ctx) => ctx.db.query("devOtpCodes").take(5))).toEqual([])
  })

  it("le fragment d'une personne est stable et borné", () => {
    for (const id of ["k1", "k2", "une-personne", "x".repeat(40)]) {
      expect(shardOf(id)).toBe(shardOf(id))
      expect(shardOf(id)).toBeGreaterThanOrEqual(0)
      expect(shardOf(id)).toBeLessThan(REACTION_SHARDS)
    }
  })
})
