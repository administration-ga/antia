// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 347-366, `reseauPersonnel_contentReports`) @ ad2e7fdc2 — adaptations : `networkId` (le réseau du contenu signalé : c'est la file de SES modérateurs) ; personnes ; motifs et statuts du domaine ; `by_status_and_createdAt` préfixé par le réseau ; `by_post` lu par la cascade de suppression d'un groupe ; `by_comment` non recopié (D35).
/**
 * Signalements — un lecteur signale une publication ou un commentaire ; la file
 * du réseau du contenu les reçoit. La modération à l'échelle (équipes, sanctions,
 * recours, relecture) arrive en PA5 sur cette table.
 */
import { CONTENT_REPORT_REASONS, CONTENT_REPORT_STATUSES } from "@antia/social-domain/moderation"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const contentReportReasonValidator = literals(CONTENT_REPORT_REASONS)
export const contentReportStatusValidator = literals(CONTENT_REPORT_STATUSES)

export const moderationTables = {
  contentReports: defineTable({
    networkId: v.id("networks"),
    targetKind: v.union(v.literal("post"), v.literal("comment")),
    postId: v.id("posts"),
    commentId: v.optional(v.id("postComments")),
    reporterPersonId: v.id("persons"),
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
    .index("by_post", ["postId"]),
}
