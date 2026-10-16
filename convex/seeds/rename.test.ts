// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../_generated/api"
import { devToolsAllowed } from "../lib/devTools"
import { enter, seed } from "../modules/calls/fixtures.setup"
import { testConvex } from "../test.setup"
import { assertSeedsAllowed, SEED_CONFIRMATION, seedsAllowed } from "./foundations"

afterEach(() => vi.unstubAllEnvs())

describe("nom canonique ANTSIA — reprise des données", () => {
  it("résout le nouveau nom avant migration, puis renomme la même racine sans changer les adhésions", async () => {
    const t = testConvex()
    const original = await seed(t)
    const person = await enter(t, original.root, "rename.demo")
    await t.run(async (ctx) => ctx.db.patch(original.root, { slug: "antia", name: "ANTIA", theme: "antia" }))
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })).toMatchObject({ _id: original.root, slug: "antsia", name: "ANTSIA", theme: "antsia" })
    const renamed = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    expect(renamed).toEqual({ root: original.root, testClosed: original.testClosed, created: [] })
    const facts = await t.run(async (ctx) => ({
      root: await ctx.db.get(original.root), child: await ctx.db.get(original.testClosed),
      roots: await ctx.db.query("networks").withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active")).take(2),
      membership: await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", original.root).eq("personId", person.personId)).unique(),
    }))
    expect(facts.root).toMatchObject({ slug: "antsia", name: "ANTSIA", theme: "antsia" })
    expect(facts.child?.parentId).toBe(original.root)
    expect(facts.roots).toHaveLength(1)
    expect(facts.membership).toMatchObject({ networkId: original.root, personId: person.personId, status: "declaree" })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "antia" })).toMatchObject({ _id: original.root, slug: "antsia" })
    expect(await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })).toEqual(renamed)
  })

  it("refuse une collision du nouveau nom et conserve la racine originale", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(root, { slug: "antia", name: "ANTIA", theme: "antia" })
      await ctx.db.insert("networks", { slug: "antsia", kind: "closed", parentId: root, name: "Autre réseau", membershipPolicy: "declared_or_verified", defaultVisibility: "network", reachValues: [], theme: "antsia", status: "active", createdAt: 1, updatedAt: 1 })
    })
    await expect(t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })).rejects.toThrow(/déjà utilisé/)
    expect(await t.run((ctx) => ctx.db.get(root))).toMatchObject({ slug: "antia", name: "ANTIA", theme: "antia" })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })).toBeNull()
  })

  it("ne traite jamais un réseau fermé ou archivé comme alias de racine", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    await t.run(async (ctx) => { await ctx.db.patch(root, { slug: "another-root" }); await ctx.db.patch(testClosed, { slug: "antia" }) })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })).toBeNull()
    await t.run(async (ctx) => { await ctx.db.patch(testClosed, { slug: "test-closed" }); await ctx.db.patch(root, { slug: "antia", status: "archived" }) })
    expect(await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })).toBeNull()
  })

  it("conserve les anciennes variables de développement avec priorité aux nouvelles et garde locale", () => {
    const local = { CONVEX_CLOUD_URL: "http://127.0.0.1:3210" }
    expect(devToolsAllowed({ ...local, ANTIA_DEV_TOOLS: "true" })).toBe(true)
    expect(devToolsAllowed({ ...local, ANTIA_DEV_TOOLS: "true", ANTSIA_DEV_TOOLS: "false" })).toBe(false)
    expect(devToolsAllowed({ CONVEX_CLOUD_URL: "https://example.convex.cloud", ANTIA_DEV_TOOLS: "true" })).toBe(false)
    expect(seedsAllowed({ ANTIA_SEEDS_ALLOWED: "true" })).toBe(true)
    expect(seedsAllowed({ ANTIA_SEEDS_ALLOWED: "true", ANTSIA_SEEDS_ALLOWED: "false" })).toBe(false)
    vi.stubEnv("ANTSIA_SEEDS_ALLOWED", "false")
    vi.stubEnv("ANTIA_SEEDS_ALLOWED", "true")
    vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud")
    expect(() => assertSeedsAllowed("ANTIA_SEEDS_HORS_PRODUCTION")).toThrow(/hors production/)
    vi.stubEnv("CONVEX_CLOUD_URL", local.CONVEX_CLOUD_URL)
    expect(() => assertSeedsAllowed("ANTIA_SEEDS_HORS_PRODUCTION")).not.toThrow()
  })
})
