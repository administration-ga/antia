// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 922-990, `reseauPersonnel_thematicGroups` et `reseauPersonnel_thematicGroupMembers`) @ ad2e7fdc2 — adaptations : `networkId` sur le groupe et sur l'appartenance ; personnes ; `memberCount` retiré du document (agrégat au module complet, D02) ; index réduits à ceux que lit la garde d'appartenance (lot 7) — découverte (`search_name` filtrée par réseau, D17), invitations et listes de membres arrivent avec le module complet (lot 9).
/**
 * Groupes THÉMATIQUES d'un réseau — un espace de discussion autour d'un thème,
 * avec son mur. Ce lot pose ce que la garde d'audience `group` lit : le groupe
 * (vivant ou fermé) et l'appartenance VIVANTE d'une personne.
 */
import { THEMATIC_GROUP_ROLES } from "@antia/social-domain/thematicGroups"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const thematicGroupRoleValidator = literals(THEMATIC_GROUP_ROLES)

export const thematicGroupsTables = {
  thematicGroups: defineTable({
    networkId: v.id("networks"),
    name: v.string(),
    /** Le thème, dit en clair. Facultatif — un nom peut suffire. */
    description: v.optional(v.string()),
    createdByPersonId: v.id("persons"),
    /**
     * Publication ÉPINGLÉE en tête du mur — un acte de MODÉRATION du groupe.
     * Relue AVEC SA GARDE à chaque lecture : retirée, elle disparaît d'elle-même.
     */
    pinnedPostId: v.optional(v.id("posts")),
    /** Nom et description, originaux et repliés sans accents — ce que lit la découverte. */
    searchText: v.string(),
    /** Tirée au montage du formulaire — même règle que les publications. */
    idempotencyKey: v.string(),
    /** Fermé : plus aucune adhésion, invitation, publication ni modération ; l'historique reste. */
    closedAt: v.optional(v.number()),
    /** Archivé : fermeture renforcée et retrait de la découverte, jamais une suppression. */
    archivedAt: v.optional(v.number()),
    /** Suppression définitive demandée : les gardes ferment pendant la cascade bornée. */
    deletingAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  /**
   * L'appartenance d'une personne à un groupe thématique. Le DÉPART est une
   * date, pas une suppression : une ré-adhésion REPREND la ligne (en simple
   * membre). Un membre parti est un non-membre partout.
   */
  thematicGroupMembers: defineTable({
    networkId: v.id("networks"),
    groupId: v.id("thematicGroups"),
    personId: v.id("persons"),
    role: thematicGroupRoleValidator,
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  }).index("by_group_and_person", ["groupId", "personId"]),
}
