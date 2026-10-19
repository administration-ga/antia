import { createAppI18n } from "@antsia/social-features/i18n"
import type { CommerceOrderView } from "@antsia/social-domain/commerce-orders"
import type { Purchase } from "@convex/modules/shops/purchaseRules"
import { appResources } from "@/i18n/resources"

export const PURCHASE_NOW = Date.UTC(2026, 9, 18, 12)
export const purchaseI18n = () => createAppI18n({ locale: "fr", appResources, defaultNS: "purchases" })
export function orderFixture(overrides: Partial<CommerceOrderView> = {}): CommerceOrderView {
  return { orderRef: "pro.ga:order:01JA00000000000000000000O1", checkoutRef: "pro.ga:checkout:01JA00000000000000000000H1", paymentRef: "pro.ga:payment_intent:01JA00000000000000000000P1", shopRef: "antsia:shop:01JA00000000000000000000S1", reference: "Commande de recette", sellerLabel: "Atelier de recette", createdAt: PURCHASE_NOW, updatedAt: PURCHASE_NOW, revision: 8, paymentRevision: 4,
    lines: [{ offerRef: "pro.ga:offer:01JA00000000000000000000F1", variantRef: null, label: "Sac", quantity: 2, unitAmount: { amount: 1000, currency: "XAF" }, lineAmount: { amount: 2000, currency: "XAF" } }], fees: [], amount: { amount: 2000, currency: "XAF" }, orderState: "confirmed", paymentState: "succeeded", stockState: "consumed", refundState: "none", reviewRequired: false,
    fulfillment: { mode: "unknown", state: "unknown", locality: null, leadTimeDays: null }, receipt: null, settlementState: "withheld", cancellationState: "none", returnState: "none", history: [{ status: "confirmed", at: PURCHASE_NOW }], historyTruncated: false, messages: [], messagesTruncated: false,
    capabilities: { canCancel: false, canConfirmReceipt: true, canRequestReturn: false, canMessage: true, canRequestRefund: false }, consentTextVersion: "accord-checkout-origine-different-de-reception", ...overrides }
}
export function purchaseFixture(overrides: Partial<Purchase> = {}): Purchase {
  const order = orderFixture()
  return { purchaseId: "payment-private", paymentAttemptId: "payment-private", checkoutAttemptId: "checkout-private", handle: "ancienne-boutique", orderRef: order.orderRef, order, observedAt: PURCHASE_NOW, stale: false, available: true, pendingActions: [], ...overrides }
}
