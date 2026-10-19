/** P13 : aucun effet depuis une query ; intention opaque stable avant/après panne. */
import { COMMERCE_ORDER_CANCEL_REASONS, COMMERCE_ORDER_RETURN_REASONS } from "@antsia/social-domain/commerce-orders"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import type { ActionCtx } from "../../_generated/server"
import { networkAction } from "../../lib/functions"
import { literals } from "../../lib/validators"
import { type CommerceLinkConfig, readCommerceLinkConfig } from "./commerceLinkConfig"
import { randomLinkId, randomLinkToken } from "./commerceLinkCrypto"
import type { PurchaseAdmission, PurchaseDelivery, PurchaseInput } from "./purchaseFlow"
import { purchaseActionResultValidator, type PurchaseActionResult } from "./purchaseRules"
import { sendPurchaseControl } from "./purchasesClient"

type Net = { networkId: Id<"networks"> }
const beginRef = makeFunctionReference<"mutation", Net & PurchaseInput & { requestId: string; leaseToken: string; configFingerprint: string }, PurchaseAdmission>("modules/shops/purchaseFlow:begin")
const authorizeRef = makeFunctionReference<"mutation", Net & { delivery: PurchaseDelivery; configFingerprint: string }, boolean>("modules/shops/purchaseFlow:authorize")
const finishRef = makeFunctionReference<"mutation", Net & { delivery: PurchaseDelivery; rawResponse?: string }, PurchaseActionResult>("modules/shops/purchaseFlow:finish")
const storedRef = makeFunctionReference<"mutation", Net & { purchaseId: string; actionId: string }, PurchaseInput | null>("modules/shops/purchaseFlow:storedInput")
async function deliver(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, delivery: PurchaseDelivery): Promise<PurchaseActionResult> {
  if (!await ctx.runMutation(authorizeRef, { networkId, delivery, configFingerprint: config.fingerprint })) return { outcome: "refused" }
  const response = await sendPurchaseControl(config, delivery.rawBody)
  const rawResponse = response ? commerceCanonicalJson(response) : null
  return await ctx.runMutation(finishRef, { networkId, delivery, ...(rawResponse ? { rawResponse } : {}) })
}
async function run(ctx: ActionCtx, networkId: Id<"networks">, input: PurchaseInput): Promise<PurchaseActionResult> {
  const config = await readCommerceLinkConfig()
  if (!config) return { outcome: "unavailable" }
  const admit = async (intent: PurchaseInput) => await ctx.runMutation(beginRef, { networkId, ...intent, configFingerprint: config.fingerprint, requestId: randomLinkId(), leaseToken: randomLinkToken() })
  let admission = await admit(input)
  if ("kind" in admission && admission.kind === "lookup_required") {
    const lookup = await admit({ purchaseId: input.purchaseId, operation: "action_status", actionId: admission.actionId })
    if (!("kind" in lookup) || lookup.kind !== "deliver") return "kind" in lookup ? { outcome: "unavailable" } : lookup
    const result = await deliver(ctx, networkId, config, lookup)
    if (result.outcome !== "purchase" || result.action?.state !== "not_found") return result
    // Même actionId, révision et contenu. Une nouvelle enveloppe ne crée pas de décision.
    admission = await admit(input)
  }
  return "kind" in admission ? admission.kind === "deliver" ? await deliver(ctx, networkId, config, admission) : { outcome: "unavailable" } : admission
}
export const refresh = networkAction({ args: { purchaseId: v.string() }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "read" }) })
export const actionStatus = networkAction({ args: { purchaseId: v.string(), actionId: v.string() }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "action_status" }) })
export const retryStored = networkAction({ args: { purchaseId: v.string(), actionId: v.string() }, returns: purchaseActionResultValidator, handler: async (ctx, args): Promise<PurchaseActionResult> => { const input = await ctx.runMutation(storedRef, { networkId: ctx.networkId, ...args }); return input ? await run(ctx, ctx.networkId, input) : { outcome: "unavailable" } } })
export const cancel = networkAction({ args: { purchaseId: v.string(), actionId: v.string(), expectedRevision: v.number(), reason: literals(COMMERCE_ORDER_CANCEL_REASONS) }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "cancel_request" }) })
export const confirmReceipt = networkAction({ args: { purchaseId: v.string(), actionId: v.string(), expectedRevision: v.number(), consentTextVersion: v.string() }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "receipt_confirm" }) })
export const requestReturn = networkAction({ args: { purchaseId: v.string(), actionId: v.string(), expectedRevision: v.number(), reason: literals(COMMERCE_ORDER_RETURN_REASONS) }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "return_request" }) })
export const sendMessage = networkAction({ args: { purchaseId: v.string(), actionId: v.string(), expectedRevision: v.number(), text: v.string() }, returns: purchaseActionResultValidator, handler: async (ctx, args) => await run(ctx, ctx.networkId, { ...args, operation: "support_message" }) })
