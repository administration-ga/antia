// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { outboxStore } from "./messagerie-outbox"
import { AbandonedMessageSend, MessageSendInProgress } from "./messagerie-send-intent"
import { useConversationSend } from "./use-conversation-send"

const auth = vi.hoisted(() => ({ signingOut: false }))
vi.mock("@antsia/api/sign-out-everywhere", () => ({ isSigningOutEverywhere: () => auth.signingOut }))

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
	return { promise, resolve, reject }
}

afterEach(() => { auth.signingOut = false; outboxStore.__resetForTests() })
const payload = { text: "Bonjour", attachments: [], replyTo: null }

describe("Envoi raccordé à l'admission serveur", () => {
	it("montre pending jusqu'à la réponse, puis conserve le vrai messageId sans preuve de livraison inventée", async () => {
		const response = deferred<{ messageId: string }>()
		const hook = renderHook(() => useConversationSend("reader-one", "chat:one", true))
		let sending!: Promise<{ messageId: string }>
		act(() => { sending = hook.result.current.perform(payload, () => response.promise) })
		expect(outboxStore.forConversation("reader-one", "chat:one")).toMatchObject([{ text: "Bonjour", messageId: null }])
		await act(async () => { response.resolve({ messageId: "real-message" }); await sending })
		expect(outboxStore.forConversation("reader-one", "chat:one")).toMatchObject([{ messageId: "real-message" }])
		expect(outboxStore.forConversation("other-reader", "chat:one")).toEqual([])
	})
	it("réutilise la clé après un échec, et bloque une seconde surface pendant la première requête", async () => {
		const response = deferred<{ messageId: string }>()
		const first = renderHook(() => useConversationSend("reader-two", "chat:two", true))
		const second = renderHook(() => useConversationSend("reader-two", "chat:two", true))
		const keys: string[] = []
		const sending = first.result.current.perform(payload, (key) => { keys.push(key); return response.promise })
		await expect(second.result.current.perform(payload, async () => ({ messageId: "duplicate" }))).rejects.toBeInstanceOf(MessageSendInProgress)
		response.reject(new Error("network"))
		await expect(sending).rejects.toThrow("network")
		await first.result.current.perform(payload, async (key) => { keys.push(key); return { messageId: "real-message" } })
		expect(keys[0]).toBe(keys[1])
	})
	it("une réponse d'une conversation quittée ne réapparaît pas après un aller-retour", async () => {
		const response = deferred<{ messageId: string }>()
		const hook = renderHook(({ conversation }) => useConversationSend("reader-three", conversation, true), { initialProps: { conversation: "chat:old" } })
		const sending = hook.result.current.perform(payload, () => response.promise)
		hook.rerender({ conversation: "chat:new" })
		hook.rerender({ conversation: "chat:old" })
		response.resolve({ messageId: "late" })
		await expect(sending).rejects.toBeInstanceOf(AbandonedMessageSend)
		expect(outboxStore.forConversation("reader-three", "chat:old")).toEqual([])
	})
	it("une déconnexion commencée interdit l'adoption de la réponse", async () => {
		const response = deferred<{ messageId: string }>()
		const hook = renderHook(() => useConversationSend("reader-four", "chat:four", true))
		const sending = hook.result.current.perform(payload, () => response.promise)
		auth.signingOut = true
		response.resolve({ messageId: "late" })
		await expect(sending).rejects.toBeInstanceOf(AbandonedMessageSend)
		expect(outboxStore.forConversation("reader-four", "chat:four")).toEqual([])
	})
})
