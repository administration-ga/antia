/**
 * Graine des FONDATIONS — hors production seulement (cahier PA2 §4).
 *
 * Pose le réseau racine `antsia` (ouvert) et, pour les tests de bout en bout,
 * un réseau fermé `test-closed` enfant de la racine. Idempotente (« chercher
 * puis créer », piège payé par PRO.GA : une graine rejouée ne double rien).
 *
 * DOUBLE garde : l'argument `confirmNonProduction` ET un déploiement local
 * (backend Convex sur la machine) ou la variable `ANTSIA_SEEDS_ALLOWED=true`
 * posée par le propriétaire sur un déploiement de développement. En production,
 * les réseaux se créent par la console (opérateur, trace).
 *
 * Une TRANCHE qui gouverne son réseau (`networks.managedBy`) sème le sien dans
 * son module (`convex/modules/<tranche>/seed.ts`) avec les mêmes aides :
 * `assertSeedsAllowed` (double garde) et `ensureNetwork` (idempotence) ; la
 * racine se lit par `getRootNetwork` après cette graine-ci.
 */
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { LEGACY_ROOT_NETWORK_SLUG, ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"
import { PROVINCE_SLUGS } from "@antsia/social-domain/provinces"
import { v } from "convex/values"

import type { Id } from "../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../_generated/server"
import { isLocalDeployment } from "../lib/devTools"
import { getRootNetwork } from "../lib/access"

export const SEED_CONFIRMATION = "ANTSIA_SEEDS_HORS_PRODUCTION"

export function seedsAllowed(env: Record<string, string | undefined> = process.env): boolean {
  // Compatibilité des variables déjà posées ; la nouvelle valeur prime, sans éditer l’environnement.
  return isLocalDeployment(env) || (env.ANTSIA_SEEDS_ALLOWED ?? env.ANTIA_SEEDS_ALLOWED) === "true"
}

/** La double garde de toute graine : argument de confirmation ET déploiement autorisé. */
export function assertSeedsAllowed(confirmNonProduction: string): void {
  if ((confirmNonProduction !== SEED_CONFIRMATION && confirmNonProduction !== "ANTIA_SEEDS_HORS_PRODUCTION") || !seedsAllowed()) {
    throw new Error("Graine refusée : hors production seulement (argument de confirmation et déploiement local ou ANTSIA_SEEDS_ALLOWED).")
  }
}

/** « Chercher puis créer » un réseau par son identifiant public : rejouer ne double rien. */
export async function ensureNetwork(
  ctx: MutationCtx,
  slug: string,
  build: () => Parameters<MutationCtx["db"]["insert"]>[1] & object,
): Promise<{ id: Id<"networks">; created: boolean }> {
  const existing = await ctx.db
    .query("networks")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()
  if (existing) return { id: existing._id, created: false }
  return { id: await ctx.db.insert("networks", build() as never), created: true }
}

export const run = internalMutation({
  args: { confirmNonProduction: v.string() },
  returns: v.object({ root: v.id("networks"), testClosed: v.id("networks"), created: v.array(v.string()) }),
  handler: async (ctx, { confirmNonProduction }) => {
    assertSeedsAllowed(confirmNonProduction)
    const now = Date.now()
    const created: string[] = []
    const existingRoot = await getRootNetwork(ctx)
    if (existingRoot) {
      if (existingRoot.slug !== ROOT_NETWORK_SLUG && existingRoot.slug !== LEGACY_ROOT_NETWORK_SLUG) throw new Error("Graine refusée : une autre racine existe déjà.")
      const collision = await ctx.db.query("networks").withIndex("by_slug", (q) => q.eq("slug", ROOT_NETWORK_SLUG)).unique()
      if (collision && collision._id !== existingRoot._id) throw new Error("Graine refusée : le nouvel identifiant de la racine est déjà utilisé.")
      if (existingRoot.slug !== ROOT_NETWORK_SLUG || existingRoot.name !== BRAND_NAME || existingRoot.theme === LEGACY_ROOT_NETWORK_SLUG) {
        await ctx.db.patch(existingRoot._id, { slug: ROOT_NETWORK_SLUG, name: BRAND_NAME, ...(existingRoot.theme === LEGACY_ROOT_NETWORK_SLUG ? { theme: ROOT_NETWORK_SLUG } : {}), updatedAt: now })
      }
    }
    const root = existingRoot ? { id: existingRoot._id, created: false } : await ensureNetwork(ctx, ROOT_NETWORK_SLUG, () => ({
      slug: ROOT_NETWORK_SLUG,
      kind: "root",
      name: BRAND_NAME,
      membershipPolicy: "open",
      defaultVisibility: "network",
      facetSchema: { fields: [{ key: "province", kind: "enum", required: false, defaultVisibility: "hidden", enumValues: [...PROVINCE_SLUGS] }] },
      reachValues: [],
      theme: "antsia",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }))
    if (root.created) created.push(ROOT_NETWORK_SLUG)
    const testClosed = await ensureNetwork(ctx, "test-closed", () => ({
      slug: "test-closed",
      kind: "closed",
      parentId: root.id,
      name: "Réseau fermé de test",
      membershipPolicy: "declared_or_verified",
      defaultVisibility: "network",
      facetSchema: {
        fields: [{ key: "countryOfResidence", kind: "country", required: true, defaultVisibility: "network", excludedValues: ["GA"] }],
      },
      reachValues: ["local", "diaspora"],
      openCountries: ["FR"],
      theme: "antsia",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }))
    if (testClosed.created) created.push("test-closed")
    return { root: root.id, testClosed: testClosed.id, created }
  },
})
