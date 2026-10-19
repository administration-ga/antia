/**
 * conversation-arrivals — ce qu'un lecteur d'écran entend quand un message
 * ARRIVE dans une conversation ouverte (P18b, A04).
 *
 * Module pur, testé en environnement `node`. La région polie de la
 * conversation ne doit annoncer QUE des arrivées :
 *
 *  · jamais l'historique — ni l'ouverture d'une conversation (pas de repère
 *    encore posé), ni les anciens chargés à la demande (le dernier message ne
 *    bouge pas) ;
 *  · jamais mes propres messages, ni les lignes système, ni un retrait ;
 *  · jamais plus que ce que l'écran montre : quand le fil suit le bas, le
 *    message est à l'écran — son auteur et son corps sont dits ; quand on lit
 *    plus haut, seule la pastille l'est (« 2 nouveaux messages »).
 *
 * Clés QUALIFIÉES, `t` en dernier paramètre, comme `conversation-scroll`.
 */

import type { TFunction } from "i18next"

import { newMessagesLabel } from "./conversation-scroll"
import { bubbleText } from "./messagerie-bulles"

/** Au-delà, le corps est coupé : une annonce polie n'est pas une lecture intégrale. */
export const ARRIVAL_TEXT_MAX = 280

/** Ce que l'annonce lit d'un message — un sous-ensemble de la bulle. */
export interface ArrivalMessage {
	id: string
	senderId: string
	senderName?: string | null
	text: string | null
	masked?: boolean
	deleted?: boolean
	systemText?: string | null
	attachments?: readonly unknown[]
}

export interface ArrivalInput {
	/**
	 * Le repère précédent : le dernier message connu (`null` pour un fil reçu
	 * vide). `null` tout court : aucun repère encore — c'est l'ouverture, rien
	 * ne s'annonce.
	 */
	previous: { lastId: string | null } | null
	messages: readonly ArrivalMessage[]
	selfId: string
	/** Le fil suit-il le bas (le nouveau message est-il à l'écran) ? */
	pinned: boolean
	/** Messages déjà signalés par la pastille avant cette arrivée. */
	unseen: number
}

/** L'annonce d'une arrivée, ou `null` quand il n'y a rien à dire. */
export function arrivalAnnouncement(input: ArrivalInput, t: TFunction): string | null {
	const { previous, messages } = input
	if (previous === null) return null
	const last = messages.at(-1)
	if (last === undefined || last.id === previous.lastId) return null

	let start = 0
	if (previous.lastId !== null) {
		const index = messages.findIndex((message) => message.id === previous.lastId)
		// Le repère a disparu (retrait, autre fenêtre de lecture) : on ne sait
		// pas ce qui est neuf — mieux vaut se taire que d'annoncer du passé.
		if (index < 0) return null
		start = index + 1
	}

	const arrivals = messages
		.slice(start)
		.filter(
			(message) =>
				message.senderId !== input.selfId &&
				(message.systemText === null || message.systemText === undefined) &&
				message.deleted !== true,
		)
	if (arrivals.length === 0) return null

	if (!input.pinned) {
		const unseen = Number.isFinite(input.unseen) && input.unseen > 0 ? Math.trunc(input.unseen) : 0
		return newMessagesLabel(unseen + arrivals.length, t) || null
	}
	if (arrivals.length > 1) return newMessagesLabel(arrivals.length, t) || null

	const message = arrivals[0]!
	const name = (message.senderName ?? "").trim()
	const body = bubbleText({ deleted: message.deleted, masked: message.masked, text: message.text }, t).trim()
	const excerpt = body.length > ARRIVAL_TEXT_MAX ? `${body.slice(0, ARRIVAL_TEXT_MAX - 1)}…` : body
	if (excerpt.length > 0) {
		return t("messagerie:messagerieConversationView.arrivalWithText", { name, text: excerpt })
	}
	if ((message.attachments?.length ?? 0) > 0) {
		return t("messagerie:messagerieConversationView.arrivalWithAttachment", { name })
	}
	return t("messagerie:messagerieConversationView.arrival", { name })
}
