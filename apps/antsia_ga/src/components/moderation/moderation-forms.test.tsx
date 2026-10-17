// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes } from "react"
import Link from "next/link"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@antsia/api/engine"

const state = vi.hoisted(() => ({ available: true, previewError: null as unknown, mutation: vi.fn(), success: vi.fn(), failure: vi.fn(), info: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { moderation: { cases: { decide: "decide", reviewContent: "review", reviewNetworkAppeal: "appeal" }, reviewProjection: { preview: "preview" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/viewer-preferences", () => ({ useViewerTimeZone: () => "UTC" }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ data: { available: state.available, kind: "post", title: null, body: "Excerpt", media: [] }, error: state.previewError, refetch: vi.fn() }) }))
vi.mock("@antsia/social-features/reseau-personnel", () => ({ PostMedia: () => null }))
vi.mock("convex/react", () => ({ useMutation: () => state.mutation }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.failure, info: state.info } }))
vi.mock("next/link", () => ({ default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a {...props} href={href} /> }))

import { AppealDecision, ReportDecision } from "./moderation-forms"
import { ModerationGuard } from "./moderation-guard"

let root: Root | undefined
let container: HTMLDivElement
function tree(count = 1, appeals = false, canDecide = true) { return <ModerationGuard><Link href="/outside">Away</Link>{Array.from({ length: count }, (_, index) => appeals ? <AppealDecision key={index} appealId={`appeal-${index}` as Id<"appeals">} canDecide={canDecide} /> : <ReportDecision key={index} reportId={`report-${index}` as Id<"reports">} />)}</ModerationGuard> }
async function mount(count = 1, appeals = false, canDecide = true) { root = createRoot(container); await act(async () => { root?.render(tree(count, appeals, canDecide)) }) }
async function reason(text: string, index = 0) {
  await act(async () => {
    const input = container.querySelectorAll<HTMLTextAreaElement>('textarea[name="reason"]')[index]
    if (!input) throw new Error("Missing reason")
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function submit(index = 0) { await act(async () => { container.querySelectorAll("form")[index]?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) }) }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div"); document.body.append(container)
  state.available = true; state.previewError = null
  state.mutation.mockReset().mockResolvedValue({ status: "dismissed" }); state.success.mockReset(); state.failure.mockReset(); state.info.mockReset()
})
afterEach(async () => { await act(async () => { root?.unmount() }); root = undefined; container.remove(); vi.restoreAllMocks() })

describe("décision motivée et garde de navigation", () => {
  it("un contenu devenu indisponible autorise seulement le classement, une erreur reste fermée", async () => {
    state.available = false
    await mount()
    expect(container.querySelector("fieldset")?.disabled).toBe(false)
    expect([...container.querySelectorAll<HTMLOptionElement>('select[name="action"] option')].filter((option) => option.value !== "dismissed").every((option) => option.disabled)).toBe(true)
    await submit()
    expect(state.mutation).not.toHaveBeenCalled()
    await reason("Contenu retiré, dossier clos."); await submit()
    expect(state.mutation).toHaveBeenCalledWith({ networkId: "network", reportId: "report-0", decision: "dismissed", reason: "Contenu retiré, dossier clos.", sanctions: [] })
    state.available = true; state.previewError = new Error("refused")
    await act(async () => { root?.render(tree()) })
    expect(container.querySelector("fieldset")?.disabled).toBe(true)
  })
  it("le retrait est confirmé après validation, une annulation ne crée pas de décision", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    await mount(); await reason("Contenu contraire aux règles.")
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[name="action"]')
      if (!select) throw new Error("Missing action")
      select.value = "removal"; select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await submit()
    expect(confirm).toHaveBeenCalledWith("moderation.confirm.removal")
    expect(state.mutation).not.toHaveBeenCalled()
    confirm.mockReturnValue(true); await submit()
    expect(state.mutation).toHaveBeenCalledWith({ networkId: "network", reportId: "report-0", decision: "actioned", reason: "Contenu contraire aux règles.", sanctions: [{ kind: "removal" }] })
  })
  it("un motif insuffisant est refusé avant écriture, le motif valable est transmis nettoyé", async () => {
    await mount()
    await reason(" a "); await submit()
    expect(state.mutation).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).toBeTruthy()
    await reason("  Contexte relu.  "); await submit()
    expect(state.mutation).toHaveBeenCalledWith({ networkId: "network", reportId: "report-0", decision: "dismissed", reason: "Contexte relu.", sanctions: [] })
    expect(state.success).toHaveBeenCalledWith("moderation.saved")
  })
  it("un échec garde le motif et rend le refus traduit", async () => {
    state.mutation.mockRejectedValueOnce({ data: { code: "rateLimited" } })
    await mount(); await reason("Contexte relu."); await submit()
    expect(container.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')?.value).toBe("Contexte relu.")
    expect(state.failure).toHaveBeenCalledWith("errors:rateLimited")
    expect(container.querySelector("fieldset")?.disabled).toBe(false)
  })
  it("deux décisions opposées partagent un verrou, même avant le prochain rendu", async () => {
    let finish: ((value: unknown) => void) | undefined
    state.mutation.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await mount(2); await reason("Contexte du premier.", 0); await reason("Contexte du deuxième.", 1)
    await act(async () => { for (const form of container.querySelectorAll("form")) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(state.mutation).toHaveBeenCalledTimes(1)
    expect([...container.querySelectorAll("fieldset")].every((field) => field.disabled)).toBe(true)
    const navigation = new MouseEvent("click", { bubbles: true, cancelable: true })
    container.querySelector("a")?.dispatchEvent(navigation)
    expect(navigation.defaultPrevented).toBe(true)
    expect(state.info).toHaveBeenCalledWith("moderation.pendingBlocked")
    await act(async () => { finish?.({ status: "dismissed" }) })
  })
  it("un brouillon protège lien et fermeture, sans garder un listener après démontage", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false)
    await mount(); await reason("Brouillon motivé.")
    const navigation = new MouseEvent("click", { bubbles: true, cancelable: true })
    container.querySelector("a")?.dispatchEvent(navigation)
    expect(navigation.defaultPrevented).toBe(true)
    const leaving = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leaving); expect(leaving.defaultPrevented).toBe(true)
    await act(async () => { root?.unmount() }); root = undefined
    const after = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })
})

describe("recours réseau : indépendance et décision motivée", () => {
  it("un décideur déclaré non indépendant ne peut pas écrire, même par soumission forcée", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    await mount(1, true)
    await reason("Motif programmatique.")
    await act(async () => { root?.render(tree(1, true, false)) })
    expect(container.querySelector("fieldset")?.disabled).toBe(true)
    expect(container.textContent).toContain("moderation.anotherDecider")
    await submit()
    expect(state.mutation).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })
  it("la validation précède confirmation et l'annulation est explicitement transportée", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    await mount(1, true)
    await reason(" a "); await submit()
    expect(confirm).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled()
    await reason("  Décision initiale infirmée.  ")
    await act(async () => { const select = container.querySelector<HTMLSelectElement>('select[name="decision"]'); if (select) { select.value = "overturn"; select.dispatchEvent(new Event("change", { bubbles: true })) } })
    await submit()
    expect(confirm).toHaveBeenCalledWith("moderation.confirm.overturn")
    expect(state.mutation).toHaveBeenCalledWith({ networkId: "network", appealId: "appeal-0", overturn: true, reason: "Décision initiale infirmée." })
  })
  it("les maintiens et annulations de recours partagent aussi le verrou en attente", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    let finish: ((value: unknown) => void) | undefined
    state.mutation.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await mount(2, true); await reason("Recours réexaminé A.", 0); await reason("Recours réexaminé B.", 1)
    await act(async () => { const select = container.querySelectorAll<HTMLSelectElement>('select[name="decision"]')[1]; if (select) { select.value = "overturn"; select.dispatchEvent(new Event("change", { bubbles: true })) } })
    await act(async () => { for (const form of container.querySelectorAll("form")) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(state.mutation).toHaveBeenCalledTimes(1)
    expect([...container.querySelectorAll("fieldset")].every((field) => field.disabled)).toBe(true)
    await act(async () => { finish?.(null) })
  })
})
