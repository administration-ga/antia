import { createAppI18n } from "@antsia/social-features/i18n"
import type { PaymentAttempt, PaymentContext } from "@convex/modules/shops/paymentRules"
import { appResources } from "@/i18n/resources"

export const PAYMENT_TEST_NOW = Date.UTC(2026, 9, 18, 12)
export const TEST_CHECKOUT_ATTEMPT_ID = "checkout-test-private"
export const TEST_PAYMENT_ATTEMPT_ID = "payment-test-private"
export const paymentTestI18n = (locale: "fr" | "en" = "fr") => createAppI18n({ locale, appResources, defaultNS: "payment" })

export function paymentAttemptFixture(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
  return {
    paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID,
    checkoutAttemptId: TEST_CHECKOUT_ATTEMPT_ID,
    state: "pending", amount: { amount: 25200, currency: "XAF" },
    checkoutRef: "pro.ga:checkout:01JA00000000000000000000H1",
    paymentRef: "pro.ga:payment_intent:01JA00000000000000000000P1",
    orderRef: "pro.ga:order:01JA00000000000000000000O1",
    paymentState: "pending", orderState: "pending", stockState: "held", refundState: "none",
    reviewRequired: false, revision: 3, observedAt: PAYMENT_TEST_NOW,
    createdAt: PAYMENT_TEST_NOW, updatedAt: PAYMENT_TEST_NOW,
    action: { kind: "await_provider_confirmation" }, canRetry: false, canRefresh: true, canRequestRefund: false, reason: null,
    ...overrides,
  }
}

export function paymentContextFixture(overrides: Partial<PaymentContext> = {}): PaymentContext {
  return {
    checkoutAttemptId: TEST_CHECKOUT_ATTEMPT_ID,
    available: true, reason: null, amount: { amount: 25200, currency: "XAF" },
    expiresAt: PAYMENT_TEST_NOW + 120_000,
    providerLabel: "Fournisseur de recette", beneficiaryLabel: "Structure de recette", modes: ["mobile_money"],
    consentTextVersion: "version-consentement-test",
    readinessRef: "readiness-test-private", readinessExpiresAt: PAYMENT_TEST_NOW + 60_000, existing: null,
    ...overrides,
  }
}
