// Dupliqué de socle/packages/agent-features/src/features/notifications/notification-center-store.ts @ ad2e7fdc2 — adaptations : l'ONGLET de la carte retiré avec l'onglet « Administration » (champ `tab`, `selectNotificationCenterTab` et le type `CenterTab`) — la carte n'a plus qu'une source, la cloche sociale du réseau ; commentaires sans la table centrale ni l'adresse de l'espace agent (la page réseau et ses paramètres de vue `?tab=activite` / `?notifications=1`).
/**
 * notification-center-store — l'état OUVERT/FERMÉ du centre de notifications
 * (la carte flottante sous la cloche), partagé par toutes les surfaces.
 *
 * Pourquoi un magasin et non un état local de la cloche : les anciens liens
 * de la page réseau (`?tab=activite`, `?notifications=1`) doivent continuer à
 * aboutir — la page réseau consomme ce paramètre UNE fois et demande
 * l'ouverture du centre ; la cloche, montée ailleurs dans la coque, l'entend
 * par ce magasin. Aucune donnée de notification n'y transite : la liste reste
 * servie dans la carte par ses requêtes (`notifications.bell`).
 *
 * Fonctions pures d'état + `useSyncExternalStore`, même recette que
 * `messagerie/dock-store.ts`. Aucune persistance : un centre ouvert ne
 * survit pas au rechargement, et c'est voulu (une notification se relit) —
 * donc aucun préfixe de stockage par réseau à configurer.
 */

import { useSyncExternalStore } from "react"

export interface NotificationCenterState {
	/** La carte est-elle ouverte ? */
	open: boolean
	/**
	 * Compteur d'ouvertures DEMANDÉES : permet à une cloche montée après la
	 * demande (hydratation, changement de coque) de l'honorer quand même.
	 */
	requestSeq: number
}

const INITIAL: NotificationCenterState = {
	open: false,
	requestSeq: 0,
}

let state: NotificationCenterState = INITIAL
const listeners = new Set<() => void>()

function emit(next: NotificationCenterState): void {
	if (next === state) return
	state = next
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSnapshot(): NotificationCenterState {
	return state
}

function getServerSnapshot(): NotificationCenterState {
	return INITIAL
}

/** Ouvre le centre (idempotent sur `open`, mais incrémente la demande). */
export function openNotificationCenter(): void {
	emit({ open: true, requestSeq: state.requestSeq + 1 })
}

/** Ferme le centre ; sans effet s'il l'est déjà (une ligne de la liste l'appelle aussi). */
export function closeNotificationCenter(): void {
	if (!state.open) return
	emit({ ...state, open: false })
}

export function toggleNotificationCenter(): void {
	if (state.open) closeNotificationCenter()
	else openNotificationCenter()
}

/** Réservé aux tests : remet le magasin à son état initial. */
export function resetNotificationCenterForTests(): void {
	emit(INITIAL)
}

export function readNotificationCenter(): NotificationCenterState {
	return state
}

export function useNotificationCenter(): NotificationCenterState {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
