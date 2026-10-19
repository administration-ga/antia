/** P11 : seules ces actions génèrent l'entropie et appellent le serveur PRO configuré. */
import type { CommerceFulfillment } from "@antsia/social-domain/commerce/command"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_CHECKOUT_CONSENT_VERSION, parseCommerceCheckoutControlRequest } from "@antsia/social-domain/commerce-checkout"
import { makeFunctionReference } from "convex/server"
import { type Infer, v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { ActionCtx } from "../../_generated/server"
import { networkAction } from "../../lib/functions"
import { sendCheckoutCommand, sendCheckoutControl } from "./checkoutClient"
import { type CommerceLinkConfig, readCommerceLinkConfig } from "./commerceLinkConfig"
import { randomLinkId, randomLinkToken } from "./commerceLinkCrypto"
import type { CheckoutDelivery } from "./checkoutFlow"
import { checkoutActionResultValidator, checkoutFulfillmentValidator, checkoutLineValidator, checkoutMoneyValidator, checkoutOptionsResultValidator, type CheckoutActionResult, type CheckoutOptionsResult } from "./checkoutRules"

type Net = { networkId: Id<"networks"> }
type Money = Infer<typeof checkoutMoneyValidator>
type Lines = Infer<typeof checkoutLineValidator>[]
type DeliveryArgs = Net & { delivery: CheckoutDelivery }
type Intent = { handle: string; lines: Lines; fulfillment: CommerceFulfillment; consentTextVersion: string; expectedPolicyVersion: number; clientRequestId: string; note?: string }
const beginOptionsRef = makeFunctionReference<"mutation", Net & { handle: string; requestId: string; leaseToken: string; configFingerprint: string }, CheckoutDelivery | null>("modules/shops/checkoutFlow:beginOptions")
const authorizeRef = makeFunctionReference<"mutation", DeliveryArgs & { configFingerprint: string }, boolean>("modules/shops/checkoutFlow:authorize")
const finishOptionsRef = makeFunctionReference<"mutation", DeliveryArgs & { rawResponse?: string }, CheckoutOptionsResult>("modules/shops/checkoutFlow:finishOptions")
const finishRef = makeFunctionReference<"mutation", DeliveryArgs & { rawResponse?: string; httpStatus?: number }, CheckoutActionResult>("modules/shops/checkoutFlow:finishAttemptOperation")
const createRef = makeFunctionReference<"mutation", Net & Intent & { optionsRequestId: string; attemptId: string; requestId: string; leaseToken: string; configFingerprint: string; reconfirmAttemptId?: string; acceptedTotal?: Money }, CheckoutDelivery | CheckoutActionResult>("modules/shops/checkoutFlow:createAttempt")
const operationRef = makeFunctionReference<"mutation", Net & { attemptId: string; operation: "retry" | "status" | "release"; requestId: string; leaseToken: string; configFingerprint: string; forReconfirm?: boolean; acceptedTotal?: Money }, CheckoutDelivery | null>("modules/shops/checkoutFlow:beginAttemptOperation")
const reconfirmRef = makeFunctionReference<"mutation", Net & { attemptId: string; clientRequestId: string; acceptedTotal: Money }, { existingAttemptId: string } | { handle: string; lines: Lines; fulfillment: CommerceFulfillment; note?: string } | null>("modules/shops/checkoutFlow:reconfirmInput")

async function deliver(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, delivery: CheckoutDelivery): Promise<CheckoutActionResult> {
  if (!await ctx.runMutation(authorizeRef, { networkId, delivery, configFingerprint: config.fingerprint })) return { outcome: "refused" }
  if (delivery.kind === "prepare" || delivery.kind === "request_status") {
    const reply = await sendCheckoutCommand(config, delivery.rawBody)
    return await ctx.runMutation(finishRef, { networkId, delivery, ...(reply ? { rawResponse: reply.rawResponse, httpStatus: reply.status } : {}) })
  }
  const parsed = parseCommerceCheckoutControlRequest(delivery.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
  const reply = parsed.ok ? await sendCheckoutControl(config, parsed.value) : null
  const rawResponse = reply ? commerceCanonicalJson(reply) : null
  return await ctx.runMutation(finishRef, { networkId, delivery, ...(rawResponse ? { rawResponse } : {}) })
}

async function loadOptions(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, handle: string): Promise<{ result: CheckoutOptionsResult; requestId: string | null }> {
  const delivery = await ctx.runMutation(beginOptionsRef, { networkId, handle, requestId: randomLinkId(), leaseToken: randomLinkToken(), configFingerprint: config.fingerprint })
  if (!delivery || !await ctx.runMutation(authorizeRef, { networkId, delivery, configFingerprint: config.fingerprint })) return { result: { outcome: "unavailable" }, requestId: null }
  const request = parseCommerceCheckoutControlRequest(delivery.rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
  const reply = request.ok ? await sendCheckoutControl(config, request.value) : null
  const rawResponse = reply ? commerceCanonicalJson(reply) : null
  const result = await ctx.runMutation(finishOptionsRef, { networkId, delivery, ...(rawResponse ? { rawResponse } : {}) })
  return { result, requestId: result.outcome === "ready" ? delivery.requestId : null }
}

export const options = networkAction({
  args: { handle: v.string() }, returns: checkoutOptionsResultValidator,
  handler: async (ctx, args): Promise<CheckoutOptionsResult> => {
    const config = await readCommerceLinkConfig()
    return config ? (await loadOptions(ctx, ctx.networkId, config, args.handle)).result : { outcome: "unavailable" }
  },
})

async function prepareIntent(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, intent: Omit<Intent, "expectedPolicyVersion"> & { expectedPolicyVersion?: number }, reconfirmAttemptId?: string, acceptedTotal?: Money): Promise<CheckoutActionResult> {
  const readiness = await loadOptions(ctx, networkId, config, intent.handle)
  if (!readiness.requestId) return { outcome: readiness.result.outcome === "refused" ? "refused" : "unavailable" }
  if (readiness.result.outcome !== "ready") return { outcome: "unavailable" }
  const admission = await ctx.runMutation(createRef, { networkId, ...intent, expectedPolicyVersion: intent.expectedPolicyVersion ?? readiness.result.policyVersion, optionsRequestId: readiness.requestId, attemptId: randomLinkId(), requestId: randomLinkId(), leaseToken: randomLinkToken(), configFingerprint: config.fingerprint, ...(reconfirmAttemptId ? { reconfirmAttemptId, acceptedTotal } : {}) })
  return "kind" in admission ? await deliver(ctx, networkId, config, admission) : admission
}

export const prepare = networkAction({
  args: { handle: v.string(), lines: v.array(checkoutLineValidator), fulfillment: checkoutFulfillmentValidator, consentTextVersion: v.string(), expectedPolicyVersion: v.number(), clientRequestId: v.string(), note: v.optional(v.string()) }, returns: checkoutActionResultValidator,
  handler: async (ctx, args): Promise<CheckoutActionResult> => {
    if (args.consentTextVersion !== COMMERCE_CHECKOUT_CONSENT_VERSION) return { outcome: "refused" }
    const config = await readCommerceLinkConfig()
    return config ? await prepareIntent(ctx, ctx.networkId, config, args) : { outcome: "unavailable" }
  },
})

async function runOperation(ctx: ActionCtx, networkId: Id<"networks">, config: CommerceLinkConfig, attemptId: string, operation: "status" | "retry" | "release", forReconfirm?: boolean, acceptedTotal?: Money): Promise<CheckoutActionResult> {
  const admission = await ctx.runMutation(operationRef, { networkId, attemptId, operation, requestId: randomLinkId(), leaseToken: randomLinkToken(), configFingerprint: config.fingerprint, ...(forReconfirm ? { forReconfirm, acceptedTotal } : {}) })
  return admission ? await deliver(ctx, networkId, config, admission) : { outcome: "refused" }
}

export const status = networkAction({
  args: { attemptId: v.string() }, returns: checkoutActionResultValidator,
  handler: async (ctx, args): Promise<CheckoutActionResult> => {
    const config = await readCommerceLinkConfig()
    return config ? await runOperation(ctx, ctx.networkId, config, args.attemptId, "status") : { outcome: "unavailable" }
  },
})
export const retry = networkAction({
  args: { attemptId: v.string() }, returns: checkoutActionResultValidator,
  handler: async (ctx, args): Promise<CheckoutActionResult> => {
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    // Le statut corrélé est consulté d'abord ; unknown autorise uniquement les mêmes octets.
    const lookup = await runOperation(ctx, ctx.networkId, config, args.attemptId, "status")
    if (lookup.outcome !== "attempt") return lookup
    const retryAdmission = await ctx.runMutation(operationRef, { networkId: ctx.networkId, attemptId: args.attemptId, operation: "retry", requestId: randomLinkId(), leaseToken: randomLinkToken(), configFingerprint: config.fingerprint })
    return retryAdmission ? await deliver(ctx, ctx.networkId, config, retryAdmission) : lookup
  },
})
export const release = networkAction({
  args: { attemptId: v.string() }, returns: checkoutActionResultValidator,
  handler: async (ctx, args): Promise<CheckoutActionResult> => {
    const config = await readCommerceLinkConfig()
    return config ? await runOperation(ctx, ctx.networkId, config, args.attemptId, "release") : { outcome: "unavailable" }
  },
})
export const reconfirm = networkAction({
  args: { attemptId: v.string(), consentTextVersion: v.string(), clientRequestId: v.string(), acceptedTotal: checkoutMoneyValidator }, returns: checkoutActionResultValidator,
  handler: async (ctx, args): Promise<CheckoutActionResult> => {
    if (args.consentTextVersion !== COMMERCE_CHECKOUT_CONSENT_VERSION) return { outcome: "refused" }
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    let input = await ctx.runMutation(reconfirmRef, { networkId: ctx.networkId, attemptId: args.attemptId, clientRequestId: args.clientRequestId, acceptedTotal: args.acceptedTotal })
    if (input && "existingAttemptId" in input) return { outcome: "attempt", attemptId: input.existingAttemptId }
    if (!input) {
      const released = await runOperation(ctx, ctx.networkId, config, args.attemptId, "release", true, args.acceptedTotal)
      if (released.outcome !== "attempt") return released
      input = await ctx.runMutation(reconfirmRef, { networkId: ctx.networkId, attemptId: args.attemptId, clientRequestId: args.clientRequestId, acceptedTotal: args.acceptedTotal })
      // Un timeout ne prouve aucune libération et ne déclenche aucune seconde réservation.
      if (!input) return released
      if ("existingAttemptId" in input) return { outcome: "attempt", attemptId: input.existingAttemptId }
    }
    return await prepareIntent(ctx, ctx.networkId, config, { ...input, consentTextVersion: args.consentTextVersion, clientRequestId: args.clientRequestId }, args.attemptId, args.acceptedTotal)
  },
})
