import { describe, expect, it } from "vitest"
import { COLLECTION_REF, OFFER_REF } from "@/components/shops/__tests__/catalog-fixtures"
import { catalogSearch } from "./catalog-search"
import { routes } from "./routes"

describe("filtres et routes catalogue bornés", () => {
  it("normalise une recherche sans inventer de filtre ou de curseur", () => {
    expect(catalogSearch({})).toEqual({ cursor: null })
    expect(catalogSearch({ type: "service", collection: COLLECTION_REF, recherche: "  couture  ", curseur: "page-2" })).toEqual({ kind: "service", collectionRef: COLLECTION_REF, query: "couture", cursor: "page-2" })
  })
  it("refuse filtres répétés, type inconnu, référence privée et entrées trop longues", () => {
    for (const value of [{ type: ["product", "service"] }, { type: "job" }, { collection: "convex-id" }, { recherche: "x".repeat(121) }, { recherche: "bad\nquery" }, { curseur: "x".repeat(8193) }]) expect(catalogSearch(value)).toBeNull()
  })
  it("encode chaque segment et conserve les filtres sur la pagination sans URL libre", () => {
    expect(routes.shopOffer("a/b", OFFER_REF)).toContain("/boutique/a%2Fb/offres/pro.ga%3Aoffer%3A")
    expect(routes.publicShopOffer("a/b", OFFER_REF)).toContain("/boutiques/a%2Fb/offres/")
    const route = routes.publicShopCatalog("atelier", { kind: "product", collectionRef: COLLECTION_REF, query: "sac & tissu" }, "page/2")
    expect(route).toContain("type=product")
    expect(route).toContain("recherche=sac+%26+tissu")
    expect(route).toContain("curseur=page%2F2")
    expect(routes.shopCatalog("atelier")).toBe("/boutique/atelier/catalogue")
  })
})
