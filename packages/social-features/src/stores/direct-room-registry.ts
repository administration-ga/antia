// Dupliqué de socle/packages/agent-features/src/stores/direct-room-registry.ts @ ad2e7fdc2 — adaptations : références du moteur, réseau courant, dépendances LiveKit locales et libellés traduits ; structure de salle persistante conservée.
/**
 * direct-room-registry — registre des instances `Room` LiveKit des directs.
 *
 * Même service que `call-room-registry.ts`, et VOLONTAIREMENT distinct : sa
 * clé est un `Id<"liveSessions">`, quand l'autre porte des
 * `Id<"meetings">`. Les mélanger ferait lire à `useAgentPresence` — qui compte
 * les slots d'appel — des salles qui n'en sont pas.
 *
 * Le propriétaire est `DirectRoomMount` (invisible, frère stable de la branche
 * de palier) ; les présentations (`DirectStage`, ses pistes, sa barre de
 * commandes) la consomment par `useDirectRoom` + `<RoomContext.Provider>` dans
 * leur propre sous-arbre. C'est ce découplage qui permet de changer de palier
 * — donc d'arbre — sans démonter la salle.
 *
 * API minimaliste : Map + `useSyncExternalStore`, aucune dépendance ajoutée.
 */

import type { Room } from "livekit-client"
import { useSyncExternalStore } from "react"
import type { Id } from "@antsia/api/engine"

const rooms = new Map<string, Room>()
const listeners = new Set<() => void>()

function emit() {
	for (const l of listeners) l()
}

export const directRoomRegistry = {
	register(sessionId: Id<"liveSessions">, room: Room) {
		const prev = rooms.get(sessionId as string)
		if (prev === room) return
		rooms.set(sessionId as string, room)
		emit()
	},

	unregister(sessionId: Id<"liveSessions">, room?: Room) {
		// Si une salle est passée, on ne supprime que si c'est ELLE — un
		// démontage tardif ne doit pas effacer la salle qui vient de la
		// remplacer.
		const current = rooms.get(sessionId as string)
		if (room && current !== room) return
		rooms.delete(sessionId as string)
		emit()
	},

	get(sessionId: Id<"liveSessions"> | null | undefined): Room | null {
		if (!sessionId) return null
		return rooms.get(sessionId as string) ?? null
	},
}

/**
 * Hook React : la `Room` du direct, ou `null` tant qu'elle n'est pas publiée.
 * Re-rendu automatique au register/unregister.
 */
export function useDirectRoom(
	sessionId: Id<"liveSessions"> | null | undefined,
): Room | null {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		() => (sessionId ? rooms.get(sessionId as string) ?? null : null),
		() => null,
	)
}
