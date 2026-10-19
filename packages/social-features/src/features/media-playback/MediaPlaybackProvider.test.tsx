// @vitest-environment jsdom
// P04 (18/10/2026) : le pont d'environnement lit l'état d'appel EXISTANT (magasin et sonnerie), l'onglet et l'économie de données.
import { act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import { createMediaPlaybackCoordinator } from "./media-playback-coordinator"

const state = vi.hoisted(() => ({
  slots: [] as { status: string }[],
  outgoing: null as null | { meetingId: string },
  ringing: undefined as undefined | { calls: unknown[]; quickReplies: null },
  queries: [] as unknown[][],
}))

vi.mock("@antsia/api/engine", () => ({
  api: { modules: { calls: { ringing: { listRinging: "calls.ringing.listRinging" } } } },
}))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: unknown, args: unknown) => {
    state.queries.push([reference, args])
    return { data: state.ringing, isLoading: false, isError: false }
  },
}))
vi.mock("../../stores/call-store", () => ({ useCallStore: () => ({ slots: state.slots, outgoingCallWindow: state.outgoing }) }))

import { hasCallInProgress, PlaybackEnvironmentBridge } from "./MediaPlaybackProvider"

let visibility: DocumentVisibilityState = "visible"

beforeEach(() => {
  state.slots = []
  state.outgoing = null
  state.ringing = undefined
  state.queries = []
  visibility = "visible"
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, "connection")
})

describe("hasCallInProgress", () => {
  it("vrai pour un appel en établissement, actif ou en attente ; faux pour un appel terminé", () => {
    expect(hasCallInProgress([])).toBe(false)
    expect(hasCallInProgress([{ status: "ended" }])).toBe(false)
    for (const status of ["connecting", "active", "held", "incoming"]) expect(hasCallInProgress([{ status }])).toBe(true)
  })
})

describe("PlaybackEnvironmentBridge — lecture seule de l'état existant", () => {
  it("lit ce qui sonne par la même requête et les mêmes arguments que l'hôte d'appel", () => {
    const coordinator = createMediaPlaybackCoordinator()
    renderWithEngine(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(state.queries).toContainEqual(["calls.ringing.listRinging", { networkId: "networks_test" }])
  })

  it("un appel qui sonne ou un slot d'appel ouvert interrompt la lecture", () => {
    const coordinator = createMediaPlaybackCoordinator()
    state.ringing = { calls: [{ callId: "calls_1" }], quickReplies: null }
    const view = renderWithEngine(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().callInProgress).toBe(true)

    state.ringing = { calls: [], quickReplies: null }
    state.slots = [{ status: "active" }]
    view.rerender(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().callInProgress).toBe(true)

    state.slots = [{ status: "ended" }]
    view.rerender(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().callInProgress).toBe(false)

    // Un appel sortant qui sonne encore, avant tout slot.
    state.outgoing = { meetingId: "calls_2" }
    view.rerender(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().callInProgress).toBe(true)
  })

  it("suit l'onglet masqué (`visibilitychange`)", () => {
    const coordinator = createMediaPlaybackCoordinator()
    renderWithEngine(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().documentHidden).toBe(false)
    act(() => {
      visibility = "hidden"
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(coordinator.getEnvironment().documentHidden).toBe(true)
    act(() => {
      visibility = "visible"
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(coordinator.getEnvironment().documentHidden).toBe(false)
  })

  it("lit l'économie de données de la connexion", () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const coordinator = createMediaPlaybackCoordinator()
    renderWithEngine(<PlaybackEnvironmentBridge coordinator={coordinator} />)
    expect(coordinator.getEnvironment().dataSaver).toBe(true)
  })
})
