import type { CheckoutAttempt } from "@convex/modules/shops/checkoutRules"
import { catalogOfferFixture, OFFER_REF, VARIANT_REF } from "@/components/shops/__tests__/catalog-fixtures"
import type { CheckoutOptions } from "./checkout-form"

export { catalogOfferFixture, OFFER_REF, VARIANT_REF }
export const NOW = 1_792_300_000_000
export const ESTABLISHMENT_REF = "pro.ga:establishment:01JA00000000000000000000E1"
export const optionsFixture: CheckoutOptions = { outcome: "ready", policyVersion: 1, pickup: [{ establishmentRef: ESTABLISHMENT_REF, label: "Retrait centre-ville" }], fees: [{ amount: { amount: 200, currency: "XAF" }, kind: "packaging", label: "Emballage" }], sellerDelivery: { fee: { amount: 1500, currency: "XAF" }, label: "Livraison locale" } }
export function checkoutResultFixture(overrides: Partial<NonNullable<CheckoutAttempt["result"]>> = {}): NonNullable<CheckoutAttempt["result"]> {
  return { checkoutRef: "pro.ga:checkout:01JA00000000000000000000H1", expiresAt: NOW + 60_000, fees: optionsFixture.fees, lines: [{ offerRef: OFFER_REF, variantRef: VARIANT_REF, label: "Sac artisanal — Rouge", catalogRevision: 3, quantity: 1, unitAmount: { amount: 25000, currency: "XAF" }, lineAmount: { amount: 25000, currency: "XAF" } }], state: "held", total: { amount: 25200, currency: "XAF" }, ...overrides }
}
export function checkoutAttemptFixture(overrides: Partial<CheckoutAttempt> = {}): CheckoutAttempt {
  return { attemptId: "attempt-opaque-a", handle: "atelier", state: "held", expectedLines: [{ offerRef: OFFER_REF, variantRef: VARIANT_REF, expectedCatalogRevision: 3, expectedUnitAmount: { amount: 25000, currency: "XAF" }, quantity: 1 }], expectedFees: optionsFixture.fees, expectedPolicyVersion: optionsFixture.policyVersion, result: checkoutResultFixture(), reason: null, createdAt: NOW, updatedAt: NOW, expiresAt: NOW + 60_000, canRetry: false, canRelease: true, canReconfirm: false, consentTextVersion: "version-serveur-courante", paymentAvailable: false, ...overrides }
}
