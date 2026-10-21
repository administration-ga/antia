import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { createAppI18n } from "@antsia/social-features/i18n"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { appResources } from "@/i18n/resources"
import { catalogOfferFixture, catalogPageFixture, OFFER_REF } from "./__tests__/catalog-fixtures"

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { catalog: { list: "list", offer: "offer", postOffer: "postOffer" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root", personId: "reader" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: mocks.query }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => null }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))

import type { Id } from "@antsia/api/engine"
import { MemberCatalogScreen, MemberOfferScreen } from "./catalog-member-screen"
import { OfferPostSlot } from "./offer-post-slot"

const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "shops" })
function html(children: ReactNode) { return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>) }
beforeEach(() => mocks.query.mockReset())

describe("catalogue membre et slot reliés aux projections réelles", () => {
  it("requête une fenêtre bornée avec filtres et propose de vraies fiches", () => {
    mocks.query.mockReturnValue({ data: catalogPageFixture(), isError: false, isPending: false, isFetching: false })
    const value = html(<MemberCatalogScreen handle="atelier" search={{ kind: "product", query: "sac", cursor: "page-2" }} />)
    expect(mocks.query).toHaveBeenCalledWith("list", { networkId: "root", handle: "atelier", kind: "product", query: "sac", paginationOpts: { cursor: "page-2", numItems: 12 } })
    expect(value).toContain("Sac artisanal")
    expect(value).toContain("name=\"query\"")
    expect(value).toContain("Première page")
  })
  it("un refus ne conserve aucune offre provenant d'un DTO précédent", () => {
    mocks.query.mockReturnValue({ data: catalogPageFixture(), isError: true, isPending: false, isFetching: false })
    const value = html(<MemberCatalogScreen handle="atelier" search={{ cursor: null }} />)
    expect(value).toContain("Le catalogue ne peut pas être chargé")
    expect(value).not.toContain("Sac artisanal")
  })
  it("annonce la portée d'une fenêtre filtrée vide et le consentement public requis", () => {
    mocks.query.mockReturnValue({ data: catalogPageFixture({ page: [], isDone: false, filteredWindow: true, continueCursor: "next" }), isError: false, isPending: false, isFetching: false })
    const value = html(<MemberCatalogScreen handle="atelier" search={{ cursor: null }} />)
    expect(value).toContain("La suivante peut en contenir")
    expect(value).toContain("l’accord de diffusion publique")
    expect(value).toContain("Page suivante")
  })
  it("une fiche retirée ne rend ni titre précédent ni prix", () => {
    mocks.query.mockReturnValue({ data: null, isError: false, isPending: false })
    const value = html(<MemberOfferScreen handle="atelier" offerRef={OFFER_REF} />)
    expect(value).toContain("Boutique indisponible")
    expect(value).not.toContain("Sac artisanal")
  })
  it("le slot lit le post autorisé et n'affiche aucune offre en son absence", () => {
    const props = { networkId: "root" as Id<"networks">, postId: "post-test" as Id<"posts"> }
    mocks.query.mockReturnValue({ data: catalogOfferFixture(), isError: false, isPending: false })
    expect(html(<OfferPostSlot {...props} />)).toContain("Sac artisanal")
    expect(mocks.query).toHaveBeenCalledWith("postOffer", props)
    mocks.query.mockReturnValue({ data: null, isError: false, isPending: false })
    expect(html(<OfferPostSlot {...props} />)).toBe("")
    mocks.query.mockReturnValue({ data: catalogOfferFixture(), isError: true, isPending: false })
    expect(html(<OfferPostSlot {...props} />)).not.toContain("Sac artisanal")
  })
})


describe("MP05d — catalogue membre filtré", () => {
  it("transmet toutes les facettes et conserve le prochain lien même si la fenêtre est vide", () => {
    mocks.query.mockReturnValue({ data: catalogPageFixture({ page: [], isDone: false, continueCursor: "next", filteredWindow: true }), isError: false, isPending: false, isFetching: false })
    const search = { kind: "product" as const, collectionRef: "pro.ga:offer_collection:01JA00000000000000000000C1", category: ["fashion.women"], material: ["Lin", "Coton"], audience: ["women"] as Array<"women">, minPrice: 0, maxPrice: 25000, sort: "price_asc" as const, cursor: null }
    const value = html(<MemberCatalogScreen handle="atelier" search={search} />)
    expect(mocks.query).toHaveBeenCalledWith("list", { networkId: "root", handle: "atelier", kind: "product", collectionRef: search.collectionRef, category: search.category, material: ["Coton", "Lin"], audience: search.audience, minPrice: 0, maxPrice: 25000, sort: "price_asc", paginationOpts: { cursor: null, numItems: 12 } })
    expect(value).toContain("categorie=fashion.women")
    expect(value).toContain("matiere=Coton&amp;matiere=Lin")
    expect(value).toContain("curseur=next")
  })
  it("annonce une indexation en cours sans présenter la fenêtre vide comme absence exhaustive", () => {
    mocks.query.mockReturnValue({ data: catalogPageFixture({ page: [], indexStatus: "building" }), isError: false, isPending: false, isFetching: false })
    const value = html(<MemberCatalogScreen handle="atelier" search={{ category: ["fashion"], cursor: null }} />)
    expect(value).toContain("en cours d’indexation")
    expect(value).not.toContain("Aucune offre disponible")
  })
})
