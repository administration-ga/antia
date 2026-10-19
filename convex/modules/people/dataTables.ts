// Dupliqué de socle/convex/crons/dataSubjectErasure.ts @ 25398f565 — adaptations : état de progression persisté, personne et toutes tables sociales du moteur, aucune table administrative ou donnée externe.
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const dataTables = {
  dataErasureJobs: defineTable({
    personId: v.id("persons"), authUserId: v.string(),
    phase: v.union(v.literal("waiting"), v.literal("verification"), v.literal("revoke"), v.literal("discover"), v.literal("erase"), v.literal("auth"), v.literal("cleanup")),
    requestedAt: v.number(), dueAt: v.number(), updatedAt: v.number(),
    tableIndex: v.number(), cursor: v.union(v.string(), v.null()),
    changed: v.boolean(), passes: v.number(), erasedRows: v.number(),
    identitySubjects: v.array(v.string()), contacts: v.array(v.string()),
  }).index("by_person", ["personId"]).index("by_phase_due", ["phase", "dueAt"]).index("by_updated", ["updatedAt"]).index("by_phase_updated", ["phase", "updatedAt"]),
  dataErasureTargets: defineTable({ jobId: v.id("dataErasureJobs"), table: v.string(), targetId: v.string() })
    .index("by_job_target", ["jobId", "targetId"]).index("by_job", ["jobId"])
    .index("by_job_table_target", ["jobId", "table", "targetId"]),
  dataExports: defineTable({ personId: v.id("persons"), requestedAt: v.number(), expiresAt: v.number() })
    .index("by_person", ["personId"]).index("by_expiry", ["expiresAt"]),
  /** Trace minimale de fin : aucune référence à la personne, au compte ou aux contenus. */
  dataErasureReceipts: defineTable({ completedAt: v.number(), erasedRows: v.number(), event: v.literal("person.erased.v1") })
    .index("by_completed", ["completedAt"]),
}
