"use client"

/** P10 : source commerciale autonome ; aucun identifiant de fil personnel. */
import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useMutation } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

const backend = api.modules.commercialMessaging
export type CommercialThread = NonNullable<FunctionReturnType<typeof backend.threads.getThread>>
export type CommercialThreadId = CommercialThread["threadId"]
export type CommercialShopId = CommercialThread["shop"]["shopId"]
export type CommercialMessage = FunctionReturnType<typeof backend.messages.paginateMessages>["page"][number]
export type CommercialAttachment = NonNullable<FunctionArgs<typeof backend.messages.sendMessage>["attachments"]>[number]
type Networkless<T> = Omit<T, "networkId">

/** Des pages serveur vivantes, sans reconstruire leurs droits dans l'écran. */
export const COMMERCIAL_MESSAGING_SOURCE = {
	useThread(threadId: CommercialThreadId) {
		const { networkId } = useNetwork()
		return useAuthenticatedConvexQuery(backend.threads.getThread, { networkId, threadId })
	},
	useThreads(shopId: CommercialShopId | undefined, query: string, cursor: string | null) {
		const { networkId } = useNetwork()
		const args = { networkId, query: query.trim().slice(0, 120), paginationOpts: { cursor, numItems: 25 } }
		const mine = useAuthenticatedConvexQuery(backend.threads.paginateMyThreads, shopId === undefined ? args : "skip")
		const shop = useAuthenticatedConvexQuery(backend.threads.paginateShopThreads, shopId === undefined ? "skip" : { ...args, shopId })
		return shopId === undefined ? mine : shop
	},
	useMessages(threadId: CommercialThreadId, cursor: string | null, enabled: boolean) {
		const { networkId } = useNetwork()
		return useAuthenticatedConvexQuery(backend.messages.paginateMessages, enabled ? { networkId, threadId, paginationOpts: { cursor, numItems: 30 } } : "skip")
	},
	useWrites() {
		const { networkId } = useNetwork()
		const send = useMutation(backend.messages.sendMessage)
		const remove = useMutation(backend.messages.removeMessage)
		const upload = useMutation(backend.messages.generateUploadUrl)
		const decide = useMutation(backend.threads.decideRequest)
		const block = useMutation(backend.threads.setThreadBlock)
		const close = useMutation(backend.threads.close)
		const read = useMutation(backend.threads.markRead)
		const consent = useMutation(backend.calls.setCallConsent)
		const call = useMutation(backend.calls.startCall)
		const report = useMutation(api.modules.moderation.cases.report)
		return {
			send: (args: Networkless<FunctionArgs<typeof backend.messages.sendMessage>>) => send({ ...args, networkId }),
			remove: (args: Networkless<FunctionArgs<typeof backend.messages.removeMessage>>) => remove({ ...args, networkId }),
			upload: (threadId: CommercialThreadId) => upload({ networkId, threadId }),
			decide: (args: Networkless<FunctionArgs<typeof backend.threads.decideRequest>>) => decide({ ...args, networkId }),
			block: (args: Networkless<FunctionArgs<typeof backend.threads.setThreadBlock>>) => block({ ...args, networkId }),
			close: (threadId: CommercialThreadId) => close({ networkId, threadId }),
			read: (threadId: CommercialThreadId) => read({ networkId, threadId }),
			consent: (args: Networkless<FunctionArgs<typeof backend.calls.setCallConsent>>) => consent({ ...args, networkId }),
			call: (args: Networkless<FunctionArgs<typeof backend.calls.startCall>>) => call({ ...args, networkId }),
			report: (messageId: CommercialMessage["messageId"], reason: string) => report({ networkId, target: { kind: "commercialMessage", id: messageId }, reason }),
		}
	},
}

/** Déduplication d'une fenêtre sans convertir des messages en messages personnels. */
export function orderedCommercialMessages(messages: readonly CommercialMessage[]): CommercialMessage[] {
	return [...new Map(messages.map((message) => [message.messageId, message])).values()]
		.sort((a, b) => a.createdAt - b.createdAt || String(a.messageId).localeCompare(String(b.messageId)))
}
