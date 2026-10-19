import { createAppI18n } from "@antsia/social-features/i18n"
import { describe, expect, it } from "vitest"
import fr from "@/i18n/locales/fr/checkout.json"
import en from "@/i18n/locales/en/checkout.json"
import { CHECKOUT_EXPIRY_WARNING_MS, checkoutCartLines, checkoutComparison, checkoutExpired, checkoutExpiringSoon, checkoutFormSchema, checkoutUnitAmount, EMPTY_CHECKOUT_FORM } from "./checkout-model"
import { catalogOfferFixture, checkoutAttemptFixture, checkoutResultFixture, ESTABLISHMENT_REF, NOW, OFFER_REF, VARIANT_REF } from "./checkout-fixtures.test-support"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: { checkout: fr }, en: { checkout: en } }, defaultNS: "checkout" })
const schema = checkoutFormSchema(i18n.getFixedT("fr", "checkout"))
const pickup = () => ({ ...EMPTY_CHECKOUT_FORM, fulfillmentMode: "pickup" as const, establishmentRef: ESTABLISHMENT_REF, consent: true })
describe("contrat de formulaire de préparation", () => {
  it("ne préremplit ni choix, ni adresse, ni consentement", () => {
    expect(EMPTY_CHECKOUT_FORM).toMatchObject({ variantRef: "", fulfillmentMode: "", establishmentRef: "", country: "", locality: "", line1: "", consent: false })
    expect(schema.safeParse(EMPTY_CHECKOUT_FORM).success).toBe(false)
    expect(schema.safeParse(pickup()).success).toBe(true)
  })
  it.each(["0", "1000", "1.5", "-1", "1e2", " 1", "01"])("refuse la quantité %s", (quantity) => { expect(schema.safeParse({ ...pickup(), quantity }).success).toBe(false) })
  it("borne la quantité entière et exige un établissement réellement sélectionné", () => {
    expect(schema.safeParse({ ...pickup(), quantity: "999" }).success).toBe(true)
    expect(schema.safeParse({ ...pickup(), establishmentRef: "" }).success).toBe(false)
    expect(schema.safeParse({ ...pickup(), consent: false }).success).toBe(false)
  })
  it("limite l'adresse au contrat GA et aux bornes P06", () => {
    const delivery = { ...pickup(), fulfillmentMode: "seller_delivery", country: "GA", locality: "Libreville", line1: "Quartier saisi volontairement" }
    expect(schema.safeParse(delivery).success).toBe(true)
    expect(schema.safeParse({ ...delivery, locality: "x".repeat(101) }).success).toBe(false)
    expect(schema.safeParse({ ...delivery, country: "FR" }).success).toBe(false)
    expect(schema.safeParse({ ...delivery, line1: "texte\u0000" }).success).toBe(false)
  })
  it("compare version, quantité et prix sans modifier le snapshot attendu", () => {
    const expected = checkoutAttemptFixture().expectedLines
    const current = checkoutResultFixture({ lines: [{ ...checkoutResultFixture().lines[0]!, catalogRevision: 4, quantity: 1, unitAmount: { amount: 28000, currency: "XAF" }, lineAmount: { amount: 28000, currency: "XAF" } }] })
    expect(checkoutComparison(expected, current.lines)[0]).toMatchObject({ changed: true, before: { expectedCatalogRevision: 3, expectedUnitAmount: { amount: 25000 } }, after: { catalogRevision: 4, unitAmount: { amount: 28000 } } })
    expect(expected[0]?.expectedUnitAmount.amount).toBe(25000)
  })
  it("traite l'échéance exacte comme dépassée sans prolonger la réserve", () => {
    expect(checkoutExpired(NOW, NOW)).toBe(true)
    expect(checkoutExpired(NOW + 1, NOW)).toBe(false)
    expect(checkoutExpired(null, NOW)).toBe(false)
  })
  it("P18b (A17) : l'échéance approche dans les deux minutes qui la précèdent, jamais après elle", () => {
    expect(CHECKOUT_EXPIRY_WARNING_MS).toBeGreaterThanOrEqual(20_000)
    expect(checkoutExpiringSoon(NOW + CHECKOUT_EXPIRY_WARNING_MS, NOW)).toBe(true)
    expect(checkoutExpiringSoon(NOW + CHECKOUT_EXPIRY_WARNING_MS + 1, NOW)).toBe(false)
    expect(checkoutExpiringSoon(NOW + 1, NOW)).toBe(true)
    expect(checkoutExpiringSoon(NOW, NOW)).toBe(false)
    expect(checkoutExpiringSoon(NOW - 1, NOW)).toBe(false)
    expect(checkoutExpiringSoon(null, NOW)).toBe(false)
    expect(checkoutExpiringSoon(Number.NaN, NOW)).toBe(false)
  })
})

describe("prix exact d'une ligne, offre seule ou panier", () => {
  it("prend le prix de la variante désignée, jamais le prix de base à sa place", () => {
    const offer = catalogOfferFixture()
    expect(checkoutUnitAmount(offer, VARIANT_REF)).toBe(17500)
    expect(checkoutUnitAmount(offer, "")).toBeUndefined()
    expect(checkoutUnitAmount(offer)).toBeUndefined()
    expect(checkoutUnitAmount(offer, "pro.ga:offer_variant:retiree")).toBeUndefined()
  })
  it("sans variante : le prix fixe ou unitaire, jamais un devis", () => {
    expect(checkoutUnitAmount(catalogOfferFixture({ variants: [] }))).toBe(15000)
    expect(checkoutUnitAmount(catalogOfferFixture({ variants: [], price: { mode: "unit", currency: "XAF", amount: 900, unit: "kg" } }))).toBe(900)
    expect(checkoutUnitAmount(catalogOfferFixture({ variants: [], price: { mode: "quote", currency: "XAF" } }))).toBeUndefined()
  })
  it("un panier n'est préparable que si chacune de ses lignes a son prix exact", () => {
    const fixed = catalogOfferFixture({ offerRef: "pro.ga:offer:second", variants: [], price: { mode: "fixed", currency: "XAF", amount: 3000 } })
    expect(checkoutCartLines([{ offer: catalogOfferFixture(), variantRef: VARIANT_REF, quantity: 2 }, { offer: fixed, quantity: 3 }])).toEqual([
      { offerRef: OFFER_REF, variantRef: VARIANT_REF, quantity: 2, expectedCatalogRevision: 3, expectedUnitAmount: { amount: 17500, currency: "XAF" } },
      { offerRef: "pro.ga:offer:second", quantity: 3, expectedCatalogRevision: 3, expectedUnitAmount: { amount: 3000, currency: "XAF" } },
    ])
    expect(checkoutCartLines([{ offer: fixed, quantity: 3 }, { offer: catalogOfferFixture(), quantity: 1 }])).toBeNull()
    expect(checkoutCartLines([{ offer: fixed, quantity: 3 }, { offer: catalogOfferFixture(), variantRef: "pro.ga:offer_variant:retiree", quantity: 1 }])).toBeNull()
  })
})
