/**
 * messagerie-outbox — les envois EN COURS, avant leur admission (P05, 18/10/2026).
 *
 * Sur un fil existant, le composeur se vide au clic : sans trace locale, le
 * texte disparaissait de l'écran pendant tout l'aller-retour — sur un réseau
 * lent, plusieurs secondes de vide, et la tentation de retaper (donc un second
 * message). L'entrée locale porte l'IDENTIFIANT de l'envoi, qui est aussi sa
 * clé d'idempotence côté serveur (`messagerie-send-intent.ts`) : c'est ce qui la
 * raccorde à l'admission.
 *
 * Trois états, et pas un de plus, parce que ce sont ceux que le moteur prouve :
 *  · ici, « Envoi en cours » : l'intention est partie, le serveur n'a rien dit ;
 *  · dans le fil, « Envoyé » : le serveur l'a admis (le message existe) ;
 *  · dans le fil, « Lu » : le correspondant l'a lu (`readAt`, tête-à-tête).
 * Aucun « Livré » : le moteur ne reçoit aucune preuve de réception sur un
 * appareil, et un statut sans preuve est un statut fabriqué.
 *
 * En succès, l'entrée est rattachée au `messageId` admis et reste jusqu'à sa
 * projection dans le fil : le retour d'une mutation ne prouve pas que React a
 * déjà peint la nouvelle query. En échec, elle s'efface et le brouillon reste
 * disponible. Mémoire seulement ; une réponse d'un contexte quitté ne réinjecte
 * rien et le remplacement du document de session vide cette mémoire.
 */

import { useSyncExternalStore } from "react"

export interface OutboxEntry {
	/** L'identifiant local de l'envoi — la clé d'idempotence transmise au serveur. */
	key: string
	/** Le réseau et le lecteur : une autre session ne voit pas cet envoi. */
	owner: string
	/** La conversation visée. */
	conversation: string
	text: string
	attachmentCount: number
	at: number
	/** L'admission n'est affirmée qu'après le retour de la mutation. */
	messageId: string | null
}

let entries: readonly OutboxEntry[] = []
const listeners = new Set<() => void>()
const EMPTY: readonly OutboxEntry[] = Object.freeze([])
const byConversation = new Map<string, readonly OutboxEntry[]>()

function rebuild(): void {
	byConversation.clear()
	for (const entry of entries) {
		const context = JSON.stringify([entry.owner, entry.conversation])
		byConversation.set(context, [...(byConversation.get(context) ?? []), entry])
	}
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export const outboxStore = {
	/** Un envoi part. Une même clé n'est jamais inscrite deux fois (réessai, double appui). */
	add(entry: OutboxEntry): void {
		if (entries.some((current) => current.key === entry.key)) return
		entries = [...entries, entry]
		rebuild()
	},
	/** Le serveur a répondu — admis ou refusé : l'entrée locale n'a plus lieu d'être. */
	remove(key: string): void {
		if (!entries.some((current) => current.key === key)) return
		entries = entries.filter((current) => current.key !== key)
		rebuild()
	},
	/** Le serveur a admis l'envoi : le garder jusqu'à sa projection réelle. */
	admit(key: string, messageId: string, conversation?: string): void {
		entries = entries.map((entry) => entry.key === key ? { ...entry, messageId, conversation: conversation ?? entry.conversation } : entry)
		rebuild()
	},
	/** La promotion suit le nettoyage des pièces du composeur. */
	moveConversation(owner: string, from: string, to: string): void {
		if (!entries.some((entry) => entry.owner === owner && entry.conversation === from)) return
		entries = entries.map((entry) => entry.owner === owner && entry.conversation === from ? { ...entry, conversation: to } : entry)
		rebuild()
	},
	/** La query a réellement projeté CE message, pas simplement le même texte. */
	acknowledge(owner: string, conversation: string, messageIds: readonly string[]): void {
		const ids = new Set(messageIds)
		const next = entries.filter((entry) => entry.owner !== owner || entry.conversation !== conversation || entry.messageId === null || !ids.has(entry.messageId))
		if (next.length === entries.length) return
		entries = next
		rebuild()
	},
	has(key: string): boolean {
		return entries.some((current) => current.key === key)
	},
	forConversation(owner: string, conversation: string): readonly OutboxEntry[] {
		return byConversation.get(JSON.stringify([owner, conversation])) ?? EMPTY
	},
	/** Remise à zéro — RÉSERVÉE AUX TESTS. */
	__resetForTests(): void {
		entries = []
		rebuild()
	},
}

/** Les envois en cours d'UNE conversation, réactifs. */
export function useOutbox(owner: string, conversation: string): readonly OutboxEntry[] {
	return useSyncExternalStore(
		subscribe,
		() => outboxStore.forConversation(owner, conversation),
		() => EMPTY,
	)
}
