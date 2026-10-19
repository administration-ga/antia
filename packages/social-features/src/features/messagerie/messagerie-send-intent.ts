/**
 * messagerie-send-intent — UNE intention d'envoi, UNE clé d'idempotence
 * (P05, 18/10/2026).
 *
 * Le serveur déduplique par `idempotencyKey` dans un fil (`sendMessage`,
 * `sendGroupMessage`) : la même clé ne crée jamais deux messages. Le piège est
 * côté écran. L'ancienne clé « du prochain envoi » (`useIdempotencyKey`) n'était
 * renouvelée qu'après un SUCCÈS : après un échec (délai dépassé alors que le
 * serveur avait enregistré), la personne corrigeait son texte ou enregistrait
 * un vocal, renvoyait — et le serveur rendait le PREMIER message comme un
 * rejeu. Le second disparaissait en silence.
 *
 * Ici la clé est liée au CONTENU de l'intention (fil, texte, pièces, citation) :
 *  · renvoyer exactement la même chose (« Réessayer », double appui, requête
 *    perdue) réutilise la même clé → aucun doublon ;
 *  · envoyer autre chose prend une clé neuve → rien n'est avalé.
 *
 * Module PUR : l'identifiant neuf est INJECTÉ (`createKey`), donc testable.
 */

export interface SendIntentPayload {
	/** La conversation visée (clé `chat:…`, `groupe:…`, `draft:…`). */
	conversation: string
	text: string
	/** Les pièces DÉJÀ montées — leur stockage fait partie de l'intention. */
	attachments: readonly { storageId: string; filename?: string; mimeType?: string; sizeBytes?: number; durationMs?: number }[]
	/** Le message cité, s'il y en a un. */
	replyTo: string | null
}

export interface SendIntent {
	fingerprint: string
	/** La clé d'idempotence transmise au serveur — aussi l'identifiant local de l'envoi. */
	key: string
}

/** L'empreinte d'une intention : ce qui, s'il change, en fait une AUTRE. */
export function sendIntentFingerprint(payload: SendIntentPayload): string {
	return JSON.stringify([
		payload.conversation,
		payload.text,
		payload.attachments.map((attachment) => [attachment.storageId, attachment.filename ?? null, attachment.mimeType ?? null, attachment.sizeBytes ?? null, attachment.durationMs ?? null]),
		payload.replyTo,
	])
}

/**
 * La clé de cette intention : celle de l'intention précédente si c'est la même
 * (réessai), une clé neuve sinon.
 */
export function sendIntentFor(
	previous: SendIntent | null,
	payload: SendIntentPayload,
	createKey: () => string,
): SendIntent {
	const fingerprint = sendIntentFingerprint(payload)
	if (previous !== null && previous.fingerprint === fingerprint) return previous
	return { fingerprint, key: createKey() }
}

/**
 * Une mémoire d'intentions partagée entre les poses dock/page : verrou
 * synchrone pendant l'aller-retour, clé conservée après échec seulement.
 * La conversation passée ici inclut le réseau et la personne du lecteur.
 */
export function createSendIntentBook() {
	const records = new Map<string, { intent: SendIntent; pending: boolean }>()
	return {
		begin(payload: SendIntentPayload, createKey: () => string): SendIntent | null {
			const previous = records.get(payload.conversation)
			if (previous?.pending) return null
			const intent = sendIntentFor(previous?.intent ?? null, payload, createKey)
			records.set(payload.conversation, { intent, pending: true })
			return intent
		},
		settle(conversation: string, key: string, admitted: boolean): void {
			const record = records.get(conversation)
			if (!record || record.intent.key !== key) return
			if (admitted) records.delete(conversation)
			else records.set(conversation, { ...record, pending: false })
		},
	}
}

/** Interruption locale : aucun résultat ancien ne doit modifier un nouveau contexte. */
export class AbandonedMessageSend extends Error {}
export class MessageSendInProgress extends Error {}
