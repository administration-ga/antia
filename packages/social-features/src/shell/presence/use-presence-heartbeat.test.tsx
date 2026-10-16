// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const calls: { name: "heartbeat" | "setOffline"; args: unknown }[] = []

vi.mock("@antsia/api/engine", () => ({
  api: { modules: { calls: { presence: { heartbeat: "heartbeat", setOffline: "setOffline" } } } },
}))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "networks_test" }) }))
vi.mock("convex/react", () => ({
  useMutation: (ref: "heartbeat" | "setOffline") => (args: unknown) => {
    calls.push({ name: ref, args })
    return Promise.resolve(null)
  },
}))

import { PRESENCE_MIN_BEAT_GAP_MS, PRESENCE_OFFLINE_DELAY_MS, shouldBeat, usePresenceHeartbeat } from "./use-presence-heartbeat"

const count = (name: "heartbeat" | "setOffline") => calls.filter((call) => call.name === name).length

beforeEach(() => {
  vi.useFakeTimers()
  calls.length = 0
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe("shouldBeat — pas de battement redoublé", () => {
  it("bat sans battement connu, ou passé l'écart minimal", () => {
    expect(shouldBeat(1_000, undefined)).toBe(true)
    expect(shouldBeat(PRESENCE_MIN_BEAT_GAP_MS, 0)).toBe(true)
    expect(shouldBeat(PRESENCE_MIN_BEAT_GAP_MS - 1, 0)).toBe(false)
  })
})

describe("usePresenceHeartbeat — le battement de présence du réseau", () => {
  it("bat au montage dans le réseau courant, puis toutes les 30 s", () => {
    const view = renderHook(() => usePresenceHeartbeat())
    expect(count("heartbeat")).toBe(1)
    expect(calls[0]?.args).toEqual({ networkId: "networks_test" })
    vi.advanceTimersByTime(30_000)
    expect(count("heartbeat")).toBe(2)
    view.unmount()
  })

  it("un remontage immédiat (navigation, double montage) n'envoie ni « hors ligne » ni second battement", () => {
    renderHook(() => usePresenceHeartbeat()).unmount()
    renderHook(() => usePresenceHeartbeat())
    vi.advanceTimersByTime(PRESENCE_OFFLINE_DELAY_MS + 10)
    expect(count("setOffline")).toBe(0)
    expect(count("heartbeat")).toBe(1)
  })

  it("dit « hors ligne » après le délai quand la coque se démonte pour de bon", () => {
    const view = renderHook(() => usePresenceHeartbeat())
    view.unmount()
    expect(count("setOffline")).toBe(0)
    vi.advanceTimersByTime(PRESENCE_OFFLINE_DELAY_MS)
    expect(count("setOffline")).toBe(1)
  })

  it("dit « hors ligne » tout de suite à la fermeture de l'onglet", () => {
    const view = renderHook(() => usePresenceHeartbeat())
    window.dispatchEvent(new Event("beforeunload"))
    expect(count("setOffline")).toBe(1)
    view.unmount()
  })
})
