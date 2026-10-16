import { afterEach, describe, expect, it, vi } from "vitest"
import type { SignOutEverywhereOptions } from "@antsia/api/sign-out-everywhere"

const mocks = vi.hoisted(() => ({ signOutEverywhere: vi.fn() }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ signOutEverywhere: mocks.signOutEverywhere }))
vi.mock("./auth-client", () => ({ authClient: { engine: true } }))

import { signOutAndRedirect } from "./sign-out"

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe("console — déconnexion complète et résultat non trompeur", () => {
  it.each([
    [true, true, "/entrer"],
    [false, true, "/entrer?deconnexion=incomplete"],
    [true, false, "/entrer?deconnexion=incomplete"],
    [false, false, "/entrer?deconnexion=incomplete"],
  ] as const)("révocation=%s nettoyage=%s choisit le retour explicite", async (serverRevoked, localCleared, expected) => {
    const assign = vi.fn()
    vi.stubGlobal("window", { location: { assign } })
    const result = { serverRevoked, localCleared, errors: [], purged: [] }
    mocks.signOutEverywhere.mockImplementationOnce(async (_client: unknown, options: SignOutEverywhereOptions) => {
      expect(assign).not.toHaveBeenCalled()
      options.navigate?.(result)
      return result
    })
    expect(await signOutAndRedirect()).toEqual(result)
    expect(mocks.signOutEverywhere).toHaveBeenCalledWith({ engine: true }, { navigate: expect.any(Function) })
    expect(assign).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith(expected)
  })

  it("la navigation appartient au rappel du helper et ne se répète pas après sa résolution", async () => {
    const assign = vi.fn()
    vi.stubGlobal("window", { location: { assign } })
    const result = { serverRevoked: true, localCleared: true, errors: [], purged: [] }
    mocks.signOutEverywhere.mockImplementationOnce(async (_client: unknown, options: SignOutEverywhereOptions) => {
      options.navigate?.(result)
      expect(assign).toHaveBeenCalledOnce()
      return result
    })
    await signOutAndRedirect()
    expect(assign).toHaveBeenCalledOnce()
  })

  it("un échec de navigation est propagé sans lancer une seconde redirection", async () => {
    const failure = new Error("navigation refusée")
    const assign = vi.fn(() => { throw failure })
    vi.stubGlobal("window", { location: { assign } })
    mocks.signOutEverywhere.mockImplementationOnce(async (_client: unknown, options: SignOutEverywhereOptions) => {
      options.navigate?.({ serverRevoked: true, localCleared: true, errors: [], purged: [] })
    })
    await expect(signOutAndRedirect()).rejects.toBe(failure)
    expect(assign).toHaveBeenCalledOnce()
  })
})
