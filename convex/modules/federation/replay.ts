// Dupliqué de socle/convex/modules/reseau/federation.ts @ 25398f565 — adaptations : rejeu par administrateur IDN vivant, même reçu/corps signé, journal moteur et trace dédiée, registre métier fermé sans re-provisionnement.
import { assertDecisionReason } from "@antsia/social-domain/audit"
import { FEDERATION_BODY_MAX_BYTES, federationEnvironment, parseFederationEnvelope } from "@antsia/social-domain/federationProtocol"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import { checked, fail, notFound } from "../../lib/errors"
import { operatorMutation, operatorQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { appendAudit, operatorCapacity } from "../platform/audit"
import { requireFederationAdmin } from "./access"
import { federationBodyDigest } from "./signature"

export const replay = operatorMutation({
  args: { deadLetterId: v.id("federationDeadLetters"), reason: v.string() },
  returns: v.object({ outcome: v.union(v.literal("deduplicated"), v.literal("still_failing")), eventId: v.string() }),
  handler: async (ctx, args) => {
    await requireFederationAdmin(ctx, ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const reason = checked(() => assertDecisionReason(args.reason, 10))
    const row = await ctx.db.get(args.deadLetterId)
    if (!row) return notFound()
    const deployedEnvironment = federationEnvironment(process.env.FEDERATION_ENVIRONMENT)
    const emitter = await ctx.db.get(row.emitterId)
    const network = await ctx.db.get(row.networkId)
    if (!deployedEnvironment || row.environment !== deployedEnvironment || !emitter?.enabled || emitter.environment !== row.environment || emitter.networkId !== row.networkId || !network || network.status !== "active" || !emitter.allowedContracts.includes(row.contract)) return fail("policyRefused")
    if (new TextEncoder().encode(row.rawBody).byteLength > FEDERATION_BODY_MAX_BYTES) return fail("conflict")
    const envelope = parseFederationEnvelope(row.rawBody)
    const digest = await federationBodyDigest(row.rawBody)
    const receipt = await ctx.db.get(row.receiptId)
    if (!envelope.ok || !receipt || digest !== row.bodySha256 || receipt.bodySha256 !== digest || receipt.emitterId !== row.emitterId || receipt.environment !== row.environment || receipt.networkId !== row.networkId || receipt.eventId !== row.eventId || envelope.envelope.eventId !== row.eventId || envelope.envelope.contract !== row.contract || envelope.envelope.objectRef !== row.objectRef) return fail("conflict")
    const now = Date.now()
    const outcome = receipt.status === "applied" ? "deduplicated" as const : "still_failing" as const
    if (outcome === "still_failing") {
      // Aucun handler PA5 : conserver les mêmes identifiants et la même
      // enveloppe. Le nombre de tentatives porte l'observabilité du rejeu.
      await ctx.db.patch(row._id, { status: "dead_letter", reason: "unsupported_contract", attempts: row.attempts + 1, lastAttemptAt: now, resolvedAt: undefined })
      await ctx.db.patch(receipt._id, { status: "dead_letter", updatedAt: now })
    }
    await ctx.db.insert("federationReplayAudit", { networkId: row.networkId, emitterId: row.emitterId, environment: row.environment, deadLetterId: row._id, eventId: row.eventId, requestedByPersonId: ctx.person._id, reason, outcome, requestedAt: now })
    await appendAudit(ctx, { action: "federation.replay", capacity: operatorCapacity(ctx.operator), actorPersonId: ctx.person._id, networkId: row.networkId, subject: { table: "federationDeadLetters", id: row._id }, details: { reason, eventId: row.eventId, outcome }, at: now })
    return { outcome, eventId: row.eventId }
  },
})

export const getDeadLetter = operatorQuery({
  args: { deadLetterId: v.id("federationDeadLetters") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.deadLetterId)
    if (!row) return notFound()
    return row
  },
})

export const paginateDeadLetters = operatorQuery({
  args: { networkId: v.id("networks"), status: v.union(v.literal("dead_letter"), v.literal("resolved")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => await ctx.db.query("federationDeadLetters").withIndex("by_network_status_failedAt", (q) => q.eq("networkId", args.networkId).eq("status", args.status)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(20, Math.max(1, args.paginationOpts.numItems)) }),
})

export const paginateReceipts = operatorQuery({
  args: { networkId: v.id("networks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => await ctx.db.query("federationInboxReceipts").withIndex("by_network_receivedAt", (q) => q.eq("networkId", args.networkId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)) }),
})
