/** PA9B : état opérateur fermé et relance administrative motivée des copies de médias. */
import { assertDecisionReason } from "@antsia/social-domain/audit"
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { checked, fail, notFound } from "../../lib/errors"
import { operatorMutation, operatorQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { appendAudit, operatorCapacity } from "../platform/audit"
import { requireFederationAdmin } from "./access"
import { clearFederatedMedia, queueFederatedMedia } from "./mediaJobs"
import { isFederatedContentAvailable } from "./mirrorAccess"

type MediaTransfer = {
  mirrorId: Id<"mirrors">
  networkId: Id<"networks">
  localTable: "pages" | "posts"
  objectRef: string
  status: "pending" | "running" | "attached" | "failed"
  attempts: number
  reason: "configuration" | "download" | "obsolete" | "admission" | null
  updatedAt: number
}

const mediaTransferValidator = v.object({
  mirrorId: v.id("mirrors"), networkId: v.id("networks"),
  localTable: v.union(v.literal("pages"), v.literal("posts")), objectRef: v.string(),
  status: v.union(v.literal("pending"), v.literal("running"), v.literal("attached"), v.literal("failed")),
  attempts: v.number(),
  reason: v.union(v.literal("configuration"), v.literal("download"), v.literal("obsolete"), v.literal("admission"), v.null()),
  updatedAt: v.number(),
})

/** Le curseur reste celui de la fenêtre brute, même si son filtre ne rend aucune ligne. */
export const paginate = operatorQuery({
  args: { networkId: v.id("networks"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(mediaTransferValidator),
  handler: async (ctx, args): Promise<PaginationResult<MediaTransfer>> => {
    const result = await ctx.db.query("mirrors")
      .withIndex("by_network", (q) => q.eq("networkId", args.networkId))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.min(20, Math.max(1, args.paginationOpts.numItems)) })
    const page = result.page.flatMap((row): MediaTransfer[] => {
      if (!row.mediaManifest?.length || (row.localTable !== "pages" && row.localTable !== "posts")) return []
      return [{
        mirrorId: row._id, networkId: row.networkId, localTable: row.localTable, objectRef: row.objectRef,
        status: row.mediaStatus ?? "pending", attempts: row.mediaAttempts ?? 0,
        reason: row.mediaError ?? null, updatedAt: row.updatedAt,
      }]
    })
    // Aucun manifeste, URL, identifiant de stockage, digest ni corps d'enveloppe ne sort.
    return { ...result, page }
  },
})

/** Une relance remet à zéro un lot courant ; elle n'autorise aucune restauration de source retirée. */
export const retry = operatorMutation({
  args: { mirrorId: v.id("mirrors"), reason: v.string() },
  returns: v.object({ status: v.literal("pending") }),
  handler: async (ctx, args) => {
    await requireFederationAdmin(ctx, ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const reason = checked(() => assertDecisionReason(args.reason, 10))
    const row = await ctx.db.get(args.mirrorId)
    if (!row) return notFound()
    const now = Date.now()
    const expired = row.mediaStatus === "running" && row.mediaLeaseUntil !== undefined && row.mediaLeaseUntil <= now
    if (row.mediaStatus !== "failed" && !expired) return fail("conflict")
    if (row.sourceState !== "active" || (row.localTable !== "pages" && row.localTable !== "posts") || !row.localId
      || row.sourceRevision === undefined || !Number.isSafeInteger(row.sourceRevision) || row.sourceRevision < 1
      || !row.sourceDigest || !row.mediaManifest?.length) return fail("policyRefused")
    if (!await isFederatedContentAvailable(ctx, row.localTable, row.localId)) return fail("policyRefused")
    const manifest = row.mediaManifest
    await clearFederatedMedia(ctx, row)
    await queueFederatedMedia(ctx, row._id, row.sourceRevision, row.sourceDigest, manifest)
    await appendAudit(ctx, {
      action: "federation.media_retry", capacity: operatorCapacity(ctx.operator), actorPersonId: ctx.person._id,
      networkId: row.networkId, subject: { table: "mirrors", id: row._id },
      details: { reason, from: row.mediaStatus ?? null, attempts: row.mediaAttempts ?? 0 }, at: now,
    })
    return { status: "pending" as const }
  },
})
