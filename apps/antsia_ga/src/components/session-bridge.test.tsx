// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ token: vi.fn(), request: vi.fn(), generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }))
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }) }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/lib/auth-client", () => ({ authClient: { getCookie: () => "signed-sdk-cookie", convex: { token: mocks.token } } }))
vi.mock("@/lib/session-bridge-client", () => ({ clearLocalSessionForAnonymousBridge: () => true, currentSessionBridgeGeneration: () => mocks.generation, requestSessionBridge: mocks.request, rotateSessionBridgeFence: () => mocks.generation }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => false }))
import { SessionBridge } from "./session-bridge"
import { BRIDGE_TIMEOUT_MS } from "@/lib/session-bridge"

afterEach(() => { vi.useRealTimers(); mocks.token.mockReset(); mocks.request.mockReset() })
describe("confirmation de session bornée", () => {
  it("un SDK de jeton bloqué rend une erreur réessayable, aucun contenu privé et aucune admission", async () => {
    vi.useFakeTimers()
    mocks.token.mockImplementation(() => new Promise(() => undefined))
    const host = document.createElement("div"), root = createRoot(host)
    await act(async () => { root.render(<SessionBridge><p>private-content</p></SessionBridge>) })
    expect(host.textContent).toContain("session.confirming")
    await act(async () => { await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS + 1) })
    expect(host.textContent).toContain("session.unavailable")
    expect(host.textContent).not.toContain("private-content")
    expect(mocks.request).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})
