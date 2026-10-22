// @vitest-environment jsdom
/** Navigation SPA : l'URL et la requête changent même si la prop RSC initiale reste identique. */
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appResources } from "@/i18n/resources"
import { catalogOfferFixture } from "./__tests__/catalog-fixtures"
import type { CatalogOffer } from "./catalog-model"

const mocks = vi.hoisted(() => ({ query: vi.fn(), push: vi.fn(), search: "", listeners: new Set<() => void>() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { catalog: { list: "list" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root", personId: "reader" }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (...args: unknown[]) => mocks.query(...args) }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  return { useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams(useSyncExternalStore(callback => { mocks.listeners.add(callback); return () => { mocks.listeners.delete(callback) } }, () => mocks.search, () => "")) }
})
import { MemberCatalogScreen } from "./catalog-member-screen"

const handle = "epicerie-moussavou-demo"
const collectionRef = `demo:collection:${handle}`
const offers: CatalogOffer[] = [["epicerie-produits", "Panier du marché", 1500], ["panier-raphia", "Panier en raphia", 8500], ["savon-artisanal", "Savon artisanal", 2500], ["sac-wax", "Sac en wax", 12000]].map(([ref, title, amount]) => catalogOfferFixture({ offerRef: `demo:offer:${ref}`, shopHandle: handle, title: String(title), price: { mode: "fixed", currency: "XAF", amount: Number(amount) }, collections: [{ collectionRef, label: "Produits démo" }], variants: [], variantAxes: [], actions: { contact: false, quote: false, purchase: false } }))
let root: Root, container: HTMLDivElement
async function navigate(search: string) { await act(async () => { mocks.search = search; window.history.pushState(window.history.state, "", `/boutique/${handle}/catalogue${search}`); for (const listener of mocks.listeners) listener() }) }
/** Les filtres vivent dans la feuille « Filtrer », portée hors de l'écran : on les cherche dans le document. */
async function input(name: string, value: string) { const field = document.querySelector<HTMLInputElement>(`[role="dialog"] input[name="${name}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })) }) }
const titles = () => [...container.querySelectorAll("[data-offer-card]")].map(card => card.querySelector("h3")?.textContent)
beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.search = ""; mocks.listeners.clear(); mocks.push.mockReset(); mocks.query.mockReset()
  window.history.replaceState({}, "", `/boutique/${handle}/catalogue`)
  mocks.push.mockImplementation((href: string) => { mocks.search = new URL(href, window.location.origin).search; window.history.pushState(window.history.state, "", href); for (const listener of mocks.listeners) listener() })
  mocks.query.mockImplementation((_reference, args) => ({ isPending: false, isError: false, isFetching: false, data: { page: args.minPrice === 2500 && args.sort === "price_desc" ? [offers[3], offers[1], offers[2]] : offers, collections: [{ collectionRef, label: "Produits démo" }], isDone: true, continueCursor: "", filteredWindow: false } }))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); window.history.replaceState({}, "", "/") })

describe("MP05d — navigation catalogue vivante", () => {
  it("un seul geste applique prix et tri, interroge Convex et remplace les résultats sans changer la prop initiale", async () => {
    const initialSearch = { cursor: null }
    await act(async () => root.render(<I18nextProvider i18n={createAppI18n({ locale: "fr", appResources, defaultNS: "shops" })}><MemberCatalogScreen handle={handle} search={initialSearch} /></I18nextProvider>))
    expect(container.querySelectorAll("[data-offer-card]")).toHaveLength(4)
    await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Filtrer")!.click())
    await input("minPrice", "2500")
    const sort = document.querySelector<HTMLSelectElement>('[role="dialog"] select[name="sort"]')!
    await act(async () => { sort.value = "price_desc"; sort.dispatchEvent(new Event("change", { bubbles: true })) })
    await act(async () => document.querySelector('[role="dialog"] form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    expect(window.location.search).toBe("?prixMin=2500&tri=price_desc")
    expect(mocks.query).toHaveBeenLastCalledWith("list", { networkId: "root", handle, minPrice: 2500, sort: "price_desc", paginationOpts: { cursor: null, numItems: 12 } })
    expect(container.querySelectorAll("[data-offer-card]")).toHaveLength(3)
    expect(titles()).toEqual(["Sac en wax", "Panier en raphia", "Savon artisanal"])
    // La recherche appliquée referme la feuille ; le filtre actif se lit dans la barre et s'y retire.
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[aria-label="Filtres actifs"]')?.textContent).toContain("2500")
    expect(initialSearch).toEqual({ cursor: null })
    // Le retour d'historique retrouve l'ancienne sélection sans réadopter les résultats filtrés.
    await navigate("")
    expect(container.querySelectorAll("[data-offer-card]")).toHaveLength(4)
    expect(mocks.query).toHaveBeenLastCalledWith("list", { networkId: "root", handle, paginationOpts: { cursor: null, numItems: 12 } })
  })
  it("une URL répétant un scalaire refuse la navigation sans conserver les anciennes cartes", async () => {
    await act(async () => root.render(<I18nextProvider i18n={createAppI18n({ locale: "fr", appResources, defaultNS: "shops" })}><MemberCatalogScreen handle={handle} search={{ cursor: null }} /></I18nextProvider>))
    const calls = mocks.query.mock.calls.length
    await navigate("?prixMin=2500&prixMin=0")
    expect(container.querySelectorAll("[data-offer-card]")).toHaveLength(0)
    expect(mocks.query).toHaveBeenCalledTimes(calls)
    expect(container.textContent).toContain("Boutique indisponible")
  })
})
