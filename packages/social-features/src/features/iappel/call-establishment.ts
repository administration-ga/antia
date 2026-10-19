/**
 * call-establishment — QUAND un appel est-il réellement établi ? (P05, 18/10/2026)
 *
 * « En communication » et le chrono ne partent ni du clic, ni du décrochage
 * serveur (`answeredAt`), mais de l'établissement observé de la salle : la salle
 * LiveKit de CET appareil est connectée ET un autre participant y est entré.
 * Entre les deux, l'écran dit « Connexion… » (spécification 05 §4 :
 * `Sonnerie → Connexion → Connecté`).
 *
 * L'instant est consigné une seule fois par appel, par le pool de salles
 * (`CallRoomMount`), et lu par l'écran d'appel comme par la pilule : une
 * reconnexion ne le remet jamais à zéro (l'appel dure, c'est le réseau qui
 * hoquette).
 *
 * Un magasin de module minuscule et non le magasin d'appel : il ne porte qu'un
 * fait observé par la salle, il n'a aucune transition à arbitrer. Mémoire
 * seulement — rien n'est écrit dans un stockage, une déconnexion (document
 * remplacé) l'efface avec le reste.
 * La présence dans la salle ne prouve ni une piste publiée ni l'audibilité.
 */

import { useSyncExternalStore } from "react"

import type { CallConnectionState } from "./call-phase"

const establishedAt = new Map<string, number>()
const connections = new Map<string, CallConnectionState>()
const listeners = new Set<() => void>()

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/**
 * La salle est CONNECTÉE et quelqu'un d'autre que moi y est : un repère
 * d'établissement pour la durée, pas une preuve d'audibilité des pistes.
 */
export function isMediaEstablished(input: { connected: boolean; remoteParticipants: number }): boolean {
	return input.connected && input.remoteParticipants > 0
}

/** Consigne l'établissement — la PREMIÈRE fois seulement. Rend `true` s'il est nouveau. */
export function markCallEstablished(meetingId: string, at: number = Date.now()): boolean {
	if (establishedAt.has(meetingId) || !Number.isFinite(at)) return false
	establishedAt.set(meetingId, at)
	notify()
	return true
}

/** L'instant d'établissement de cet appel, ou `null` s'il ne l'est pas (encore). */
export function callEstablishedAt(meetingId: string | null | undefined): number | null {
	if (meetingId === null || meetingId === undefined) return null
	return establishedAt.get(meetingId) ?? null
}

/** Oublie les appels qui ne sont plus dans la ligne (raccrochés, fermés). */
export function forgetCallEstablishments(present: ReadonlySet<string>): void {
	let changed = false
	for (const meetingId of establishedAt.keys()) {
		if (present.has(meetingId)) continue
		establishedAt.delete(meetingId)
		changed = true
	}
	for (const meetingId of connections.keys()) {
		if (present.has(meetingId)) continue
		connections.delete(meetingId)
		changed = true
	}
	if (changed) notify()
}

/** La connexion de la SALLE, indépendante de l'existence d'un jeton. */
export function observeCallConnection(meetingId: string, connection: CallConnectionState): void {
	if (connections.get(meetingId) === connection) return
	connections.set(meetingId, connection)
	notify()
}

export function callObservedConnection(meetingId: string | null): CallConnectionState {
	return meetingId === null ? "connecting" : connections.get(meetingId) ?? "connecting"
}

/** La pilule et la scène lisent la même reconnexion, sans remonter la salle. */
export function useObservedCallConnection(meetingId: string | null): CallConnectionState {
	return useSyncExternalStore(subscribe, () => callObservedConnection(meetingId), () => "connecting" as const)
}

/** L'établissement d'UN appel, réactif. `null` tant qu'il n'est pas établi. */
export function useCallEstablishedAt(meetingId: string | null): number | null {
	return useSyncExternalStore(
		subscribe,
		() => callEstablishedAt(meetingId),
		() => null,
	)
}

/** Remise à zéro — RÉSERVÉE AUX TESTS (singleton de module). */
export function __resetCallEstablishmentsForTests(): void {
	establishedAt.clear()
	connections.clear()
	notify()
}
