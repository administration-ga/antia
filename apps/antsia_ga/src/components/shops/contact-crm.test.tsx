// @vitest-environment jsdom
import type { CommercialThread } from "@antsia/social-features/messagerie"
import { COMMERCE_INQUIRY_CONSENT_TEXT, COMMERCE_INQUIRY_CONSENT_VERSION } from "@antsia/social-domain/commerce-inquiry"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fr from "@/i18n/locales/fr/shops.json"
import en from "@/i18n/locales/en/shops.json"

const state = vi.hoisted(() => ({ transfer: { state: "none", textVersion: "2026-10-18-p10-v1" } as { state: string; textVersion: string; selectedText?: string; consentedAt?: number; revokedAt?: number }, submit: vi.fn(), withdraw: vi.fn(), retry: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: { commercialMessaging: { crm: { getMyTransfer: "get", submitToCrm: "submit", withdrawCrmConsent: "withdraw", retryTransfer: "retry" } } } } }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network" }) }))
vi.mock("@antsia/api/viewer-preferences", () => ({ useViewerTimeZone: () => "UTC" }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => ({ data: state.transfer, isError: false }) }))
vi.mock("convex/react", () => ({ useMutation: (reference: string) => reference === "submit" ? state.submit : reference === "withdraw" ? state.withdraw : state.retry }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "fr" } }) }))
vi.mock("./shop-ui", () => ({ useShopAction: () => ({ pending: false, error: null, run: async (work: () => Promise<unknown>, success?: (result: unknown) => void) => { try { const result = await work(); success?.(result); return result } catch { return undefined } } }) }))

import { ContactCrm } from "./contact-crm"

const thread = { threadId: "commercial-thread", state: "accepted", viewerKind: "requester" } as CommercialThread
let root: Root | undefined
let container: HTMLDivElement
async function mount(value = thread) { root = createRoot(container); await act(async () => { root?.render(<ContactCrm thread={value} />) }) }
async function submit() { await act(async () => { container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) }) }
async function fill(name: string, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
    if (!input) throw new Error("Missing field")
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div"); document.body.append(container)
  state.transfer = { state: "none", textVersion: COMMERCE_INQUIRY_CONSENT_VERSION }
  state.submit.mockReset().mockResolvedValue({ state: "queued", transferId: "transfer" }); state.withdraw.mockReset().mockResolvedValue({ state: "withdrawal_pending" }); state.retry.mockReset()
})
afterEach(async () => { await act(async () => { root?.unmount() }); root = undefined; container.remove() })

describe("consentement CRM sélectif", () => {
  it("affiche exactement les textes FR et EN de la version domaine", () => {
    expect(fr.contact.crm.consent).toBe(COMMERCE_INQUIRY_CONSENT_TEXT.fr)
    expect(en.contact.crm.consent).toBe(COMMERCE_INQUIRY_CONSENT_TEXT.en)
  })
  it("commence vide et décoché et refuse la soumission sans choix explicite", async () => {
    await mount()
    expect(container.querySelector<HTMLTextAreaElement>('textarea[name="selectedText"]')?.value).toBe("")
    expect(container.querySelector<HTMLInputElement>('input[name="displayName"]')?.value).toBe("")
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false)
    await submit()
    expect(state.submit).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).toBeTruthy()
    expect(container.querySelector('input[type="email"], input[type="tel"]')).toBeNull()
  })
  it("envoie les seuls champs choisis et réutilise la clé d'un réessai identique", async () => {
    state.submit.mockRejectedValueOnce(new Error("temporary"))
    await mount(); await fill("selectedText", "Cet extrait seulement"); await fill("displayName", "Mon alias")
    await act(async () => { container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click() })
    await submit(); await submit()
    expect(state.submit).toHaveBeenCalledTimes(2)
    const first = state.submit.mock.calls[0]?.[0]
    const second = state.submit.mock.calls[1]?.[0]
    expect(first).toEqual({ networkId: "network", threadId: "commercial-thread", selectedText: "Cet extrait seulement", displayName: "Mon alias", consent: true, textVersion: COMMERCE_INQUIRY_CONSENT_VERSION, idempotencyKey: expect.any(String) })
    expect(second).toEqual(first)
  })
  it("garde le retrait accessible dans un fil bloqué et ne propose rien au vendeur", async () => {
    state.transfer = { state: "failed", textVersion: COMMERCE_INQUIRY_CONSENT_VERSION, selectedText: "Chosen text", consentedAt: 1 }
    await mount({ ...thread, state: "blocked" })
    const withdraw = [...container.querySelectorAll("button")].find((button) => button.textContent === "contact.crm.withdraw")
    expect(withdraw).toBeTruthy()
    await act(async () => { withdraw?.click() })
    expect(state.withdraw).toHaveBeenCalledWith({ networkId: "network", threadId: "commercial-thread" })
    await act(async () => { root?.render(<ContactCrm thread={{ ...thread, viewerKind: "shop" }} />) })
    expect(container.textContent).toBe("")
  })
})
