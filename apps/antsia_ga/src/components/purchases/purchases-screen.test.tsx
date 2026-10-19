// @vitest-environment jsdom
import type { Purchase } from "@convex/modules/shops/purchaseRules"
import { COMMERCE_ORDER_RECEIPT_TEXT, COMMERCE_ORDER_RECEIPT_VERSION } from "@antsia/social-domain/commerce-orders"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ purchase: null as Purchase | null, person: "person-a", error: false, action: vi.fn(), read: vi.fn(), refetch: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { purchases: { get: "get", listMy: "list" }, purchasesActions: { refresh: "refresh", actionStatus: "status", retryStored: "retryStored", cancel: "cancel", confirmReceipt: "receipt", requestReturn: "return", sendMessage: "message" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-a", personId: mocks.person }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (ref: string, args: unknown) => { mocks.read(ref, args); return { data: ref === "list" ? { page: mocks.purchase ? [mocks.purchase] : [], continueCursor: "page-two", isDone: false } : mocks.purchase, isError: mocks.error, isPending: false, refetch: mocks.refetch } } }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useAction: (ref: string) => (args: unknown) => mocks.action(ref, args) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
import { PurchaseScreen, PurchasesScreen } from "./purchases-screen"
import { orderFixture, PURCHASE_NOW, purchaseFixture, purchaseI18n } from "./purchase-fixtures.test-support"

const i18n = purchaseI18n()
let root: Root, container: HTMLDivElement, online: boolean
async function render(children: ReactNode = <PurchaseScreen purchaseId="payment-private" />) { await act(async () => root.render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)) }
async function click(node: Element) { await act(async () => (node as HTMLElement).click()) }
const button = (key: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === i18n.t(key))!
const receiptForm = () => container.querySelector('input[type="checkbox"]')!.closest("form")!
async function confirmReceipt() { await click(container.querySelector('input[type="checkbox"]')!); await act(async () => { receiptForm().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) }) }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(PURCHASE_NOW)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  online = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online)
  mocks.purchase = purchaseFixture(); mocks.person = "person-a"; mocks.error = false; mocks.action.mockReset(); mocks.read.mockClear(); mocks.refetch.mockReset()
  mocks.action.mockImplementation(async (_ref: string, args: { actionId?: string }) => ({ outcome: "purchase", purchaseId: "payment-private", action: args.actionId ? { actionId: args.actionId, state: "accepted" } : null }))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers() })

describe("réception et support privés fondés sur l'engagement", () => {
  it("sépare paiement, réception, remise et reversement et exige un accord neuf à la version de réception", async () => {
    await render()
    expect(container.textContent).toContain(i18n.t("payment:paymentStates.succeeded"))
    expect(container.textContent).toContain(i18n.t("receiptUnknown"))
    expect(container.textContent).toContain(i18n.t("fulfillmentStates.unknown"))
    expect(container.textContent).toContain(i18n.t("settlementStates.withheld"))
    expect(container.textContent).toContain(COMMERCE_ORDER_RECEIPT_TEXT.fr)
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    expect(mocks.purchase!.order!.consentTextVersion).not.toBe(COMMERCE_ORDER_RECEIPT_VERSION)
    await confirmReceipt()
    expect(mocks.action).toHaveBeenCalledWith("receipt", { networkId: "network-a", purchaseId: "payment-private", actionId: expect.any(String), expectedRevision: 8, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION })
    expect(mocks.action.mock.calls.map(([ref]) => ref)).not.toContain("payout")
  })
  it("masque les commandes sans capacités et ne fabrique pas le nom d'un ancien vendeur", async () => {
    mocks.purchase = purchaseFixture({ order: orderFixture({ sellerLabel: null, capabilities: { canCancel: false, canConfirmReceipt: false, canRequestReturn: false, canMessage: false, canRequestRefund: false } }) })
    await render(); expect(container.querySelector("form")).toBeNull()
    expect(container.textContent).toContain(i18n.t("sellerUnknown"))
  })
  it("garde le support historique après retrait de la boutique et échappe son texte", async () => {
    mocks.purchase = purchaseFixture({ order: orderFixture({ messages: [{ messageRef: "message-private", side: "seller", text: "<img src=x onerror=alert(1)>", createdAt: PURCHASE_NOW }], messagesTruncated: true, historyTruncated: true }) })
    await render()
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain(i18n.t("messagesTruncated")); expect(container.textContent).toContain(i18n.t("historyTruncated"))
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).not.toContain(routes.storefront("ancienne-boutique"))
    expect(container.querySelector('[name="text"]')).not.toBeNull()
  })
  it("sans snapshot propose une actualisation manuelle, sans commande automatique", async () => {
    mocks.purchase = purchaseFixture({ order: null, observedAt: null, stale: true })
    await render(); expect(container.textContent).toContain(i18n.t("noSnapshot")); expect(mocks.action).not.toHaveBeenCalled()
    await click(button("refresh")); expect(mocks.action).toHaveBeenCalledWith("refresh", { networkId: "network-a", purchaseId: "payment-private" })
  })
  it("une lecture refusée retire l'ancien snapshot et ses actions", async () => {
    await render(); mocks.error = true; await render()
    expect(container.textContent).not.toContain("Atelier de recette"); expect(container.querySelector("form")).toBeNull()
  })
})
describe("réponses incertaines et continuité réseau", () => {
  it("après reload reprend seulement un corps serveur encore admissible, avec le même actionId", async () => {
    mocks.purchase = purchaseFixture({ pendingActions: [{ actionId: "opaque-action", operation: "receipt_confirm", state: "not_found", reason: null, createdAt: PURCHASE_NOW, canRetry: true }] })
    await render(); expect(container.querySelector("form")).toBeNull(); await click(button("resume"))
    expect(mocks.action).toHaveBeenCalledWith("retryStored", { networkId: "network-a", purchaseId: "payment-private", actionId: "opaque-action" })
  })
  it("un corps purgé ne propose que la recherche, sans reconstruire la décision", async () => {
    mocks.purchase = purchaseFixture({ pendingActions: [{ actionId: "purged-action", operation: "support_message", state: "unknown", reason: null, createdAt: PURCHASE_NOW, canRetry: false }] })
    await render(); expect(button("resume")).toBeUndefined(); expect(container.querySelector("form")).toBeNull()
    await click(button("actionStatus")); expect(mocks.action).toHaveBeenCalledWith("status", { networkId: "network-a", purchaseId: "payment-private", actionId: "purged-action" })
  })
  it("suspend toute action hors ligne et exige actualisation plus nouvel accord après retour", async () => {
    await render(); await click(container.querySelector('input[type="checkbox"]')!)
    await act(async () => { online = false; window.dispatchEvent(new Event("offline")) })
    expect(button("refresh").disabled).toBe(true)
    await act(async () => { receiptForm().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(mocks.action).not.toHaveBeenCalled()
    await act(async () => { online = true; window.dispatchEvent(new Event("online")) })
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    // L'accord est suspendu par son `<fieldset disabled>` : état EFFECTIF (`:disabled`), la
    // propriété `disabled` de la case ne reflétant que son propre attribut.
    expect(container.querySelector('input[type="checkbox"]')!.matches(":disabled")).toBe(true)
    await click(button("refresh")); expect(container.querySelector('input[type="checkbox"]')!.matches(":disabled")).toBe(false)
  })
  it("ne réadopte pas une réponse d'action après remplacement d'acteur", async () => {
    let resolve!: (value: unknown) => void; mocks.action.mockReturnValue(new Promise((done) => { resolve = done }))
    await render(); await confirmReceipt(); mocks.person = "person-b"; mocks.purchase = null; await render()
    await act(async () => resolve({ outcome: "purchase", purchaseId: "payment-private", action: { actionId: "late", state: "accepted" } }))
    expect(mocks.refetch).not.toHaveBeenCalled(); expect(container.textContent).not.toContain("Atelier de recette")
  })
  it("la liste est paginée par dix et rejoint uniquement des suivis privés", async () => {
    await render(<PurchasesScreen />)
    expect(mocks.read).toHaveBeenCalledWith("list", { networkId: "network-a", paginationOpts: { cursor: null, numItems: 10 } })
    expect(container.querySelector(`a[href="${routes.purchase("payment-private")}"]`)).not.toBeNull()
    await click(button("next")); expect(mocks.read).toHaveBeenLastCalledWith("list", { networkId: "network-a", paginationOpts: { cursor: "page-two", numItems: 10 } })
  })
})
/** P14B (écrit, non exécuté) : les prestations sans paiement renvoient à Mes demandes, sans se mêler aux achats. */
describe("renvoi Mes achats → Mes demandes", () => {
  it("une section distincte mène à Mes demandes, sans état de paiement ni lecture de demandes", async () => {
    mocks.purchase = null
    await render(<PurchasesScreen />)
    const section = container.querySelector('section[aria-labelledby="purchases-service-requests-title"]')
    expect(section).not.toBeNull()
    expect(section?.querySelector("h2")?.textContent).toBe(i18n.t("serviceRequests.title"))
    expect(section?.querySelector(`a[href="${routes.serviceRequests()}"]`)?.textContent).toBe(i18n.t("serviceRequests.open"))
    // Aucun état de paiement, de remise ou de reversement simulé pour ces prestations.
    for (const key of ["payment:paymentStates.succeeded", "settlementStates.withheld", "fulfillmentStates.unknown", "receiptUnknown"]) expect(section?.textContent).not.toContain(i18n.t(key))
    // La liste des achats reste celle des seuls suivis payés : aucune requête de services.
    expect(mocks.read.mock.calls.map(([ref]) => ref)).toEqual(expect.not.arrayContaining(["myRequests"]))
    expect(container.textContent).toContain(i18n.t("empty"))
  })
})
