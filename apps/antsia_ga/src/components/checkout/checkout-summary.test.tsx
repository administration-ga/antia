import { createAppI18n } from "@antsia/social-features/i18n"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it } from "vitest"
import fr from "@/i18n/locales/fr/checkout.json"
import en from "@/i18n/locales/en/checkout.json"
import { checkoutAmount } from "./checkout-model"
import { CheckoutSummary } from "./checkout-summary"
import { checkoutAttemptFixture, checkoutResultFixture } from "./checkout-fixtures.test-support"

describe("récapitulatif privé et comparaison explicite", () => {
  it.each(["fr", "en"] as const)("affiche les montants entiers, frais et échéance en %s sans action de paiement", (locale) => {
    const i18n = createAppI18n({ locale, appResources: { fr: { checkout: fr }, en: { checkout: en } }, defaultNS: "checkout" })
    const attempt = checkoutAttemptFixture()
    const html = renderToStaticMarkup(<I18nextProvider i18n={i18n}><CheckoutSummary result={attempt.result!} expected={attempt.expectedLines} expectedFees={attempt.expectedFees} expectedPolicyVersion={attempt.expectedPolicyVersion} /></I18nextProvider>)
    expect(html).toContain(checkoutAmount(25000, locale))
    expect(html).toContain(checkoutAmount(25200, locale))
    expect(html).toContain("Emballage")
    expect(html).toContain(locale === "fr" ? "Échéance" : "Deadline")
    expect(html).not.toContain("<button")
    expect(html).not.toContain("checkoutRef")
  })
  it("conserve avant/après et échappe le libellé sans réécrire les conditions acceptées", () => {
    const i18n = createAppI18n({ locale: "fr", appResources: { fr: { checkout: fr }, en: { checkout: en } }, defaultNS: "checkout" })
    const result = checkoutResultFixture({ lines: [{ ...checkoutResultFixture().lines[0]!, label: '<script>prix</script>', catalogRevision: 4, unitAmount: { amount: 28000, currency: "XAF" }, lineAmount: { amount: 28000, currency: "XAF" } }], total: { amount: 28200, currency: "XAF" } })
    const attempt = checkoutAttemptFixture()
    const html = renderToStaticMarkup(<I18nextProvider i18n={i18n}><CheckoutSummary compare result={result} expected={attempt.expectedLines} expectedFees={attempt.expectedFees} expectedPolicyVersion={attempt.expectedPolicyVersion} /></I18nextProvider>)
    expect(html).toContain("Conditions demandées")
    expect(html).toContain("Conditions proposées")
    expect(html).toContain(checkoutAmount(25000, "fr"))
    expect(html).toContain(checkoutAmount(28000, "fr"))
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
  })
  it("compare aussi les frais et totaux antérieurs lorsque les lignes sont inchangées", () => {
    const i18n = createAppI18n({ locale: "fr", appResources: { fr: { checkout: fr }, en: { checkout: en } }, defaultNS: "checkout" })
    const attempt = checkoutAttemptFixture()
    const result = checkoutResultFixture({ fees: [{ kind: "packaging", label: "Nouvel emballage", amount: { amount: 350, currency: "XAF" } }], total: { amount: 25350, currency: "XAF" } })
    const html = renderToStaticMarkup(<I18nextProvider i18n={i18n}><CheckoutSummary compare result={result} expected={attempt.expectedLines} expectedFees={attempt.expectedFees} expectedPolicyVersion={attempt.expectedPolicyVersion} /></I18nextProvider>)
    expect(html).toContain("Conditions demandées")
    expect(html).toContain("Conditions proposées")
    expect(html).toContain(checkoutAmount(200, "fr"))
    expect(html).toContain(checkoutAmount(350, "fr"))
    expect(html).toContain(checkoutAmount(25200, "fr"))
    expect(html).toContain(checkoutAmount(25350, "fr"))
  })
})
