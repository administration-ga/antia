// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ query: vi.fn(), push: vi.fn(), params: null as URLSearchParams | null, network: { networkId: "root-a", personId: "person-a" } }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { marketplace: { search: "offers", demoSelection: "demo" }, marketplaceShops: { search: "shops" } } } } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (...args: unknown[]) => mocks.query(...args) }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => mocks.network }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main data-member-page>{children}</main> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => mocks.params }))

import { appResources } from "@/i18n/resources"
import { catalogOfferFixture } from "@/components/shops/__tests__/catalog-fixtures"
import { routes } from "@/lib/routes"
import type { MarketplaceSearch } from "@/lib/marketplace-search"
import { MarketplaceScreen } from "./marketplace-screen"

type QueryState = { data: unknown; isPending: boolean; isError: boolean; isFetching: boolean; refetch: ReturnType<typeof vi.fn> }
const state = (data: unknown, changes: Partial<QueryState> = {}): QueryState => ({ data, isPending: data === undefined, isError: false, isFetching: false, refetch: vi.fn(), ...changes })
const page = (changes: Record<string, unknown> = {}) => ({ indexStatus: "ready", page: [catalogOfferFixture()], isDone: true, continueCursor: "", filteredWindow: false, ...changes })
const storefront = { handle: "atelier", name: "Atelier partagé", logoUrl: null, model: "products", specialty: "Artisanat", serviceArea: "Libreville", badge: "community", publishedAt: 1_700_000_000_000 }
const defaultSearch: MarketplaceSearch = { view: "products", cursor: null }
let root: Root, container: HTMLDivElement, offerState: QueryState, shopState: QueryState, demoState: QueryState, width: number
const widthListeners = new Set<() => void>()
const appI18n = (locale: "fr" | "en" = "fr") => createAppI18n({ locale, appResources, defaultNS: "marketplace" })
async function render(search: MarketplaceSearch | null = defaultSearch, locale: "fr" | "en" = "fr") { await act(async () => root.render(<I18nextProvider i18n={appI18n(locale)}><MarketplaceScreen search={search} /></I18nextProvider>)) }
const link = (label: string) => [...container.querySelectorAll("a")].find(node => node.textContent === label)
const button = (label: string) => [...container.querySelectorAll("button")].find(node => node.textContent === label)
async function click(node: HTMLElement | undefined | null) { if (!node) throw new Error("Élément de recette absent"); await act(async () => node.click()) }
async function input(selector: string, value: string) {
  const node = container.querySelector<HTMLInputElement>(selector)
  if (!node) throw new Error(`Champ de recette absent : ${selector}`)
  await setInput(node, value)
}
async function setInput(node: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })) })
}
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))) }

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  width = 390; mocks.params = null; widthListeners.clear(); mocks.query.mockReset(); mocks.push.mockReset(); mocks.network = { networkId: "root-a", personId: "person-a" }
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ media: query, get matches() { return width >= 1024 }, addEventListener: (_name: string, listener: () => void) => widthListeners.add(listener), removeEventListener: (_name: string, listener: () => void) => widthListeners.delete(listener) })))
  offerState = state(page()); shopState = state({ page: [storefront], isDone: true, continueCursor: "", filteredWindow: false }); demoState = state([])
  mocks.query.mockImplementation((reference: unknown) => reference === "demo" ? demoState : reference === "shops" ? shopState : offerState)
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

describe("MP04 — marketplace membre et fenêtres autorisées", () => {
  it("interroge les produits bornés et réutilise les vraies cartes sans action financière", async () => {
    await render()
    expect(mocks.query).toHaveBeenCalledWith("offers", { networkId: "root-a", kind: "product", paginationOpts: { cursor: null, numItems: 12 } })
    expect(mocks.query).toHaveBeenCalledWith("demo", { networkId: "root-a", kind: "product" })
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(container.textContent).toContain("Sac artisanal")
    expect(container.querySelector("[data-offer-card] a")?.getAttribute("href")).toBe(routes.shopOffer("atelier", catalogOfferFixture().offerRef))
    expect(container.querySelector("[data-offer-card] button, [data-offer-card] form, [data-checkout]")).toBeNull()
    expect(link("Créer ou gérer mon activité")?.getAttribute("href")).toBe(routes.myShops())
    expect(link("Mes paniers")?.getAttribute("href")).toBe(routes.cart())
  })

  it("les trois vues conservent la recherche et retirent les facettes lors d'un changement de vue", async () => {
    const search: MarketplaceSearch = { view: "products", query: "atelier", category: ["fashion"], brand: ["Atelier"], sort: "relevance", cursor: "page-2" }
    await render(search)
    expect(link("Services")?.getAttribute("href")).toBe(routes.marketplace({ view: "services", query: "atelier", cursor: null }))
    expect(link("Boutiques")?.getAttribute("href")).toBe(routes.marketplace({ view: "shops", query: "atelier", cursor: null }))
    await render({ view: "shops", query: "atelier", cursor: null })
    expect(mocks.query).toHaveBeenCalledWith("shops", { networkId: "root-a", query: "atelier", paginationOpts: { cursor: null, numItems: 12 } })
    expect(container.textContent).toContain("Atelier partagé")
    expect(container.querySelector('input[name="category"]')).toBeNull()
    expect(container.querySelector("[data-marketplace-demo]")).toBeNull()
    await render({ view: "services", serviceMode: ["remote", "hybrid"], cursor: null })
    expect(mocks.query).toHaveBeenCalledWith("offers", { networkId: "root-a", kind: "service", serviceMode: ["remote", "hybrid"], paginationOpts: { cursor: null, numItems: 12 } })
    expect(container.querySelector('input[name="serviceMode"][value="remote"]')).not.toBeNull()
  })

  it("une fenêtre vide non terminale continue avec tous les filtres et le curseur dans l'URL", async () => {
    offerState = state(page({ page: [], isDone: false, continueCursor: "signed-next", filteredWindow: true }))
    const search: MarketplaceSearch = { view: "products", category: ["fashion", "fashion.women.clothing"], brand: ["Atelier", "Maison"], audience: ["women", "unisex"], minPrice: 0, maxPrice: 25000, sort: "price_asc", cursor: null }
    await render(search)
    expect(container.textContent).toContain("La suivante peut en contenir")
    expect(link("Page suivante")?.getAttribute("href")).toBe(routes.marketplace({ ...search, cursor: "signed-next" }))
    await render({ ...search, cursor: "signed-next" })
    expect(mocks.query).toHaveBeenCalledWith("offers", { networkId: "root-a", kind: "product", category: search.category, brand: search.brand, audience: search.audience, minPrice: 0, maxPrice: 25000, sort: "price_asc", paginationOpts: { cursor: "signed-next", numItems: 12 } })
    expect(link("Première page")?.getAttribute("href")).toBe(routes.marketplace(search))
    expect(container.textContent).not.toMatch(/résultats au total|sur \d+ résultats/u)
  })

  it("distingue chargement, index en préparation et absence terminale sans recycler d'offre", async () => {
    offerState = state(undefined)
    await render()
    expect(container.textContent).toContain("Recherche en cours")
    offerState = state(page({ indexStatus: "building" }))
    await render()
    expect(container.textContent).toContain("Le catalogue se prépare")
    expect(container.textContent).not.toContain("Sac artisanal")
    const retry = offerState.refetch
    await click(button("Réessayer")); expect(retry).toHaveBeenCalledOnce()
    offerState = state(page({ page: [] }))
    await render()
    expect(container.textContent).toContain("Aucun résultat pour ces filtres")
    expect(link("Page suivante")).toBeUndefined()
  })

  it("masque les anciennes cartes lors d'une panne et permet une nouvelle lecture", async () => {
    offerState = state(page(), { isError: true })
    await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("La marketplace ne peut pas être chargée")
    expect(container.textContent).not.toContain("Sac artisanal")
    await click(button("Réessayer"))
    expect(offerState.refetch).toHaveBeenCalledOnce()
    offerState = state(page(), { isFetching: true })
    await render()
    expect(container.textContent).toContain("Actualisation des résultats")
  })

  it("présente la démo séparément et ne la transforme pas en catalogue ou bouton d'achat", async () => {
    offerState = state(page({ page: [] }))
    demoState = state([catalogOfferFixture({ offerRef: "demo:offer:epicerie-produits", title: "Panier fictif", shopHandle: "epicerie-moussavou-demo", variants: [], variantAxes: [], media: [] })])
    await render()
    const selection = container.querySelector("[data-marketplace-demo]")!
    expect(selection.textContent).toContain("Sélection de démonstration")
    expect(selection.textContent).toContain("Offres fictives")
    expect(selection.textContent).toContain("n’est pas le catalogue général")
    expect(selection.textContent).toContain("Panier fictif")
    expect(selection.querySelector("button, form, [data-checkout]")).toBeNull()
    expect(container.textContent).toContain("Aucun résultat pour ces filtres")
    demoState = state([catalogOfferFixture()], { isError: true })
    await render()
    expect(container.querySelector("[data-marketplace-demo]")?.textContent).not.toContain("Sac artisanal")
  })

  it("garde catalogue et démo distincts sans erreur React après changement de filtres et pagination", async () => {
    const errors = vi.spyOn(console, "error")
    try {
      demoState = state([catalogOfferFixture({ offerRef: "demo:offer:epicerie-produits", title: "Offre fictive", shopHandle: "epicerie-moussavou-demo", variants: [], variantAxes: [], media: [] })])
      await render()
      const filtered: MarketplaceSearch = { view: "products", brand: ["Atelier"], cursor: null }
      await render(filtered)
      await render({ ...filtered, cursor: "next-window" })
      await render(filtered)
      expect(Array.from(container.querySelectorAll("[data-offer-card] h3")).map(node => node.textContent)).toEqual(["Sac artisanal", "Offre fictive"])
      expect(container.querySelectorAll("[data-marketplace-demo]")).toHaveLength(1)
      expect(errors).not.toHaveBeenCalled()
    } finally { errors.mockRestore() }
  })

  it("une URL invalide n'émet aucune recherche, et les clés de réseau changent avec la personne", async () => {
    await render(null)
    expect(mocks.query).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Ce lien de recherche n’est pas valide")
    await render({ view: "products", cursor: "other-window" })
    mocks.query.mockClear(); mocks.network = { networkId: "root-b", personId: "person-b" }; offerState = state(undefined)
    await render({ view: "products", cursor: null })
    expect(mocks.query).toHaveBeenCalledWith("offers", { networkId: "root-b", kind: "product", paginationOpts: { cursor: null, numItems: 12 } })
    expect(container.textContent).not.toContain("Sac artisanal")
  })

  it("retire une facette appliquée par une nouvelle URL sans reprendre le curseur", async () => {
    await render({ view: "products", brand: ["Atelier", "Maison"], cursor: "signed-next" })
    const active = container.querySelector('ul[aria-label="Filtres actifs"]')!
    await click(active.querySelector<HTMLButtonElement>('button[aria-label="Retirer Atelier"]'))
    expect(mocks.push).toHaveBeenCalledWith(routes.marketplace({ view: "products", brand: ["Maison"], cursor: null }), { scroll: false })
    expect(document.activeElement).toBe(container.querySelector("h1"))
  })

  it.each([320, 390, 834, 1440])("garde un seul formulaire et la bonne branche de filtres à %i px", async (nextWidth) => {
    width = nextWidth
    await render()
    expect(container.querySelectorAll("[data-member-page]")).toHaveLength(1)
    expect(container.querySelectorAll("aside")).toHaveLength(1)
    expect(container.querySelectorAll("form")).toHaveLength(1)
    expect(container.querySelector<HTMLDetailsElement>("[data-marketplace-filter-panel]")?.open).toBe(nextWidth >= 1024)
    expect(container.querySelector("[data-offer-card]")).not.toBeNull()
  })

  it("le même panneau s'adapte lors d'un changement de format sans doubler le formulaire", async () => {
    await render()
    await act(async () => { width = 1440; widthListeners.forEach(listener => listener()) })
    expect(container.querySelector<HTMLDetailsElement>("[data-marketplace-filter-panel]")?.open).toBe(true)
    expect(container.querySelectorAll("form")).toHaveLength(1)
  })

  it("applique les choix hiérarchiques, plusieurs marques et les prix puis place le focus sur le titre", async () => {
    width = 1440
    await render({ view: "products", cursor: "old-window" })
    const categories = container.querySelector<HTMLDetailsElement>("[data-marketplace-categories]")!
    expect(categories.open).toBe(false)
    await click(categories.querySelector("summary"))
    expect(categories.open).toBe(true)
    await click(container.querySelector<HTMLInputElement>('input[name="category"][value="fashion.women.clothing"]'))
    const brandField = () => [...container.querySelectorAll("fieldset")].find(field => field.querySelector("legend")?.textContent === "Marques")!
    const brandInput = brandField().querySelector<HTMLInputElement>("input")!
    await setInput(brandInput, "Atelier")
    await click(brandField().querySelector("button"))
    await setInput(brandInput, "Maison")
    await click(brandField().querySelector("button"))
    await input('input[name="minPrice"]', "1000")
    await input('input[name="maxPrice"]', "20000")
    await submit()
    expect(mocks.push).toHaveBeenCalledWith(routes.marketplace({ view: "products", category: ["fashion.women.clothing"], brand: ["Atelier", "Maison"], minPrice: 1000, maxPrice: 20000, sort: "newest", cursor: null }), { scroll: false })
    expect(document.activeElement).toBe(container.querySelector("h1"))
  })

  it("refuse un intervalle inversé, puis garde pertinence pour une vraie recherche", async () => {
    width = 1440
    await render()
    await input('input[name="minPrice"]', "20000"); await input('input[name="maxPrice"]', "1000")
    await submit()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Vérifiez les filtres")
    await input('input[name="minPrice"]', ""); await input('input[name="maxPrice"]', ""); await input('input[name="query"]', "robe en lin")
    await submit()
    expect(mocks.push).toHaveBeenCalledWith(routes.marketplace({ view: "products", query: "robe en lin", sort: "relevance", cursor: null }), { scroll: false })
    expect([...container.querySelectorAll('select[name="sort"] option')].map(option => option.textContent)).toEqual(["Pertinence"])
  })

  it("une marque répétée reste refusée et un choix peut être retiré avant validation", async () => {
    width = 1440
    await render({ view: "products", brand: ["Atelier"], cursor: null })
    const field = [...container.querySelectorAll("fieldset")].find(node => node.querySelector("legend")?.textContent === "Marques")!
    await setInput(field.querySelector("input")!, "atelier")
    await click(field.querySelector("button"))
    expect(field.querySelector('[role="alert"]')?.textContent).toContain("6 valeurs distinctes")
    expect(field.querySelectorAll("li")).toHaveLength(1)
    await click(field.querySelector<HTMLButtonElement>('button[aria-label="Retirer Atelier"]'))
    expect(field.querySelector("li")).toBeNull()
    await submit()
    expect(mocks.push).toHaveBeenCalledWith(routes.marketplace({ view: "products", sort: "newest", cursor: null }), { scroll: false })
  })

  it("borne les catégories à six sans verrouiller les choix déjà cochés", async () => {
    width = 1440
    await render()
    await click(container.querySelector<HTMLElement>("[data-marketplace-categories] summary"))
    for (const value of ["fashion", "food", "craft", "electronics", "beauty", "home"]) await click(container.querySelector<HTMLInputElement>(`input[name="category"][value="${value}"]`))
    expect(container.querySelector<HTMLInputElement>('input[name="category"][value="fashion.women"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLInputElement>('input[name="category"][value="fashion"]')?.disabled).toBe(false)
    await click(container.querySelector<HTMLInputElement>('input[name="category"][value="fashion"]'))
    expect(container.querySelector<HTMLInputElement>('input[name="category"][value="fashion.women"]')?.disabled).toBe(false)
  })

  it("refuse aussi dix-sept mots séparés par tirets dans le formulaire", async () => {
    width = 1440
    await render()
    await input('input[name="query"]', Array.from({ length: 17 }, () => "a").join("-"))
    await submit()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("16 mots au maximum")
  })

  it("rend les libellés anglais réels et remet les filtres à zéro dans la même vue", async () => {
    await render({ view: "services", query: "design", cursor: "window" }, "en")
    expect(container.textContent).toContain("Products")
    expect(container.textContent).toContain("Service delivery")
    expect(container.textContent).not.toContain("filters.serviceMode")
    await click(button("Reset all"))
    expect(mocks.push).toHaveBeenCalledWith(routes.marketplace({ view: "services", cursor: null }), { scroll: false })
  })
})


it("MP06 — l'URL vivante remplace le snapshot initial sans rechargement", async () => {
  mocks.params = new URLSearchParams("vue=services&modeCommercial=quote&langue=fr-GA&zone=Libreville&dureeMin=30")
  await render(defaultSearch)
  expect(mocks.query).toHaveBeenCalledWith("offers", { networkId: "root-a", kind: "service", commercialMode: ["quote"], languageCode: ["fr-GA"], serviceZone: ["libreville"], minDurationMinutes: 30, paginationOpts: { cursor: null, numItems: 12 } })
  expect(container.querySelector('input[name="commercialMode"][value="quote"]:checked')).not.toBeNull()
  mocks.params = new URLSearchParams("vue=services&langue=fr&langue=FR")
  await render(defaultSearch)
  expect(container.textContent).toContain("Ce lien de recherche n’est pas valide")
  expect(container.querySelector("[data-offer-card]")).toBeNull()
})

it("MP06 — sélectionne une langue par son nom dans la recherche de prestations", async () => {
  await render({ view: "services", cursor: null })
  const field = container.querySelector<HTMLSelectElement>('select[id$="-language"]')!
  expect([...field.options].map(option => option.textContent)).toContain("Anglais")
  await act(async () => { field.value = "en"; field.dispatchEvent(new Event("change", { bubbles: true })) })
  await submit()
  expect(mocks.push).toHaveBeenLastCalledWith(routes.marketplace({ view: "services", languageCode: ["en"], sort: "newest", cursor: null }), { scroll: false })
})
