/**
 * Facettes — les attributs d'une personne propres à un réseau (EXF-AN-04),
 * validés contre le schéma BORNÉ du réseau, chaque champ avec sa visibilité.
 */
import { projectFacets, validateFacetValues } from "@antia/social-domain/facets"
import { v } from "convex/values"

import { fail } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { facetValueValidator, facetVisibilityValidator } from "../../lib/validators"

/** La personne règle SA facette dans le réseau (membre, même en attente : elle complète son entrée). */
export const setMyFacet = networkMutation({
  minStatus: "en_attente",
  args: {
    values: v.record(v.string(), facetValueValidator),
    visibilities: v.record(v.string(), facetVisibilityValidator),
  },
  returns: v.null(),
  handler: async (ctx, { values, visibilities }) => {
    await enforceRateLimit(ctx, "person.facet", ctx.person._id)
    const schema = ctx.network.facetSchema
    if (!schema) return fail("invalidArgument", { field: "facet" })
    const errors = validateFacetValues(schema, values)
    if (errors.length > 0) return fail("invalidArgument", { field: `facet.${errors[0]?.key ?? ""}` })
    const known = new Set(schema.fields.map((field) => field.key))
    if (Object.keys(visibilities).some((key) => !known.has(key))) return fail("invalidArgument", { field: "visibilities" })
    const existing = await ctx.db
      .query("personFacets")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", ctx.networkId).eq("personId", ctx.person._id))
      .unique()
    const row = { values, visibilities, updatedAt: Date.now() }
    if (existing) await ctx.db.patch(existing._id, row)
    else await ctx.db.insert("personFacets", { networkId: ctx.networkId, personId: ctx.person._id, ...row })
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
