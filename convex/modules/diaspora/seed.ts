/**
 * Graine du réseau `diasporale` — hors production seulement (double garde du
 * moteur : argument de confirmation ET déploiement local ou autorisé).
 *
 * Réseau fermé, enfant de la racine, GOUVERNÉ par la tranche `diaspora`,
 * politique « déclaré ou vérifié », visibilité « réseau », pays ouverts de
 * départ (arbitrage A8 : la France), facette diaspora au format du moteur, et un
 * hub par pays ouvert, compteurs à zéro jusqu'au premier passage nocturne.
 * Idempotente : rejouée, elle ne double rien. La racine doit exister (graine des
 * fondations d'abord). En production, la console crée le réseau avec
 * `managedBy: "diaspora"`.
 */
import { validateFacetSchema } from "@antia/social-domain/facets"
import { isValidNetworkSlug, validateNetworkShape } from "@antia/social-domain/network"
import { DIASPORALE_NETWORK_SEED, DIASPORALE_SLICE, type EngineFacetField } from "@diasporale/domain"
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { getRootNetwork } from "../../lib/access"
import { assertSeedsAllowed, ensureNetwork } from "../../seeds/foundations"
import { hubRow } from "./hubs"

/** Un champ de facette du domaine (listes figées) au format mutable des tables du moteur. */
function engineFacetField(field: EngineFacetField) {
  return {
    key: field.key,
    kind: field.kind,
    required: field.required,
    defaultVisibility: field.defaultVisibility,
    ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
    ...(field.maxItems !== undefined ? { maxItems: field.maxItems } : {}),
    ...(field.excludedValues !== undefined ? { excludedValues: [...field.excludedValues] } : {}),
  }
}

export const run = internalMutation({
  args: { confirmNonProduction: v.string() },
  returns: v.object({ network: v.id("networks"), created: v.boolean(), hubs: v.array(v.string()) }),
  handler: async (ctx, { confirmNonProduction }) => {
    assertSeedsAllowed(confirmNonProduction)
    const root = await getRootNetwork(ctx)
    if (!root) throw new Error("Graine refusée : le réseau racine manque (graine des fondations d'abord).")

    const seed = DIASPORALE_NETWORK_SEED
    const facetSchema = { fields: seed.facetSchema.fields.map(engineFacetField) }
    const shapeErrors = validateNetworkShape({
      kind: seed.kind,
      parentId: root._id,
      membershipPolicy: seed.membershipPolicy,
      defaultVisibility: seed.defaultVisibility,
    })
    if (!isValidNetworkSlug(seed.slug) || shapeErrors.length > 0 || validateFacetSchema(facetSchema).length > 0) {
      throw new Error("Graine refusée : réglages du réseau diasporale invalides pour le moteur.")
    }

    const now = Date.now()
    const network = await ensureNetwork(ctx, seed.slug, () => ({
      slug: seed.slug,
      kind: seed.kind,
      parentId: root._id,
      managedBy: DIASPORALE_SLICE,
      name: seed.name,
      membershipPolicy: seed.membershipPolicy,
      defaultVisibility: seed.defaultVisibility,
      facetSchema,
      reachValues: [...seed.reachValues],
      openCountries: [...seed.openCountries],
      theme: seed.theme,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }))

    const hubs: string[] = []
    for (const country of seed.openCountries) {
      if (await hubRow(ctx, network.id, country)) continue
      await ctx.db.insert("countryHubs", {
        networkId: network.id,
        country,
        members: 0,
        associations: 0,
        companies: 0,
        upcomingEvents: 0,
        updatedAt: now,
      })
      hubs.push(country)
    }
    return { network: network.id, created: network.created, hubs }
  },
})
