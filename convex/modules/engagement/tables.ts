// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 278-300) @ ad2e7fdc2 — adaptations : réactions en personnes, avec le réseau ; compteur FRAGMENTÉ (`postReactionShards`) à la place des champs `reactionCount(s)` écrits sur la publication (dette D01 du document 02).
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { reactionKindValidator } from "../../lib/validators"

export const engagementTables = {
  /** UNE réaction par (publication, personne) : changer de genre remplace, jamais n'empile. */
  postReactions: defineTable({
    networkId: v.id("networks"),
    postId: v.id("posts"),
    personId: v.id("persons"),
    kind: reactionKindValidator,
    createdAt: v.number(),
  })
    .index("by_post_and_person", ["postId", "personId"])
    .index("by_person", ["personId"]),

  /** Fragments du compteur de réactions d'une publication (somme des fragments = total). */
  postReactionShards: defineTable({
    postId: v.id("posts"),
    shard: v.number(),
    like: v.number(),
    bravo: v.number(),
    soutien: v.number(),
    instructif: v.number(),
  }).index("by_post_and_shard", ["postId", "shard"]),
}
