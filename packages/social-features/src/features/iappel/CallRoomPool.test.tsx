// @vitest-environment jsdom

/**
 * P05 — le POOL de salles, monté une fois par la couche d'appel : ce qu'il
 * monte, ce qu'il ne remonte jamais, et ce qu'il libère.
 *
 *  · un appel AUDIO ne demande jamais la caméra ; un appel vidéo la demande ;
 *  · changer de thème, réduire l'appel, recevoir une nouvelle photographie du
 *    slot : la salle n'est PAS recréée (aucun remount) ;
 *  · un refus de micro laisse l'appel vivant, en écoute seule, et se réessaie ;
 *  · un appel TERMINÉ n'a plus de salle : elle est démontée, donc ses pistes
 *    arrêtées — et un jeton tardif ne remonte rien ;
 *  · l'établissement réel des médias est consigné une fois, jamais réécrit.
 *
 * LiveKit est doublé : on observe ce que le pool DEMANDE à la salle (props
 * `audio`/`video`, montage, démontage), pas un vrai serveur multimédia.
 */

import { act, cleanup } from "@testing-library/react"
import type { Id } from "@antsia/api/engine"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"

type RoomProps = {
	token: string
	audio: boolean
	video: boolean
	children?: ReactNode
	onMediaDeviceFailure?: (failure?: string, kind?: MediaDeviceKind) => void
}

const lk = vi.hoisted(() => ({
	mounts: [] as string[],
	unmounts: [] as string[],
	props: new Map<string, RoomProps>(),
	connectionState: "connected",
	remotes: [] as unknown[],
}))

vi.mock("@livekit/components-react", async () => {
	const React = await import("react")
	function LiveKitRoom(props: RoomProps) {
		lk.props.set(props.token, props)
		React.useEffect(() => {
			lk.mounts.push(props.token)
			return () => {
				lk.unmounts.push(props.token)
			}
			// Une salle par montage : le jeton ne change pas sous une même salle.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [])
		return React.createElement("div", { "data-room": props.token }, props.children)
	}
	const localParticipant = {
		identity: "moi",
		isMicrophoneEnabled: true,
		setMicrophoneEnabled: async () => undefined,
		setCameraEnabled: async () => undefined,
	}
	const room = { switchActiveDevice: async () => true }
	return {
		LiveKitRoom,
		RoomAudioRenderer: () => null,
		useConnectionState: () => lk.connectionState,
		useRemoteParticipants: () => lk.remotes,
		useLocalParticipant: () => ({ localParticipant, microphoneTrack: undefined }),
		useRoomContext: () => room,
	}
})
vi.mock("livekit-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("livekit-client")>()),
	supportsAudioOutputSelection: () => false,
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))

import { LIVEKIT_DIRECT_CALL_ROOM_OPTIONS } from "../../lib/livekit/room-options"
import { callStore, useCallStore } from "../../stores/call-store"
import { __resetCallEstablishmentsForTests, callEstablishedAt, callObservedConnection } from "./call-establishment"
import { CallRoomPool } from "./CallRoomMount"

const CALL = "call-audio" as Id<"calls">
const PEER = "persons_peer" as Id<"persons">

function Harness({ onDisconnected = () => undefined }: { onDisconnected?: (meetingId: Id<"calls">) => void }) {
	const { slots, activeSlotId } = useCallStore()
	return (
		<CallRoomPool
			slots={slots}
			activeSlotId={activeSlotId}
			options={LIVEKIT_DIRECT_CALL_ROOM_OPTIONS}
			onDisconnected={onDisconnected}
		/>
	)
}

function placeCall(mediaType: "audio" | "video", meetingId: Id<"calls"> = CALL) {
	act(() => {
		callStore.openOutgoingCall({ meetingId, participantUserId: PEER, mediaType, startedAt: 1 })
		callStore.hydrateSlot(meetingId, { token: `jeton-${meetingId}`, wsUrl: "wss-test", roomName: "salle", joinedAt: 2, mediaType })
	})
	return `jeton-${meetingId}`
}

beforeEach(() => {
	callStore.__resetForTests()
	__resetCallEstablishmentsForTests()
	lk.mounts = []
	lk.unmounts = []
	lk.props.clear()
	lk.connectionState = "connected"
	lk.remotes = []
	document.documentElement.classList.remove("dark")
})
afterEach(cleanup)

describe("ce que la salle demande", () => {
	it("un appel AUDIO ne demande jamais la caméra ; un appel vidéo la demande", () => {
		const audio = placeCall("audio")
		renderWithEngine(<Harness />)
		expect(lk.props.get(audio)).toMatchObject({ audio: true, video: false })

		act(() => callStore.__resetForTests())
		const video = placeCall("video", "call-video" as Id<"calls">)
		expect(lk.props.get(video)).toMatchObject({ audio: true, video: true })
	})

	it("aucun jeton, aucune salle : l'écran s'ouvre avant le réseau", () => {
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderWithEngine(<Harness />)
		expect(lk.mounts).toEqual([])
	})
})

describe("continuité — la salle n'est jamais recréée", () => {
	it("thème sombre, réduction, nouvelle photographie du slot : un seul montage", () => {
		const token = placeCall("audio")
		const view = renderWithEngine(<Harness />)
		act(() => {
			document.documentElement.classList.add("dark")
			callStore.setMinimized(true)
			callStore.setMinimized(false)
			callStore.reconcileSlotFromMeeting(CALL, { callKind: "direct", group: null })
			callStore.hydrateSlot(CALL, { token, wsUrl: "wss-test", roomName: "salle", joinedAt: 3 })
		})
		view.rerender(<Harness />)
		expect(lk.mounts).toEqual([token])
		expect(lk.unmounts).toEqual([])
	})
})

describe("permissions — refus récupérable", () => {
	it("micro refusé : l'appel continue en écoute seule, puis un nouvel appui le redemande", () => {
		const token = placeCall("audio")
		renderWithEngine(<Harness />)
		act(() => lk.props.get(token)?.onMediaDeviceFailure?.("PermissionDenied", "audioinput"))
		expect(callStore.getMicBlocked()).not.toBeNull()
		expect(callStore.getMicMuted()).toBe(true)
		expect(lk.props.get(token)?.audio).toBe(false)
		expect(lk.unmounts).toEqual([])
		act(() => callStore.setMicMuted(false))
		expect(lk.props.get(token)?.audio).toBe(true)
	})

	it("caméra refusée : l'intention s'éteint, la salle reste", () => {
		const token = placeCall("video")
		renderWithEngine(<Harness />)
		act(() => lk.props.get(token)?.onMediaDeviceFailure?.("PermissionDenied", "videoinput"))
		expect(callStore.getCameraEnabled()).toBe(false)
		expect(lk.props.get(token)?.video).toBe(false)
		expect(lk.unmounts).toEqual([])
	})
})

describe("fin — les pistes sont libérées", () => {
	it("un ancien refus de caméra ne modifie pas l'appel suivant", () => {
		const oldToken = placeCall("audio")
		renderWithEngine(<Harness />)
		const staleFailure = lk.props.get(oldToken)?.onMediaDeviceFailure
		act(() => callStore.markSlotEnded(CALL, "ended"))
		const nextToken = placeCall("video", "call-next" as Id<"calls">)
		act(() => staleFailure?.("PermissionDenied", "videoinput"))
		expect(callStore.getCameraEnabled()).toBe(true)
		expect(lk.props.get(nextToken)?.video).toBe(true)
	})

	it("un appel terminé (fin distante) démonte sa salle : plus de micro pendant l'écran de fin", () => {
		const token = placeCall("audio")
		renderWithEngine(<Harness />)
		act(() => callStore.markSlotEnded(CALL, "ended"))
		expect(lk.unmounts).toEqual([token])
		// Un jeton qui arrive APRÈS la fin ne remonte aucune salle.
		act(() => callStore.hydrateSlot(CALL, { token: "jeton-tardif", wsUrl: "wss-test" }))
		expect(lk.mounts).toEqual([token])
	})

	it("raccrocher retire le slot : la salle est démontée", () => {
		const token = placeCall("audio")
		renderWithEngine(<Harness />)
		act(() => callStore.removeSlot(CALL))
		expect(lk.unmounts).toEqual([token])
	})
})

describe("établissement réel des médias", () => {
	it("consigné quand la salle est connectée ET qu'un autre participant est là, une seule fois", () => {
		placeCall("audio")
		const view = renderWithEngine(<Harness />)
		expect(callEstablishedAt(CALL)).toBeNull()
		lk.remotes = [{ identity: "pair" }]
		act(() => callStore.setMinimized(true))
		view.rerender(<Harness />)
		const first = callEstablishedAt(CALL)
		expect(first).not.toBeNull()
		lk.connectionState = "reconnecting"
		lk.remotes = []
		act(() => callStore.setMinimized(false))
		view.rerender(<Harness />)
		expect(callEstablishedAt(CALL)).toBe(first)
		expect(callObservedConnection(CALL)).toBe("reconnecting")
		lk.connectionState = "connected"
		view.rerender(<Harness />)
		expect(callObservedConnection(CALL)).toBe("connected")
		expect(callEstablishedAt(CALL)).toBe(first)
	})

	it("l'appel qui quitte la ligne est oublié", () => {
		placeCall("audio")
		lk.remotes = [{ identity: "pair" }]
		renderWithEngine(<Harness />)
		expect(callEstablishedAt(CALL)).not.toBeNull()
		act(() => callStore.removeSlot(CALL))
		expect(callEstablishedAt(CALL)).toBeNull()
		expect(callObservedConnection(CALL)).toBe("connecting")
	})
})
