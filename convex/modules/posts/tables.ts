// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 137-300) @ ad2e7fdc2 — adaptations : `networkId` et visibilité `network`/`root` sur chaque publication, index préfixés par le réseau ; auteurs et réacteurs en personnes ; AUCUN compteur sur la publication (dette D01 du document 02) : les réactions se comptent par fragments (`postReactionShards`) ; médias, partages, groupes, pages, directs et évènements arrivent avec leurs modules (PA3).
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { contentVisibilityValidator, postAudienceValidator, postStatusValidator } from "../../lib/validators"

export const postsTables = {
  posts: defineTable({
    networkId: v.id("networks"),
    authorPersonId: v.id("persons"),
    /** Le corps, déjà validé (`assertPostContent`). */
    body: v.string(),
    audience: postAudienceValidator,
    /** `network` : visible dans son réseau ; `root` : aussi à la racine (geste explicite ou règle). */
    visibility: contentVisibilityValidator,
    status: postStatusValidator,
    tags: v.optional(v.array(v.string())),
    mentionedPersonIds: v.optional(v.array(v.id("persons"))),
    /** Corps et tags, repliés pour l'index plein texte (chaîne vide pour un partage sans mot). */
    searchText: v.string(),
    idempotencyKey: v.optional(v.string()),
    publishedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    editedAt: v.optional(v.number()),
    removedAt: v.optional(v.number()),
  })
    .index("by_network_status_publishedAt", ["networkId", "status", "publishedAt"])
    .index("by_network_author_status_publishedAt", ["networkId", "authorPersonId", "status", "publishedAt"])
    .index("by_author_and_idempotencyKey", ["authorPersonId", "idempotencyKey"])
    .searchIndex("search_body", { searchField: "searchText", filterFields: ["networkId", "status"] }),
}
