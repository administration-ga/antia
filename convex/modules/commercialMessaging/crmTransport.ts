/** P10 : transport serveur borné ; scheduler sans texte ni secret, reprise par outbox. */
import { COMMERCE_COMMAND_LIMITS, COMMERCE_COMMAND_SCOPES, parseCommerceCommandRequest, parseCommerceCommandResponse } from "@antsia/social-domain/commerce/command"
import { COMMERCE_COMMAND_CONTRACT, commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_INQUIRY_WITHDRAW_CONTRACT, COMMERCE_INQUIRY_WITHDRAW_PATH, COMMERCE_INQUIRY_WITHDRAW_TTL_MS, parseCommerceInquiryWithdrawalResponse } from "@antsia/social-domain/commerce-inquiry"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import { components } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalAction, internalMutation, type MutationCtx } from "../../_generated/server"
import { readCommerceLinkConfig } from "../shops/commerceLinkConfig"
import { commerceLinkHeaders, readCommerceLinkResponse, sha256Hex } from "../shops/commerceLinkCrypto"
import { liveShopCommerceLink } from "../shops/commerceLinkLifecycle"
import { canReadCommercialThread } from "./access"
import { deliverCrm, withdrawTransfer } from "./crm"

const COMMAND_PATH = "/commerce/v1/commands"
type Job = { generation: number; attempt: number; kind: "submit" | "status" | "withdraw"; rawBody: string; originalBody?: string; requestSha256: string; fingerprint: string }
type Delivery = { outcome: "submitted"; inquiryRef: string; submittedAt: number } | { outcome: "withdrawn" | "unavailable" | "rejected" | "expired" }
const jobValidator = v.object({ generation: v.number(), attempt: v.number(), kind: v.union(v.literal("submit"), v.literal("status"), v.literal("withdraw")), rawBody: v.string(), originalBody: v.optional(v.string()), requestSha256: v.string(), fingerprint: v.string() })
const deliveryValidator = v.union(v.object({ outcome: v.literal("submitted"), inquiryRef: v.string(), submittedAt: v.number() }), v.object({ outcome: v.union(v.literal("withdrawn"), v.literal("unavailable"), v.literal("rejected"), v.literal("expired")) }))
const claimRef = makeFunctionReference<"mutation", { networkId: Id<"networks">; transferId: Id<"commercialCrmTransfers"> }, Job | null>("modules/commercialMessaging/crmTransport:claim")
const finishRef = makeFunctionReference<"mutation", { networkId: Id<"networks">; transferId: Id<"commercialCrmTransfers">; generation: number; attempt: number; delivery: Delivery }, null>("modules/commercialMessaging/crmTransport:finish")

async function liveConsent(ctx: MutationCtx, row: Doc<"commercialCrmTransfers">): Promise<boolean> {
  if (row.revokedAt !== undefined || !row.sessionId) return false
  const person = await ctx.db.get(row.personId), thread = await ctx.db.get(row.threadId)
  if (!person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined || thread?.state !== "accepted" || !await canReadCommercialThread(ctx, row.networkId, row.personId, row.threadId)) return false
  const session: unknown = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "_id", value: row.sessionId }] })
  if (!session || typeof session !== "object" || !("userId" in session) || session.userId !== person.authUserId || !("expiresAt" in session) || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return false
  const shop = await ctx.db.get(row.shopId), config = await readCommerceLinkConfig()
  const link = shop ? await liveShopCommerceLink(ctx, shop.networkId, shop._id) : null
  return config?.fingerprint === row.configFingerprint && link?.permissions.includes("receive_inquiries") === true
}

export const claim = internalMutation({
  args: { networkId: v.id("networks"), transferId: v.id("commercialCrmTransfers") }, returns: v.union(v.null(), jobValidator),
  handler: async (ctx, args): Promise<Job | null> => {
    let row = await ctx.db.get(args.transferId)
    const now = Date.now()
    if (!row || row.networkId !== args.networkId || row.state === "withdrawn" || row.state === "submitted" || row.attempts >= 8 || row.nextAttemptAt > now || (row.leaseUntil ?? 0) > now) return null
    if (row.revokedAt === undefined && !await liveConsent(ctx, row)) {
      await withdrawTransfer(ctx, row)
      row = await ctx.db.get(row._id)
      if (!row || row.state === "withdrawn") return null
    }
    const config = await readCommerceLinkConfig()
    // Une rotation de clé peut acheminer un RETRAIT de la même source/environnement.
    if (!config || config.source !== row.source || config.environment !== row.environment) return null
    const attempt = row.attempts + 1
    let kind: Job["kind"], rawBody: string
    if (row.revokedAt !== undefined) {
      kind = "withdraw"
      rawBody = row.withdrawalBody && (row.withdrawalExpiresAt ?? 0) > now ? row.withdrawalBody : commerceCanonicalJson({ contract: COMMERCE_INQUIRY_WITHDRAW_CONTRACT, version: 1,
        source: row.source, environment: row.environment, requestId: await sha256Hex(`withdraw:${row.requestId}:${row.revokedAt}:${now}`),
        issuedAt: now, expiresAt: now + COMMERCE_INQUIRY_WITHDRAW_TTL_MS, subjectRef: row.subjectRef,
        submitRequestId: row.requestId, submitRequestSha256: row.requestSha256, conversationRef: row.conversationRef, revokedAt: row.revokedAt })!
      if (rawBody !== row.withdrawalBody) await ctx.db.patch(row._id, { withdrawalBody: rawBody, withdrawalExpiresAt: now + COMMERCE_INQUIRY_WITHDRAW_TTL_MS })
    } else if (row.requestExpiresAt <= now) {
      kind = "status"
      rawBody = commerceCanonicalJson({ contract: COMMERCE_COMMAND_CONTRACT, version: 1, command: "request.status", source: row.source, environment: row.environment,
        scope: COMMERCE_COMMAND_SCOPES["request.status"], requestId: await sha256Hex(`inquiry-status:${row.requestId}:${attempt}:${now}`), issuedAt: now, expiresAt: now + 60_000,
        subject: { kind: "buyer", ref: row.subjectRef, authVerifiedAt: now }, payload: { targetCommand: "inquiry.submit", targetRequestId: row.requestId, targetRequestSha256: row.requestSha256 } })!
    } else {
      if (!row.rawBody) return null
      kind = "submit"; rawBody = row.rawBody
    }
    await ctx.db.patch(row._id, { state: row.revokedAt === undefined ? "submitting" : "withdrawal_pending", attempts: attempt, leaseUntil: now + 30_000, dispatchedAt: row.dispatchedAt ?? now, updatedAt: now })
    return { kind, rawBody, ...(kind === "status" && row.rawBody ? { originalBody: row.rawBody } : {}), requestSha256: await sha256Hex(rawBody), fingerprint: config.fingerprint, generation: row.generation, attempt }
  },
})

export const finish = internalMutation({
  args: { networkId: v.id("networks"), transferId: v.id("commercialCrmTransfers"), generation: v.number(), attempt: v.number(), delivery: deliveryValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.transferId)
    if (!row || row.networkId !== args.networkId || row.generation !== args.generation || row.attempts !== args.attempt || row.leaseUntil === undefined) return null
    const now = Date.now(), result = args.delivery
    if (row.revokedAt === undefined && !await liveConsent(ctx, row)) { await withdrawTransfer(ctx, row); return null }
    if (result.outcome === "submitted" && row.revokedAt === undefined) {
      await ctx.db.patch(row._id, { state: "submitted", inquiryRef: result.inquiryRef, submittedAt: result.submittedAt, rawBody: undefined, sessionId: undefined, leaseUntil: undefined, updatedAt: now })
    } else if (result.outcome === "withdrawn" && row.revokedAt !== undefined) {
      await ctx.db.patch(row._id, { state: "withdrawn", rawBody: undefined, withdrawalBody: undefined, withdrawalExpiresAt: undefined, selectedText: undefined, displayName: undefined, sessionId: undefined, leaseUntil: undefined, updatedAt: now })
    } else {
      const retry = result.outcome === "unavailable" && row.attempts < 8
      const delay = Math.min(3_600_000, 15_000 * 2 ** Math.min(row.attempts, 8))
      await ctx.db.patch(row._id, { state: row.revokedAt !== undefined ? "withdrawal_pending" : retry ? "queued" : "failed", lastOutcome: result.outcome === "expired" ? "expired" : result.outcome === "rejected" ? "rejected" : "unavailable", leaseUntil: undefined, nextAttemptAt: row.attempts >= 8 || result.outcome === "rejected" || result.outcome === "expired" ? Number.MAX_SAFE_INTEGER : now + delay, updatedAt: now })
      if (retry) await ctx.scheduler.runAfter(delay, deliverCrm, { networkId: row.networkId, transferId: row._id })
    }
    return null
  },
})

export const deliver = internalAction({
  args: { networkId: v.id("networks"), transferId: v.id("commercialCrmTransfers") }, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(claimRef, args)
    if (!job) return null
    let delivery: Delivery = { outcome: "unavailable" }
    try {
      const config = await readCommerceLinkConfig()
      if (config?.fingerprint === job.fingerprint) {
        const response = await fetch(new URL(job.kind === "withdraw" ? COMMERCE_INQUIRY_WITHDRAW_PATH : COMMAND_PATH, config.proHttpOrigin), {
          method: "POST", body: job.rawBody, headers: await commerceLinkHeaders(config, job.rawBody, job.kind === "status" ? "request.status" : "inquiry.submit"), redirect: "error", signal: AbortSignal.timeout(8000),
        })
        const rawResponse = await readCommerceLinkResponse(response, COMMERCE_COMMAND_LIMITS.responseMaxBytes)
        if (rawResponse) {
          if (job.kind === "withdraw") {
            const body: unknown = JSON.parse(job.rawBody)
            if (body && typeof body === "object" && "requestId" in body && typeof body.requestId === "string") {
              const parsed = parseCommerceInquiryWithdrawalResponse(rawResponse, { requestId: body.requestId, requestSha256: job.requestSha256 })
              if (parsed.ok) delivery = { outcome: parsed.value.outcome === "withdrawn" ? response.ok ? "withdrawn" : "unavailable" : "rejected" }
            }
          } else {
            const request = parseCommerceCommandRequest(job.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
            if (request.ok) {
              const parsed = parseCommerceCommandResponse(rawResponse, { request: request.value, requestSha256: job.requestSha256 }, Date.now())
              if (parsed.ok && parsed.value.outcome === "accepted" && response.ok) {
                const result = parsed.value.result
                if (job.kind === "submit" && result && "inquiryRef" in result) delivery = { outcome: "submitted", inquiryRef: result.inquiryRef, submittedAt: result.submittedAt }
                else if (job.kind === "status" && result && "state" in result && "targetRequestId" in result) {
                  if (result.recordedResponse && result.recordedResponseSha256 && job.originalBody && await sha256Hex(result.recordedResponse) === result.recordedResponseSha256) {
                    const original = parseCommerceCommandRequest(job.originalBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
                    if (original.ok) {
                      const receipt = parseCommerceCommandResponse(result.recordedResponse, { request: original.value, requestSha256: await sha256Hex(job.originalBody) }, Date.now())
                      if (receipt.ok && receipt.value.outcome === "accepted" && receipt.value.result && "inquiryRef" in receipt.value.result) delivery = { outcome: "submitted", inquiryRef: receipt.value.result.inquiryRef, submittedAt: receipt.value.result.submittedAt }
                      else if (receipt.ok) delivery = { outcome: "rejected" }
                    }
                  } else if (result.state === "unknown") delivery = { outcome: "expired" }
                }
              } else if (parsed.ok && parsed.value.outcome !== "accepted" && parsed.value.outcome !== "unavailable") delivery = { outcome: "rejected" }
            }
          }
        }
      }
    } catch { /* Aucun corps ni secret dans le journal ; le reçu reste indéterminé. */ }
    await ctx.runMutation(finishRef, { ...args, generation: job.generation, attempt: job.attempt, delivery })
    return null
  },
})

/** Le cron rattrape une chute du scheduler, en lots globaux de vingt références. */
export const drain = internalMutation({
  args: {}, returns: v.null(), handler: async (ctx) => {
    const now = Date.now()
    for (const state of ["queued", "submitting", "withdrawal_pending"] as const) {
      const rows = await ctx.db.query("commercialCrmTransfers").withIndex("by_state_nextAttemptAt", (q) => q.eq("state", state).lte("nextAttemptAt", now)).take(20)
      for (const row of rows) {
        if ((row.leaseUntil ?? 0) > now) continue
        if (row.attempts >= 8) await ctx.db.patch(row._id, { state: row.revokedAt === undefined ? "failed" : "withdrawal_pending", leaseUntil: undefined, nextAttemptAt: Number.MAX_SAFE_INTEGER, updatedAt: now })
        else await ctx.scheduler.runAfter(0, deliverCrm, { networkId: row.networkId, transferId: row._id })
      }
    }
    return null
  },
})
