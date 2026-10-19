/** PA10 : références de fil privées ; aucun corps, média ou profil recopié. */
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const feedBackfillPhase = v.union(v.literal("self"), v.literal("connectionsLow"), v.literal("connectionsHigh"), v.literal("follows"), v.literal("pages"), v.literal("signatories"), v.literal("done"))
export const feedFanoutPhase = v.union(v.literal("self"), v.literal("connectionsLow"), v.literal("connectionsHigh"), v.literal("followers"), v.literal("pageFollowers"), v.literal("pageSignatories"), v.literal("done"))

export const feedTables = {
  feedEntries: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), scope: v.literal("pour_vous"), postId: v.id("posts"),
    publishedAt: v.number(), postCreationTime: v.number(), expiresAt: v.number(), createdAt: v.number(),
  })
    .index("by_reader_post", ["networkId", "personId", "scope", "postId"])
    .index("by_reader_order", ["networkId", "personId", "scope", "publishedAt", "postCreationTime", "postId"])
    .index("by_post", ["postId"])
    .index("by_post_network", ["postId", "networkId"])
    .index("by_person", ["personId"])
    .index("by_expiresAt", ["expiresAt"]),
  feedCursors: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), scope: v.literal("pour_vous"), generation: v.number(),
    status: v.union(v.literal("building"), v.literal("ready")), phase: feedBackfillPhase, step: v.number(), sourceDone: v.boolean(),
    sourceCursor: v.union(v.string(), v.null()), postCursor: v.union(v.string(), v.null()),
    activePersonId: v.optional(v.id("persons")), activePageId: v.optional(v.id("pages")),
    accessVersion: v.string(), windowStart: v.number(), cutoff: v.number(), startedAt: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
  })
    .index("by_reader", ["networkId", "personId", "scope"])
    .index("by_person", ["personId"])
    .index("by_active_person", ["activePersonId"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),
  feedFanoutJobs: defineTable({
    networkId: v.id("networks"), postId: v.id("posts"), generation: v.number(), status: v.union(v.literal("pending"), v.literal("done")),
    phase: feedFanoutPhase, step: v.number(), cursor: v.union(v.string(), v.null()), startedAt: v.number(), updatedAt: v.number(), expiresAt: v.number(),
  })
    .index("by_network_post", ["networkId", "postId"])
    .index("by_network_status", ["networkId", "status"])
    .index("by_post", ["postId"])
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_expiresAt", ["expiresAt"]),
}
