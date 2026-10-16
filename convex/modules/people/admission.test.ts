// @vitest-environment edge-runtime
/** PA4 : une vérification tardive n'écrase ni choix ni sanction à la racine. */
import { describe, expect, it } from "vitest"

import { internal } from "../../_generated/api"
import type { Doc } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { promoteDerivedRootMembership } from "./admission"

async function fixture(rootStatus: Doc<"networkMemberships">["status"] | null = "declaree") {
  const t = testConvex({ automaticSessions: false })
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const now = Date.now()
  const personId = await t.run(async (ctx) => await ctx.db.insert("persons", { authUserId: "server-person-fixture", displayName: "Awa", handle: "awa.recette", publishedAt: now, createdAt: now, updatedAt: now }))
  const childId = await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId: testClosed, personId, status: "verifiee", verifiedBy: "consulat", role: "member", joinedAt: now, statusChangedAt: now }))
  const rootId = rootStatus === null ? null : await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId: root, personId, status: rootStatus, role: "network_admin", derivedFrom: testClosed, joinedAt: now, statusChangedAt: now, ...(rootStatus === "suspendue" ? { statusBeforeSuspension: "declaree", suspendedUntil: now + 60_000 } : {}), ...(rootStatus === "partie" ? { leftAt: now } : {}) }))
  return { t, root, testClosed, personId, childId, rootId }
}

describe("promotion de la racine par une vérification enfant tardive", () => {
  it("élève la racine existante, conserve rôle/origine/date d'entrée, et met l'annuaire à jour", async () => {
    const { t, root, testClosed, personId, rootId } = await fixture()
    const before = await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)
    expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))).toBe(true)
    expect(await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)).toMatchObject({ status: "verifiee", verifiedBy: "consulat", role: "network_admin", derivedFrom: testClosed, joinedAt: before?.joinedAt })
    expect(await t.run(async (ctx) => await ctx.db.query("peopleDirectory").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", personId)).unique())).toMatchObject({ listed: true })
    expect(await t.run(async (ctx) => await ctx.db.query("networkMemberships").take(5))).toHaveLength(2)
  })

  it("un second passage est idempotent et conserve la source déjà vérifiée", async () => {
    const { t, testClosed, personId, rootId } = await fixture()
    await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))
    const before = await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)
    expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "operator"))).toBe(false)
    expect(await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)).toEqual(before)
  })

  it("ne crée jamais une racine absente", async () => {
    const { t, root, testClosed, personId } = await fixture(null)
    expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))).toBe(false)
    expect(await t.run(async (ctx) => await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", personId)).unique())).toBeNull()
  })

  it("ne réactive pas une racine partie et préserve la sanction et son statut de restauration", async () => {
    for (const status of ["partie", "suspendue"] as const) {
      const { t, testClosed, personId, rootId } = await fixture(status)
      const before = await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)
      expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))).toBe(false)
      expect(await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)).toEqual(before)
    }
  })

  it("un enfant non vérifié ou sorti ne promeut pas la racine", async () => {
    for (const status of ["en_attente", "declaree", "partie", "suspendue"] as const) {
      const { t, testClosed, personId, childId, rootId } = await fixture()
      await t.run(async (ctx) => await ctx.db.patch(childId, { status }))
      expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))).toBe(false)
      expect(await t.run(async (ctx) => rootId ? await ctx.db.get(rootId) : null)).toMatchObject({ status: "declaree" })
    }
  })

  it("un réseau source archivé n'élève pas la racine et la racine n'est pas son propre enfant", async () => {
    const { t, root, testClosed, personId } = await fixture()
    expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, root, "consulat"))).toBe(false)
    await t.run(async (ctx) => await ctx.db.patch(testClosed, { status: "archived" }))
    expect(await t.run(async (ctx) => await promoteDerivedRootMembership(ctx, personId, testClosed, "consulat"))).toBe(false)
  })
})
