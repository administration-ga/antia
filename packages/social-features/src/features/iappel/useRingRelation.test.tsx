// Dupliqué de socle/packages/agent-features/src/features/iappel/useRingRelation.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (i18n français, réseau de test) ; appel par `calls.direct.callMember({ networkId, target: { personId } })` ; la panne se dit par son CODE traduit (`notFound` → phrase d'iAppel), jamais par le texte du serveur — le cas « phrase Convex d'affiliation » du socle (refus administratif) devient ce cas-là ; cas neufs : refus admis → écran de fin avec l'identité de l'appelé, appel admis → fenêtre sortante sur l'appel, l'appelé et le média GRAVÉS par le serveur.
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  toastError: vi.fn(),
  openOutgoingCall: vi.fn(),
  openRefusedCall: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: { modules: { calls: { direct: { callMember: "callMember" } } } },
}))
vi.mock("convex/react", () => ({ useMutation: () => mocks.call }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))
vi.mock("../../stores/call-store", () => ({
  useCallStore: () => ({
    openOutgoingCall: mocks.openOutgoingCall,
    openRefusedCall: mocks.openRefusedCall,
  }),
}))

import { useRingRelation } from "./useRingRelation"

const ALINE = "persons_aline" as never

function RingRelationTrigger({ mediaType }: { mediaType: "audio" | "video" }) {
  const { busyHandle, ring } = useRingRelation()
  return (
    <button
      type="button"
      disabled={busyHandle === "aline.minko"}
      onClick={() => void ring({ personId: ALINE, handle: "aline.minko", displayName: "Aline Minko" }, mediaType)}
    >
      Appeler Aline Minko
    </button>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(cleanup)

describe("useRingRelation — appeler une relation", () => {
  it.each(["audio", "video"] as const)(
    "une panne %s se dit par son code traduit, et l'action se libère",
    async (mediaType) => {
      const error = new ConvexError({ code: "notFound" })
      error.message = "Server Error"
      let rejectCall!: (reason: unknown) => void
      mocks.call.mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectCall = reject
          }),
      )
      renderWithEngine(<RingRelationTrigger mediaType={mediaType} />)
      const button = screen.getByRole<HTMLButtonElement>("button", { name: "Appeler Aline Minko" })

      fireEvent.click(button)
      expect(mocks.call).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, target: { personId: ALINE }, mediaType })
      expect(button.disabled).toBe(true)

      await act(async () => {
        rejectCall(error)
      })

      expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
        "Cet appel n'est plus disponible ou ne vous est pas destiné.",
        { duration: 8000 },
      )
      expect(mocks.openOutgoingCall).not.toHaveBeenCalled()
      expect(mocks.openRefusedCall).not.toHaveBeenCalled()
      expect(button.disabled).toBe(false)
    },
  )

  it("un refus ouvre l'écran de FIN avec l'identité de l'appelé, jamais un toast", async () => {
    mocks.call.mockResolvedValue({ admitted: false, callId: "calls_1", reason: "busy", voicemailOffered: true })
    renderWithEngine(<RingRelationTrigger mediaType="audio" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Appeler Aline Minko" }))
    })

    expect(mocks.openRefusedCall).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        meetingId: "calls_1",
        mediaType: "audio",
        voicemailOffered: true,
        scope: "personnel",
        callee: { userId: ALINE, name: "Aline Minko", avatarUrl: null, handle: "aline.minko" },
      }),
    )
    expect(mocks.openOutgoingCall).not.toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it("un appel admis ouvre la fenêtre sortante sur l'appel, l'appelé et le média GRAVÉS par le serveur", async () => {
    mocks.call.mockResolvedValue({ admitted: true, callId: "calls_2", calleePersonId: ALINE, mediaType: "audio" })
    renderWithEngine(<RingRelationTrigger mediaType="video" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Appeler Aline Minko" }))
    })

    expect(mocks.openOutgoingCall).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        meetingId: "calls_2",
        participantUserId: ALINE,
        mediaType: "audio",
        scope: "personnel",
        callee: { userId: ALINE, name: "Aline Minko", avatarUrl: null, handle: "aline.minko" },
      }),
    )
    expect(mocks.openRefusedCall).not.toHaveBeenCalled()
  })
})
