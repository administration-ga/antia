// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-ressources.ts @ ad2e7fdc2 — adaptations : générique sur le type de pièce (`A extends GroupeRessourceAttachment`, défaut inchangé) pour que les champs propres au moteur — la retenue de la garde des fichiers, `withheld` — traversent jusqu'à l'affichage de la pièce ; la logique est inchangée.
export interface GroupeRessourceAttachment {
	filename: string
	mimeType: string
	sizeBytes: number
	durationMs: number | null
	url: string | null
}

export interface GroupeRessourceMessage<
	A extends GroupeRessourceAttachment = GroupeRessourceAttachment,
> {
	messageId: string
	text: string | null
	createdAt: number
	attachments: readonly A[]
}

export interface GroupeRessources<
	A extends GroupeRessourceAttachment = GroupeRessourceAttachment,
> {
	attachments: Array<A & { key: string; createdAt: number }>
	links: Array<{ url: string; createdAt: number }>
}

const HTTP_LINK = /https?:\/\/[^\s<>"']+/giu
const TRAILING_PUNCTUATION = /[),.;!?\]}]+$/u

/**
 * Extrait uniquement les ressources que la projection serveur a déjà jugées
 * visibles pour le membre. Aucun accès direct à la table n'est permis ici.
 */
export function ressourcesDuGroupe<
	A extends GroupeRessourceAttachment = GroupeRessourceAttachment,
>(messages: readonly GroupeRessourceMessage<A>[]): GroupeRessources<A> {
	const attachments: GroupeRessources<A>["attachments"] = []
	const linksByUrl = new Map<string, number>()

	for (const message of messages) {
		message.attachments.forEach((attachment, index) => {
			attachments.push({
				...attachment,
				key: `${message.messageId}:${index}`,
				createdAt: message.createdAt,
			})
		})

		for (const match of message.text?.match(HTTP_LINK) ?? []) {
			const url = match.replace(TRAILING_PUNCTUATION, "")
			if (url.length > 0 && !linksByUrl.has(url)) {
				linksByUrl.set(url, message.createdAt)
			}
		}
	}

	return {
		attachments: attachments.sort((a, b) => b.createdAt - a.createdAt),
		links: [...linksByUrl.entries()]
			.map(([url, createdAt]) => ({ url, createdAt }))
			.sort((a, b) => b.createdAt - a.createdAt),
	}
}
