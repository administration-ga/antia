/**
 * Tables de la plateforme (console du moteur) : les opérateurs. Socle minimal
 * posé en PA2 pour garder les fonctions de console ; la console complète
 * (IDN `loa ≥ 2` obligatoire, journal `operatorAudit`, double validation des
 * actes irréversibles) arrive au prompt PA7.
 */
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const platformTables = {
  operators: defineTable({
    personId: v.id("persons"),
    role: v.union(v.literal("platform_operator"), v.literal("platform_admin")),
    grantedAt: v.number(),
    grantedByPersonId: v.optional(v.id("persons")),
    revokedAt: v.optional(v.number()),
  }).index("by_person", ["personId"]),
}
