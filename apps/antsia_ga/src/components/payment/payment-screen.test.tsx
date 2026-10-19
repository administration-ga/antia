// @vitest-environment jsdom
import type { PaymentAttempt } from "@convex/modules/shops/paymentRules"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/lib/routes"

const mocks = vi.hoisted(() => ({ attempt: null as PaymentAttempt | null, person: "person-a", error: false, action: vi.fn(), read: vi.fn(), refetch: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { shops: { payment: { getAttempt: "attempt", listMy: "list" }, paymentActions: { status: "status", retry: "retry", requestRefund: "refund" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-test", personId: mocks.person }) }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: string, args: unknown) => { mocks.read(reference, args); return { isError: mocks.error, isPending: false, refetch: mocks.refetch, data: reference === "list" ? { page: mocks.attempt ? [mocks.attempt] : [], isDone: false, continueCursor: "next-page" } : mocks.attempt } } }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useAction: (reference: string) => (args: unknown) => mocks.action(reference, args) }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@/components/member-chrome", () => ({ MemberPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

import { PaymentAttemptScreen, PaymentListScreen } from "./payment-screen"
import { PAYMENT_TEST_NOW, TEST_PAYMENT_ATTEMPT_ID, paymentAttemptFixture, paymentTestI18n } from "./payment-fixtures.test-support"

const i18n = paymentTestI18n()
let root: Root
let container: HTMLDivElement
const button = (key: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === i18n.t(key))
async function render(children: ReactNode = <PaymentAttemptScreen paymentAttemptId={TEST_PAYMENT_ATTEMPT_ID} />) { await act(async () => root.render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>)) }
async function click(node: HTMLElement) { await act(async () => node.click()) }
async function chooseReason(reason = "other") { await act(async () => { const select = container.querySelector('select[name="reason"]') as HTMLSelectElement; select.value = reason; select.dispatchEvent(new Event("change", { bubbles: true })) }) }
async function agreeRefund() { await click(container.querySelector('input[name="accepted"]') as HTMLInputElement) }
async function submitRefund() { await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) }) }
const succeeded = (overrides: Partial<PaymentAttempt> = {}) => paymentAttemptFixture({ state: "succeeded", paymentState: "succeeded", canRequestRefund: true, ...overrides })
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(PAYMENT_TEST_NOW)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  mocks.person = "person-a"; mocks.error = false; mocks.attempt = paymentAttemptFixture()
  mocks.action.mockReset(); mocks.read.mockClear(); mocks.refetch.mockReset()
  mocks.action.mockImplementation(async () => ({ outcome: "attempt", attempt: mocks.attempt }))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); window.history.replaceState({}, "", "/"); vi.restoreAllMocks(); vi.useRealTimers() })

describe("recherche et retour navigateur sans nouveau débit", () => {
  it("hors ligne suspend statut, reprise et remboursement et réclame un statut au retour", async () => {
    let online = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online)
    mocks.attempt = succeeded(); await render(); await chooseReason(); await agreeRefund()
    await act(async () => { online = false; window.dispatchEvent(new Event("offline")) })
    expect(button("checkStatus")!.disabled).toBe(true)
    await submitRefund(); expect(mocks.action).not.toHaveBeenCalled()
    await act(async () => { online = true; window.dispatchEvent(new Event("online")) })
    expect((container.querySelector('input[name="accepted"]') as HTMLInputElement).checked).toBe(false)
    expect((container.querySelector('input[name="accepted"]') as HTMLInputElement).disabled).toBe(true)
    await click(button("checkStatus")!)
    expect(mocks.action.mock.calls.map(([ref]) => ref)).toEqual(["status"])
  })
  it("ne présente aucun lien PSP hors ligne et relie la commande réelle à Mes achats", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.attempt = paymentAttemptFixture({ state: "requires_action", paymentState: "requires_action", action: { kind: "provider_redirect", url: "https://psp.example.test/action" } })
    await render()
    expect(container.querySelector('a[href="https://psp.example.test/action"]')).toBeNull()
    expect(container.querySelector(`a[href="${routes.purchase(TEST_PAYMENT_ATTEMPT_ID)}"]`)).not.toBeNull()
    expect(mocks.action).not.toHaveBeenCalled()
  })
  it("ignore paid/success du navigateur et n'exécute aucune action à l'ouverture du retour", async () => {
    window.history.replaceState({}, "", `${routes.paymentReturn(TEST_PAYMENT_ATTEMPT_ID)}?paid=true&success=1`)
    await render(<PaymentAttemptScreen paymentAttemptId={TEST_PAYMENT_ATTEMPT_ID} returnedFromProvider />)
    expect(container.textContent).toContain(i18n.t("returnNotice"))
    expect(container.textContent).toContain(i18n.t("paymentStates.pending"))
    expect(container.textContent).not.toContain(i18n.t("paymentStates.succeeded"))
    expect(mocks.action).not.toHaveBeenCalled()
    expect(mocks.read).toHaveBeenCalledWith("attempt", { networkId: "network-test", paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID })
  })
  it("recherche avant de reprendre une tentative inconnue et conserve son identifiant", async () => {
    mocks.attempt = paymentAttemptFixture({ state: "unknown", paymentState: null, canRetry: true })
    await render()
    await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["status", "retry"])
    expect(mocks.action).toHaveBeenLastCalledWith("retry", { networkId: "network-test", paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID })
  })
  it("ne reprend pas si le statut retrouvé ferme canRetry", async () => {
    mocks.attempt = paymentAttemptFixture({ state: "unknown", paymentState: null, canRetry: true })
    mocks.action.mockResolvedValue({ outcome: "attempt", attempt: paymentAttemptFixture({ canRetry: false }) })
    await render(); await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["status"])
  })
  it("ne reprend pas une autre tentative même si son serveur autorise sa reprise", async () => {
    mocks.attempt = paymentAttemptFixture({ state: "unknown", paymentState: null, canRetry: true })
    mocks.action.mockResolvedValue({ outcome: "attempt", attempt: paymentAttemptFixture({ paymentAttemptId: "foreign-payment", state: "unknown", canRetry: true }) })
    await render(); await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["status"])
    expect(container.textContent).toContain(i18n.t("unavailable"))
  })
})

describe("remboursement explicitement demandé et idempotent", () => {
  it.each(["observedAt", "paymentRef", "orderRef"] as const)("n'affiche pas de formulaire de remboursement sans %s malgré le drapeau canRequestRefund", async (field) => {
    mocks.attempt = succeeded({ [field]: null })
    await render()
    expect(container.querySelector("form")).toBeNull()
    expect(mocks.action).not.toHaveBeenCalled()
  })
  it("exige un motif choisi et un accord décoché, puis transmet expectedRevision", async () => {
    mocks.attempt = succeeded({ revision: 7 })
    await render()
    expect((container.querySelector('input[name="accepted"]') as HTMLInputElement).checked).toBe(false)
    expect((container.querySelector('select[name="reason"]') as HTMLSelectElement).value).toBe("")
    expect(button("requestRefund")!.disabled).toBe(true)
    await submitRefund(); expect(mocks.action).not.toHaveBeenCalled()
    await agreeRefund(); await submitRefund(); expect(mocks.action).not.toHaveBeenCalled()
    await chooseReason("duplicate_payment"); await submitRefund()
    expect(mocks.action).toHaveBeenCalledWith("refund", { networkId: "network-test", paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID, expectedRevision: 7, reason: "duplicate_payment", clientRequestId: expect.any(String) })
  })
  it("un changement de révision exige un accord neuf et le motif n'est pas présélectionné", async () => {
    mocks.attempt = succeeded({ revision: 7 })
    await render(); await chooseReason(); await agreeRefund()
    mocks.attempt = succeeded({ revision: 8 })
    await render()
    expect((container.querySelector('input[name="accepted"]') as HTMLInputElement).checked).toBe(false)
    expect((container.querySelector('select[name="reason"]') as HTMLSelectElement).value).toBe("")
    await submitRefund()
    expect(mocks.action).not.toHaveBeenCalled()
  })
  it("ne forme qu'une seule intention de remboursement sur un double submit", async () => {
    mocks.attempt = succeeded(); mocks.action.mockReturnValue(new Promise(() => {}))
    await render(); await chooseReason(); await agreeRefund()
    await act(async () => { const form = container.querySelector("form")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(mocks.action).toHaveBeenCalledOnce()
  })
  it("après réponse perdue, recherche puis reprend la même clé, raison et révision", async () => {
    mocks.attempt = succeeded()
    mocks.action.mockImplementationOnce(async () => { throw new Error("lost") }).mockImplementationOnce(async () => ({ outcome: "attempt", attempt: succeeded() })).mockImplementationOnce(async () => ({ outcome: "attempt", attempt: succeeded({ refundState: "requested", canRequestRefund: false }) }))
    await render(); await chooseReason("late_payment"); await agreeRefund(); await submitRefund()
    const first = mocks.action.mock.calls[0]!
    await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["refund", "status", "refund"])
    expect(mocks.action.mock.calls[2]).toEqual(first)
  })
  it("un remboursement retrouvé n'est pas soumis une seconde fois", async () => {
    mocks.attempt = succeeded()
    mocks.action.mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({ outcome: "attempt", attempt: succeeded({ refundState: "requested", canRequestRefund: false }) })
    await render(); await chooseReason(); await agreeRefund(); await submitRefund()
    await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["refund", "status"])
  })
  it("un statut inconnu après perte ne soumet pas une autre demande de remboursement", async () => {
    mocks.attempt = succeeded()
    mocks.action.mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({ outcome: "attempt", attempt: paymentAttemptFixture({ state: "unknown", paymentState: null, observedAt: null, refundState: "none", canRequestRefund: true }) })
    await render(); await chooseReason(); await agreeRefund(); await submitRefund()
    await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["refund", "status"])
  })
  it("un statut d'une autre tentative ferme la suite sans rembourser une autre référence", async () => {
    mocks.attempt = succeeded()
    mocks.action.mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({ outcome: "attempt", attempt: succeeded({ paymentAttemptId: "foreign-payment" }) })
    await render(); await chooseReason(); await agreeRefund(); await submitRefund()
    await click(button("retrySameAttempt")!)
    expect(mocks.action.mock.calls.map(([reference]) => reference)).toEqual(["refund", "status"])
    expect(container.textContent).toContain(i18n.t("unavailable"))
  })
  it("une revue de paiement tardif n'interdit pas le remboursement autorisé d'un paiement prouvé", async () => {
    mocks.attempt = succeeded({ reviewRequired: true })
    await render(); await chooseReason("late_payment"); await agreeRefund(); await submitRefund()
    expect(mocks.action).toHaveBeenCalledWith("refund", expect.objectContaining({ reason: "late_payment" }))
  })
})

describe("confidentialité et navigation privées", () => {
  it("un refus de lecture masque le DTO précédent", async () => {
    await render(); expect(container.textContent).toContain(i18n.t("paymentStates.pending"))
    mocks.error = true; await render()
    expect(container.textContent).toContain(i18n.t("unavailable"))
    expect(container.textContent).not.toContain(i18n.t("paymentStates.pending"))
  })
  it("un refus d'action ferme l'ancien statut", async () => {
    mocks.action.mockResolvedValue({ outcome: "refused" })
    await render(); await click(button("checkStatus")!)
    expect(container.textContent).toContain(i18n.t("unavailable"))
    expect(container.textContent).not.toContain(i18n.t("paymentStates.pending"))
  })
  it("le changement d'acteur annule les effets d'une réponse tardive", async () => {
    let resolve!: (value: unknown) => void
    mocks.action.mockReturnValue(new Promise((done) => { resolve = done }))
    await render(); await click(button("checkStatus")!)
    mocks.person = "person-b"; mocks.attempt = null
    await render()
    await act(async () => resolve({ outcome: "attempt", attempt: succeeded() }))
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(i18n.t("paymentStates.succeeded"))
  })
  it("la liste privée demande dix éléments puis les vrais curseurs et ouvre le suivi", async () => {
    await render(<PaymentListScreen />)
    expect(mocks.read).toHaveBeenCalledWith("list", { networkId: "network-test", paginationOpts: { cursor: null, numItems: 10 } })
    expect(container.querySelector(`a[href="${routes.paymentAttempt(TEST_PAYMENT_ATTEMPT_ID)}"]`)).not.toBeNull()
    await click(button("next")!)
    expect(mocks.read).toHaveBeenLastCalledWith("list", { networkId: "network-test", paginationOpts: { cursor: "next-page", numItems: 10 } })
    await click(button("previous")!)
    expect(mocks.read).toHaveBeenLastCalledWith("list", { networkId: "network-test", paginationOpts: { cursor: null, numItems: 10 } })
  })
})
