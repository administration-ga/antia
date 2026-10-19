import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import { SHOP_LIMITS, SHOP_MODELS as SERVER_MODELS, checkShopDescription } from "@convex/modules/shops/rules"
import { presentationSchema, publicationActions, SHOP_FORM_LIMITS, SHOP_MODELS, shopErrorText, startShopSchema } from "./shop-model"
import { editorFixture } from "./__tests__/fixtures"

const t = ((key: string) => key) as TFunction
describe("Formulaires boutiques P07", () => {
  it("garde les mêmes modèles et plafonds que le serveur sans l'importer dans les composants", () => {
    expect(SHOP_MODELS).toEqual(SERVER_MODELS)
    for (const [key, value] of Object.entries(SHOP_FORM_LIMITS)) expect(SHOP_LIMITS[key as keyof typeof SHOP_LIMITS]).toBe(value)
  })
  it("demande un nom pour un brouillon et permet une page existante sélectionnée", () => {
    expect(startShopSchema(t).safeParse({ model: "products", name: "", pageId: "" }).success).toBe(false)
    expect(startShopSchema(t).safeParse({ model: "quote_services", name: "", pageId: "page_eligible" }).success).toBe(true)
    expect(startShopSchema(t).safeParse({ model: "employer", name: "Atelier", pageId: "" }).success).toBe(false)
  })
  it("préserve la casse commerciale et permet une description de brouillon encore courte", () => {
    const values = { name: "  Mon Atelier e\u0301te\u0301  ", description: "Court", specialty: "", serviceArea: "", hours: "" }
    expect(presentationSchema(t).parse(values).name).toBe("Mon Atelier été")
    expect(checkShopDescription(values.description).ok).toBe(true)
    expect(presentationSchema(t).safeParse({ ...values, hours: "x".repeat(SHOP_FORM_LIMITS.hoursMax + 1) }).success).toBe(false)
    expect(presentationSchema(t).safeParse({ ...values, name: "Nom\u0000caché" }).success).toBe(false)
  })
  it("ferme publication et réadmission selon les vrais états, même si un flag isolé est incohérent", () => {
    const shop = editorFixture()
    expect(publicationActions(shop, false).request).toBe(true)
    expect(publicationActions(shop, true).request).toBe(false)
    expect(publicationActions({ ...shop, policy: "closed" }, false).request).toBe(false)
    expect(publicationActions({ ...shop, publication: { ...shop.publication, requestable: false }, storefront: { ...shop.storefront, state: "pending_review" } }, false)).toEqual({ request: false, cancel: true, withdraw: false })
    expect(publicationActions({ ...shop, publication: { ...shop.publication, requestable: false }, storefront: { ...shop.storefront, state: "suspended" } }, false)).toEqual({ request: false, cancel: false, withdraw: false })
  })
  it("ne montre jamais une trace serveur brute", () => {
    expect(shopErrorText(new Error("private stack and identity"), t)).toBe("common.actionFailed")
  })
})
