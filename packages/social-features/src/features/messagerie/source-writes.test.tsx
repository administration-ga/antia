// @vitest-environment jsdom
// PA6 : l’adaptateur d’écriture choisit la boîte et le réseau, tandis que la
// conversation garde ses gestes, clés idempotentes, brouillons et refus.
import { api, type Id } from "@antsia/api/engine"
import { NetworkProvider } from "@antsia/api/network"
import { act, renderHook } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, renderWithEngine, TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import type { MessageComposerProps } from "./MessageComposer"

const mocks = vi.hoisted(() => ({
	registered: [] as string[],
	calls: [] as { name: string; args: unknown }[],
	results: new Map<string, unknown>(),
	errors: new Map<string, unknown>(),
	mutations: new Map<string, { mutateAsync: (args: unknown) => Promise<unknown>; isPending: boolean }>(),
	composer: null as MessageComposerProps | null,
	group: false,
	empty: [] as unknown[],
	groupData: { title: "Équipe", myRole: "member", memberCount: 2, activeCall: null, pinnedMessage: null },
}))

vi.mock("@antsia/api/hooks", () => ({
	useConvexMutationQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(reference)
		mocks.registered.push(name)
		let mutation = mocks.mutations.get(name)
		if (mutation === undefined) {
			mutation = {
				isPending: false,
				mutateAsync: async (args: unknown) => {
					mocks.calls.push({ name, args })
					if (mocks.errors.has(name)) throw mocks.errors.get(name)
					return mocks.results.get(name) ?? null
				},
			}
			mocks.mutations.set(name, mutation)
		}
		return mutation
	},
	useAuthenticatedConvexQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(reference)
		const data = name.endsWith(":getGroupThread") && mocks.group
			? mocks.groupData
			: name.endsWith(":listTyping") || name.endsWith(":listGroupTyping") ? mocks.empty : undefined
		return { data, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() }
	},
}))
vi.mock("convex/react", async (importOriginal) => ({
	...await importOriginal<typeof import("convex/react")>(),
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	usePaginatedQuery: () => ({ results: mocks.empty, status: "Exhausted", loadMore: vi.fn() }),
}))
vi.mock("@antsia/ui/overlay", () => ({ useVisualViewport: () => undefined }))
vi.mock("../iappel/presence-dot", () => ({
	useConnectionsPresence: () => ({ presenceOf: () => null }),
	PresenceDot: () => null,
}))
vi.mock("../iappel/use-launch-conference", () => ({
	useConferenceLaunchAvailable: () => false,
	useLaunchConference: () => vi.fn(),
}))
vi.mock("./use-draft-existing-thread", () => ({ useOpenExistingThreadForDraft: () => undefined }))
vi.mock("./MessageComposer", () => ({ MessageComposer: (props: MessageComposerProps) => {
	mocks.composer = props
	return <div data-testid="composer" />
} }))
vi.mock("./ConversationHeader", () => ({ ConversationHeader: () => null }))
vi.mock("./messagerie-styles", () => ({ MessagerieStyles: () => null }))
vi.mock("./MessagerieGroupeInfos", () => ({ MessagerieGroupeInfos: () => null }))
vi.mock("./ForwardMessageSheet", () => ({ ForwardMessageSheet: () => null }))
vi.mock("./NewMessagesPill", () => ({ NewMessagesPill: () => null }))

import { useDockState } from "./dock-store"
import { MessagerieConversationView } from "./MessagerieConversationView"
import { SOURCE_AGENT, type MessageWrites, type MessagerieSource } from "./messagerie-source"

const DIRECT_THREAD = "thread-direct" as Id<"personalThreads">
const GROUP_THREAD = "thread-group" as Id<"groupThreads">
const SEND = getFunctionName(api.modules.messaging.messages.sendMessage)
const GROUP_SEND = getFunctionName(api.modules.groups.messages.sendGroupMessage)
const UPLOAD = getFunctionName(api.modules.messaging.messages.generateAttachmentUploadUrl)
const GROUP_UPLOAD = getFunctionName(api.modules.groups.messages.generateAttachmentUploadUrl)
const FORWARD = getFunctionName(api.modules.messaging.forward.forwardMessage)

function writesForConversation(): { -readonly [Key in keyof MessageWrites]: MessageWrites[Key] } {
	const { result, unmount } = renderHook(() => SOURCE_AGENT.useMessageWrites(), { wrapper: EngineTestWrapper })
	const writes = result.current
	unmount()
	return writes
}

function injectedSource(writes: MessageWrites): MessagerieSource {
	return {
		...SOURCE_AGENT,
		useMessageWrites: () => writes,
		useThreads: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn(), isFetching: false, enabled: true }),
		useThreadById: () => ({ data: undefined, isLoading: false, isError: false, enabled: false }),
		useGroupThreads: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn(), isFetching: false, enabled: true }),
		useStartCall: () => ({ isPending: false, appeler: async () => { throw new Error("appel hors recette") } }),
	}
}

function mountConversation(writes: MessageWrites, kind: "chat" | "groupe" | "draft" = "chat") {
	mocks.group = kind === "groupe"
	mocks.registered = []
	return renderWithEngine(<MessagerieConversationView
		conversationKey={kind === "draft" ? "draft:awa.demo" : kind === "groupe" ? `groupe:${GROUP_THREAD}` : `chat:${DIRECT_THREAD}`}
		variant="page"
		nav={{ back: vi.fn(), openConversation: vi.fn(), openCompose: vi.fn(), openComposeGroupe: vi.fn() }}
		draft="Bonjour"
		source={injectedSource(writes)}
	/>)
}

function composer(): MessageComposerProps {
	if (mocks.composer === null) throw new Error("composeur non monté")
	return mocks.composer
}

beforeEach(() => {
	mocks.registered = []
	mocks.calls = []
	mocks.results.clear()
	mocks.errors.clear()
	mocks.mutations.clear()
	mocks.composer = null
	mocks.group = false
})

describe("SOURCE_AGENT — écritures liées au réseau courant", () => {
	it("ignore un réseau glissé par l’appelant, sans modifier les pièces ni la clé idempotente", async () => {
		const { result } = renderHook(() => SOURCE_AGENT.useMessageWrites(), { wrapper: EngineTestWrapper })
		const attachment = { storageId: "image" as Id<"_storage">, filename: "image.jpg", mimeType: "image/jpeg", sizeBytes: 42 }
		const args = { networkId: "foreign" as Id<"networks">, threadId: DIRECT_THREAD, content: "Bonjour", attachmentFiles: [attachment], idempotencyKey: "same-key" }
		await act(async () => { await result.current.send.mutateAsync(args) })
		expect(mocks.calls).toEqual([{ name: SEND, args: { ...args, networkId: TEST_NETWORK_ID } }])
	})

	it("dépôt 1:1 et groupe, transfert : même réseau injecté, cible conservée", async () => {
		const { result } = renderHook(() => SOURCE_AGENT.useMessageWrites(), { wrapper: EngineTestWrapper })
		const to = { kind: "group" as const, threadId: GROUP_THREAD }
		await act(async () => {
			await result.current.uploadUrl1a1.mutateAsync({})
			await result.current.uploadUrlGroupe.mutateAsync({})
			await result.current.forwardMessage.mutateAsync({ messageId: "message" as Id<"personalMessages">, to })
		})
		expect(mocks.calls).toEqual([
			{ name: UPLOAD, args: { networkId: TEST_NETWORK_ID } },
			{ name: GROUP_UPLOAD, args: { networkId: TEST_NETWORK_ID } },
			{ name: FORWARD, args: { networkId: TEST_NETWORK_ID, messageId: "message", to } },
		])
	})

	it("une bascule de réseau remplace le réseau injecté sans réécrire les arguments", async () => {
		let networkId = TEST_NETWORK_ID
		function Wrapper({ children }: { children: ReactNode }) {
			return <NetworkProvider networkId={networkId} slug="test" personId={TEST_PERSON_ID} charte="antsia" routes={TEST_ROUTES}>{children}</NetworkProvider>
		}
		const { result, rerender } = renderHook(() => SOURCE_AGENT.useMessageWrites(), { wrapper: Wrapper })
		await act(async () => { await result.current.clearTyping.mutateAsync({ threadId: DIRECT_THREAD }) })
		networkId = "new-network" as Id<"networks">
		rerender()
		await act(async () => { await result.current.clearTyping.mutateAsync({ threadId: DIRECT_THREAD }) })
		expect(mocks.calls.map(({ args }) => args)).toEqual([
			{ networkId: TEST_NETWORK_ID, threadId: DIRECT_THREAD },
			{ networkId, threadId: DIRECT_THREAD },
		])
	})

	it("propage l’objet de refus de dépôt sans le transformer en URL", async () => {
		const refusal = { data: { code: "notFound" } }
		mocks.errors.set(UPLOAD, refusal)
		const { result } = renderHook(() => SOURCE_AGENT.useMessageWrites(), { wrapper: EngineTestWrapper })
		await expect(result.current.uploadUrl1a1.mutateAsync({})).rejects.toBe(refusal)
	})
})

describe("conversation — les écritures viennent de la source injectée", () => {
	it.each(["chat", "groupe"] as const)("envoi %s : utilise la source, sans choisir une mutation moteur de message", async (kind) => {
		const writes = writesForConversation()
		const send = vi.fn<typeof writes.send.mutateAsync>().mockResolvedValue({ messageId: "sent" as Id<"personalMessages">, deduplicated: false })
		const sendGroup = vi.fn<typeof writes.sendGroup.mutateAsync>().mockResolvedValue({ messageId: "sent-group" as Id<"groupMessages">, deduplicated: false })
		writes.send = { ...writes.send, mutateAsync: send }
		writes.sendGroup = { ...writes.sendGroup, mutateAsync: sendGroup }
		mountConversation(writes, kind)
		await act(async () => { await composer().onSend({ text: "Bonjour", attachments: [] }) })
		const called = kind === "chat" ? send : sendGroup
		expect(called).toHaveBeenCalledWith({ threadId: kind === "chat" ? DIRECT_THREAD : GROUP_THREAD, content: "Bonjour", idempotencyKey: expect.any(String) })
		expect(kind === "chat" ? sendGroup : send).not.toHaveBeenCalled()
		expect(mocks.registered).not.toContain(SEND)
		expect(mocks.registered).not.toContain(GROUP_SEND)
	})

	it("le brouillon démarre un fil par la source et conserve les pièces initiales", async () => {
		const writes = writesForConversation()
		const startThread = vi.fn<typeof writes.startThread.mutateAsync>().mockResolvedValue({
			threadId: DIRECT_THREAD,
			messageId: "first-message" as Id<"personalMessages">,
			created: true,
		})
		writes.startThread = { ...writes.startThread, mutateAsync: startThread }
		mountConversation(writes, "draft")
		const attachment = { storageId: "photo", filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 42 }
		await act(async () => { await composer().onSend({ text: "Premier message", attachments: [attachment] }) })
		expect(startThread).toHaveBeenCalledWith({ handle: "awa.demo", initialMessage: "Premier message", initialAttachmentFiles: [attachment] })
		expect(mocks.registered).not.toContain(getFunctionName(api.modules.messaging.inbox.startThreadWithHandle))
	})

	it("un refus d’envoi rend le brouillon, dit le code et garde la même clé pour le réessai", async () => {
		const writes = writesForConversation()
		const refusal = { data: { code: "notFound" }, message: "PRIVATE_SERVER_TRACE" }
		const send = vi.fn<typeof writes.send.mutateAsync>().mockRejectedValue(refusal)
		writes.send = { ...writes.send, mutateAsync: send }
		const { container } = mountConversation(writes)
		const { result: dock } = renderHook(useDockState)
		for (let attempt = 0; attempt < 2; attempt += 1) {
			await act(async () => { await expect(composer().onSend({ text: "À conserver", attachments: [] })).rejects.toBe(refusal) })
		}
		expect(dock.current.drafts[`chat:${DIRECT_THREAD}`]).toBe("À conserver")
		expect(send.mock.calls[0]?.[0].idempotencyKey).toBe(send.mock.calls[1]?.[0].idempotencyKey)
		expect(container.querySelector(".msg-error")?.textContent).toBeTruthy()
		expect(container.textContent).not.toContain("PRIVATE_SERVER_TRACE")
	})

	it.each(["chat", "groupe"] as const)("dépôt %s : emprunte la source et conserve le refus, sans URL de repli", async (kind) => {
		const writes = writesForConversation()
		const refusal = { data: { code: "notFound" } }
		const upload = vi.fn<() => Promise<string>>().mockRejectedValue(refusal)
		if (kind === "chat") writes.uploadUrl1a1 = { ...writes.uploadUrl1a1, mutateAsync: upload }
		else writes.uploadUrlGroupe = { ...writes.uploadUrlGroupe, mutateAsync: upload }
		mountConversation(writes, kind)
		await expect(composer().generateUploadUrl()).rejects.toBe(refusal)
		expect(upload).toHaveBeenCalledWith({})
		expect(mocks.calls.some(({ name }) => name === UPLOAD || name === GROUP_UPLOAD)).toBe(false)
	})
})
