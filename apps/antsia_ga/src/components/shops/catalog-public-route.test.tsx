import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ shop: vi.fn(), catalog: vi.fn(), offer: vi.fn(), slot: vi.fn() }))
vi.mock("@/lib/public-shops-data", () => ({ loadPublicStorefront: mocks.shop }))
vi.mock("@/lib/public-catalog-data", () => ({ loadPublicCatalog: mocks.catalog, loadPublicOffer: mocks.offer, loadPublicPostOffer: mocks.slot }))
vi.mock("@/lib/server-session", () => ({ getPublicLocale: async () => "fr", configuredMetadataOrigin: () => "https://antsia.ga", getServerViewer: vi.fn(), withinBridgeDeadline: (work: () => Promise<unknown>) => work() }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("TEST_NOT_FOUND") } }))
vi.mock("@/components/public/public-shell", () => ({ PUBLIC_LINK: "public-link", PublicShell: ({ viewer, children }: { viewer: string; children: ReactNode }) => <main data-viewer={viewer}>{children}</main> }))
vi.mock("@/components/public/public-status", () => ({ PublicStatus: ({ status }: { status: string }) => <p data-status={status}>{status}</p> }))
vi.mock("./catalog-filters", () => ({ CatalogFiltersForm: () => <form data-testid="catalog-filters" /> }))

import { routes } from "@/lib/routes"
import { PublicCatalogMetadata, PublicCatalogScreen, PublicOfferMetadata, PublicOfferScreen } from "./catalog-public-route"
import { PublicOfferPostSlot } from "./public-offer-post-slot"
import { catalogOfferFixture, catalogPageFixture, OFFER_REF } from "./__tests__/catalog-fixtures"

const input = () => ({ params: Promise.resolve({ handle: "atelier", offerRef: OFFER_REF }), searchParams: Promise.resolve({}) })
beforeEach(() => {
  mocks.shop.mockReset(); mocks.catalog.mockReset(); mocks.offer.mockReset(); mocks.slot.mockReset()
  mocks.shop.mockResolvedValue({ status: "ready", viewer: "anonymous", data: { name: "Atelier", handle: "atelier" } })
  mocks.catalog.mockResolvedValue({ status: "ready", viewer: "anonymous", data: catalogPageFixture() })
  mocks.offer.mockResolvedValue({ status: "ready", viewer: "anonymous", data: catalogOfferFixture() })
})

describe("catalogue et fiche en SSR public réel", () => {
  it("rend les vraies offres, les liens publics et leurs métadonnées", async () => {
    const html = renderToStaticMarkup(await PublicCatalogScreen(input()))
    expect(html).toContain("Sac artisanal")
    expect(html).toContain(routes.publicShopOffer("atelier", OFFER_REF))
    expect(html).not.toContain("linkRef")
    const metadata = await PublicOfferMetadata(input())
    expect(metadata.title).toBe("Sac artisanal")
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.alternates?.canonical).toBe(`https://antsia.ga${routes.publicShopOffer("atelier", OFFER_REF)}`)
    const detail = renderToStaticMarkup(await PublicOfferScreen(input()))
    expect(detail).toContain("Description complète de l’offre.")
    expect(detail).toContain("Rouge")
    expect(detail).not.toContain("data-checkout")
  })
  it("une offre retirée garde une réponse indistincte sans ancien titre ni canonique", async () => {
    mocks.offer.mockResolvedValue({ status: "ready", viewer: "anonymous", data: null })
    const metadata = await PublicOfferMetadata(input())
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toBeUndefined()
    expect(JSON.stringify(metadata)).not.toContain("Sac artisanal")
    await expect(PublicOfferScreen(input())).rejects.toThrow("TEST_NOT_FOUND")
  })
  it("un catalogue indisponible ne conserve pas de métadonnées indexables de la boutique", async () => {
    mocks.catalog.mockResolvedValue({ status: "unavailable" })
    const metadata = await PublicCatalogMetadata(input())
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toBeUndefined()
    expect(JSON.stringify(metadata)).not.toContain("Atelier")
    const html = renderToStaticMarkup(await PublicCatalogScreen(input()))
    expect(html).toContain('data-status="unavailable"')
    expect(html).not.toContain("Sac artisanal")
  })
  it.each(["refused", "unavailable", "handoff"])("une lecture %s ne retombe pas sur le contenu anonyme", async (status) => {
    mocks.offer.mockResolvedValue({ status })
    const metadata = await PublicOfferMetadata(input())
    expect(metadata.robots).toEqual({ index: false, follow: false })
    const html = renderToStaticMarkup(await PublicOfferScreen(input()))
    expect(html).toContain(`data-status="${status}"`)
    expect(html).not.toContain("Sac artisanal")
  })
  it("conserve filtres et curseur sur une fenêtre vide, sans promettre un total", async () => {
    mocks.catalog.mockResolvedValue({ status: "ready", viewer: "anonymous", data: catalogPageFixture({ page: [], isDone: false, continueCursor: "next-window", filteredWindow: true }) })
    const props = { params: Promise.resolve({ handle: "atelier" }), searchParams: Promise.resolve({ type: "service", recherche: "couture", curseur: "old-window" }) }
    const html = renderToStaticMarkup(await PublicCatalogScreen(props))
    expect(mocks.catalog).toHaveBeenCalledWith("atelier", { kind: "service", query: "couture" }, "old-window", false)
    expect(html).toContain("La suivante peut en contenir")
    expect(html).toContain("type=service&amp;recherche=couture&amp;curseur=next-window")
    expect(html).toContain("l’accord de diffusion publique")
    expect((await PublicCatalogMetadata(props)).robots).toEqual({ index: false, follow: false })
  })
  it("ne consulte rien pour un handle mal encodé ou des filtres répétés", async () => {
    await expect(PublicCatalogScreen({ params: Promise.resolve({ handle: "%E0" }) })).rejects.toThrow("TEST_NOT_FOUND")
    await expect(PublicCatalogScreen({ params: Promise.resolve({ handle: "atelier" }), searchParams: Promise.resolve({ type: ["product", "service"] }) })).rejects.toThrow("TEST_NOT_FOUND")
    expect(mocks.catalog).not.toHaveBeenCalled()
  })
  it("le slot SSR ne rend que l'offre encore admissible et n'utilise aucun fournisseur membre", async () => {
    mocks.slot.mockResolvedValue({ status: "ready", viewer: "anonymous", data: catalogOfferFixture() })
    const html = renderToStaticMarkup(await PublicOfferPostSlot({ postId: "post-test", locale: "fr" }))
    expect(mocks.slot).toHaveBeenCalledWith("post-test")
    expect(html).toContain("Sac artisanal")
    for (const result of [{ status: "refused" }, { status: "unavailable" }, { status: "ready", viewer: "anonymous", data: null }]) {
      mocks.slot.mockResolvedValue(result)
      expect(await PublicOfferPostSlot({ postId: "post-test", locale: "fr" })).toBeNull()
    }
  })
})
