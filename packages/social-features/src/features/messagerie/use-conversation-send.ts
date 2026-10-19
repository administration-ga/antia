"use client"

import { isSigningOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { useCallback, useEffect, useRef } from "react"
import { outboxStore } from "./messagerie-outbox"
import { AbandonedMessageSend, createSendIntentBook, MessageSendInProgress, type SendIntentPayload } from "./messagerie-send-intent"

const intentBook = createSendIntentBook()

interface SendAdmission {
	messageId: string
	/** Le premier message transforme le brouillon en conversation réelle. */
	conversation?: string
}

/** Une admission serveur, puis seulement les effets du contexte encore vivant. */
export function useConversationSend(owner: string, conversation: string, active: boolean) {
	const mounted = useRef(true)
	const current = useRef({ owner, conversation, active })
	const generation = useRef(0)
	if (current.current.owner !== owner || current.current.conversation !== conversation || current.current.active !== active) generation.current += 1
	current.current = { owner, conversation, active }
	const version = generation.current
	useEffect(() => {
		mounted.current = true
		return () => { mounted.current = false }
	}, [])

	const isCurrent = useCallback(() => mounted.current && generation.current === version && current.current.owner === owner && current.current.conversation === conversation && current.current.active && !isSigningOutEverywhere(), [owner, conversation, version])
	const perform = useCallback(async <Result extends SendAdmission>(payload: Omit<SendIntentPayload, "conversation">, dispatch: (key: string) => Promise<Result>): Promise<Result> => {
		if (!isCurrent()) throw new AbandonedMessageSend()
		const context = JSON.stringify([owner, conversation])
		const intent = intentBook.begin({ ...payload, conversation: context }, () => crypto.randomUUID())
		if (intent === null) throw new MessageSendInProgress()
		outboxStore.add({ key: intent.key, owner, conversation, text: payload.text, attachmentCount: payload.attachments.length, at: Date.now(), messageId: null })
		try {
			const result = await dispatch(intent.key)
			if (!isCurrent()) throw new AbandonedMessageSend()
			intentBook.settle(context, intent.key, true)
			outboxStore.admit(intent.key, result.messageId)
			return result
		} catch (error) {
			intentBook.settle(context, intent.key, false)
			outboxStore.remove(intent.key)
			if (!isCurrent()) throw new AbandonedMessageSend()
			throw error
		}
	}, [owner, conversation, isCurrent])
	return { perform, isCurrent }
}
