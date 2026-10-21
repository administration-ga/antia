import { afterEach, describe, expect, it, vi } from "vitest"
import { COLLECTION_REF, OFFER_REF } from "@/components/shops/__tests__/catalog-fixtures"
import { catalogSearch } from "./catalog-search"
import { routes } from "./routes"

afterEach(() => { vi.unstubAllEnvs() })

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
  it.each(["http://127.0.0.1:3210", "http://localhost:3210", "https://vivid-hedgehog-655.convex.cloud"])("accepte seulement les trois collections démo déclarées sur %s", (backendUrl) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backendUrl)
    for (const handle of ["epicerie-moussavou-demo", "studio-objectif-demo", "atelier-tech-demo"]) {
      const collectionRef = `demo:collection:${handle}`
      expect(catalogSearch({ collection: collectionRef })).toEqual({ collectionRef, cursor: null })
    }
    for (const collection of ["demo:collection:autre", "demo:collection:atelier-tech-demo/extra", "demo:collection:ATELIER-TECH-DEMO"]) expect(catalogSearch({ collection })).toBeNull()
  })
  it.each(["https://production.convex.cloud", "https://other.convex.cloud", "https://vivid-hedgehog-655.convex.cloud.evil.test", "http://localhost:3211"])("refuse les collections démo sur %s et conserve les références PRO.GA", (backendUrl) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backendUrl)
    vi.stubEnv("ANTSIA_DEMO_DEPLOYMENT", "vivid-hedgehog-655")
    expect(catalogSearch({ collection: "demo:collection:atelier-tech-demo" })).toBeNull()
    expect(catalogSearch({ collection: COLLECTION_REF })).toEqual({ collectionRef: COLLECTION_REF, cursor: null })
  })
})
