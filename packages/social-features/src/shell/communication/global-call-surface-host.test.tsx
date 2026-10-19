// @vitest-environment jsdom

/**
 * P05 — l'hôte UNIQUE de la couche d'appel, monté avec ses vraies règles
 * (magasin, plan de surface, machine d'états, gestes) et des surfaces doublées.
 *
 *  · FIN DISTANTE : le serveur dit « terminé » → le slot l'est aussi, l'écran
 *    de fin s'affiche, et une fermeture de salle tardive ne raccroche ni ne
 *    referme rien ;
 *  · REFUS D'ADMISSION (occupé…) : l'écran de fin est VISIBLE ;
 *  · ÉTABLISSEMENT : l'écran d'appel reçoit l'instant réel des médias ;
 *  · DÉCONNEXION : démonter la couche raccroche au serveur et vide la ligne —
 *    aucune reprise par une session suivante.
 */

import type { Id } from "@antsia/api/engine"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { StrictMode, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"

const host = vi.hoisted(() => ({
	call: undefined as unknown,
	byCall: new Map<string, unknown>(),
	placeNext: null as Promise<unknown> | null,
	mutations: [] as { name: string; args: unknown }[],
	pool: null as null | { slots: readonly { meetingId: string; status: string }[]; onDisconnected: (meetingId: string) => void },
}))

vi.mock("@antsia/api/hooks", () => ({
	useAuthenticatedConvexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
		const name = getFunctionName(reference)
		const callId = typeof args === "object" && args !== null && "callId" in args ? String(args.callId) : ""
		const data = args === "skip" ? undefined : name.endsWith(":getCall") ? host.byCall.has(callId) ? host.byCall.get(callId) : host.call : undefined
		return { data, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() }
	},
	useConvexMutationQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(reference)
		return {
			isPending: false,
			mutateAsync: async (args: unknown) => {
				host.mutations.push({ name, args })
				if (name.endsWith(":callMember") && host.placeNext !== null) return await host.placeNext
				return null
			},
		}
	},
}))
vi.mock("@antsia/ui/overlay", () => ({ useIsReseauMobile: () => true }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock("../../features/iappel/CallRoomMount", () => ({
	CallRoomPool: (props: { slots: readonly { meetingId: string; status: string }[]; onDisconnected: (meetingId: string) => void }) => {
		host.pool = props
		return null
	},
}))
vi.mock("../../features/iappel/CallSurface", () => ({
	CallSurface: ({ children, pillState }: { children?: ReactNode; pillState?: { label: string; timerStart: number | null } }) => <div data-testid="surface" data-label={pillState?.label} data-timer={pillState?.timerStart}>{children}</div>,
}))
vi.mock("../../features/iappel/CallStage", () => ({
	CallStage: (props: { establishedAt?: number | null; onHangUp: () => void; children?: ReactNode }) => (
		<div data-testid="stage" data-established={props.establishedAt === undefined ? "absent" : String(props.establishedAt)}>
			<button type="button" onClick={props.onHangUp}>raccrocher</button>
			{props.children}
		</div>
	),
}))
vi.mock("../../features/iappel/CallEndScreen", () => ({
	CallEndScreen: (props: { kind: string; onClose: () => void; onRetry?: () => void; retryAvailable?: boolean }) => (
		<div data-testid="end" data-kind={props.kind}>
			<button type="button" onClick={props.onClose}>fermer</button>
			{props.retryAvailable && <button type="button" onClick={props.onRetry}>rappeler</button>}
		</div>
	),
}))
vi.mock("../../features/iappel/AddToCallPanel", () => ({ AddToCallPanel: () => null }))
vi.mock("../../features/iappel/CallWaitingChip", () => ({ CallWaitingChip: () => null }))
vi.mock("../../features/iappel/HeldCallChips", () => ({ HeldCallChips: () => null }))
vi.mock("../../features/iappel/IncomingCallBanner", () => ({ IncomingCallBanner: () => null }))
vi.mock("../../features/iappel/IncomingCallCard", () => ({ IncomingCallCard: () => null }))
vi.mock("../../features/iappel/VoicemailRecorder", () => ({ VoicemailRecorder: () => null }))
vi.mock("../../features/iappel/use-call-slot-connector", () => ({ useCallSlotConnector: () => undefined }))
vi.mock("../../features/iappel/use-call-line-sync", () => ({ useCallLineSync: () => undefined }))
vi.mock("../../features/iappel/use-incoming-calls", () => ({
	useIncomingCalls: () => ({ primary: null, secondary: [], audible: null, callWaiting: false, vibrate: false, quickReplies: [], dismiss: vi.fn(), audioBlocked: false }),
}))
vi.mock("../../features/iappel/hooks/use-ringtone-muted-pref", () => ({
	useRingtoneMutedPref: () => ({ muted: false, vibrate: true, toggle: vi.fn(), setMuted: vi.fn(), setVibrate: vi.fn() }),
}))
vi.mock("../../lib/livekit/audio-unlock", () => ({ installAudioUnlock: () => () => undefined }))
vi.mock("../../lib/livekit/use-busy-tone", () => ({ useBusyTone: () => undefined }))
vi.mock("../../lib/livekit/use-hold-tone", () => ({ useHoldTone: () => undefined }))
vi.mock("../../lib/livekit/use-ringback", () => ({ useRingback: () => undefined }))

import { callStore } from "../../stores/call-store"
import { __resetCallEstablishmentsForTests, markCallEstablished, observeCallConnection } from "../../features/iappel/call-establishment"
import { GlobalCallSurfaceHost } from "./global-call-surface-host"

const CALL = "call-1" as Id<"calls">
const PEER = "persons_peer" as Id<"persons">

function liveCall() {
	act(() => {
		callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1, callee: { userId: PEER, name: "Awa", handle: "awa.demo" } })
		callStore.hydrateSlot(CALL, { token: "jeton", wsUrl: "wss-test", roomName: "salle", joinedAt: 2 })
	})
}

function callDoc(over: Record<string, unknown>) {
	return {
		_id: CALL, kind: "direct", status: "active", callStatus: "connected", mediaType: "audio",
		createdByPersonId: "persons_me", calleePersonId: PEER, answeredAt: 10, calleeEngagedAtCreate: false,
		endReason: null, heldBy: [], declineNote: null, groupThreadId: null, participantCount: 2, title: null,
		startedAt: 1, endedAt: null, ...over,
	}
}

function leaves() {
	return host.mutations.filter((mutation) => mutation.name.endsWith(":leave"))
}

beforeEach(() => {
	callStore.__resetForTests()
	__resetCallEstablishmentsForTests()
	host.call = undefined
	host.byCall.clear()
	host.placeNext = null
	host.mutations = []
	host.pool = null
})
afterEach(cleanup)

describe("fin distante", () => {
	it("une lecture serveur devenue indisponible ferme aussi les médias", () => {
		liveCall()
		host.call = null
		renderWithEngine(<GlobalCallSurfaceHost />)
		expect(callStore.getSlots()).toMatchObject([{ meetingId: CALL, status: "ended", endKind: "error" }])
	})

	it("un appel parqué terminé sur le serveur quitte la ligne sans fermer l'actif", () => {
		const held = "call-held" as Id<"calls">
		act(() => callStore.openOutgoingCall({ meetingId: held, participantUserId: PEER, mediaType: "audio", startedAt: 0 }))
		liveCall()
		host.call = callDoc({})
		host.byCall.set(held, callDoc({ _id: held, status: "ended", callStatus: "ended", endReason: "normal" }))
		renderWithEngine(<GlobalCallSurfaceHost />)
		expect(callStore.getSlots().map((slot) => slot.meetingId)).toEqual([CALL])
		expect(callStore.getActiveSlotId()).toBe(CALL)
		expect(leaves()).toEqual([])
	})

	it("le serveur dit « terminé » : le slot l'est, l'écran de fin s'affiche, la salle n'est plus demandée", () => {
		liveCall()
		host.call = callDoc({})
		const view = renderWithEngine(<GlobalCallSurfaceHost />)
		expect(screen.getByTestId("stage")).toBeInTheDocument()
		host.call = callDoc({ status: "ended", callStatus: "ended", endReason: "normal", endedAt: 50 })
		view.rerender(<GlobalCallSurfaceHost />)
		expect(callStore.getSlots()).toMatchObject([{ meetingId: CALL, status: "ended", endKind: "ended" }])
		expect(screen.getByTestId("end")).toHaveAttribute("data-kind", "ended")
		expect(host.pool?.slots.map((slot) => slot.status)).toEqual(["ended"])
	})

	it("une fermeture de salle APRÈS la fin ne raccroche rien et ne referme pas l'écran de fin", () => {
		liveCall()
		host.call = callDoc({ status: "ended", callStatus: "declined", endReason: "declined", endedAt: 50 })
		renderWithEngine(<GlobalCallSurfaceHost />)
		act(() => host.pool?.onDisconnected(CALL))
		expect(leaves()).toEqual([])
		expect(screen.getByTestId("end")).toHaveAttribute("data-kind", "declined")
		fireEvent.click(screen.getByText("fermer"))
		expect(callStore.getSlots()).toEqual([])
	})

	it("une salle qui tombe PENDANT l'appel, elle, raccroche (perte réseau définitive)", () => {
		liveCall()
		host.call = callDoc({})
		renderWithEngine(<GlobalCallSurfaceHost />)
		act(() => host.pool?.onDisconnected(CALL))
		expect(leaves()).toHaveLength(1)
		expect(callStore.getSlots()).toEqual([])
	})
})

describe("refus d'admission", () => {
	it("« Occupé » à l'admission : l'écran de fin est VISIBLE, avec sa raison", () => {
		act(() => callStore.openRefusedCall({ meetingId: CALL, mediaType: "audio", endKind: "busy", callee: { userId: PEER, name: "Awa" } }))
		renderWithEngine(<GlobalCallSurfaceHost />)
		expect(screen.getByTestId("end")).toHaveAttribute("data-kind", "busy")
	})
})

describe("établissement réel", () => {
	it("la pilule suit la reconnexion de la salle sans remettre sa durée à zéro", () => {
		liveCall()
		host.call = callDoc({})
		renderWithEngine(<GlobalCallSurfaceHost />)
		act(() => { markCallEstablished(CALL, 1234); observeCallConnection(CALL, "connected") })
		expect(screen.getByTestId("surface")).toHaveAttribute("data-label", "En communication")
		act(() => observeCallConnection(CALL, "reconnecting"))
		expect(screen.getByTestId("surface")).toHaveAttribute("data-label", "Reconnexion…")
		expect(screen.getByTestId("surface")).toHaveAttribute("data-timer", "1234")
	})

	it("l'écran d'appel reçoit l'instant où les médias passent — `null` avant", () => {
		liveCall()
		host.call = callDoc({})
		renderWithEngine(<GlobalCallSurfaceHost />)
		expect(screen.getByTestId("stage")).toHaveAttribute("data-established", "null")
		act(() => {
			markCallEstablished(CALL, 1234)
		})
		expect(screen.getByTestId("stage")).toHaveAttribute("data-established", "1234")
	})
})

describe("déconnexion — la couche démontée ferme définitivement", () => {
	it("le nettoyage simulé de StrictMode ne raccroche ni ne purge l'appel", async () => {
		liveCall()
		host.call = callDoc({})
		const view = renderWithEngine(<StrictMode><GlobalCallSurfaceHost /></StrictMode>)
		await act(async () => { await Promise.resolve() })
		expect(leaves()).toEqual([])
		expect(callStore.getSlots().map((slot) => slot.meetingId)).toEqual([CALL])
		await act(async () => { view.unmount(); await Promise.resolve() })
		expect(leaves()).toHaveLength(1)
	})

	it("un rappel admis après démontage est quitté sans rouvrir une salle", async () => {
		let resolve!: (value: unknown) => void
		host.placeNext = new Promise((done) => { resolve = done })
		// P10 (`callEndActions`) : sans projection lisible de l'appel, aucun rappel n'est offert.
		// Le refus « occupé » d'un appel PERSONNEL, tel que le serveur l'enregistre (`insertRefusedCall`).
		host.call = callDoc({ status: "ended", callStatus: "declined", endReason: "busy", answeredAt: null, endedAt: 1 })
		act(() => callStore.openRefusedCall({ meetingId: CALL, mediaType: "audio", endKind: "busy", callee: { userId: PEER, name: "Awa" } }))
		const view = renderWithEngine(<GlobalCallSurfaceHost />)
		fireEvent.click(screen.getByText("rappeler"))
		await act(async () => { view.unmount(); await Promise.resolve() })
		await act(async () => { resolve({ admitted: true, callId: "call-late" }); await Promise.resolve() })
		expect(callStore.getSlots()).toEqual([])
		expect(leaves()).toEqual([{ name: expect.stringMatching(/:leave$/), args: { networkId: expect.any(String), callId: "call-late", intentional: true } }])
	})

	it("raccroche chaque appel vivant au serveur, vide la ligne et la fenêtre sortante", async () => {
		liveCall()
		host.call = callDoc({})
		const view = renderWithEngine(<GlobalCallSurfaceHost />)
		await act(async () => { view.unmount(); await Promise.resolve() })
		expect(leaves()).toEqual([{ name: expect.stringMatching(/:leave$/), args: { networkId: expect.any(String), callId: CALL, intentional: true } }])
		expect(callStore.getSlots()).toEqual([])
		expect(callStore.getOutgoingCallWindow()).toBeNull()
	})

	it("un appel déjà terminé n'est pas raccroché une seconde fois au démontage", async () => {
		act(() => callStore.openRefusedCall({ meetingId: CALL, mediaType: "audio", endKind: "dnd" }))
		const view = renderWithEngine(<GlobalCallSurfaceHost />)
		await act(async () => { view.unmount(); await Promise.resolve() })
		expect(leaves()).toEqual([])
		expect(callStore.getSlots()).toEqual([])
	})

	it("raccrocher depuis l'écran libère la ligne et prévient le serveur", () => {
		liveCall()
		host.call = callDoc({})
		renderWithEngine(<GlobalCallSurfaceHost />)
		fireEvent.click(screen.getByText("raccrocher"))
		expect(callStore.getSlots()).toEqual([])
		expect(leaves()).toHaveLength(1)
	})
})
