// @vitest-environment jsdom

/**
 * P05 — le connecteur ne ressuscite rien : un jeton (ou un échec) qui revient
 * après la fin, le raccrochage ou la purge de la ligne n'ouvre aucune salle et
 * n'écrit rien sur un appel qui n'attend plus. Et une double acceptation ne
 * remet ni l'état ni l'instant du décrochage à zéro.
 */

import type { Id } from "@antsia/api/engine"
import { act, cleanup, renderHook } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper } from "../../tests/engine-wrapper"

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((ok, ko) => {
		resolve = ok
		reject = ko
	})
	return { promise, resolve, reject }
}

const calls = vi.hoisted(() => ({
	join: [] as unknown[],
	token: [] as unknown[],
	leave: [] as unknown[],
	joinNext: null as Deferred<unknown> | null,
	tokenNext: null as Deferred<unknown> | null,
}))

vi.mock("@antsia/api/hooks", () => ({
	useConvexMutationQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(reference)
		return {
			isPending: false,
			mutateAsync: async (args: unknown) => {
				if (name.endsWith(":join")) {
					calls.join.push(args)
					return calls.joinNext === null ? { roomName: "salle", mediaType: "audio", callStatus: "ringing" } : await calls.joinNext.promise
				}
				if (name.endsWith(":leave")) calls.leave.push(args)
				return null
			},
		}
	},
	useConvexActionQuery: () => ({
		isPending: false,
		mutateAsync: async (args: unknown) => {
			calls.token.push(args)
			return calls.tokenNext === null ? { token: "jeton", wsUrl: "wss-test", roomName: "salle", mediaType: "audio" } : await calls.tokenNext.promise
		},
	}),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))

import { callStore } from "../../stores/call-store"
import { useCallSlotConnector } from "./use-call-slot-connector"
import { useIappelActions } from "./use-iappel-actions"

const CALL = "call-1" as Id<"calls">
const PEER = "persons_peer" as Id<"persons">

function slot() {
	return callStore.getSlots().find((candidate) => candidate.meetingId === CALL)
}

async function flush() {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()
	})
}

beforeEach(() => {
	callStore.__resetForTests()
	calls.join = []
	calls.token = []
	calls.leave = []
	calls.joinNext = null
	calls.tokenNext = null
})
afterEach(cleanup)

describe("useCallSlotConnector — jeton tardif", () => {
	it("un décrochage revenu après démontage ne demande plus de jeton", async () => {
		calls.joinNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		const view = renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		view.unmount()
		await act(async () => calls.joinNext?.resolve({ roomName: "salle", mediaType: "audio", callStatus: "ringing" }))
		await flush()
		expect(calls.token).toEqual([])
		expect(slot()?.token ?? null).toBeNull()
	})

	it("un ancien jeton n'hydrate pas une nouvelle entrée du même appel de groupe", async () => {
		const oldToken = deferred<unknown>()
		const newToken = deferred<unknown>()
		calls.tokenNext = oldToken
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		act(() => callStore.removeSlot(CALL))
		calls.tokenNext = newToken
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 2 }))
		await flush()
		expect(calls.token).toHaveLength(2)
		await act(async () => oldToken.resolve({ token: "ancienne-session", wsUrl: "wss-test", roomName: "salle", mediaType: "audio" }))
		await flush()
		expect(slot()?.token ?? null).toBeNull()
		await act(async () => newToken.resolve({ token: "nouvelle-session", wsUrl: "wss-test", roomName: "salle", mediaType: "audio" }))
		await flush()
		expect(slot()?.token).toBe("nouvelle-session")
	})

	it("un jeton revenu après démontage n'hydrate pas même un slot encore présent", async () => {
		calls.tokenNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		const view = renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		view.unmount()
		await act(async () => calls.tokenNext?.resolve({ token: "tardif", wsUrl: "wss-test", roomName: "salle", mediaType: "audio" }))
		await flush()
		expect(slot()?.token ?? null).toBeNull()
	})

	it("chemin nominal : décroche, demande le jeton, pose la salle", async () => {
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		expect(calls.join).toHaveLength(1)
		expect(calls.token).toHaveLength(1)
		expect(slot()?.token).toBe("jeton")
	})

	it("raccroché pendant le décrochage : aucun jeton n'est demandé", async () => {
		calls.joinNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		act(() => callStore.removeSlot(CALL))
		await act(async () => calls.joinNext?.resolve({ roomName: "salle", mediaType: "audio", callStatus: "ringing" }))
		await flush()
		expect(calls.token).toEqual([])
		expect(slot()).toBeUndefined()
	})

	it("terminé pendant la demande de jeton : le jeton tardif n'est posé nulle part", async () => {
		calls.tokenNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		expect(calls.token).toHaveLength(1)
		act(() => callStore.markSlotEnded(CALL, "declined"))
		await act(async () => calls.tokenNext?.resolve({ token: "tardif", wsUrl: "wss-test", roomName: "salle", mediaType: "audio" }))
		await flush()
		expect(slot()).toMatchObject({ status: "ended", endKind: "declined" })
		expect(slot()?.token ?? null).toBeNull()
	})

	it("un échec revenu après la purge de la ligne n'écrit aucune erreur ; vivant, il la dit", async () => {
		calls.tokenNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 1 }))
		renderHook(() => useCallSlotConnector(), { wrapper: EngineTestWrapper })
		await flush()
		act(() => callStore.removeSlot(CALL))
		await act(async () => calls.tokenNext?.reject(new Error("réseau")))
		await flush()
		expect(slot()).toBeUndefined()

		calls.tokenNext = deferred()
		act(() => callStore.openOutgoingCall({ meetingId: CALL, participantUserId: PEER, mediaType: "audio", startedAt: 2 }))
		await flush()
		await act(async () => calls.tokenNext?.reject({ data: { code: "notFound" } }))
		await flush()
		expect(slot()?.connectError).toBeTruthy()
	})
})

describe("useIappelActions — double acceptation", () => {
	it("une carte entrante périmée ne peut réaccepter un slot terminé", () => {
		const { result } = renderHook(() => useIappelActions(), { wrapper: EngineTestWrapper })
		act(() => result.current.answer({ meetingId: CALL, mediaType: "audio" }))
		act(() => callStore.markSlotEnded(CALL, "ended"))
		act(() => result.current.answer({ meetingId: CALL, mediaType: "video" }))
		expect(slot()).toMatchObject({ status: "ended", endKind: "ended", mediaType: "audio" })
		expect(callStore.getCameraEnabled()).toBe(false)
	})

	it("quitter un groupe retire ma salle et appelle leave sans toucher l'autre appel", async () => {
		const other = "call-other" as Id<"calls">
		const { result } = renderHook(() => useIappelActions(), { wrapper: EngineTestWrapper })
		act(() => result.current.answer({ meetingId: other, mediaType: "audio" }))
		act(() => result.current.answer({ meetingId: CALL, mediaType: "audio", callKind: "group", group: { title: "Groupe", memberCount: 3 } }))
		await act(async () => result.current.hangUp(CALL))
		expect(slot()).toBeUndefined()
		expect(callStore.getSlots().map((entry) => entry.meetingId)).toEqual([other])
		expect(calls.leave).toEqual([{ networkId: expect.any(String), callId: CALL, intentional: true }])
	})

	it("décrocher deux fois ne remet ni « Connexion… » ni l'instant du décrochage à zéro", () => {
		const { result } = renderHook(() => useIappelActions(), { wrapper: EngineTestWrapper })
		vi.useFakeTimers()
		vi.setSystemTime(1_000)
		act(() => result.current.answer({ meetingId: CALL, mediaType: "audio" }))
		act(() => callStore.hydrateSlot(CALL, { token: "jeton", wsUrl: "wss-test" }))
		act(() => callStore.upsertSlot({ meetingId: CALL, status: "active" }))
		vi.setSystemTime(9_000)
		act(() => result.current.answer({ meetingId: CALL, mediaType: "audio" }))
		vi.useRealTimers()
		expect(slot()).toMatchObject({ status: "active", answeredAt: 1_000, token: "jeton" })
		expect(callStore.getActiveSlotId()).toBe(CALL)
	})

	it("un appel audio décroché en audio n'allume pas la caméra ; « Répondre en vidéo » l'allume", () => {
		const { result } = renderHook(() => useIappelActions(), { wrapper: EngineTestWrapper })
		act(() => result.current.answer({ meetingId: CALL, mediaType: "audio" }))
		expect(callStore.getCameraEnabled()).toBe(false)
		act(() => callStore.__resetForTests())
		act(() => result.current.answer({ meetingId: CALL, mediaType: "video" }))
		expect(callStore.getCameraEnabled()).toBe(true)
	})
})
