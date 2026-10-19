// @vitest-environment jsdom

/**
 * P18b (A05) — l'appel qui sonne :
 *
 *  · s'ANNONCE par la région polie persistante de l'hôte (qui appelle, rien
 *    de plus), sur toutes les poses, et la région se vide à la fin de la
 *    sonnerie ;
 *  · au TÉLÉPHONE, la carte plein écran est une MODALE : dialogue nommé,
 *    focus sur « Répondre », Échap sans effet (il ne refuse jamais l'appel).
 */

import type { Id } from "@antsia/api/engine"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"

const state = vi.hoisted(() => ({
	mobile: true,
	primary: null as unknown,
	dismiss: vi.fn(),
	declined: vi.fn(),
}))

vi.mock("@antsia/api/hooks", () => ({
	useAuthenticatedConvexQuery: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() }),
	useConvexMutationQuery: (reference: Parameters<typeof getFunctionName>[0]) => ({
		isPending: false,
		mutateAsync: async () => {
			if (getFunctionName(reference).endsWith(":decline")) state.declined()
			return null
		},
	}),
}))
vi.mock("@antsia/ui/overlay", () => ({ useIsReseauMobile: () => state.mobile }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock("../../features/iappel/CallRoomMount", () => ({ CallRoomPool: () => null }))
vi.mock("../../features/iappel/CallSurface", () => ({
	CallSurface: ({ children }: { children?: ReactNode }) => <div data-testid="surface">{children}</div>,
}))
vi.mock("../../features/iappel/CallStage", () => ({ CallStage: () => null }))
vi.mock("../../features/iappel/CallEndScreen", () => ({ CallEndScreen: () => null }))
vi.mock("../../features/iappel/AddToCallPanel", () => ({ AddToCallPanel: () => null }))
vi.mock("../../features/iappel/CallWaitingChip", () => ({ CallWaitingChip: () => null }))
vi.mock("../../features/iappel/HeldCallChips", () => ({ HeldCallChips: () => null }))
vi.mock("../../features/iappel/IncomingCallBanner", () => ({ IncomingCallBanner: () => <div data-testid="banner" /> }))
// La carte doublée garde ce que la couche cherche : la commande « Répondre » (ton `answer`).
vi.mock("../../features/iappel/IncomingCallCard", () => ({
	IncomingCallCard: ({ onDecline }: { onDecline: () => void }) => (
		<div data-testid="incoming-card">
			<button type="button">Message</button>
			<button type="button" onClick={() => onDecline()}>
				<span className="iappel-ctl" data-tone="hangup" />
				Refuser
			</button>
			<button type="button">
				<span className="iappel-ctl" data-tone="answer" />
				Répondre
			</button>
		</div>
	),
}))
vi.mock("../../features/iappel/VoicemailRecorder", () => ({ VoicemailRecorder: () => null }))
vi.mock("../../features/iappel/use-call-slot-connector", () => ({ useCallSlotConnector: () => undefined }))
vi.mock("../../features/iappel/use-call-line-sync", () => ({ useCallLineSync: () => undefined }))
vi.mock("../../features/iappel/use-incoming-calls", () => ({
	useIncomingCalls: () => ({
		primary: state.primary,
		secondary: [],
		audible: null,
		callWaiting: false,
		vibrate: false,
		quickReplies: [],
		dismiss: state.dismiss,
		audioBlocked: false,
	}),
}))
vi.mock("../../features/iappel/hooks/use-ringtone-muted-pref", () => ({
	useRingtoneMutedPref: () => ({ muted: false, vibrate: true, toggle: vi.fn(), setMuted: vi.fn(), setVibrate: vi.fn() }),
}))
vi.mock("../../lib/livekit/audio-unlock", () => ({ installAudioUnlock: () => () => undefined }))
vi.mock("../../lib/livekit/use-busy-tone", () => ({ useBusyTone: () => undefined }))
vi.mock("../../lib/livekit/use-hold-tone", () => ({ useHoldTone: () => undefined }))
vi.mock("../../lib/livekit/use-ringback", () => ({ useRingback: () => undefined }))

import { callStore } from "../../stores/call-store"
import { CALL_ANNOUNCER_ATTRIBUTE } from "../../features/iappel/use-call-announcer"
import { GlobalCallSurfaceHost } from "./global-call-surface-host"

const RINGING = {
	meetingId: "call-2" as Id<"calls">,
	kind: "direct" as const,
	group: null,
	scope: "personnel" as const,
	caller: { userId: "persons_awa" as Id<"persons">, name: "Awa", handle: "awa.demo" },
	mediaType: "audio" as const,
	ringingSince: 1,
}

const announcer = () => document.querySelector(`[${CALL_ANNOUNCER_ATTRIBUTE}]`)

beforeEach(() => {
	callStore.__resetForTests()
	state.mobile = true
	state.primary = null
	state.dismiss.mockReset()
	state.declined.mockReset()
})
afterEach(cleanup)

describe("appel entrant au téléphone (P18b, A05)", () => {
	it("la carte est une modale nommée, le focus est sur « Répondre », et Échap ne refuse pas l'appel", () => {
		state.primary = RINGING
		renderWithEngine(<GlobalCallSurfaceHost />)

		const dialog = screen.getByRole("dialog", { name: "Appel entrant de Awa" })
		expect(dialog).toHaveAttribute("aria-modal", "true")
		expect(dialog).toContainElement(screen.getByTestId("incoming-card"))
		expect(dialog.parentElement).toBe(document.body)
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "Répondre" }))

		fireEvent.keyDown(document, { key: "Escape" })

		expect(screen.getByRole("dialog", { name: "Appel entrant de Awa" })).toBeInTheDocument()
		expect(state.dismiss).not.toHaveBeenCalled()
		expect(state.declined).not.toHaveBeenCalled()
	})

	it("l'appel s'annonce par la région persistante, qui se vide quand plus rien ne sonne", () => {
		state.primary = RINGING
		const view = renderWithEngine(<GlobalCallSurfaceHost />)

		const region = announcer()
		expect(region).not.toBeNull()
		expect(region).toHaveAttribute("aria-live", "polite")
		expect(region?.textContent).toBe("Appel entrant de Awa")

		state.primary = null
		act(() => {
			view.rerender(<GlobalCallSurfaceHost />)
		})
		expect(announcer()?.textContent).toBe("")
		expect(screen.queryByRole("dialog")).toBeNull()
	})
})

describe("appel entrant au bureau (P18b, A05)", () => {
	it("la bannière ne vole pas le focus ; l'annonce dit l'appel vidéo, sans dialogue", () => {
		state.mobile = false
		state.primary = { ...RINGING, mediaType: "video" as const }
		const before = document.activeElement
		renderWithEngine(<GlobalCallSurfaceHost />)

		expect(screen.getByTestId("banner")).toBeInTheDocument()
		expect(screen.queryByRole("dialog")).toBeNull()
		expect(document.activeElement).toBe(before)
		expect(announcer()?.textContent).toBe("Appel vidéo entrant de Awa")
	})

	it("la région d'annonce disparaît avec l'hôte", () => {
		state.primary = RINGING
		const view = renderWithEngine(<GlobalCallSurfaceHost />)
		expect(announcer()).not.toBeNull()
		view.unmount()
		expect(announcer()).toBeNull()
	})
})
