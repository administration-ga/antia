import { COMMERCE_CHECKOUT_STATES, COMMERCE_ORDER_STATES, COMMERCE_PAYMENT_STATES } from "@antsia/social-domain/commerce/lifecycle"
import { COMMERCE_MAX_AMOUNT_XAF } from "@antsia/social-domain/commerce/primitives"
import { createAppI18n } from "@antsia/social-features/i18n"
import { describe, expect, it } from "vitest"
import fr from "@/i18n/locales/fr/payment.json"
import en from "@/i18n/locales/en/payment.json"
import { PAYMENT_ATTEMPT_STATES, PAYMENT_CONSENT_DEFAULTS, PAYMENT_ORDER_STATES, PAYMENT_PAYMENT_STATES, PAYMENT_REFUND_REASONS, PAYMENT_REFUND_STATES, PAYMENT_STOCK_STATES, paymentAmount, paymentConsentSchema, paymentDate, paymentRefundSchema, safeProviderRedirect } from "./payment-model"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: { payment: fr }, en: { payment: en } }, defaultNS: "payment" })
const t = i18n.getFixedT("fr", "payment")

describe("montants et dates de paiement sans valeur inventée", () => {
  it.each(["fr", "en"])("affiche uniquement les francs XAF entiers en %s", (locale) => {
    expect(paymentAmount(25000, locale)).toContain("XAF")
    expect(paymentAmount(0, locale)).not.toBeNull()
    expect(paymentAmount(-0, locale)).toBe(paymentAmount(0, locale))
    expect(paymentAmount(COMMERCE_MAX_AMOUNT_XAF, locale)).not.toBeNull()
  })
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1.5, COMMERCE_MAX_AMOUNT_XAF + 1, Number.MAX_SAFE_INTEGER + 1])("ne remplace pas le montant invalide %s par zéro ni par un arrondi", (amount) => { expect(paymentAmount(amount, "fr")).toBeNull() })
  it("conserve une date absente et refuse les dates invalides sans utiliser l'heure courante", () => {
    for (const value of [null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 8_640_000_000_000_001]) expect(paymentDate(value, "fr")).toBeNull()
    expect(paymentDate(Date.UTC(2026, 9, 18, 12), "fr")).toContain("13:00")
    expect(paymentDate(Date.UTC(2026, 9, 18, 12), "fr")).toContain("2026")
    expect(paymentAmount(100, "invalid_locale")).toBeNull()
    expect(paymentDate(1_792_300_000_000, "invalid_locale")).toBeNull()
  })
})

describe("action explicite du prestataire, jamais un retour de paiement", () => {
  it("conserve les octets de l'URL HTTPS du DTO autorisé", () => {
    const url = "https://psp.example.test/session/opaque?signature=a%2Fb%3D&request=opaque"
    expect(safeProviderRedirect(url)).toBe(url)
  })
  it.each([
    undefined, null, {}, 1, "", "/retour?paid=true", "//psp.example.test/path", "javascript:alert(1)", "data:text/html,paid", "http://psp.example.test/path",
    "https://user@psp.example.test/path", "https://user:secret@psp.example.test/path", "https://psp.example.test/path#paid", "https://psp.example.test/path#",
    " https://psp.example.test/path", "https://psp.example.test/path ", "https://psp.example.test/\npaid", "https://psp.example.test/path\n", "https://psp.example.test\\evil/path", "https://psp.example.test:99999/path", "https://./", "https://psp..example.test/", `https://psp.example.test/${"x".repeat(2048)}`,
  ])("refuse une redirection ambiguë ou non contractuelle : %s", (value) => { expect(safeProviderRedirect(value)).toBeNull() })
  it("n'extrait aucune action ni confirmation d'un objet de retour navigateur", () => {
    expect(safeProviderRedirect({ paid: true, success: true, next: "https://psp.example.test/" })).toBeNull()
    expect(safeProviderRedirect(new URLSearchParams("paid=true&success=1"))).toBeNull()
    expect(PAYMENT_PAYMENT_STATES).not.toContain("paid")
    expect(PAYMENT_PAYMENT_STATES).not.toContain("success")
  })
})

describe("consentements explicites et états fermés", () => {
  it("commence décoché et ne transforme pas une absence d'accord en autorisation", () => {
    const schema = paymentConsentSchema(t)
    expect(PAYMENT_CONSENT_DEFAULTS).toEqual({ accepted: false })
    expect(schema.safeParse(PAYMENT_CONSENT_DEFAULTS).success).toBe(false)
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ accepted: "true" }).success).toBe(false)
    expect(schema.safeParse({ accepted: true, paid: true }).success).toBe(false)
    expect(schema.parse({ accepted: true })).toEqual({ accepted: true })
  })
  it("exige accord et motif fermé pour transmettre une demande de remboursement", () => {
    const schema = paymentRefundSchema(t)
    for (const reason of PAYMENT_REFUND_REASONS) expect(schema.safeParse({ accepted: true, reason }).success).toBe(true)
    expect(schema.safeParse({ accepted: false, reason: "duplicate_payment" }).success).toBe(false)
    expect(schema.safeParse({ accepted: true, reason: "" }).success).toBe(false)
    expect(schema.safeParse({ accepted: true, reason: "automatic" }).success).toBe(false)
    expect(schema.safeParse({ accepted: true, reason: "other", refunded: true }).success).toBe(false)
  })
  it("reprend les domaines P06 sans assimiler paiement, commande, réserve ou remboursement", () => {
    expect(PAYMENT_PAYMENT_STATES).toEqual(COMMERCE_PAYMENT_STATES)
    expect(PAYMENT_ORDER_STATES).toEqual(COMMERCE_ORDER_STATES)
    expect(PAYMENT_STOCK_STATES).toEqual(COMMERCE_CHECKOUT_STATES)
    expect(PAYMENT_REFUND_STATES).toEqual(["none", "requested", "processing", "confirmed", "failed", "rejected"])
    expect(PAYMENT_ATTEMPT_STATES).toContain("unknown")
    expect(PAYMENT_ATTEMPT_STATES).not.toContain("delivered")
  })
  it("fournit les mêmes clés FR/EN et couvre exactement chaque état admissible", () => {
    const keys = (object: Record<string, unknown>, prefix = ""): string[] => Object.entries(object).flatMap(([key, value]) => typeof value === "object" && value !== null ? keys(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]).sort()
    expect(keys(fr)).toEqual(keys(en))
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.attemptStates).sort()).toEqual([...PAYMENT_ATTEMPT_STATES].sort())
      expect(Object.keys(messages.paymentStates).sort()).toEqual([...PAYMENT_PAYMENT_STATES].sort())
      expect(Object.keys(messages.orderStates).sort()).toEqual([...PAYMENT_ORDER_STATES].sort())
      expect(Object.keys(messages.stockStates).sort()).toEqual([...PAYMENT_STOCK_STATES].sort())
      expect(Object.keys(messages.refundStates).sort()).toEqual([...PAYMENT_REFUND_STATES].sort())
      expect(Object.keys(messages.refundReasons).sort()).toEqual([...PAYMENT_REFUND_REASONS].sort())
    }
    expect(fr.consent).toBe("J’autorise le lancement de ce paiement pour le montant et le bénéficiaire affichés. Une demande en attente ou un retour du fournisseur ne confirme pas le règlement.")
    expect(en.consent).toBe("I authorise starting this payment for the displayed amount and beneficiary. A pending request or provider return does not confirm settlement.")
  })
})
