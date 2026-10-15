// Dupliqué de socle/packages/agent-features/src/features/messagerie/GroupeAvatar.tsx @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

import { MessagesSquare } from "lucide-react"
import { Avatar } from "../reseau-personnel/Avatar"

export interface GroupeAvatarProps {
	title: string
	avatarUrl: string | null | undefined
	size?: number
}

/**
 * L'identité visuelle d'un groupe, partagée par la liste et la conversation.
 * Une photo choisie par les administrateurs prime ; l'emblème collectif reste
 * le repli explicite, jamais les initiales d'un participant.
 */
export function GroupeAvatar({
	title,
	avatarUrl,
	size = 32,
}: GroupeAvatarProps) {
	if (avatarUrl) {
		return (
			<Avatar
				displayName={title}
				avatarUrl={avatarUrl}
				hasIdentity
				size={size}
			/>
		)
	}

	return (
		<span
			aria-hidden="true"
			className="msg-row-emblem"
			style={{ width: size, height: size, minWidth: size }}
		>
			<MessagesSquare size={Math.max(15, Math.round(size * 0.48))} />
		</span>
	)
}
