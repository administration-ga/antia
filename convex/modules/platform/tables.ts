/**
 * Tables de la plateforme : les opérateurs de la console et, en développement
 * local seulement, les codes à usage unique lisibles à l'écran. Socle minimal
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

  /**
   * Codes à usage unique de DÉVELOPPEMENT : écrits seulement quand les outils
   * de développement sont ouverts (variable ET déploiement local), pour que la
   * personne qui teste lise son code à l'écran sans service de courriel. Une
   * ligne par adresse, remplacée à chaque envoi. Toujours vide en production.
   */
  devOtpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
}
