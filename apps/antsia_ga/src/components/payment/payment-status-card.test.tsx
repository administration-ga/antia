import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it, vi } from "vitest"
import type { PaymentAttempt } from "@convex/modules/shops/paymentRules"
import { routes } from "@/lib/routes"
import { PaymentStatusCard } from "./payment-status-card"
import { paymentAttemptFixture, paymentTestI18n } from "./payment-fixtures.test-support"

/** Adresse fictive du prestataire : elle ne vit que dans ce test (cliquet `no-hardcoded-urls`). */
const TEST_PROVIDER_URL = "https://psp.example.test/action/opaque?signature=a%2Fb%3D"

vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
const i18n = paymentTestI18n()
function html(overrides: Partial<PaymentAttempt> = {}, compact = false) { return renderToStaticMarkup(<I18nextProvider i18n={i18n}><PaymentStatusCard attempt={paymentAttemptFixture(overrides)} compact={compact} /></I18nextProvider>) }
const requiresAction = (): Partial<PaymentAttempt> => ({ state: "requires_action", paymentState: "requires_action", action: { kind: "provider_redirect", url: TEST_PROVIDER_URL } })

describe("faits de paiement séparés de la commande et de la remise", () => {
  it("conserve paiement prouvé, commande en attente, stock expiré et remboursement en cours indépendants", () => {
    const rendered = html({ state: "succeeded", paymentState: "succeeded", orderState: "pending", stockState: "expired", refundState: "processing", reviewRequired: true })
    expect(rendered).toContain(i18n.t("paymentStates.succeeded"))
    expect(rendered).toContain(i18n.t("orderStates.pending"))
    expect(rendered).toContain(i18n.t("stockStates.expired"))
    expect(rendered).toContain(i18n.t("refundStates.processing"))
    expect(rendered).toContain(i18n.t("reviewRequired"))
    expect(rendered).toContain(i18n.t("fulfillmentUnconfirmed"))
    expect(rendered).not.toContain(i18n.t("orderStates.delivered"))
    expect(rendered).not.toContain(i18n.t("refundStates.confirmed"))
  })
  it.each(["observedAt", "paymentRef", "orderRef"] as const)("ne présente pas succeeded comme confirmé sans %s", (field) => {
    const rendered = html({ state: "succeeded", paymentState: "succeeded", [field]: null })
    expect(rendered).toContain(i18n.t("attemptStates.unknown"))
    expect(rendered).toContain(i18n.t("stateUnknown"))
    expect(rendered).not.toContain(i18n.t("paymentStates.succeeded"))
    expect(rendered).not.toContain(i18n.t("attemptStates.succeeded"))
  })
  it("un remboursement sans observation n'est pas présenté confirmé", () => {
    const rendered = html({ state: "unknown", paymentState: null, observedAt: null, refundState: "confirmed" })
    expect(rendered).toContain(i18n.t("dateUnknown"))
    expect(rendered).not.toContain(i18n.t("refundStates.confirmed"))
  })
  it("n'invente aucun état ou montant à partir des champs absents ou invalides", () => {
    const rendered = html({ state: "unknown", paymentState: null, orderState: null, stockState: null, refundState: null, observedAt: null, amount: { amount: Number.NaN, currency: "XAF" } })
    expect(rendered).toContain(i18n.t("amountUnknown"))
    expect(rendered).toContain(i18n.t("dateUnknown"))
    expect(rendered).not.toContain(i18n.t("paymentStates.succeeded"))
    expect(rendered).not.toContain(i18n.t("orderStates.confirmed"))
  })
})

describe("action prestataire réellement admissible", () => {
  it("rend seulement un lien explicite HTTPS de l'action serveur requires_action", () => {
    const rendered = html(requiresAction())
    expect(rendered).toContain(TEST_PROVIDER_URL.replaceAll("&", "&amp;"))
    expect(rendered).toContain(i18n.t("providerAction"))
    expect(rendered).toMatch(/referrerpolicy="no-referrer"/i)
    expect(rendered).not.toContain("http-equiv")
    expect(rendered).not.toContain(i18n.t("paymentStates.succeeded"))
  })
  it.each(["localState", "paymentState", "canRefresh", "reviewRequired", "compact"])("ne rend aucun lien prestataire quand %s ne l'autorise pas", (condition) => {
    const overrides = { ...requiresAction(), ...(condition === "localState" ? { state: "pending" as const } : condition === "paymentState" ? { paymentState: "pending" as const } : condition === "canRefresh" ? { canRefresh: false } : condition === "reviewRequired" ? { reviewRequired: true } : {}) }
    expect(html(overrides, condition === "compact")).not.toContain(TEST_PROVIDER_URL)
  })
  it.each(["http://psp.example.test/action", "https://user:secret@psp.example.test/action", "https://psp.example.test/action#paid", "javascript:alert(1)"])("refuse l'URL non contractuelle %s", (url) => {
    const rendered = html({ ...requiresAction(), action: { kind: "provider_redirect", url } })
    expect(rendered).toContain(i18n.t("providerActionUnavailable"))
    expect(rendered).not.toContain(`href="${url}"`)
  })
  it("le mode compact pointe vers le suivi privé et ne révèle pas de références commerciales brutes", () => {
    const attempt = paymentAttemptFixture()
    const rendered = html({}, true)
    expect(rendered).toContain(routes.paymentAttempt(attempt.paymentAttemptId))
    expect(rendered).not.toContain(attempt.checkoutRef)
    expect(rendered).not.toContain(attempt.paymentRef!)
    expect(rendered).not.toContain(attempt.orderRef!)
  })
})
