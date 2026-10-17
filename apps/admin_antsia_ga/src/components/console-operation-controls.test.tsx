// @vitest-environment jsdom
import { createAppI18n } from "@antsia/social-features/i18n"
import { ConvexError } from "convex/values"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appResources } from "@/i18n/resources"
import enOperations from "@/i18n/locales/en/operations.json"
import frOperations from "@/i18n/locales/fr/operations.json"

const state = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dirty: vi.fn(), pending: vi.fn(), navigate: vi.fn(), signingOut: false }))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error, info: state.info } }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => state.signingOut }))

import { MotiveAction, OperationDraftProvider, useOperationDraft, useOperationDraftGuard } from "./console-operation-controls"
import { downloadAggregateExport } from "./console-export"

let root: Root
let container: HTMLDivElement
const decision = vi.fn<(reason: string) => Promise<unknown>>()
async function renderChildren(children: ReactNode) {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: { ...appResources.fr, operations: frOperations }, en: { ...appResources.en, operations: enOperations } }, defaultNS: "admin" })
  await act(async () => root.render(<I18nextProvider i18n={i18n}><OperationDraftProvider onDirtyChange={state.dirty} onPendingChange={state.pending}>{children}</OperationDraftProvider></I18nextProvider>))
}
function DraftProbe({ dirty, pending = false }: { dirty: boolean; pending?: boolean }) { useOperationDraft(dirty, pending); return null }
function GuardProbe() { const canChange = useOperationDraftGuard(); return <button onClick={() => { if (canChange()) state.navigate() }}>Changer</button> }
function button(label: string) {
  const element = Array.from(container.querySelectorAll("button")).find((row) => row.textContent?.includes(label))
  if (!element) throw new Error(`Missing button ${label}`)
  return element
}
async function enterReason(value: string) {
  await act(async () => {
    const field = container.querySelector("textarea")
    if (!field) throw new Error("Missing reason field")
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, value)
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
async function submit() {
  await act(async () => { container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.success.mockReset()
  state.error.mockReset()
  state.dirty.mockReset()
  state.pending.mockReset()
  state.info.mockReset()
  state.navigate.mockReset()
  state.signingOut = false
  decision.mockReset()
  decision.mockResolvedValue(null)
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await renderChildren(<MotiveAction label="Décider" minLength={10} onDecision={decision} />)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("décisions motivées", () => {
  it("le déclencheur n'écrit rien et une motivation trop courte refuse la décision", async () => {
    await act(async () => button("Décider").click())
    expect(decision).not.toHaveBeenCalled()
    await enterReason("court")
    await submit()
    expect(decision).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull()
  })
  it("envoie le motif validé et empêche deux écritures pendant une décision", async () => {
    let resolve: (value: unknown) => void = () => undefined
    decision.mockImplementation(() => new Promise((done) => { resolve = done }))
    await act(async () => button("Décider").click())
    await enterReason("  Motif documenté de cette décision  ")
    await submit()
    await submit()
    expect(decision).toHaveBeenCalledTimes(1)
    expect(decision).toHaveBeenCalledWith("Motif documenté de cette décision")
    expect(button("Enregistrement").disabled).toBe(true)
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(true)
    await act(async () => resolve(null))
    expect(container.querySelector("textarea")).toBeNull()
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(false)
  })
  it("un refus backend ne passe jamais pour un succès et conserve le motif pour réessayer", async () => {
    decision.mockRejectedValue(new ConvexError({ code: "policyRefused", privateDetail: "private-secret" }))
    await act(async () => button("Décider").click())
    await enterReason("Motif documenté de cette décision")
    await submit()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).not.toContain("private-secret")
    expect(container.querySelector("textarea")?.value).toBe("Motif documenté de cette décision")
    expect(state.success).not.toHaveBeenCalled()
    decision.mockResolvedValue(null)
    await submit()
    expect(decision).toHaveBeenCalledTimes(2)
    expect(state.success).toHaveBeenCalledTimes(1)
  })
})

describe("brouillons agrégés des opérations", () => {
  it("nettoyer un formulaire ne retire pas la protection d'un autre", async () => {
    await renderChildren(<><DraftProbe key="a" dirty /><DraftProbe key="b" dirty /></>)
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(true)
    await renderChildren(<><DraftProbe key="a" dirty={false} /><DraftProbe key="b" dirty /></>)
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(true)
    await renderChildren(<DraftProbe key="a" dirty={false} />)
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(false)
  })
  it("protège la fermeture de page, puis laisse passer une déconnexion intentionnelle", async () => {
    await renderChildren(<DraftProbe dirty />)
    const leave = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leave)
    expect(leave.defaultPrevented).toBe(true)
    state.signingOut = true
    const signOut = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(signOut)
    expect(signOut.defaultPrevented).toBe(false)
  })
  it("le nettoyage et le démontage libèrent le callback et l'écouteur", async () => {
    await renderChildren(<DraftProbe dirty />)
    await renderChildren(<DraftProbe dirty={false} />)
    const clean = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    await renderChildren(<DraftProbe dirty />)
    await act(async () => root.render(null))
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(false)
    const unmounted = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unmounted)
    expect(unmounted.defaultPrevented).toBe(false)
  })
  it("au téléphone l'ouverture ne déclenche pas le clavier du champ de motif", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })))
    await act(async () => button("Décider").click())
    expect(document.activeElement?.tagName).toBe("P")
    expect(document.activeElement?.textContent).toContain("Confirmer : Décider")
    expect(container.querySelector("textarea")?.hasAttribute("autofocus")).toBe(false)
  })
  it("sur bureau le focus du champ résulte du clic explicite", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
    expect(container.querySelector("textarea")).toBeNull()
    await act(async () => button("Décider").click())
    expect(document.activeElement).toBe(container.querySelector("textarea"))
  })
  it("la garde interne conserve un brouillon refusé et autorise le changement confirmé", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    await renderChildren(<><DraftProbe dirty /><GuardProbe /></>)
    await act(async () => button("Changer").click())
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(state.navigate).not.toHaveBeenCalled()
    expect(state.dirty.mock.calls.at(-1)?.[0]).toBe(true)
    confirm.mockReturnValue(true)
    await act(async () => button("Changer").click())
    expect(state.navigate).toHaveBeenCalledTimes(1)
  })
  it("une décision pending interdit le changement même si une confirmation serait acceptée", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    await renderChildren(<><DraftProbe dirty pending /><GuardProbe /></>)
    await act(async () => button("Changer").click())
    expect(state.pending.mock.calls.at(-1)?.[0]).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
    expect(state.info).toHaveBeenCalledWith(expect.stringContaining("Une décision est en cours"))
  })
  it("une réponse tardive ne délivre ni callback de succès ni toast après démontage", async () => {
    let resolve: (value: unknown) => void = () => undefined
    const success = vi.fn()
    decision.mockImplementation(() => new Promise((done) => { resolve = done }))
    await renderChildren(<MotiveAction label="Décider" minLength={10} onDecision={decision} onSuccess={success} />)
    await act(async () => button("Décider").click())
    await enterReason("Motif documenté de cette décision")
    await submit()
    expect(state.pending.mock.calls.at(-1)?.[0]).toBe(true)
    await act(async () => root.render(null))
    await act(async () => resolve({ outcome: "still_failing" }))
    expect(state.pending.mock.calls.at(-1)?.[0]).toBe(false)
    expect(success).not.toHaveBeenCalled()
    expect(state.success).not.toHaveBeenCalled()
    expect(state.error).not.toHaveBeenCalled()
  })
})

describe("téléchargement local agrégé", () => {
  it("déclenche immédiatement le téléchargement et révoque l'URL temporaire", () => {
    const create = vi.fn(() => "blob:aggregate-test")
    const revoke = vi.fn()
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    downloadAggregateExport({ threshold: 5, periods: [] }, "json")
    expect(create).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith("blob:aggregate-test")
    expect(document.querySelector('[download="antsia-aggregate.json"]')).toBeNull()
  })
  it("nettoie également l'URL si l'ouverture du téléchargement échoue", () => {
    const revoke = vi.fn()
    vi.stubGlobal("URL", { createObjectURL: () => "blob:aggregate-test", revokeObjectURL: revoke })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { throw new Error("download refused") })
    expect(() => downloadAggregateExport({ threshold: 5, periods: [] }, "csv")).toThrow()
    expect(revoke).toHaveBeenCalledWith("blob:aggregate-test")
    expect(document.querySelector('[download="antsia-aggregate.csv"]')).toBeNull()
  })
})
