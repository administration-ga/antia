// Dupliqué de socle/packages/agent-features/src/features/iappel/call-host-store.ts @ ad2e7fdc2 — adaptations : documentation seulement — carte du poste et magasin `icom-poste-store` retirés des exemples (un seul espace, le réseau) ; aucune donnée persistée, donc aucun préfixe de stockage.
"use client"

/**
 * call-host-store — le REGISTRE des cartes iCom qui peuvent héberger un appel.
 *
 * Deux faits d'exécution, jamais persistés, branchés à React par
 * `useSyncExternalStore` :
 *
 *   · les CARTES déclarées (`registerCallHost`) — chacune avec l'élément DOM
 *     de son corps, les scopes qu'elle accepte et sa forme du moment. Une
 *     carte se déclare quand elle est montée au BUREAU, se retire au
 *     démontage : au téléphone réel (< 960 px), rien ne se déclare et l'appel
 *     prend l'écran comme avant ;
 *   · ce que l'HÔTE de la couche d'appel a DÉCIDÉ (`publishCallHosting`) :
 *     quelle carte, et quel mode (`cover` ou `strip`). C'est lui qui calcule le
 *     plan (`planCallSurface`) — une seule réponse à « où est l'appel ». La
 *     carte ne calcule rien : elle LIT son mode et se met en forme.
 *
 * ⚠️ Un singleton de module, et non un contexte : la carte iCom vit dans la
 * page du réseau, l'hôte d'appel dans la coque — des arbres que rien ne
 * relie.
 */

import { useSyncExternalStore } from "react"
import {
	pickCallHost,
	type CallHostingView,
	type CallHostMode,
	type CallHostPose,
	type CallHostView,
	type CallRingingView,
} from "./call-host"
import type { CallScope } from "./call-types"

export interface CallHost extends CallHostView {
	/** Le corps de la carte : la surface d'appel y PORTAILLE son rendu. */
	element: HTMLElement
}

export type CallHosting = CallHostingView

let hosts: readonly CallHost[] = []
let hosting: CallHosting | null = null
/**
 * Ce qui SONNE, publié par l'hôte — pour qu'une carte FERMÉE se réveille :
 * elle n'est pas déclarée tant qu'elle est fermée, l'hôte ne peut donc pas la
 * choisir ; elle lit la sonnerie et s'ouvre, puis se déclare, puis l'hôte la
 * couvre.
 */
let ringing: CallRingingView | null = null
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

function getHosts(): readonly CallHost[] {
	return hosts
}
/** ⚠️ Instantané SERVEUR figé : `useSyncExternalStore` exige une référence stable. */
const NO_HOSTS: readonly CallHost[] = Object.freeze([])
function getServerHosts(): readonly CallHost[] {
	return NO_HOSTS
}

function getHosting(): CallHosting | null {
	return hosting
}
function getServerHosting(): CallHosting | null {
	return null
}

/**
 * Déclare une carte. Le retour la retire (idempotent).
 *
 * Une carte déjà déclarée sous le même identifiant est REMPLACÉE À SA PLACE
 * — un corps qui change d'élément (la carte passe du rail au portail) ne
 * doit pas la faire remonter en tête de récence.
 */
export function registerCallHost(host: CallHost): () => void {
	const index = hosts.findIndex((entry) => entry.id === host.id)
	if (index >= 0) {
		hosts = hosts.map((entry, position) => (position === index ? host : entry))
	} else {
		hosts = [...hosts, host]
	}
	notify()
	return () => {
		// Ne retirer QUE cette déclaration : une re-déclaration plus récente du
		// même identifiant (autre élément) ne doit pas tomber avec l'ancienne.
		if (!hosts.some((entry) => entry.id === host.id && entry.element === host.element)) {
			return
		}
		hosts = hosts.filter((entry) => entry.id !== host.id)
		notify()
	}
}

/** La forme de la carte a changé — même place dans la récence. */
export function updateCallHostPose(id: string, pose: CallHostPose): void {
	const current = hosts.find((entry) => entry.id === id)
	if (current === undefined || current.pose === pose) return
	hosts = hosts.map((entry) => (entry.id === id ? { ...entry, pose } : entry))
	notify()
}

/** Publié par l'hôte de la couche d'appel, et par lui seul. */
export function publishCallHosting(next: CallHosting | null): void {
	if (hosting === next) return
	if (
		hosting !== null &&
		next !== null &&
		hosting.id === next.id &&
		hosting.mode === next.mode
	) {
		return
	}
	hosting = next
	notify()
}

/** Publié par l'hôte de la couche d'appel, et par lui seul : ce qui sonne. */
export function publishCallRinging(next: CallRingingView | null): void {
	if (ringing === next) return
	if (ringing !== null && next !== null && ringing.scope === next.scope) return
	ringing = next
	notify()
}

function getRinging(): CallRingingView | null {
	return ringing
}
function getServerRinging(): CallRingingView | null {
	return null
}

/** La carte qui héberge un appel de ce scope, ou `null` (surface libre). */
export function useCallHostFor(scope: CallScope): CallHost | null {
	const list = useSyncExternalStore(subscribe, getHosts, getServerHosts)
	return pickCallHost(list, scope)
}

/** Ce que l'appel occupe dans CETTE carte — `none` si elle n'héberge rien. */
export function useCallHostMode(id: string): CallHostMode {
	const current = useSyncExternalStore(subscribe, getHosting, getServerHosting)
	return current !== null && current.id === id ? current.mode : "none"
}

/** Ce qui sonne au bureau, hors appel en attente — lu par une carte fermée. */
export function useCallRinging(): CallRingingView | null {
	return useSyncExternalStore(subscribe, getRinging, getServerRinging)
}

/** Réservé aux tests : remet le registre à zéro. */
export function resetCallHostsForTests(): void {
	hosts = []
	hosting = null
	ringing = null
	notify()
}
