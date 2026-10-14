import { defineSchema } from "convex/server"

/**
 * Schéma du moteur social national ANTIA.
 *
 * VIDE au prompt PA0 (« aucune table, aucun métier »). Les tables arrivent par
 * tranches verticales : chaque module expose `convex/modules/<module>/tables.ts`,
 * agrégé ici. Les fondations multi-réseaux (`networks`, `persons`,
 * `identityLinks`, `networkMemberships`, `personFacets`, `consents`,
 * `handleHistory`) viennent d'abord (PA2), avant toute duplication (PA3).
 *
 * `schemaValidation: true` est NON NÉGOCIABLE (le socle l'a désactivée, ce qui
 * laissait les validateurs de tables sans effet à l'exécution — annexe A §0.4).
 * Fichier partagé avec la session DIASPORALE : modifié par la session ANTIA
 * seulement, sur demande.
 */
export default defineSchema({}, { schemaValidation: true })
