// @vitest-environment jsdom
import type { PaymentContext } from "@convex/modules/shops/paymentRules"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ context: null as PaymentContext | null, error: false, person: "person-a", read: vi.fn(), refetch: vi.fn(), start: vi.fn(), options: vi.fn(), push: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { payment: { context: "context" }, paymentActions: { start: "start", options: "options" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-test", personId: mocks.person }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: string, args: unknown) => { mocks.read(reference, args); return { isError: mocks.error, isPending: false, data: mocks.context, refetch: mocks.refetch } } }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useAction: (reference: string) => reference === "start" ? mocks.start : mocks.options }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

import { PaymentCheckoutPanel } from "./payment-checkout-panel"
import { paymentDate } from "./payment-model"
import { PAYMENT_TEST_NOW, TEST_CHECKOUT_ATTEMPT_ID, TEST_PAYMENT_ATTEMPT_ID, paymentAttemptFixture, paymentContextFixture, paymentTestI18n } from "./payment-fixtures.test-support"

const i18n = paymentTestI18n()
let root: Root
let container: HTMLDivElement
const button = (key: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === i18n.t(key))
async function render() { await act(async () => root.render(<I18nextProvider i18n={i18n}><PaymentCheckoutPanel checkoutAttemptId={TEST_CHECKOUT_ATTEMPT_ID} /></I18nextProvider>)) }
async function click(node: HTMLElement) { await act(async () => node.click()) }
async function accept() { await click(container.querySelector('input[type="checkbox"]') as HTMLInputElement) }
async function submit() { await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) }) }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(PAYMENT_TEST_NOW)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  mocks.context = paymentContextFixture(); mocks.error = false; mocks.person = "person-a"
  mocks.read.mockClear(); mocks.start.mockReset(); mocks.options.mockReset(); mocks.refetch.mockReset(); mocks.push.mockReset()
  mocks.start.mockResolvedValue({ outcome: "attempt", attempt: paymentAttemptFixture() })
  mocks.options.mockResolvedValue({ outcome: "ready" })
  mocks.refetch.mockImplementation(async () => ({ isError: false, data: mocks.context }))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers() })

describe("lancement privé explicitement consenti", () => {
  it("suspend start/options hors ligne, puis exige conditions relues et nouvel accord", async () => {
    let online = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online)
    await render(); await accept()
    await act(async () => { online = false; window.dispatchEvent(new Event("offline")) })
    await submit(); expect(mocks.start).not.toHaveBeenCalled(); expect(button("start")!.disabled).toBe(true)
    await act(async () => { online = true; window.dispatchEvent(new Event("online")) })
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true)
    await click(button("refreshOptions")!)
    expect(mocks.options).toHaveBeenCalledOnce(); expect(mocks.start).not.toHaveBeenCalled()
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
  })
  it.each(["closed", "null", "error"])("ne propose aucun lancement pour un contexte %s", async (mode) => {
    if (mode === "closed") mocks.context = paymentContextFixture({ available: false, reason: "provider_not_configured" })
    if (mode === "null") mocks.context = null
    if (mode === "error") mocks.error = true
    await render()
    expect(container.querySelector("form")).toBeNull()
    expect(button("start")).toBeUndefined()
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it("exige un accord décoché et utilise le montant, la version et la readiness réellement affichés", async () => {
    await render()
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    expect(button("start")!.disabled).toBe(true)
    await submit()
    expect(mocks.start).not.toHaveBeenCalled()
    await accept(); await submit()
    expect(mocks.start).toHaveBeenCalledWith({ networkId: "network-test", checkoutAttemptId: TEST_CHECKOUT_ATTEMPT_ID, expectedTotal: { amount: 25200, currency: "XAF" }, consentTextVersion: "version-consentement-test", readinessRef: "readiness-test-private", clientRequestId: expect.any(String) })
    expect(mocks.push).toHaveBeenCalledWith(routes.paymentAttempt(TEST_PAYMENT_ATTEMPT_ID))
  })
  it("affiche les moyens par leurs libellés et ne laisse pas passer un code serveur brut", async () => {
    await render()
    expect(container.textContent).toContain(i18n.t("modeLabels.mobile_money"))
    expect(container.textContent).not.toContain("mobile_money")
  })
  it.each(["beneficiary", "readiness", "amount", "version"])("un changement %s exige un accord neuf", async (change) => {
    await render(); await accept()
    mocks.context = paymentContextFixture(change === "beneficiary" ? { beneficiaryLabel: "Autre structure de recette" } : change === "readiness" ? { readinessRef: "new-readiness" } : change === "amount" ? { amount: { amount: 27000, currency: "XAF" } } : { consentTextVersion: "new-consent-version" })
    await render()
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    expect(button("start")!.disabled).toBe(true)
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it.each(["readiness", "checkout"])("ferme le lancement à l'échéance %s et demande de recharger les conditions", async (deadline) => {
    mocks.context = paymentContextFixture(deadline === "readiness" ? { readinessExpiresAt: PAYMENT_TEST_NOW + 1000 } : { expiresAt: PAYMENT_TEST_NOW + 1000 })
    await render(); await accept()
    await act(async () => { vi.advanceTimersByTime(1020) })
    expect(button("start")!.disabled).toBe(true)
    expect(container.textContent).toContain(i18n.t("readyExpired"))
    await submit()
    expect(mocks.start).not.toHaveBeenCalled()
    await click(button("refreshOptions")!)
    expect(mocks.options).toHaveBeenCalledWith({ networkId: "network-test", checkoutAttemptId: TEST_CHECKOUT_ATTEMPT_ID })
  })
  it("un double submit conserve une seule intention avant le prochain rendu", async () => {
    mocks.start.mockReturnValue(new Promise(() => {}))
    await render(); await accept()
    await act(async () => { const form = container.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(mocks.start).toHaveBeenCalledOnce()
  })
  it("recherche d'abord après réponse perdue puis reprend strictement la même clé et readiness", async () => {
    const order: string[] = []
    mocks.start.mockImplementationOnce(async () => { order.push("start"); throw new Error("lost") }).mockImplementationOnce(async () => { order.push("same-start"); return { outcome: "attempt", attempt: paymentAttemptFixture() } })
    mocks.refetch.mockImplementation(async () => { order.push("search"); return { isError: false, data: paymentContextFixture({ readinessRef: "changed-but-not-new-intention" }) } })
    await render(); await accept(); await submit()
    const first = mocks.start.mock.calls[0]![0]
    await click(button("sameStart")!)
    expect(mocks.start.mock.calls[1]![0]).toEqual(first)
    expect(order.slice(0, 3)).toEqual(["start", "search", "same-start"])
  })
  it("ouvre le reçu retrouvé sans relancer start après une réponse perdue", async () => {
    mocks.start.mockRejectedValueOnce(new Error("lost"))
    await render(); await accept(); await submit()
    mocks.refetch.mockResolvedValue({ isError: false, data: paymentContextFixture({ existing: paymentAttemptFixture() }) })
    await click(button("sameStart")!)
    expect(mocks.start).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith(routes.paymentAttempt(TEST_PAYMENT_ATTEMPT_ID))
  })
  it("ne réémet rien si la recherche de contexte échoue", async () => {
    mocks.start.mockRejectedValueOnce(new Error("lost"))
    await render(); await accept(); await submit()
    mocks.refetch.mockResolvedValue({ isError: true, data: paymentContextFixture() })
    await click(button("sameStart")!)
    expect(mocks.start).toHaveBeenCalledOnce()
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it("un refus de lecture ou d'action retire l'ancien bénéficiaire et l'accord", async () => {
    await render(); expect(container.textContent).toContain("Structure de recette")
    mocks.error = true; await render()
    expect(container.textContent).not.toContain("Structure de recette")
    mocks.error = false; await render(); await accept()
    mocks.start.mockResolvedValue({ outcome: "refused" })
    await submit()
    expect(container.textContent).not.toContain("Structure de recette")
    expect(container.querySelector("form")).toBeNull()
  })
  it("P18b (A17) : avertit avant l'échéance de l'accord, offre le rechargement existant, sans rien lancer ni prolonger", async () => {
    // Fixture : accord de paiement à 60 s, réserve à 120 s — l'accord expire le premier.
    await render()
    const expected = i18n.t("expiringSoon", { date: paymentDate(PAYMENT_TEST_NOW + 60_000, "fr") })
    expect(container.textContent).toContain(expected)
    expect(container.querySelector('[role="status"].sr-only')?.textContent).toBe(expected)
    const refresh = [...container.querySelectorAll("button")].filter((node) => node.textContent === i18n.t("refreshOptions"))
    expect(refresh).toHaveLength(1)
    await click(refresh[0]!)
    expect(mocks.options).toHaveBeenCalledWith({ networkId: "network-test", checkoutAttemptId: TEST_CHECKOUT_ATTEMPT_ID })
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it("P18b (A17) : une réserve qui expire la première s'annonce sans aucune prolongation proposée", async () => {
    mocks.context = paymentContextFixture({ expiresAt: PAYMENT_TEST_NOW + 60_000, readinessExpiresAt: PAYMENT_TEST_NOW + 90_000 })
    await render()
    expect(container.textContent).toContain(i18n.t("expiringSoonReserve", { date: paymentDate(PAYMENT_TEST_NOW + 60_000, "fr") }))
    expect([...container.querySelectorAll("button")].some((node) => node.textContent === i18n.t("refreshOptions"))).toBe(false)
  })
  it("P18b (A17) : rien n'est annoncé tant que l'échéance est lointaine ; l'avertissement vient deux minutes avant", async () => {
    mocks.context = paymentContextFixture({ expiresAt: PAYMENT_TEST_NOW + 10 * 60_000, readinessExpiresAt: PAYMENT_TEST_NOW + 5 * 60_000 })
    await render()
    const status = container.querySelector('[role="status"].sr-only')!
    expect(status.textContent).toBe("")
    await act(async () => { vi.advanceTimersByTime(3 * 60_000 + 20) })
    expect(status.textContent).toBe(i18n.t("expiringSoon", { date: paymentDate(PAYMENT_TEST_NOW + 5 * 60_000, "fr") }))
    expect(button("start")).toBeDefined()
  })
  it("une réponse d'un autre acteur ne navigue pas et ne réadopte aucun reçu", async () => {
    let resolve!: (value: unknown) => void
    mocks.start.mockReturnValue(new Promise((done) => { resolve = done }))
    await render(); await accept(); await submit()
    mocks.person = "person-b"; mocks.context = null
    await render()
    await act(async () => resolve({ outcome: "attempt", attempt: paymentAttemptFixture() }))
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.refetch).not.toHaveBeenCalled()
  })
})
