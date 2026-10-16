// @vitest-environment edge-runtime
/** Recette du mur : locale seulement, cible fictive fermée, aucune admission implicite. */
import type { MembershipStatus } from "@antsia/social-domain/membership"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
const HANDLE = "relations.recette"
const EMAIL = "relations.recette@exemple.test"
const NOW = Date.UTC(2026, 9, 16, 14)
const ARGS = { confirmNonProduction: SEED_CONFIRMATION }

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seedNetworks(t: T) {
  const foundations = await t.mutation(internal.seeds.foundations.run, ARGS)
  const diaspora = await t.mutation(internal.modules.diaspora.seed.run, ARGS)
  return { root: foundations.root, network: diaspora.network }
}

async function fixture(t: T, options: {
  handle?: string
  email?: string
  verified?: boolean
  status?: MembershipStatus
  rootStatus?: MembershipStatus
  withMembership?: boolean
  withdrawn?: boolean
} = {}) {
  const { root, network } = await seedNetworks(t)
  const user: unknown = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: { name: "Relations Recette", email: options.email ?? EMAIL, emailVerified: options.verified ?? true, createdAt: NOW, updatedAt: NOW },
    },
  })
  if (typeof user !== "object" || user === null || !("_id" in user) || typeof user._id !== "string") throw new Error("Utilisateur fictif de test absent")
  const authUserId = user._id
  const personId = await t.run(async (ctx) => {
    const person = await ctx.db.insert("persons", {
      authUserId, handle: options.handle ?? HANDLE, displayName: "Relations Recette", publishedAt: NOW,
      ...(options.withdrawn ? { withdrawnAt: NOW } : {}), createdAt: NOW, updatedAt: NOW,
    })
    await ctx.db.insert("networkMemberships", { networkId: root, personId: person, status: options.rootStatus ?? "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW })
    if (options.withMembership !== false) {
      await ctx.db.insert("networkMemberships", { networkId: network, personId: person, status: options.status ?? "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW })
    }
    return person
  })
  return { root, network, personId, authUserId }
}

async function posts(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("posts").take(100))
}

describe("diaspora/seed:profilePostsForRecette", () => {
  it("refuse sans confirmation avant toute écriture", async () => {
    const t = testConvex()
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, { confirmNonProduction: "oui" })).rejects.toThrow(/hors production/)
    expect(await posts(t)).toEqual([])
  })

  it("refuse un déploiement en nuage même si les graines y sont explicitement autorisées", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", "https://recette.convex.cloud")
    vi.stubEnv("ANTSIA_SEEDS_ALLOWED", "true")
    const t = testConvex()
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/backend local obligatoire/)
    expect(await posts(t)).toEqual([])
  })

  it("ne crée aucun réseau si DIASPORALE n'existe pas", async () => {
    const t = testConvex()
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/réseau diasporale actif/)
    expect(await t.run(async (ctx) => await ctx.db.query("networks").take(5))).toEqual([])
  })

  it("ne crée aucun profil quand le handle réservé est absent", async () => {
    const t = testConvex()
    await seedNetworks(t)
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/profil fictif préexistant/)
    expect(await t.run(async (ctx) => await ctx.db.query("persons").take(5))).toEqual([])
    expect(await posts(t)).toEqual([])
  })

  it("ne prend jamais un autre handle pour cible", async () => {
    const t = testConvex()
    const { personId } = await fixture(t, { handle: "autre.recette" })
    const before = await t.run(async (ctx) => await ctx.db.get(personId))
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/profil fictif préexistant/)
    expect(await t.run(async (ctx) => await ctx.db.get(personId))).toEqual(before)
    expect(await posts(t)).toEqual([])
  })

  it("ne crée aucune adhésion pour la cible non membre", async () => {
    const t = testConvex()
    await fixture(t, { withMembership: false })
    const before = await t.run(async (ctx) => await ctx.db.query("networkMemberships").take(5))
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/adhésion préexistante/)
    expect(await t.run(async (ctx) => await ctx.db.query("networkMemberships").take(5))).toEqual(before)
    expect(await posts(t)).toEqual([])
  })

  it.each(["en_attente", "suspendue", "partie"] as const)("refuse une adhésion %s sans la modifier", async (status) => {
    const t = testConvex()
    await fixture(t, { status })
    const before = await t.run(async (ctx) => await ctx.db.query("networkMemberships").take(5))
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/adhésion préexistante/)
    expect(await t.run(async (ctx) => await ctx.db.query("networkMemberships").take(5))).toEqual(before)
    expect(await posts(t)).toEqual([])
  })

  it.each(["suspendue", "partie"] as const)("une adhésion racine %s ferme aussi la recette", async (rootStatus) => {
    const t = testConvex()
    await fixture(t, { rootStatus })
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/adhésion préexistante/)
    expect(await posts(t)).toEqual([])
  })

  it.each([
    { email: "personne.reelle@exemple.test", verified: true },
    { email: EMAIL, verified: false },
  ])("le handle ne suffit pas sans l'identité fictive vérifiée ($verified)", async (options) => {
    const t = testConvex()
    await fixture(t, options)
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/identité fictive vérifiée/)
    expect(await posts(t)).toEqual([])
  })

  it("refuse le profil retiré sans le republier", async () => {
    const t = testConvex()
    const { personId } = await fixture(t, { withdrawn: true })
    await expect(t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).rejects.toThrow(/profil fictif préexistant/)
    expect(await t.run(async (ctx) => await ctx.db.get(personId))).toMatchObject({ withdrawnAt: NOW })
    expect(await posts(t)).toEqual([])
  })

  it("ajoute trente-cinq textes réseau idempotents sans toucher au profil, aux identités ni aux adhésions", async () => {
    const t = testConvex()
    const { root, network, personId, authUserId } = await fixture(t)
    const snapshot = async () => await t.run(async (ctx) => ({
      person: await ctx.db.get(personId),
      memberships: await ctx.db.query("networkMemberships").take(5),
      identities: await ctx.db.query("identityLinks").take(5),
      networks: await ctx.db.query("networks").take(5),
    }))
    const before = await snapshot()
    expect(await t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).toEqual({ handle: HANDLE, created: 35, existing: 0 })
    const first = await posts(t)
    expect(first).toHaveLength(35)
    expect(new Set(first.map((post) => post.body)).size).toBe(35)
    expect(new Set(first.map((post) => post.idempotencyKey)).size).toBe(35)
    for (const post of first) {
      expect(post).toMatchObject({ networkId: network, authorPersonId: personId, audience: "public", visibility: "network", onRoot: false, status: "published", reach: "diaspora" })
      expect(post.body).toMatch(/^PD4 mur recette \d{2}\/35 — Publication fictive/)
      expect(post.groupId).toBeUndefined()
      expect(post.pageId).toBeUndefined()
      expect(post.sharedPostId).toBeUndefined()
      expect(post.media).toBeUndefined()
    }
    expect(await t.mutation(internal.modules.diaspora.seed.profilePostsForRecette, ARGS)).toEqual({ handle: HANDLE, created: 0, existing: 35 })
    expect(await posts(t)).toEqual(first)
    expect(await snapshot()).toEqual(before)

    const reader = t.withIdentity({ subject: authUserId })
    const firstPage = await reader.query(api.modules.posts.posts.personPosts, { networkId: network, handle: HANDLE, limit: 30 })
    expect(firstPage.items).toHaveLength(30)
    expect(firstPage.nextCursor).not.toBeNull()
    const secondPage = await reader.query(api.modules.posts.posts.personPosts, { networkId: network, handle: HANDLE, limit: 30, cursor: firstPage.nextCursor! })
    expect(secondPage.items).toHaveLength(5)
    expect(secondPage.nextCursor).toBeNull()
    expect(new Set([...firstPage.items, ...secondPage.items].map((post) => post._id)).size).toBe(35)
    expect((await reader.query(api.modules.posts.posts.myFeed, { networkId: root, scope: "recents" })).items).toEqual([])
  })
})
