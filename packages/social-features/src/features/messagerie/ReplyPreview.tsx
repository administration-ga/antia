// Dupliqué de socle/packages/agent-features/src/features/messagerie/ReplyPreview.tsx @ ad2e7fdc2 — adaptations : libellés traduits (espace de noms `messagerie`, clés `replyPreview.*`), le retrait dit par la clé partagée `MESSAGE_DELETED_KEY` ; extrait relu par le moteur (`replyExcerpt` du contrat `attachments`).
"use client"

/**
 * ReplyPreview — l'extrait du message CITÉ, à deux endroits.
 *
 *  · `place="bubble"` — sous la bulle qui cite. Cliquable : elle ramène au
 *    message d'origine (c'est le geste attendu, et le seul moyen de retrouver
 *    ce dont on parle dans un fil long).
 *  · `place="composer"` — au-dessus du composeur pendant qu'on rédige, avec
 *    une croix pour annuler la citation.
 *
 * ⚠️ L'extrait n'est JAMAIS recopié à l'écriture. Le serveur le RELIT à la
 * lecture (`replyExcerpt` du contrat `@antsia/social-contracts/attachments`), avec la garde du
 * fil : un message supprimé depuis cesse ainsi d'apparaître dans les citations
 * qui le désignent — sans cela, la citation serait le seul endroit où le
 * message supprimé survivrait. Ce composant ne reçoit donc que ce que le
 * serveur a bien voulu rendre, et affiche « Message supprimé » quand il l'a
 * retiré.
 */

import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MESSAGE_DELETED_KEY } from "./messagerie-bulles"

export interface ReplyPreviewData {
	/** L'identifiant du message cité — sert à y revenir. */
	messageId: string
	/** Le nom de son auteur, quand on le connaît. */
	authorName?: string | null
	/** L'extrait, tronqué par le serveur. */
	excerpt: string
	/** Le message cité a été retiré depuis. */
	deleted: boolean
}

export function ReplyPreview({
	reply,
	place,
	onOpen,
	onCancel,
}: {
	reply: ReplyPreviewData
	place: "bubble" | "composer"
	/** Ramener au message d'origine — seulement sous une bulle. */
	onOpen?: (messageId: string) => void
	/** Annuler la citation — seulement au-dessus du composeur. */
	onCancel?: () => void
}) {
	const { t } = useTranslation("messagerie")
	const auteur = reply.authorName ?? t("replyPreview.quotedMessage")
	const texte = reply.deleted ? t(MESSAGE_DELETED_KEY) : reply.excerpt

	if (place === "composer") {
		return (
			<div className="msg-reply-preview">
				<span style={{ flex: 1, minWidth: 0 }}>
					<span className="msg-quote-author">{t("replyPreview.replyTo", { author: auteur })}</span>
					<span className="msg-quote-text">{texte}</span>
				</span>
				{onCancel !== undefined ? (
					<button
						type="button"
						className="msg-icon-btn"
						aria-label={t("replyPreview.cancel")}
						onClick={onCancel}
					>
						<X aria-hidden="true" size={15} />
					</button>
				) : null}
			</div>
		)
	}

	return (
		<button
			type="button"
			className="msg-quote"
			data-deleted={reply.deleted ? "true" : "false"}
			// Le nom accessible dit ce que fait le bouton, pas seulement ce qu'il
			// montre : « Message cité de X » lu seul ne dit pas qu'on peut y aller.
			aria-label={t("replyPreview.goTo", { author: auteur })}
			onClick={() => onOpen?.(reply.messageId)}
		>
			<span className="msg-quote-author">{auteur}</span>
			<span className="msg-quote-text">{texte}</span>
		</button>
	)
}
