// Dupliqué de socle/packages/agent-features/src/features/messagerie/PinnedMessageBanner.tsx @ ad2e7fdc2 — adaptations : libellés traduits (espace de noms `messagerie`, clés `pinnedMessageBanner.*`).
"use client"

/**
 * PinnedMessageBanner — LE message épinglé, au sommet de la conversation
 * (ADR-0143 §5).
 *
 * Un seul message épinglé par fil : la bande le rappelle et y RAMÈNE. Le
 * contenu est relu par le serveur à chaque lecture — un message retiré ou
 * masqué n'est jamais annoncé ici (`null` côté serveur, rien côté écran).
 *
 * Le retrait (« Désépingler ») n'est rendu que pour qui a le droit d'épingler
 * — le serveur re-contrôle de toute façon, mais un bouton refusé après
 * l'appui est un défaut, pas une garde.
 */

import { Pin, X } from "lucide-react"
import { useTranslation } from "react-i18next"

export interface PinnedMessageData {
	messageId: string
	senderName: string
	excerpt: string
	hasAttachments: boolean
}

export function PinnedMessageBanner({
	pinned,
	canPin,
	onJump,
	onUnpin,
}: {
	pinned: PinnedMessageData
	/** Le droit d'épingle dans CE fil — décide du bouton de retrait. */
	canPin: boolean
	/** Ramener au message dans le fil. */
	onJump: (messageId: string) => void
	onUnpin: () => void
}) {
	const { t } = useTranslation("messagerie")
	const corps =
		pinned.excerpt.length > 0
			? pinned.excerpt
			: pinned.hasAttachments
				? t("pinnedMessageBanner.attachment")
				: t("pinnedMessageBanner.message")
	return (
		<div className="msg-pinned-banner" role="note">
			<button
				type="button"
				className="msg-pinned-jump"
				onClick={() => onJump(pinned.messageId)}
				aria-label={t("pinnedMessageBanner.jump", { sender: pinned.senderName, body: corps })}
			>
				<Pin aria-hidden="true" size={13} className="msg-pinned-icon" />
				<span className="msg-pinned-body">
					<span className="msg-pinned-author">{pinned.senderName}</span>{" "}
					<span className="msg-pinned-excerpt">{corps}</span>
				</span>
			</button>
			{canPin ? (
				<button
					type="button"
					className="msg-pinned-unpin"
					onClick={onUnpin}
					aria-label={t("pinnedMessageBanner.unpin")}
				>
					<X aria-hidden="true" size={14} />
				</button>
			) : null}
		</div>
	)
}
