// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appResources } from "@/i18n/resources"
import { cartDraftKey, type CartDraft } from "@/lib/cart-draft"
import { routes } from "@/lib/routes"
import { checkoutAttemptFixture } from "@/components/checkout/checkout-fixtures.test-support"

const mocks = vi.hoisted(() => ({ lookup: { outcome: "absent" } as unknown, stop: vi.fn(), refetch: vi.fn(), push: vi.fn(), person: "person-a", error: false }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { checkout: { cartContext: "cartContext", findByClientRequestId: "lookup", stopClientIntent: "stop" }, checkoutActions: { options: "options", prepare: "prepare" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-a", personId: mocks.person }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (ref: string) => ({ data: ref === "lookup" ? mocks.lookup : undefined, isError: mocks.error, isPending: false, isFetching: false, refetch: mocks.refetch }) }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useAction: () => vi.fn(), useMutation: () => mocks.stop, useConvex: () => ({ query: vi.fn() }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
import { CartScreen } from "./cart-screen"

const i18n = createAppI18n({ locale: "fr", appResources, defaultNS: "cart" })
let root: Root, container: HTMLDivElement
function frozen(): CartDraft { const now = Date.now(); return { version: 1, networkId: "network-a", personId: "person-a", handle: "atelier", items: [{ offerRef: "pro.ga:offer:opaque", quantity: 1 }], updatedAt: now, submitted: { submittedAt: now, clientRequestId: "stable-request-key", digest: "a".repeat(64), expectedPolicyVersion: 1, expectedLines: [{ offerRef: "pro.ga:offer:opaque", quantity: 1, expectedCatalogRevision: 1, expectedUnitAmount: { amount: 100, currency: "XAF" } }] } } }
async function render() { await act(async () => root.render(<I18nextProvider i18n={i18n}><CartScreen /></I18nextProvider>)) }
async function stop() { await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === i18n.t("stopIntent"))!.click()) }
beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); sessionStorage.setItem(cartDraftKey("network-a", "person-a"), JSON.stringify(frozen()))
  mocks.person = "person-a"; mocks.error = false; mocks.lookup = { outcome: "absent" }; mocks.stop.mockReset(); mocks.push.mockReset(); mocks.refetch.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); sessionStorage.clear() })
describe("clôture certaine de l'intention inconnue", () => {
  it("ne défige qu'après le reçu stopped du serveur", async () => {
    mocks.stop.mockResolvedValue({ outcome: "stopped" }); await render(); await stop()
    expect(mocks.stop).toHaveBeenCalledWith({ networkId: "network-a", clientRequestId: "stable-request-key" })
    expect(JSON.parse(sessionStorage.getItem(cartDraftKey("network-a", "person-a"))!).submitted).toBeNull()
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it("une réponse perdue laisse le draft figé et une tentative déjà créée ouvre son suivi", async () => {
    mocks.stop.mockRejectedValueOnce(new Error("lost")); await render(); await stop()
    expect(JSON.parse(sessionStorage.getItem(cartDraftKey("network-a", "person-a"))!).submitted.clientRequestId).toBe("stable-request-key")
    mocks.stop.mockResolvedValue({ outcome: "attempt", attempt: checkoutAttemptFixture() }); await stop()
    expect(mocks.push).toHaveBeenCalledWith(routes.checkoutAttempt(checkoutAttemptFixture().attemptId))
    expect(JSON.parse(sessionStorage.getItem(cartDraftKey("network-a", "person-a"))!).submitted).not.toBeNull()
  })
  it("une erreur de lookup ne devient ni absence ni autorisation d'abandon", async () => {
    mocks.error = true; await render()
    expect(container.textContent).not.toContain(i18n.t("stopIntent")); expect(mocks.stop).not.toHaveBeenCalled()
  })
  it("un remplacement d'acteur ne traite pas la réponse tardive", async () => {
    let resolve!: (value: unknown) => void
    mocks.stop.mockReturnValue(new Promise((done) => { resolve = done })); await render(); await stop()
    mocks.person = "person-b"; await render(); await act(async () => resolve({ outcome: "stopped" }))
    expect(JSON.parse(sessionStorage.getItem(cartDraftKey("network-a", "person-a"))!).submitted).not.toBeNull()
    expect(container.textContent).toContain(i18n.t("empty")); expect(mocks.push).not.toHaveBeenCalled()
  })
})
