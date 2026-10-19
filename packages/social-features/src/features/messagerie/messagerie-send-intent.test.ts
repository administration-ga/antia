import { describe, expect, it, vi } from "vitest"
import { createSendIntentBook, sendIntentFor, type SendIntentPayload } from "./messagerie-send-intent"

const payload: SendIntentPayload = { conversation: "network:person:chat:one", text: "Bonjour", attachments: [], replyTo: null }

describe("Intention d'envoi P05", () => {
	it("garde la clé du retry, mais renouvelle une intention dont le texte, la citation ou la pièce change", () => {
		const key = vi.fn().mockReturnValueOnce("one").mockReturnValueOnce("two").mockReturnValueOnce("three").mockReturnValueOnce("four")
		const first = sendIntentFor(null, payload, key)
		expect(sendIntentFor(first, { ...payload }, key)).toBe(first)
		const other = sendIntentFor(first, { ...payload, text: "Autre message" }, key)
		expect(other.key).toBe("two")
		expect(sendIntentFor(other, { ...payload, replyTo: "message-replied" }, key).key).toBe("three")
		expect(sendIntentFor(first, { ...payload, attachments: [{ storageId: "voice", durationMs: 3000 }] }, key).key).toBe("four")
	})
	it("une même pièce avec une autre durée est une intention différente", () => {
		const first = sendIntentFor(null, { ...payload, attachments: [{ storageId: "voice", durationMs: 3000 }] }, () => "one")
		expect(sendIntentFor(first, { ...payload, attachments: [{ storageId: "voice", durationMs: 4000 }] }, () => "two").key).toBe("two")
	})
	it("verrouille le double appui entre surfaces et permet le même contenu après une admission", () => {
		const book = createSendIntentBook()
		const first = book.begin(payload, () => "one")!
		expect(book.begin(payload, () => "should-not-exist")).toBeNull()
		book.settle(payload.conversation, first.key, false)
		expect(book.begin(payload, () => "should-not-exist")?.key).toBe("one")
		book.settle(payload.conversation, first.key, true)
		expect(book.begin(payload, () => "two")?.key).toBe("two")
	})
	it("une réponse ancienne ne libère pas l'envoi plus récent", () => {
		const book = createSendIntentBook()
		book.begin(payload, () => "one")
		book.settle(payload.conversation, "one", true)
		book.begin(payload, () => "two")
		book.settle(payload.conversation, "one", false)
		expect(book.begin(payload, () => "three")).toBeNull()
	})
})
