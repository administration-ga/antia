/** P12 : seule porte HTTP, déclenchée explicitement. Un retour navigateur ne fait qu'afficher. */
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { parseCommercePaymentControlRequest } from "@antsia/social-domain/commerce-payment"
import { makeFunctionReference } from "convex/server"
import { type Infer, v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import type { ActionCtx } from "../../_generated/server"
import { networkAction } from "../../lib/functions"
import { readCommerceLinkConfig, type CommerceLinkConfig } from "./commerceLinkConfig"
import { randomLinkId, randomLinkToken } from "./commerceLinkCrypto"
import { checkoutMoneyValidator } from "./checkoutRules"
import { sendPaymentCommand, sendPaymentControl } from "./paymentClient"
import type { PaymentDelivery } from "./paymentFlow"
import { paymentActionResultValidator, paymentOptionsResultValidator, paymentRefundReasonValidator, PAYMENT_CONSENT_VERSION, type PaymentActionResult, type PaymentOptionsResult } from "./paymentRules"

type Net = { networkId: Id<"networks"> }
type Lease = { requestId: string; leaseToken: string; configFingerprint: string }
type StartArgs = { checkoutAttemptId: string; expectedTotal: Infer<typeof checkoutMoneyValidator>; consentTextVersion: string; clientRequestId: string; readinessRef: string }
type Admission = PaymentDelivery | PaymentActionResult
type Operation = { paymentAttemptId: string; operation: "status" | "retry" | "refund_request"; expectedRevision?: number; clientRequestId?: string; reason?: Infer<typeof paymentRefundReasonValidator> }
const beginOptions = makeFunctionReference<"mutation", Net & Lease & { checkoutAttemptId: string }, PaymentDelivery | null>("modules/shops/paymentFlow:beginOptions")
const createStart = makeFunctionReference<"mutation", Net & Lease & StartArgs & { paymentAttemptId: string; authorizationRequestId: string }, Admission>("modules/shops/paymentFlow:createStart")
const beginOperation = makeFunctionReference<"mutation", Net & Lease & Operation, PaymentDelivery | null>("modules/shops/paymentFlow:beginOperation")
const authorize = makeFunctionReference<"mutation", Net & { delivery: PaymentDelivery; configFingerprint: string }, boolean>("modules/shops/paymentFlow:authorize")
const finishOptions = makeFunctionReference<"mutation", Net & { delivery: PaymentDelivery; rawResponse?: string }, PaymentOptionsResult>("modules/shops/paymentFlow:finishOptions")
const finish = makeFunctionReference<"mutation", Net & { delivery: PaymentDelivery; rawResponse?: string; httpStatus?: number }, Admission>("modules/shops/paymentFlow:finish")

function lease(config: CommerceLinkConfig): Lease { return { requestId: randomLinkId(), leaseToken: randomLinkToken(), configFingerprint: config.fingerprint } }
async function deliver(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, delivery: PaymentDelivery): Promise<PaymentActionResult> {
  // Au maximum autorisation puis commande ; aucune boucle de nouvelle intention après timeout.
  let pending = delivery
  for (let step = 0; step < 2; step++) {
    if (!await ctx.runMutation(authorize, { networkId, delivery: pending, configFingerprint: config.fingerprint })) return { outcome: "refused" }
    let result: Admission
    if (pending.kind === "start" || pending.kind === "request_status") {
      const reply = await sendPaymentCommand(config, pending.rawBody)
      result = await ctx.runMutation(finish, { networkId, delivery: pending, ...(reply ? { rawResponse: reply.rawResponse, httpStatus: reply.status } : {}) })
    } else {
      const request = parseCommercePaymentControlRequest(pending.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
      const reply = request.ok ? await sendPaymentControl(config, request.value) : null
      const rawResponse = reply ? commerceCanonicalJson(reply) : null
      result = await ctx.runMutation(finish, { networkId, delivery: pending, ...(rawResponse ? { rawResponse } : {}) })
    }
    if (!("kind" in result)) return result
    pending = result
  }
  return { outcome: "unavailable" }
}
async function operation(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, input: Operation): Promise<PaymentActionResult> {
  const delivery = await ctx.runMutation(beginOperation, { networkId, ...lease(config), ...input })
  return delivery ? await deliver(ctx, networkId, config, delivery) : { outcome: "refused" }
}

export const options = networkAction({
  args: { checkoutAttemptId: v.string() }, returns: paymentOptionsResultValidator,
  handler: async (ctx, args): Promise<PaymentOptionsResult> => {
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const delivery = await ctx.runMutation(beginOptions, { networkId: ctx.networkId, ...lease(config), checkoutAttemptId: args.checkoutAttemptId })
    if (!delivery || !await ctx.runMutation(authorize, { networkId: ctx.networkId, delivery, configFingerprint: config.fingerprint })) return { outcome: "unavailable" }
    const request = parseCommercePaymentControlRequest(delivery.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
    const reply = request.ok ? await sendPaymentControl(config, request.value) : null
    const rawResponse = reply ? commerceCanonicalJson(reply) : null
    return await ctx.runMutation(finishOptions, { networkId: ctx.networkId, delivery, ...(rawResponse ? { rawResponse } : {}) })
  },
})
export const start = networkAction({
  args: { checkoutAttemptId: v.string(), expectedTotal: checkoutMoneyValidator, consentTextVersion: v.string(), clientRequestId: v.string(), readinessRef: v.string() }, returns: paymentActionResultValidator,
  handler: async (ctx, args): Promise<PaymentActionResult> => {
    if (args.consentTextVersion !== PAYMENT_CONSENT_VERSION) return { outcome: "refused" }
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const admission = await ctx.runMutation(createStart, { networkId: ctx.networkId, ...lease(config), ...args, paymentAttemptId: randomLinkId(), authorizationRequestId: randomLinkId() })
    return "kind" in admission ? await deliver(ctx, ctx.networkId, config, admission) : admission
  },
})
export const status = networkAction({
  args: { paymentAttemptId: v.string() }, returns: paymentActionResultValidator,
  handler: async (ctx, args): Promise<PaymentActionResult> => {
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const lookup = await operation(ctx, ctx.networkId, config, { ...args, operation: "status" })
    // Un reçu retrouvé est suivi du statut canonique ; jamais d'un nouveau start.
    if (lookup.outcome === "attempt" && lookup.attempt.paymentRef && lookup.attempt.revision === 0) return await operation(ctx, ctx.networkId, config, { ...args, operation: "status" })
    return lookup
  },
})
export const retry = networkAction({
  args: { paymentAttemptId: v.string() }, returns: paymentActionResultValidator,
  handler: async (ctx, args): Promise<PaymentActionResult> => {
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const lookup = await operation(ctx, ctx.networkId, config, { ...args, operation: "status" })
    if (lookup.outcome !== "attempt" || lookup.attempt.state !== "unknown" || !lookup.attempt.canRetry) return lookup
    const delivery = await ctx.runMutation(beginOperation, { networkId: ctx.networkId, ...lease(config), ...args, operation: "retry" })
    return delivery ? await deliver(ctx, ctx.networkId, config, delivery) : lookup
  },
})
export const requestRefund = networkAction({
  args: { paymentAttemptId: v.string(), expectedRevision: v.number(), clientRequestId: v.string(), reason: paymentRefundReasonValidator }, returns: paymentActionResultValidator,
  handler: async (ctx, args): Promise<PaymentActionResult> => {
    const config = await readCommerceLinkConfig()
    return config ? await operation(ctx, ctx.networkId, config, { ...args, operation: "refund_request" }) : { outcome: "unavailable" }
  },
})
