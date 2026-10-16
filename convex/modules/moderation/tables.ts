// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 347-366, `reseauPersonnel_contentReports`) @ ad2e7fdc2 — adaptations : `networkId` (le réseau du contenu signalé : c'est la file de SES modérateurs) ; personnes ; motifs et statuts du domaine ; `by_status_and_createdAt` préfixé par le réseau ; `by_post` lu par la cascade de suppression d'un groupe ; `by_comment` non recopié (D35).
/**
 * Signalements — un lecteur signale une publication ou un commentaire ; la file
 * du réseau du contenu les reçoit. La modération à l'échelle (équipes, sanctions,
 * recours, relecture) arrive en PA5 sur cette table.
 */
import { CONTENT_REPORT_REASONS, CONTENT_REPORT_STATUSES } from "@antsia/social-domain/moderation"
import { MODERATION_SURFACES, SANCTION_KINDS } from "@antsia/social-domain/moderationPolicy"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const contentReportReasonValidator = literals(CONTENT_REPORT_REASONS)
export const contentReportStatusValidator = literals(CONTENT_REPORT_STATUSES)
export const moderationSurfaceValidator = literals(MODERATION_SURFACES)
export const sanctionKindValidator = literals(SANCTION_KINDS)
export const moderationTargetValidator = v.union(
  v.object({ kind: v.literal("post"), id: v.id("posts") }),
  v.object({ kind: v.literal("comment"), id: v.id("postComments") }),
  v.object({ kind: v.literal("groupMessage"), id: v.id("groupMessages") }),
  v.object({ kind: v.literal("event"), id: v.id("events") }),
  v.object({ kind: v.literal("page"), id: v.id("pages") }),
  v.object({ kind: v.literal("person"), id: v.id("persons") }),
  v.object({ kind: v.literal("live"), id: v.id("liveSessions") }),
  v.object({ kind: v.literal("story"), id: v.id("stories") }),
  v.object({ kind: v.literal("album"), id: v.id("albums") }),
)

export const moderationTables = {
  reports: defineTable({
    networkId: v.id("networks"), target: moderationTargetValidator, targetKind: moderationSurfaceValidator, targetId: v.string(),
    reporterPersonId: v.optional(v.id("persons")), ownerPersonId: v.optional(v.id("persons")), reason: v.string(),
    source: v.optional(v.union(v.literal("reader"), v.literal("pre_review"))),
    teamId: v.optional(v.id("moderationTeams")), level: v.union(v.literal("team"), v.literal("network"), v.literal("platform")),
    status: contentReportStatusValidator, removedTarget: v.optional(v.boolean()), createdAt: v.number(), updatedAt: v.number(),
    reviewedAt: v.optional(v.number()), reviewedByPersonId: v.optional(v.id("persons")), decisionReason: v.optional(v.string()),
  }).index("by_reporter_target", ["reporterPersonId", "targetKind", "targetId"])
    .index("by_network_status_createdAt", ["networkId", "status", "createdAt"])
    .index("by_team_status_createdAt", ["teamId", "status", "createdAt"])
    .index("by_owner_createdAt", ["ownerPersonId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_target_status", ["targetKind", "targetId", "status"])
    .index("by_network_createdAt", ["networkId", "createdAt"]),
  moderationTeams: defineTable({ networkId: v.id("networks"), name: v.string(), scope: v.optional(moderationSurfaceValidator), active: v.boolean(), createdAt: v.number() })
    .index("by_network_active", ["networkId", "active"]),
  moderationTeamMembers: defineTable({ networkId: v.id("networks"), teamId: v.id("moderationTeams"), personId: v.id("persons"), active: v.boolean(), updatedAt: v.number() })
    .index("by_team_person", ["teamId", "personId"])
    .index("by_person_active", ["personId", "active"]),
  sanctions: defineTable({
    networkId: v.id("networks"), reportId: v.id("reports"), personId: v.id("persons"), kind: sanctionKindValidator,
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")), reason: v.string(),
    until: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
    previousMembershipStatus: v.optional(v.union(v.literal("en_attente"), v.literal("declaree"), v.literal("verifiee"))),
    target: moderationTargetValidator,
  }).index("by_person_status", ["personId", "status"])
    .index("by_status_until", ["status", "until"])
    .index("by_report", ["reportId"]),
  appeals: defineTable({
    networkId: v.id("networks"), reportId: v.id("reports"), personId: v.id("persons"), reason: v.string(),
    level: v.union(v.literal("network"), v.literal("platform")), status: v.union(v.literal("open"), v.literal("upheld"), v.literal("overturned")),
    createdAt: v.number(), updatedAt: v.number(), decisionReason: v.optional(v.string()), reviewedByPersonId: v.optional(v.id("persons")),
  }).index("by_report_level", ["reportId", "level"])
    .index("by_person_createdAt", ["personId", "createdAt"])
    .index("by_network_status_createdAt", ["networkId", "status", "createdAt"])
    .index("by_level_status_createdAt", ["level", "status", "createdAt"]),
  blockedTerms: defineTable({ networkId: v.id("networks"), term: v.string(), active: v.boolean(), updatedAt: v.number() })
    .index("by_network_active", ["networkId", "active"])
    .index("by_network_term", ["networkId", "term"]),
  moderationPolicies: defineTable({ networkId: v.id("networks"), surface: moderationSurfaceValidator, preReview: v.boolean(), maxLinks: v.number(), maxWrites: v.number(), windowMs: v.number(), updatedAt: v.number() })
    .index("by_network_surface", ["networkId", "surface"]),
  moderationContentStates: defineTable({
    networkId: v.id("networks"), targetKind: moderationSurfaceValidator, targetId: v.string(), ownerPersonId: v.optional(v.id("persons")),
    status: v.union(v.literal("published"), v.literal("pending_review"), v.literal("removed")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_target", ["targetKind", "targetId"])
    .index("by_network_status_updatedAt", ["networkId", "status", "updatedAt"])
    .index("by_network_owner_updatedAt", ["networkId", "ownerPersonId", "updatedAt"]),
  moderationTransparency: defineTable({ networkId: v.id("networks"), periodStart: v.number(), periodEnd: v.number(), cases: v.number(), distinctAuthors: v.number(), actioned: v.number(), dismissed: v.number(), generatedAt: v.number() })
    .index("by_network_period", ["networkId", "periodStart"]),
  contentReports: defineTable({
    networkId: v.id("networks"),
    targetKind: v.union(v.literal("post"), v.literal("comment")),
    postId: v.id("posts"),
    commentId: v.optional(v.id("postComments")),
    reporterPersonId: v.id("persons"),
    reportId: v.optional(v.id("reports")),
    reason: contentReportReasonValidator,
    /** La note du déclarant (bornée) — jamais son identité dans une file. */
    note: v.optional(v.string()),
    status: contentReportStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedByPersonId: v.optional(v.id("persons")),
    decisionReason: v.optional(v.string()),
  })
    // Un signalement par (déclarant, cible) : le second se dédoublonne.
    .index("by_reporter_target", ["reporterPersonId", "targetKind", "postId", "commentId"])
    // La file d'un réseau, par statut, la plus ancienne d'abord.
    .index("by_network_status_createdAt", ["networkId", "status", "createdAt"])
    // Les signalements d'une publication (cascade de la suppression d'un groupe).
    .index("by_post", ["postId"])
    .index("by_reportId", ["reportId"]),
}
