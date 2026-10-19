/** P13 : commandes privées idempotentes, preuve de session relue autour de chaque HTTP. */
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_ORDER_CANCEL_REASONS, COMMERCE_ORDER_RETURN_REASONS, COMMERCE_ORDER_CONTROL_CONTRACT, COMMERCE_ORDER_CONTROL_TTL_MS, COMMERCE_ORDER_RECEIPT_VERSION, parseCommerceOrderControlRequest, parseCommerceOrderControlResponse, type CommerceOrderControlRequest } from "@antsia/social-domain/commerce-orders"
import { type Infer, v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { requireMembership } from "../../lib/access"
import { enforceRateLimit } from "../../lib/rateLimit"
import { assertSocialWriteAllowed } from "../moderation/policy"
import { purchaseAuthority, samePurchaseScope } from "./purchaseAccess"
import { sha256Hex, validLinkToken } from "./commerceLinkCrypto"
import { paymentOpaque } from "./paymentAccess"
import { PURCHASE_FRESH_MS, PURCHASE_LEASE_MS, PURCHASE_PRIVATE_TTL_MS, purchaseActionResultValidator, purchaseOperationValidator, type PurchaseActionResult } from "./purchaseRules"

export const purchaseDeliveryValidator = v.object({ kind: v.literal("deliver"), requestId: v.string(), rawBody: v.string(), leaseToken: v.string(), generation: v.number() })
export type PurchaseDelivery = Infer<typeof purchaseDeliveryValidator>
const lookupRequiredValidator = v.object({ kind: v.literal("lookup_required"), actionId: v.string() })
export type PurchaseAdmission = PurchaseDelivery | { kind: "lookup_required"; actionId: string } | PurchaseActionResult
export const purchaseInputFields = { purchaseId: v.string(), operation: purchaseOperationValidator, actionId: v.optional(v.string()), expectedRevision: v.optional(v.number()), reason: v.optional(v.string()), consentTextVersion: v.optional(v.string()), text: v.optional(v.string()) }
export const purchaseInputValidator = v.object(purchaseInputFields)
export type PurchaseInput = Infer<typeof purchaseInputValidator>

function reply(purchaseId: string, actionId?: string, state: "accepted" | "unknown" | "refused" | "not_found" = "unknown"): PurchaseActionResult { return { outcome: "purchase", purchaseId, action: actionId ? { actionId, state } : null } }
function business(operation: CommerceOrderControlRequest["operation"]): boolean { return operation !== "read" && operation !== "action_status" }
function permitted(operation: CommerceOrderControlRequest["operation"], capabilities: { canCancel: boolean; canConfirmReceipt: boolean; canRequestReturn: boolean; canMessage: boolean }): boolean {
  return operation === "cancel_request" ? capabilities.canCancel : operation === "receipt_confirm" ? capabilities.canConfirmReceipt : operation === "return_request" ? capabilities.canRequestReturn : operation === "support_message" ? capabilities.canMessage : true
}

export const begin = internalMutation({
  args: { networkId: v.id("networks"), ...purchaseInputFields, requestId: v.string(), leaseToken: v.string(), configFingerprint: v.string() },
  returns: v.union(purchaseDeliveryValidator, lookupRequiredValidator, purchaseActionResultValidator),
  handler: async (ctx, args): Promise<PurchaseAdmission> => {
    const access = await requireMembership(ctx, args.networkId, "declaree")
    await assertSocialWriteAllowed(ctx, args.networkId, access.person._id)
    await enforceRateLimit(ctx, business(args.operation) ? "purchase.action" : "purchase.control", access.person._id)
    const current = await purchaseAuthority(ctx, args.networkId, args.purchaseId)
    if (!current || current.config.fingerprint !== args.configFingerprint || !paymentOpaque(args.requestId) || !validLinkToken(args.leaseToken)) return { outcome: "refused" }
    const now = Date.now(), isAction = business(args.operation)
    if ((isAction || args.operation === "action_status") && (!args.actionId || !paymentOpaque(args.actionId))) return { outcome: "refused" }
    const existing = args.actionId ? await ctx.db.query("shopPurchaseRequests").withIndex("by_action", (q) => q.eq("personId", access.person._id).eq("networkId", args.networkId).eq("purchaseId", args.purchaseId).eq("actionId", args.actionId)).unique() : null
    if (args.operation === "action_status" && !existing) return reply(args.purchaseId, args.actionId, "not_found")
    if (existing?.privacyRevokedAt !== undefined) return { outcome: "refused" }
    let payload: CommerceOrderControlRequest["payload"]
    if (args.operation === "read") payload = { orderRef: current.orderRef }
    else if (args.operation === "action_status") payload = { orderRef: current.orderRef, actionId: args.actionId! }
    else {
      const common = { orderRef: current.orderRef, actionId: args.actionId!, expectedRevision: args.expectedRevision! }
      if (!Number.isSafeInteger(args.expectedRevision) || (args.expectedRevision ?? 0) < 1) return { outcome: "refused" }
      if (args.operation === "cancel_request") {
        if (!COMMERCE_ORDER_CANCEL_REASONS.some((reason) => reason === args.reason)) return { outcome: "refused" }
        payload = { ...common, reason: args.reason as typeof COMMERCE_ORDER_CANCEL_REASONS[number] }
      } else if (args.operation === "return_request") {
        if (!COMMERCE_ORDER_RETURN_REASONS.some((reason) => reason === args.reason)) return { outcome: "refused" }
        payload = { ...common, reason: args.reason as typeof COMMERCE_ORDER_RETURN_REASONS[number] }
      } else if (args.operation === "receipt_confirm") {
        if (args.consentTextVersion !== COMMERCE_ORDER_RECEIPT_VERSION) return { outcome: "refused" }
        payload = { ...common, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION }
      } else {
        if (!args.text || args.text.length > 1000) return { outcome: "refused" }
        payload = { ...common, text: args.text }
      }
    }
    const intentDigest = isAction ? await sha256Hex(commerceCanonicalJson({ operation: args.operation, payload })!) : undefined
    if (isAction && existing) {
      if (existing.intentDigest !== intentDigest || existing.operation !== args.operation || existing.orderRef !== current.orderRef || existing.subjectRef !== current.scope.subjectRef) return { outcome: "refused" }
      if (existing.state === "accepted" || existing.state === "refused") return reply(args.purchaseId, args.actionId, existing.state)
      if ((existing.leaseUntil ?? 0) > now) return reply(args.purchaseId, args.actionId)
      if (existing.privateUntil <= now || !existing.rawBody) return reply(args.purchaseId, args.actionId, existing.state)
      if (existing.lookupState !== "not_found" || (existing.lastLookupAt ?? 0) < now - 10_000 || existing.lastLookupSessionDigest !== current.scope.sessionDigest) return { kind: "lookup_required", actionId: args.actionId! }
    } else if (isAction) {
      const cached = await ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", access.person._id).eq("networkId", args.networkId).eq("purchaseId", args.purchaseId)).unique()
      if (!cached || cached.privacyRevokedAt !== undefined || now - cached.observedAt > PURCHASE_FRESH_MS || cached.order.revision !== args.expectedRevision || cached.order.orderRef !== current.orderRef || cached.order.paymentRef !== current.paymentRef || !permitted(args.operation, cached.order.capabilities)) return { outcome: "unavailable" }
    }
    const request = { contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, operation: args.operation, source: current.scope.source, environment: current.scope.environment, requestId: args.requestId, shopRef: current.scope.shopRef, subject: { kind: "buyer", ref: current.scope.subjectRef, authVerifiedAt: now }, issuedAt: now, expiresAt: now + COMMERCE_ORDER_CONTROL_TTL_MS, payload }
    const rawBody = commerceCanonicalJson(request)
    if (!rawBody || !parseCommerceOrderControlRequest(rawBody, { source: current.scope.source, environment: current.scope.environment, nowMs: now }).ok) return { outcome: "refused" }
    const generation = (isAction ? existing?.generation ?? 0 : 0) + 1
    const record = { ...current.scope, requestId: args.requestId, operation: args.operation, ...(isAction ? { actionId: args.actionId!, intentDigest } : args.actionId ? { targetActionId: args.actionId } : {}), businessAction: isAction, state: "unknown" as const, bodySha256: await sha256Hex(rawBody), rawBody, issuedAt: now, expiresAt: now + COMMERCE_ORDER_CONTROL_TTL_MS, privateUntil: isAction && existing ? existing.privateUntil : now + PURCHASE_PRIVATE_TTL_MS, leaseToken: args.leaseToken, leaseUntil: now + PURCHASE_LEASE_MS, generation, createdAt: existing && isAction ? existing.createdAt : now, updatedAt: now }
    if (isAction && existing) await ctx.db.patch(existing._id, { ...record, completedAt: undefined, reason: undefined })
    else await ctx.db.insert("shopPurchaseRequests", record)
    return { kind: "deliver", requestId: args.requestId, rawBody, leaseToken: args.leaseToken, generation }
  },
})

async function liveDelivery(ctx: MutationCtx, networkId: Id<"networks">, delivery: PurchaseDelivery) {
  await requireMembership(ctx, networkId, "declaree")
  const row = await ctx.db.query("shopPurchaseRequests").withIndex("by_request", (q) => q.eq("requestId", delivery.requestId)).unique()
  if (!row || row.networkId !== networkId || row.privacyRevokedAt !== undefined || row.leaseToken !== delivery.leaseToken || row.generation !== delivery.generation || (row.leaseUntil ?? 0) <= Date.now() || row.rawBody !== delivery.rawBody || await sha256Hex(delivery.rawBody) !== row.bodySha256) return null
  const current = await purchaseAuthority(ctx, networkId, row.purchaseId)
  if (!current || !samePurchaseScope(row, current.scope)) return null
  return { row, current }
}

export const authorize = internalMutation({
  args: { networkId: v.id("networks"), delivery: purchaseDeliveryValidator, configFingerprint: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => { const live = await liveDelivery(ctx, args.networkId, args.delivery); return !!live && live.current.config.fingerprint === args.configFingerprint && live.row.expiresAt > Date.now() },
})

/** Reprise explicite après recharge : le texte ne sort que vers l'action serveur,
 * jamais dans le DTO ni dans le stockage du navigateur. La voie begin exige ensuite
 * une consultation not_found fraîche avant de réutiliser la même décision. */
export const storedInput = internalMutation({
  args: { networkId: v.id("networks"), purchaseId: v.string(), actionId: v.string() }, returns: v.union(purchaseInputValidator, v.null()),
  handler: async (ctx, args): Promise<PurchaseInput | null> => {
    const access = await requireMembership(ctx, args.networkId, "declaree")
    const current = await purchaseAuthority(ctx, args.networkId, args.purchaseId)
    if (!current || !paymentOpaque(args.actionId)) return null
    const row = await ctx.db.query("shopPurchaseRequests").withIndex("by_action", (q) => q.eq("personId", access.person._id).eq("networkId", args.networkId).eq("purchaseId", args.purchaseId).eq("actionId", args.actionId)).unique()
    if (!row?.rawBody || row.privacyRevokedAt !== undefined || row.privateUntil <= Date.now() || (row.leaseUntil ?? 0) > Date.now() || !["unknown", "not_found"].includes(row.state) || !samePurchaseScope({ ...row, sessionDigest: current.scope.sessionDigest, configFingerprint: current.scope.configFingerprint }, current.scope) || await sha256Hex(row.rawBody) !== row.bodySha256) return null
    const parsed = parseCommerceOrderControlRequest(row.rawBody, { source: row.source, environment: row.environment, nowMs: row.issuedAt })
    if (!parsed.ok || !business(parsed.value.operation) || !("expectedRevision" in parsed.value.payload)) return null
    const request = parsed.value, payload = request.payload
    if (!("expectedRevision" in payload)) return null
    return { purchaseId: args.purchaseId, operation: request.operation, actionId: payload.actionId, expectedRevision: payload.expectedRevision, ...("reason" in payload ? { reason: payload.reason } : {}), ...("text" in payload ? { text: payload.text } : {}), ...("consentTextVersion" in payload ? { consentTextVersion: payload.consentTextVersion } : {}) }
  },
})

export const finish = internalMutation({
  args: { networkId: v.id("networks"), delivery: purchaseDeliveryValidator, rawResponse: v.optional(v.string()) }, returns: purchaseActionResultValidator,
  handler: async (ctx, args): Promise<PurchaseActionResult> => {
    const live = await liveDelivery(ctx, args.networkId, args.delivery)
    if (!live) return { outcome: "refused" }
    const { row, current } = live
    await ctx.db.patch(row._id, { leaseToken: undefined, leaseUntil: undefined, updatedAt: Date.now() })
    const request = parseCommerceOrderControlRequest(row.rawBody!, { source: row.source, environment: row.environment, nowMs: row.issuedAt })
    const response = args.rawResponse && request.ok ? parseCommerceOrderControlResponse(args.rawResponse, { request: request.value, requestSha256: row.bodySha256, nowMs: Date.now() }) : null
    if (!response?.ok || response.value.outcome === "unavailable") return row.operation === "read" ? { outcome: "unavailable" } : reply(row.purchaseId, row.actionId ?? row.targetActionId)
    // « unavailable » est sorti plus haut : tout ce qui n'est pas accepté est ici un refus.
    if (response.value.outcome !== "accepted") {
      // Un refus de consultation ne prouve pas que l'action inconnue n'a jamais eu lieu.
      await ctx.db.patch(row._id, { state: "refused", reason: response.value.reason, completedAt: Date.now(), rawBody: undefined })
      return row.operation === "read" ? { outcome: "refused" } : row.operation === "action_status" ? reply(row.purchaseId, row.targetActionId) : reply(row.purchaseId, row.actionId, "refused")
    }
    const { order, action } = response.value.result
    if (order.orderRef !== current.orderRef || order.paymentRef !== current.paymentRef || order.checkoutRef !== current.scope.checkoutRef || order.shopRef !== current.scope.shopRef || order.amount.amount !== current.payment.amount.amount || order.amount.currency !== current.payment.amount.currency) return { outcome: "refused" }
    const cached = await ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", row.personId).eq("networkId", row.networkId).eq("purchaseId", row.purchaseId)).unique()
    // Le checkout/l'allocation peuvent faire évoluer états/capacités sans version de
    // commande supplémentaire. Seuls les faits contractuels immuables sont empreintés.
    // Les messages purgés n'y participent pas : une relecture de même version reste valide.
    const orderDigest = await sha256Hex(commerceCanonicalJson({ orderRef: order.orderRef, checkoutRef: order.checkoutRef, paymentRef: order.paymentRef, shopRef: order.shopRef, reference: order.reference, sellerLabel: order.sellerLabel, createdAt: order.createdAt, lines: order.lines, fees: order.fees, amount: order.amount })!)
    if (cached && orderDigest !== cached.orderDigest) return { outcome: "refused" }
    if (!cached || cached.privacyRevokedAt === undefined && order.revision >= cached.order.revision && order.paymentRevision >= cached.order.paymentRevision && order.updatedAt >= cached.order.updatedAt) {
      const fields = { ...current.scope, order, orderDigest, observedAt: Date.now(), privateUntil: Date.now() + PURCHASE_PRIVATE_TTL_MS, privatePurgedAt: undefined }
      if (cached) await ctx.db.patch(cached._id, fields)
      else await ctx.db.insert("shopPurchaseSnapshots", fields)
    }
    await ctx.db.patch(row._id, { state: action?.state ?? "accepted", completedAt: Date.now(), ...(row.businessAction && action?.state === "accepted" || !row.businessAction ? { rawBody: undefined } : {}) })
    if (row.operation === "action_status" && row.targetActionId && action) {
      const original = await ctx.db.query("shopPurchaseRequests").withIndex("by_action", (q) => q.eq("personId", row.personId).eq("networkId", row.networkId).eq("purchaseId", row.purchaseId).eq("actionId", row.targetActionId)).unique()
      if (original && original.privacyRevokedAt === undefined && original.state !== "accepted") await ctx.db.patch(original._id, { state: action.state, lookupState: action.state, lastLookupAt: Date.now(), lastLookupSessionDigest: row.sessionDigest, ...(action.state === "accepted" ? { rawBody: undefined, completedAt: Date.now(), leaseToken: undefined, leaseUntil: undefined } : {}), updatedAt: Date.now() })
    }
    return reply(row.purchaseId, row.actionId ?? row.targetActionId, action?.state ?? "accepted")
  },
})
