/** PA10 : un état technique agrégé, sans nom de fonction, argument, erreur ou personne. */
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const operationalCoverageValidator = v.union(v.literal("complete"), v.literal("bounded"))
export const operationalSnapshotFields = {
  observedAt: v.number(),
  windowStart: v.number(),
  windowEnd: v.number(),
  scanned: v.number(),
  failed: v.number(),
  pending: v.number(),
  inProgress: v.number(),
  successful: v.number(),
  canceled: v.number(),
  coverage: operationalCoverageValidator,
}

export const operationalTables = {
  operationalSnapshots: defineTable({
    networkId: v.id("networks"),
    key: v.literal("scheduled_jobs"),
    ...operationalSnapshotFields,
  }).index("by_network_key", ["networkId", "key"]).index("by_observed_at", ["observedAt"]),
}
