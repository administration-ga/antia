// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { createAppI18n } from "@antsia/social-features/i18n"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appResources } from "@/i18n/resources"
import { catalogOfferFixture, OFFER_REF } from "./__tests__/catalog-fixtures"

const mocks = vi.hoisted(() => ({ reconcile: vi.fn(), attach: vi.fn(), person: "person-a", active: true }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { commerceLinks: { linkStatus: "link" }, catalogActions: { reconcile: "reconcile" }, catalog: { list: "catalog" }, catalogPosts: { eligiblePosts: "posts", setPostOffer: "attach" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "root", personId: mocks.person }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: string) => ({ isPending: false, isError: false, data: reference === "link" ? { available: true, link: { state: mocks.active ? "active" : "revoked", permissions: ["publish_catalog"] } } : reference === "catalog" ? { page: [catalogOfferFixture()], isDone: true, continueCursor: "", collections: [], filteredWindow: false } : { page: [{ postId: "post-test", body: "La publication native de ma page", publishedAt: 1, offerRef: OFFER_REF }], isDone: true, continueCursor: "" } }) }))
vi.mock("convex/react", () => ({ useAction: () => mocks.reconcile, useMutation: () => mocks.attach, useConvexAuth: () => ({ isAuthenticated: true }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

import { CatalogReconcilePanel } from "./catalog-reconcile-panel"
import { CatalogPostLinker } from "./catalog-post-linker"
import type { Id } from "@antsia/api/engine"

let root: Root
let container: HTMLDivElement
const shopId = "shop-test" as Id<"shops">
const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "shops" })
async function render(children: ReactNode) { await act(async () => root.render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)) }
const button = (label: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === label)!
async function click(node: HTMLElement) { await act(async () => { node.dispatchEvent(new MouseEvent("click", { bubbles: true })) }) }
async function choose(name: string, value: string) { await act(async () => { const select = container.querySelector(`select[name="${name}"]`) as HTMLSelectElement; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })) }) }

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  mocks.person = "person-a"; mocks.active = true; mocks.reconcile.mockReset(); mocks.attach.mockReset()
  mocks.attach.mockResolvedValue({ changed: true })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe("actions de catalogue réelles dans l’éditeur", () => {
  it("ne déclenche rien automatiquement ; un clic enfile sans promettre applied et reprend le curseur", async () => {
    mocks.reconcile.mockResolvedValueOnce({ outcome: "queued", cursor: "next-page", done: false, queued: 20 }).mockResolvedValueOnce({ outcome: "queued", cursor: null, done: true, queued: 2 })
    await render(<CatalogReconcilePanel shopId={shopId} dirty={false} />)
    expect(mocks.reconcile).not.toHaveBeenCalled()
    await click(button("Actualiser le catalogue"))
    expect(mocks.reconcile).toHaveBeenLastCalledWith({ networkId: "root", shopId, cursor: null })
    expect(container.textContent).toContain("20 mises à jour demandées, en attente")
    await click(button("Continuer la synchronisation"))
    expect(mocks.reconcile).toHaveBeenLastCalledWith({ networkId: "root", shopId, cursor: "next-page" })
    expect(container.textContent).not.toContain("synchronisation réussie")
  })
  it("les modifications non enregistrées ferment l'action", async () => {
    await render(<CatalogReconcilePanel shopId={shopId} dirty />)
    expect(button("Actualiser le catalogue").disabled).toBe(true)
    expect(mocks.reconcile).not.toHaveBeenCalled()
  })
  it("une réponse tardive d’une autre personne ne restaure pas son ancien curseur", async () => {
    let resolve!: (value: unknown) => void
    mocks.reconcile.mockReturnValue(new Promise((done) => { resolve = done }))
    await render(<CatalogReconcilePanel shopId={shopId} dirty={false} />)
    await click(button("Actualiser le catalogue"))
    mocks.person = "person-b"
    await render(<CatalogReconcilePanel shopId={shopId} dirty={false} />)
    await act(async () => resolve({ outcome: "queued", cursor: "foreign-cursor", done: false, queued: 20 }))
    expect(container.textContent).not.toContain("20 mises à jour demandées")
    expect(container.textContent).not.toContain("Continuer la synchronisation")
  })
  it("l’association demande deux choix explicites et appelle setPostOffer avec la référence réelle", async () => {
    await render(<CatalogPostLinker shopId={shopId} handle="atelier" dirty={false} />)
    expect((container.querySelector('select[name="offerRef"]') as HTMLSelectElement).value).toBe("")
    expect((container.querySelector('select[name="postId"]') as HTMLSelectElement).value).toBe("")
    await choose("postId", "post-test"); await choose("offerRef", OFFER_REF)
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(mocks.attach).toHaveBeenCalledWith({ networkId: "root", shopId, postId: "post-test", offerRef: OFFER_REF })
    expect(container.textContent).toContain("L’association de cette publication a été enregistrée")
  })
  it("retire l’association existante avec null sans imposer une autre offre", async () => {
    await render(<CatalogPostLinker shopId={shopId} handle="atelier" dirty={false} />)
    await choose("postId", "post-test")
    await click(button("Retirer l’offre associée"))
    expect(mocks.attach).toHaveBeenCalledWith({ networkId: "root", shopId, postId: "post-test", offerRef: null })
  })
})
