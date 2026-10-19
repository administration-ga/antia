import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: {
	commercialMessaging: {
		threads: { getThread: "thread", paginateMyThreads: "mine", paginateShopThreads: "shop", decideRequest: "decide", setThreadBlock: "block", close: "close", markRead: "read" },
		messages: { paginateMessages: "messages", sendMessage: "send", removeMessage: "remove", generateUploadUrl: "upload" },
		calls: { setCallConsent: "consent", startCall: "call" },
	}, moderation: { cases: { report: "report" } },
} } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (reference: unknown, args: unknown) => state.query(reference, args) }))
vi.mock("@antsia/api/network", () => ({ useNetwork: () => ({ networkId: "network-fixture" }) }))
vi.mock("convex/react", () => ({ useMutation: (reference: unknown) => (args: unknown) => state.mutation(reference, args) }))

import { COMMERCIAL_MESSAGING_SOURCE as source, orderedCommercialMessages, type CommercialMessage, type CommercialShopId, type CommercialThreadId } from "./commercial-messaging-source"

const threadId = "commercial-thread" as CommercialThreadId
function message(id: string, at: number, content = id): CommercialMessage {
	return { messageId: id as CommercialMessage["messageId"], senderPersonId: "person" as CommercialMessage["senderPersonId"], senderKind: "requester", sender: { displayName: null, handle: null }, isMine: true, content, deleted: false, withheld: false, attachmentFiles: [], createdAt: at }
}
beforeEach(() => { state.query.mockReset().mockReturnValue({ data: undefined }); state.mutation.mockReset().mockResolvedValue(null) })

describe("source commerciale autonome", () => {
	it("n'arme qu'une boîte et injecte le réseau dans ses pages bornées", () => {
		source.useThreads(undefined, " question ", null)
		expect(state.query.mock.calls).toEqual([["mine", { networkId: "network-fixture", query: "question", paginationOpts: { cursor: null, numItems: 25 } }], ["shop", "skip"]])
		state.query.mockClear()
		source.useThreads("commercial-shop" as CommercialShopId, "", "next-page")
		expect(state.query.mock.calls).toEqual([["mine", "skip"], ["shop", { networkId: "network-fixture", shopId: "commercial-shop", query: "", paginationOpts: { cursor: "next-page", numItems: 25 } }]])
	})
	it("ferme les messages avant disponibilité du fil et écrit avec ses propres identifiants", async () => {
		source.useMessages(threadId, null, false)
		expect(state.query).toHaveBeenCalledWith("messages", "skip")
		const writes = source.useWrites()
		await writes.decide({ threadId, expectedRevision: 3, decision: "accept" })
		await writes.call({ threadId, mediaType: "audio" })
		expect(state.mutation.mock.calls).toEqual([["decide", { networkId: "network-fixture", threadId, expectedRevision: 3, decision: "accept" }], ["call", { networkId: "network-fixture", threadId, mediaType: "audio" }]])
	})
	it("ordonne sans muter la page et conserve la dernière projection d'un même message", () => {
		const rows = [message("b", 20), message("a", 10), message("b", 20, "updated")]
		const ordered = orderedCommercialMessages(rows)
		expect(ordered.map((row) => [row.messageId, row.content])).toEqual([["a", "a"], ["b", "updated"]])
		expect(rows.map((row) => row.messageId)).toEqual(["b", "a", "b"])
	})
})
