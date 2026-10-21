import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { catalogOfferFixture, catalogPageFixture, COLLECTION_REF, OFFER_REF } from "@/components/shops/__tests__/catalog-fixtures"

const mocks = vi.hoisted(() => ({ query: vi.fn(), viewer: vi.fn() }))
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.query }))
vi.mock("./server-session", () => ({ getServerViewer: mocks.viewer, withinBridgeDeadline: (work: () => Promise<unknown>) => work(), configuredMetadataOrigin: () => "https://antsia.ga" }))

import { catalogOfferSchema, catalogPageSchema, loadPublicCatalog, loadPublicOffer, loadPublicPostOffer } from "./public-catalog-data"
import { DEMO_CATALOG_DECLARATIONS } from "./demo-catalog-projection"

beforeEach(() => {
  mocks.query.mockReset(); mocks.viewer.mockReset()
  mocks.viewer.mockResolvedValue({ status: "anonymous" })
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://localhost:3210")
})

afterEach(() => { vi.unstubAllEnvs() })

function demoOfferFixture() {
  return catalogOfferFixture({
    offerRef: "demo:offer:epicerie-produits", shopHandle: "epicerie-moussavou-demo",
    collections: [{ collectionRef: "demo:collection:epicerie-moussavou-demo", label: "Produits de démonstration" }],
    variantAxes: [], variants: [], media: [{ url: "/demo-media/animation-20261020/epicerie-produits.png", altText: "Illustration générée pour la démonstration", width: null, height: null, withheld: null }],
    availability: { state: "unknown", indicative: true, updatedAt: null, stale: false },
  })
}

describe("catalogue SSR — projection strictement allowlistée", () => {
  it("admet le DTO gelé et refuse chaque champ privé même imbriqué", () => {
    const offer = catalogOfferFixture()
    expect(catalogOfferSchema.safeParse(offer).success).toBe(true)
    for (const extra of [{ linkRef: "private" }, { source: "private" }, { stockQuantity: 10 }, { proUrl: "https://pro.example/gestion" }, { pageId: "private" }]) expect(catalogOfferSchema.safeParse({ ...offer, ...extra }).success).toBe(false)
    expect(catalogOfferSchema.safeParse({ ...offer, variants: [{ ...offer.variants[0], stockQuantity: 2 }] }).success).toBe(false)
    expect(catalogOfferSchema.safeParse({ ...offer, actions: { ...offer.actions, purchase: true } }).success).toBe(false)
  })
  it("refuse prix fractionnaire, devis chiffré, intervalle inversé et protocole média actif", () => {
    const offer = catalogOfferFixture()
    for (const price of [{ mode: "fixed", amount: 1.5, currency: "XAF" }, { mode: "quote", amount: 0, currency: "XAF" }, { mode: "range", minAmount: 20, maxAmount: 10, currency: "XAF" }]) expect(catalogOfferSchema.safeParse({ ...offer, price }).success).toBe(false)
    expect(catalogOfferSchema.safeParse({ ...offer, media: [{ ...offer.media[0], url: "javascript:alert(1)" }] }).success).toBe(false)
    expect(catalogPageSchema.safeParse(catalogPageFixture({ page: Array.from({ length: 13 }, () => offer) })).success).toBe(false)
    expect(catalogPageSchema.safeParse({ ...catalogPageFixture(), privateCursorData: "forbidden" }).success).toBe(false)
  })
  it("préserve handoff et refus de session sans consultation anonyme", async () => {
    expect(await loadPublicCatalog("atelier", {}, null, true)).toEqual({ status: "handoff" })
    expect(mocks.viewer).not.toHaveBeenCalled()
    mocks.viewer.mockResolvedValue({ status: "refused" })
    expect(await loadPublicCatalog("atelier", {}, null, false)).toEqual({ status: "refused" })
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "refused" })
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("une panne de session ne se transforme pas en lecture publique", async () => {
    mocks.viewer.mockResolvedValue({ status: "unavailable" })
    expect(await loadPublicCatalog("atelier")).toEqual({ status: "unavailable" })
    expect(await loadPublicPostOffer("post-test")).toEqual({ status: "unavailable" })
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("transmet le réseau, la fenêtre, les filtres et le bearer uniquement à la projection serveur", async () => {
    mocks.viewer.mockResolvedValue({ status: "authenticated", token: "TEST-JWT" })
    mocks.query.mockImplementation(async (reference, args, options) => {
      if (getFunctionName(reference).endsWith(":getBySlug")) return { _id: "root-test" }
      expect(getFunctionName(reference)).toBe("modules/public/catalog:list")
      expect(args).toEqual({ networkId: "root-test", handle: "atelier", kind: "service", collectionRef: COLLECTION_REF, query: "couture", paginationOpts: { cursor: "page-2", numItems: 12 } })
      expect(options.token).toBe("TEST-JWT")
      return catalogPageFixture()
    })
    expect(await loadPublicCatalog("atelier", { kind: "service", collectionRef: COLLECTION_REF, query: "couture" }, "page-2")).toEqual({ status: "ready", data: catalogPageFixture(), viewer: "authenticated" })
  })
  it("conserve un retrait sous null et refuse un DTO élargi", async () => {
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : null)
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "ready", data: null, viewer: "anonymous" })
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : { ...catalogOfferFixture(), source: "private" })
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "unavailable" })
  })
  it("refuse un catalogue contenant un champ privé", async () => {
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : { ...catalogPageFixture(), privateCursorData: "forbidden" })
    const filters = { kind: "service" as const, collectionRef: COLLECTION_REF, query: "couture" }
    expect(await loadPublicCatalog("atelier", { ...filters }, "page-2")).toEqual({ status: "unavailable" })
  })
})

describe("catalogue SSR — projection illustrative de démonstration", () => {
  it.each(["http://localhost:3210", "http://127.0.0.1:3210", "https://vivid-hedgehog-655.convex.cloud"])("admet les huit déclarations uniquement sur %s", (backendUrl) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backendUrl)
    for (const declaration of DEMO_CATALOG_DECLARATIONS) {
      const base = demoOfferFixture()
      const offer = { ...base, offerRef: declaration.offerRef, shopHandle: declaration.shopHandle, kind: declaration.kind, collections: [{ collectionRef: declaration.collectionRef, label: "Démonstration" }], media: [{ ...base.media[0]!, url: declaration.imagePath }] }
      expect(catalogOfferSchema.safeParse(offer).success).toBe(true)
      expect(catalogPageSchema.safeParse(catalogPageFixture({ page: [offer], collections: offer.collections })).success).toBe(true)
    }
  })
  it.each(["https://production.convex.cloud", "https://other.convex.cloud", "https://vivid-hedgehog-655.convex.cloud.evil.test", "https://vivid-hedgehog-655.convex.cloud@evil.test", "https://vivid-hedgehog-655.convex.cloud:444", "http://localhost:3211"])("refuse la démo sur %s et conserve le contrat PRO.GA", (backendUrl) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", backendUrl)
    vi.stubEnv("ANTSIA_DEMO_DEPLOYMENT", "vivid-hedgehog-655")
    expect(catalogOfferSchema.safeParse(demoOfferFixture()).success).toBe(false)
    expect(catalogPageSchema.safeParse(catalogPageFixture({ page: [], collections: demoOfferFixture().collections })).success).toBe(false)
    expect(catalogOfferSchema.safeParse(catalogOfferFixture({ media: [{ url: "https://assets.example.test/catalogue/image.png", altText: "Produit", width: 800, height: 800, withheld: null }] })).success).toBe(true)
  })
  it("refuse toute incohérence offre, boutique, collection, image, variante ou action", () => {
    const offer = demoOfferFixture()
    const mismatches = [
      { offerRef: "demo:offer:inconnue" }, { offerRef: OFFER_REF }, { shopHandle: "studio-objectif-demo" }, { kind: "service" },
      { collections: [{ collectionRef: "demo:collection:atelier-tech-demo", label: "Autre" }] },
      { variants: catalogOfferFixture().variants }, { variantAxes: ["Couleur"] },
      { actions: { contact: true, quote: false, purchase: false } }, { actions: { contact: false, quote: true, purchase: false } },
      ...["/demo-media/animation-20261020/panier-raphia.png", "/demo-media/animation-20261020/association-lecture.png", "/demo-media/autre.png", "//evil.test/image.png", "https://assets.example.test/image.png", null].map((url) => ({ media: [{ ...offer.media[0]!, url }] })),
    ]
    for (const mismatch of mismatches) expect(catalogOfferSchema.safeParse({ ...offer, ...mismatch }).success).toBe(false)
    expect(catalogPageSchema.safeParse(catalogPageFixture({ page: [offer] })).success).toBe(false)
    expect(catalogOfferSchema.safeParse({ ...catalogOfferFixture(), media: offer.media }).success).toBe(false)
  })
  it("fait traverser la porte SSR anonyme au catalogue, à la fiche et à la carte du fil", async () => {
    const offer = demoOfferFixture(), page = catalogPageFixture({ page: [offer], collections: offer.collections })
    mocks.query.mockImplementation(async (reference) => {
      const name = getFunctionName(reference)
      return name.endsWith(":getBySlug") ? { _id: "root-test" } : name.endsWith(":list") ? page : offer
    })
    expect(await loadPublicCatalog(offer.shopHandle)).toEqual({ status: "ready", data: page, viewer: "anonymous" })
    expect(await loadPublicOffer(offer.shopHandle, offer.offerRef)).toEqual({ status: "ready", data: offer, viewer: "anonymous" })
    expect(await loadPublicPostOffer("demo-post")).toEqual({ status: "ready", data: offer, viewer: "anonymous" })
  })
})
