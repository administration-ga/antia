/** PA8 : mesures publiques matérialisées, aucune référence de personne dans les jobs. */
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const publicStageValidator = v.union(v.literal("posts"), v.literal("pages"), v.literal("done"))
const measuredTagValidator = v.object({ tag: v.string(), posts: v.number(), authorsLowerBound: v.number() })

export const publicTables = {
  publicSnapshots: defineTable({
    networkId: v.id("networks"), generation: v.number(), generatedAt: v.number(),
    periodStart: v.number(), periodEnd: v.number(), publishedPosts: v.number(),
    officialPages: v.number(), trends: v.array(v.object({ tag: v.string(), posts: v.number() })),
    bounded: v.boolean(),
  }).index("by_network", ["networkId"]),
  publicAggregateJobs: defineTable({
    networkId: v.id("networks"), generation: v.number(), stage: publicStageValidator,
    cursor: v.union(v.string(), v.null()), startedAt: v.number(), cutoff: v.number(),
    periodStart: v.number(), scanned: v.number(), publishedPosts: v.number(),
    officialPages: v.number(), tags: v.array(measuredTagValidator), bounded: v.boolean(),
  }).index("by_network", ["networkId"]),
}
