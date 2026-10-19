import { getFunctionName } from "convex/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { catalogOfferFixture, catalogPageFixture, OFFER_REF } from "@/components/shops/__tests__/catalog-fixtures"

const mocks = vi.hoisted(() => ({ query: vi.fn(), viewer: vi.fn() }))
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.query }))
vi.mock("./server-session", () => ({ getServerViewer: mocks.viewer, withinBridgeDeadline: (work: () => Promise<unknown>) => work(), configuredMetadataOrigin: () => "https://antsia.ga" }))

import { catalogOfferSchema, catalogPageSchema, loadPublicCatalog, loadPublicOffer, loadPublicPostOffer } from "./public-catalog-data"

beforeEach(() => {
  mocks.query.mockReset(); mocks.viewer.mockReset()
  mocks.viewer.mockResolvedValue({ status: "anonymous" })
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://localhost:3210")
})

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
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "refused" })
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("une panne de session ne se transforme pas en lecture publique", async () => {
    mocks.viewer.mockResolvedValue({ status: "unavailable" })
    expect(await loadPublicPostOffer("post-test")).toEqual({ status: "unavailable" })
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("transmet le réseau, la fenêtre, les filtres et le bearer uniquement à la projection serveur", async () => {
    mocks.viewer.mockResolvedValue({ status: "authenticated", token: "TEST-JWT" })
    mocks.query.mockImplementation(async (reference, args, options) => {
      if (getFunctionName(reference).endsWith(":getBySlug")) return { _id: "root-test" }
      expect(getFunctionName(reference)).toBe("modules/public/catalog:list")
      expect(args).toEqual({ networkId: "root-test", handle: "atelier", kind: "service", query: "couture", paginationOpts: { cursor: "page-2", numItems: 12 } })
      expect(options.token).toBe("TEST-JWT")
      return catalogPageFixture()
    })
    expect(await loadPublicCatalog("atelier", { kind: "service", query: "couture" }, "page-2")).toEqual({ status: "ready", data: catalogPageFixture(), viewer: "authenticated" })
  })
  it("conserve un retrait sous null et refuse un DTO élargi", async () => {
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : null)
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "ready", data: null, viewer: "anonymous" })
    mocks.query.mockImplementation(async (reference) => getFunctionName(reference).endsWith(":getBySlug") ? { _id: "root-test" } : { ...catalogOfferFixture(), source: "private" })
    expect(await loadPublicOffer("atelier", OFFER_REF)).toEqual({ status: "unavailable" })
  })
})
