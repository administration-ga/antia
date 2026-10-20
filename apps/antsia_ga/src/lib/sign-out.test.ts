import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ sdk: vi.fn(), bridge: vi.fn(), fence: vi.fn() }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ signOutEverywhere: mocks.sdk }))
vi.mock("./auth-client", () => ({ authClient: {} }))
vi.mock("./session-bridge-client", () => ({ requestSessionBridge: mocks.bridge, rotateSessionBridgeFence: mocks.fence }))
import { signOutAndRedirect } from "./sign-out"
import { routes } from "./routes"

afterEach(() => { vi.unstubAllGlobals(); mocks.sdk.mockReset(); mocks.bridge.mockReset(); mocks.fence.mockReset() })
describe("sortie avec purge du pont", () => {
  it("une révocation et deux purges confirmées retournent à l'entrée sans avertissement", async () => {
    const assign = vi.fn()
    vi.stubGlobal("window", { location: { assign } })
    mocks.fence.mockReturnValue("generation")
    mocks.sdk.mockImplementation(async (_client, options) => { options.navigate({ serverRevoked: true, localCleared: true }); return {} })
    mocks.bridge.mockResolvedValue(true)
    await signOutAndRedirect()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(routes.signedOut(false)))
  })
  it("ferme synchroniquement, attend la purge locale avant navigation et signale son échec", async () => {
    const order: string[] = [], assign = vi.fn(() => { order.push("navigate") })
    vi.stubGlobal("window", { location: { assign } })
    mocks.fence.mockImplementation(() => { order.push("fence"); return "generation" })
    mocks.sdk.mockImplementation(async (_client, options) => { order.push("sdk"); options.navigate({ serverRevoked: true, localCleared: true }); return {} })
    mocks.bridge.mockImplementation(async (_method, body) => { expect(body.anonymous).toBe(true); order.push("bridge"); return false })
    await signOutAndRedirect()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(routes.signedOut(true)))
    expect(order).toEqual(["fence", "sdk", "bridge", "navigate"])
  })
  it("ne marque pas anonyme une purge SDK incomplète et continue sa fermeture locale", async () => {
    const assign = vi.fn()
    vi.stubGlobal("window", { location: { assign } })
    mocks.fence.mockReturnValue("generation")
    mocks.sdk.mockImplementation(async (_client, options) => { options.navigate({ serverRevoked: false, localCleared: false }); return {} })
    mocks.bridge.mockResolvedValue(true)
    await signOutAndRedirect()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(routes.signedOut(true)))
    expect(mocks.bridge).toHaveBeenCalledWith("DELETE", { generation: "generation", anonymous: false })
  })
})
