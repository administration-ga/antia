// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Grant = { purpose: "usage_analytics"; origin: "settings" }
type Revoke = { purpose: "usage_analytics" }
const state = vi.hoisted(() => ({
  configured: true,
  person: { consentsInForce: [] as string[] },
  paused: false,
  order: [] as string[],
  query: vi.fn(),
  grant: vi.fn<(args: Grant) => Promise<null>>(),
  revoke: vi.fn<(args: Revoke) => Promise<null>>(),
  pause: vi.fn(),
  resume: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@convex/_generated/api", () => ({ api: { modules: { people: { persons: { getMyPerson: "get-person" }, consents: { recordConsent: "grant", revokeConsent: "revoke" } } } } }))
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => { state.query(reference, args); return state.person },
  useMutation: (reference: string) => reference === "grant" ? state.grant : state.revoke,
}))
// Aucun chargement du module de configuration ni lecture d'environnement réel.
// L'état simulé rend observable le contrat pause/resume du contrôle public.
vi.mock("./analytics-permission", () => ({
  get usageConfiguration() { return state.configured ? { configured: true } : null },
  useUsagePermission: () => ({ paused: state.paused, pause: state.pause, resume: state.resume }),
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }))

import { AnalyticsControls } from "./analytics-controls"

let root: Root | undefined
let container: HTMLDivElement

async function mount() {
  root = createRoot(container)
  await act(async () => { root?.render(<AnalyticsControls />) })
}

async function rerender() {
  await act(async () => { root?.render(<AnalyticsControls />) })
}

function button(): HTMLButtonElement {
  const element = container.querySelector("button")
  if (!element) throw new Error("Analytics control missing")
  return element
}

async function click() {
  await act(async () => { button().click() })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.configured = true
  state.person = { consentsInForce: [] }
  state.paused = false
  state.order = []
  state.query.mockClear()
  state.grant.mockReset().mockImplementation(async () => { state.order.push("grant"); return null })
  state.revoke.mockReset().mockImplementation(async () => { state.order.push("revoke"); return null })
  state.pause.mockReset().mockImplementation(() => { state.order.push("pause"); state.paused = true })
  state.resume.mockReset().mockImplementation(() => { state.order.push("resume"); state.paused = false })
  state.success.mockClear()
  state.error.mockClear()
  container = document.createElement("div")
  document.body.append(container)
})

afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = undefined
  container.remove()
})

describe("AnalyticsControls — accord facultatif et retrait immédiat", () => {
  it("sans configuration, bloque tout nouvel accord mais permet toujours de retirer un accord existant", async () => {
    state.configured = false
    await mount()
    expect(container.textContent).toContain("analytics.unconfigured")
    expect(container.querySelector('[role="status"]')?.textContent).toBe("analytics.inactive")
    expect(button().disabled).toBe(true)
    await click()
    expect(state.grant).not.toHaveBeenCalled()
    expect(state.resume).not.toHaveBeenCalled()
    state.person = { consentsInForce: ["usage_analytics"] }
    await rerender()
    expect(button().disabled).toBe(false)
    expect(button().textContent).toBe("analytics.revoke")
    expect(container.querySelector('[role="status"]')?.textContent).toBe("analytics.inactive")
  })

  it("l'accord part uniquement après le geste explicite, globalement, puis reprend après admission", async () => {
    let resolve!: (value: null) => void
    state.grant.mockImplementation(async () => { state.order.push("grant"); return new Promise<null>((done) => { resolve = done }) })
    await mount()
    expect(state.grant).not.toHaveBeenCalled()
    await click()
    expect(state.grant).toHaveBeenCalledWith({ purpose: "usage_analytics", origin: "settings" })
    expect(state.grant.mock.calls[0]?.[0]).not.toHaveProperty("networkId")
    expect(state.resume).not.toHaveBeenCalled()
    expect(button().disabled).toBe(true)
    await act(async () => { resolve(null) })
    expect(state.order).toEqual(["grant", "resume"])
    expect(state.success).toHaveBeenCalledWith("analytics.granted")
  })

  it("le retrait met le navigateur en pause avant même l'appel et sa promesse serveur", async () => {
    state.person = { consentsInForce: ["usage_analytics"] }
    let resolve!: (value: null) => void
    state.revoke.mockImplementation(async () => {
      state.order.push("revoke")
      expect(state.paused).toBe(true)
      return new Promise<null>((done) => { resolve = done })
    })
    await mount()
    expect(container.querySelector('[role="status"]')?.textContent).toBe("analytics.active")
    await click()
    expect(state.order).toEqual(["pause", "revoke"])
    expect(state.revoke).toHaveBeenCalledWith({ purpose: "usage_analytics" })
    expect(state.revoke.mock.calls[0]?.[0]).not.toHaveProperty("networkId")
    expect(container.querySelector('[role="status"]')?.textContent).toBe("analytics.inactive")
    expect(button().disabled).toBe(true)
    await act(async () => { resolve(null) })
    expect(state.paused).toBe(true)
    expect(state.resume).not.toHaveBeenCalled()
    expect(state.success).toHaveBeenCalledWith("analytics.revoked")
  })

  it("un retrait refusé conserve la pause, annonce l'échec et permet de réessayer", async () => {
    state.person = { consentsInForce: ["usage_analytics"] }
    state.revoke.mockRejectedValueOnce(new Error("transport unavailable"))
    await mount()
    await click()
    expect(state.paused).toBe(true)
    expect(state.resume).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("analytics.revokeFailed")
    expect(state.error).toHaveBeenCalledWith("analytics.revokeFailed")
    expect(button().disabled).toBe(false)
    expect(button().textContent).toBe("analytics.revoke")
    await click()
    expect(state.revoke).toHaveBeenCalledTimes(2)
    expect(state.paused).toBe(true)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it("les snapshots de consentement serveur seuls ne provoquent aucune mutation ni reprise automatique", async () => {
    state.person = { consentsInForce: ["usage_analytics"] }
    await mount()
    expect(state.query).toHaveBeenCalledWith("get-person", {})
    await rerender()
    state.person = { consentsInForce: [] }
    await rerender()
    expect(state.grant).not.toHaveBeenCalled()
    expect(state.revoke).not.toHaveBeenCalled()
    expect(state.pause).not.toHaveBeenCalled()
    expect(state.resume).not.toHaveBeenCalled()
    expect(container.querySelector('[role="status"]')?.textContent).toBe("analytics.inactive")
  })

  it("l'alerte garde l'opération refusée même si un snapshot distant change le consentement pendant l'attente", async () => {
    state.person = { consentsInForce: ["usage_analytics"] }
    let reject!: (error: Error) => void
    state.revoke.mockReturnValue(new Promise<null>((_resolve, fail) => { reject = fail }))
    await mount()
    await click()
    state.person = { consentsInForce: [] }
    await rerender()
    await act(async () => { reject(new Error("withdrawal not confirmed")) })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("analytics.revokeFailed")
    expect(state.error).toHaveBeenCalledWith("analytics.revokeFailed")
    expect(state.paused).toBe(true)
    expect(state.resume).not.toHaveBeenCalled()
  })
})
