/** P11 : snapshots privés bornés ; une préparation ne rend jamais le paiement disponible. */
import type { CommerceCheckoutLineInput, CommerceCheckoutResult, CommerceCommandRequest } from "@antsia/social-domain/commerce/command"
import { COMMERCE_COMMAND_SCOPES } from "@antsia/social-domain/commerce/command"
import { COMMERCE_COMMAND_CONTRACT } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_CHECKOUT_CONSENT_VERSION } from "@antsia/social-domain/commerce-checkout"
import { type Infer, v } from "convex/values"

import type { Doc } from "../../_generated/dataModel"
import { catalogOfferValidator } from "./catalogValidators"

export const CHECKOUT_BODY_TTL_MS = 30 * 60_000
export const CHECKOUT_REQUEST_TTL_MS = 60_000
export const CHECKOUT_HOLD_MAX_MS = 15 * 60_000
export const CHECKOUT_LEASE_MS = 30_000
export const CHECKOUT_LINES_MAX = 10
export const checkoutMoneyValidator = v.object({ amount: v.number(), currency: v.literal("XAF") })
export const checkoutLineValidator = v.object({ expectedCatalogRevision: v.number(), expectedUnitAmount: checkoutMoneyValidator, offerRef: v.string(), quantity: v.number(), variantRef: v.optional(v.string()) })
export const checkoutFulfillmentValidator = v.union(
  v.object({ mode: v.literal("pickup"), establishmentRef: v.string() }),
  v.object({ mode: v.literal("seller_delivery"), address: v.object({ country: v.string(), line1: v.string(), line2: v.optional(v.string()), locality: v.string() }), instructions: v.optional(v.string()) }),
)
export const checkoutFeeValidator = v.object({ amount: checkoutMoneyValidator, kind: v.union(v.literal("delivery"), v.literal("packaging"), v.literal("service")), label: v.string() })
export const checkoutOptionsValidator = v.object({ shopRef: v.string(), policyVersion: v.number(), pickup: v.array(v.object({ establishmentRef: v.string(), label: v.string() })), fees: v.array(checkoutFeeValidator), sellerDelivery: v.union(v.null(), v.object({ fee: checkoutMoneyValidator, label: v.string() })) })
export const checkoutResultValidator = v.object({
  checkoutRef: v.string(), expiresAt: v.number(), fees: v.array(checkoutFeeValidator), state: v.literal("held"), total: checkoutMoneyValidator,
  lines: v.array(v.object({ catalogRevision: v.number(), label: v.string(), lineAmount: checkoutMoneyValidator, offerRef: v.string(), quantity: v.number(), unitAmount: checkoutMoneyValidator, variantRef: v.optional(v.string()) })),
  changes: v.optional(v.array(v.object({ field: v.union(v.literal("catalog_revision"), v.literal("quantity"), v.literal("unit_amount")), offerRef: v.string(), variantRef: v.optional(v.string()) }))),
})
export const checkoutStateValidator = v.union(v.literal("held"), v.literal("reconfirm"), v.literal("rejected"), v.literal("unknown"), v.literal("expired"), v.literal("released"), v.literal("consumed"))
export const checkoutAttemptValidator = v.object({
  attemptId: v.string(), handle: v.string(), state: checkoutStateValidator, expectedLines: v.array(checkoutLineValidator), expectedFees: v.array(checkoutFeeValidator), expectedPolicyVersion: v.number(), result: v.union(checkoutResultValidator, v.null()), reason: v.union(v.string(), v.null()),
  createdAt: v.number(), updatedAt: v.number(), expiresAt: v.union(v.number(), v.null()), canRetry: v.boolean(), canRelease: v.boolean(), canReconfirm: v.boolean(), consentTextVersion: v.string(), paymentAvailable: v.literal(false),
})
export type CheckoutAttempt = Infer<typeof checkoutAttemptValidator>
export const checkoutActionResultValidator = v.union(v.object({ outcome: v.literal("attempt"), attemptId: v.string() }), v.object({ outcome: v.union(v.literal("unavailable"), v.literal("refused")) }))
export type CheckoutActionResult = Infer<typeof checkoutActionResultValidator>
export const checkoutOptionsResultValidator = v.union(v.object({ outcome: v.literal("ready"), policyVersion: v.number(), pickup: v.array(v.object({ establishmentRef: v.string(), label: v.string() })), fees: v.array(checkoutFeeValidator), sellerDelivery: v.union(v.null(), v.object({ fee: checkoutMoneyValidator, label: v.string() })) }), v.object({ outcome: v.union(v.literal("unavailable"), v.literal("refused")) }))
export type CheckoutOptionsResult = Infer<typeof checkoutOptionsResultValidator>
export const cartContextValidator = v.object({ items: v.array(v.object({ offerRef: v.string(), variantRef: v.union(v.string(), v.null()), quantity: v.number(), offer: v.union(catalogOfferValidator, v.null()), available: v.boolean() })), available: v.boolean(), reason: v.union(v.literal("configuration_missing"), v.literal("policy_closed"), v.literal("unavailable"), v.null()), consentTextVersion: v.string(), pending: v.union(checkoutAttemptValidator, v.null()) })
export type CartContext = Infer<typeof cartContextValidator>
export const checkoutIntentLookupValidator = v.union(v.object({ outcome: v.literal("attempt"), attempt: checkoutAttemptValidator }), v.object({ outcome: v.literal("absent") }), v.object({ outcome: v.literal("stopped") }))
export type CheckoutIntentLookup = Infer<typeof checkoutIntentLookupValidator>
export const checkoutStopIntentValidator = v.union(v.object({ outcome: v.literal("attempt"), attempt: checkoutAttemptValidator }), v.object({ outcome: v.literal("stopped") }))
export type CheckoutStopIntentResult = Infer<typeof checkoutStopIntentValidator>

export function copyCheckoutLines(lines: readonly CommerceCheckoutLineInput[]): Infer<typeof checkoutLineValidator>[] {
  return lines.map((line) => ({ ...line, expectedUnitAmount: { ...line.expectedUnitAmount } }))
}
export function copyCheckoutResult(result: CommerceCheckoutResult): Infer<typeof checkoutResultValidator> {
  // `changes` (lecture seule) n'est jamais étalé tel quel : seule sa copie est rendue, et seulement s'il existe.
  const { changes, ...rest } = result
  return { ...rest, total: { ...result.total }, fees: result.fees.map((fee) => ({ ...fee, amount: { ...fee.amount } })), lines: result.lines.map((line) => ({ ...line, unitAmount: { ...line.unitAmount }, lineAmount: { ...line.lineAmount } })), ...(changes ? { changes: changes.map((change) => ({ ...change })) } : {}) }
}

/** Le parseur P06 de réponse ne lit que les lignes de payload.checkout : cette projection
 * conserve les éléments de corrélation et de comparaison, jamais l'adresse ni la note.
 * Elle sert UNIQUEMENT à valider un reçu ancien, jamais à reconstruire un envoi. */
export function checkoutResponseRequest(attempt: Pick<Doc<"checkoutAttempts">, "requestId" | "source" | "environment" | "issuedAt" | "requestExpiresAt" | "subjectRef" | "shopRef" | "expectedLines" | "consentedAt" | "consentTextVersion">): Extract<CommerceCommandRequest, { command: "checkout.prepare" }> {
  return { contract: COMMERCE_COMMAND_CONTRACT, version: 1, command: "checkout.prepare", scope: COMMERCE_COMMAND_SCOPES["checkout.prepare"], requestId: attempt.requestId, source: attempt.source, environment: attempt.environment, issuedAt: attempt.issuedAt, expiresAt: attempt.requestExpiresAt,
    subject: { kind: "buyer", ref: attempt.subjectRef, authVerifiedAt: attempt.issuedAt }, payload: { shopRef: attempt.shopRef, lines: attempt.expectedLines,
      consent: { givenAt: attempt.consentedAt, purpose: "commerce_checkout", textVersion: attempt.consentTextVersion },
      fulfillment: { mode: "seller_delivery", address: { country: "GA", line1: "[redacted]", locality: "[redacted]" } } } }
}

export function projectCheckoutAttempt(row: Doc<"checkoutAttempts">, nowMs: number, controlsAllowed = true): CheckoutAttempt {
  const state = row.result && row.result.expiresAt <= nowMs && (row.state === "held" || row.state === "reconfirm") ? "expired" : row.state
  return { attemptId: row.attemptId, handle: row.handle, state, expectedLines: row.expectedLines, expectedFees: row.expectedFees, expectedPolicyVersion: row.expectedPolicyVersion, result: row.result ?? null, reason: row.reason ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt, expiresAt: row.result?.expiresAt ?? null,
    canRetry: controlsAllowed && state === "unknown" && !!row.rawBody && row.requestExpiresAt > nowMs && !row.cancelledAt,
    canRelease: controlsAllowed && !!row.checkoutRef && ["held", "reconfirm", "unknown"].includes(state) && !row.cancelledAt,
    canReconfirm: controlsAllowed && state === "reconfirm" && !!row.rawBody && !row.cancelledAt,
    consentTextVersion: COMMERCE_CHECKOUT_CONSENT_VERSION, paymentAvailable: false }
}
