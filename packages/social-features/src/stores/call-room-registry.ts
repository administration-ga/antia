// Dupliqué de socle/packages/agent-features/src/stores/call-room-registry.ts @ ad2e7fdc2 — adaptations : identifiant `Id<"calls">` (le paramètre garde son nom `meetingId`) ; commentaire recadré sur la coque du moteur (AppShell et centre d'appels retirés).
/**
 * call-room-registry — registre des instances `Room` LiveKit en cours.
 *
 * Pourquoi : le pool `CallRoomPool` est monté GLOBALEMENT dans la coque pour
 * que l'audio survive aux changements de route (la personne quitte la
 * conversation tout en gardant l'appel). Mais l'UI visible (la surface
 * d'appel, `CallSurface`) a besoin du contexte LiveKit (hooks `useTracks`,
 * `useLocalParticipant`, `VideoTrack`).
 *
 * Ce registre permet à un consumer dans un sous-arbre différent de l'UI
 * pool de réutiliser la même `Room` via `<RoomContext.Provider>`.
 *
 * API minimaliste — pas de Zustand pour ne pas alourdir la dépendance ;
 * Map + useSyncExternalStore suffisent.
 */

import type { Room } from "livekit-client";
import { useSyncExternalStore } from "react";
import type { Id } from "@antsia/api/engine";

const rooms = new Map<string, Room>();
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

export const callRoomRegistry = {
	register(meetingId: Id<"calls">, room: Room) {
		const prev = rooms.get(meetingId as string);
		if (prev === room) return;
		rooms.set(meetingId as string, room);
		emit();
	},

	unregister(meetingId: Id<"calls">, room?: Room) {
		// Si un room est passé, on ne supprime que si c'est lui — évite qu'un
		// unmount tardif n'écrase un nouveau register pour le même appel.
		const current = rooms.get(meetingId as string);
		if (room && current !== room) return;
		rooms.delete(meetingId as string);
		emit();
	},

	get(meetingId: Id<"calls"> | null | undefined): Room | null {
		if (!meetingId) return null;
		return rooms.get(meetingId as string) ?? null;
	},
};

/**
 * Hook React : retourne la `Room` LiveKit associée à un appel, ou null si
 * pas encore connectée. Re-render automatique sur register/unregister.
 */
export function useCallRoom(meetingId: Id<"calls"> | null | undefined): Room | null {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		() => (meetingId ? rooms.get(meetingId as string) ?? null : null),
		() => null,
	);
}
