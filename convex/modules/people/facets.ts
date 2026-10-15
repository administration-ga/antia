/**
 * Facettes — les attributs d'une personne propres à un réseau (EXF-AN-04),
 * validés contre le schéma BORNÉ du réseau, chaque champ avec sa visibilité.
 */
import { projectFacets } from "@antia/social-domain/facets"
import { v } from "convex/values"

import { fail } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { facetValueValidator, facetVisibilityValidator } from "../../lib/validators"
import { writeNetworkFacet } from "./admission"

/**
 * La personne règle SA facette dans le réseau (membre, même en attente : elle
 * complète son entrée). Dans un réseau gouverné par une tranche, certains champs
 * ne viennent que d'une preuve (le poste consulaire, de l'attestation) : la
 * tranche seule les écrit.
 */
export const setMyFacet = networkMutation({
  minStatus: "en_attente",
  args: {
    values: v.record(v.string(), facetValueValidator),
    visibilities: v.record(v.string(), facetVisibilityValidator),
  },
  returns: v.null(),
  handler: async (ctx, { values, visibilities }) => {
    if (ctx.network.managedBy) return fail("policyRefused")
    await enforceRateLimit(ctx, "person.facet", ctx.person._id)
    if (!ctx.network.facetSchema) return fail("invalidArgument", { field: "facet" })
    await writeNetworkFacet(ctx, ctx.network, ctx.person._id, { values, visibilities })
    return null
  },
})

/** La personne lit SA facette dans le réseau (tout, y compris le caché). */
export const myFacet = networkQuery({
  args: {},
  returns: v.union(
    v.object({ values: v.record(v.string(), facetValueValidator), visibilities: v.record(v.string(), facetVisibilityValidator) }),
    v.null(),
  ),
  handler: async (ctx) => {
    const facet = await ctx.db
      .query("personFacets")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", ctx.networkId).eq("personId", ctx.person._id))
      .unique()
    if (!facet) return null
    const schema = ctx.network.facetSchema ?? { fields: [] }
    return { values: projectFacets(schema, facet.values, facet.visibilities, "self"), visibilities: facet.visibilities }
  },
})
