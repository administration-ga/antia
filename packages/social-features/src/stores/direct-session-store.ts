// Dupliqué de socle/packages/agent-features/src/stores/direct-session-store.ts @ ad2e7fdc2 — adaptations : identifiants du moteur ; dépendance iAsted retirée ; un magasin par montage du réseau, remis à zéro par la coque.
"use client"

/**
 * direct-session-store — MA connexion au direct courant, hors de l'arbre React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN MAGASIN, ET NON UN `useState` DANS LA PAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DirectPage` rend DEUX arbres selon le palier (page ≥ 960 px, plein écran
 * en dessous) et le second passe par un portail vers `<body>`. Tant que les
 * credentials, le rôle du jeton et l'intention média vivaient dans `LiveArea`,
 * franchir 959 px les DÉTRUISAIT : la salle se fermait, les pistes publiées
 * s'arrêtaient, et l'hôte re-demandait aussitôt un jeton — avec un nouveau
 * nonce d'identité, donc un SECOND participant SFU pour le même sujet le temps
 * que l'ancien expire (constat D-08 de l'audit du 2026-09-06).
 *
 * Le patron est celui d'`active-meeting-store.ts` : un état de module, un
 * `useSyncExternalStore`, aucune dépendance. Il est volontairement conçu pour
 * être hissé plus tard dans `AppShell` à côté de `FloatingMeetingWindow`
 * (fenêtre flottante du direct, lot 07) SANS réécriture — c'est pourquoi il ne
 * suppose rien de la page qui l'utilise.
 *
 * ⚠️ Depuis le 2026-09-14, quitter la page n'est PLUS quitter le direct : le
 * magasin est HISSÉ — `DirectSessionHost` (shell) monte la salle et la carte
 * flottante, `DirectPage` n'est plus qu'une présentation. `leave()` n'est
 * appelé que par un geste explicite (« Quitter », « Terminer », rétrogradation).
 */

import type { Id } from "@antsia/api/engine"
import { useSyncExternalStore } from "react"
import {
	credentialTransition,
	type AntennaCredentialRole,
	type AntennaSessionRole,
} from "../features/direct/direct-antenna"
import type { LiveCallHold } from "../features/direct/direct-call-coexistence"

export type DirectSessionId = Id<"liveSessions">

/** Le rôle porté par le JETON — ce que le SFU autorise, pas ce que la base dit. */
export type DirectCredentialRole = AntennaCredentialRole

/**
 * L'état OPÉRATIONNEL de la connexion. Il ne remplace jamais le statut métier
 * de la session (`scheduled`/`live`/`ended`), qui reste au serveur : les deux
 * cohabitent, comme le demande le modèle du lot 06.
 *
 *  · `idle`          aucune session tenue ;
 *  · `preparing`     préparation locale du média en cours (aperçu, permissions) ;
 *  · `ready`         session tenue, aucun jeton — on attend le geste d'entrée ;
 *  · `connecting`    jeton demandé ou salle en cours d'ouverture ;
 *  · `connected`     salle établie ;
 *  · `reconnecting`  la salle se rétablit d'elle-même (réseau, bascule 4G) ;
 *  · `disconnected`  la salle est tombée APRÈS avoir été établie ;
 *  · `error`         la dernière tentative a échoué — `error` porte la phrase.
 */
export type DirectSessionPhase =
	| "idle"
	| "preparing"
	| "ready"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "error"

/**
 * Ce que la personne VEUT publier. Distinct de ce qui EST publié : le SFU peut
 * refuser, le navigateur aussi. Les props `audio`/`video` du `<LiveKitRoom>`
 * en dérivent et restent donc VIVANTES — `useLiveKitRoom` les ré-applique à
 * chaque `SignalConnected`, si bien qu'une intention figée écrasait à chaque
 * reconnexion le micro que l'on venait de couper à la main.
 */
export interface DirectMediaIntent {
	micEnabled: boolean
	cameraEnabled: boolean
	/** Audio seul : la caméra reste éteinte même si `cameraEnabled` est vrai. */
	audioOnly: boolean
	audioDeviceId?: string
	videoDeviceId?: string
}

export interface DirectCredentials {
	token: string
	wsUrl: string
	role: DirectCredentialRole
	/**
	 * Millisecondes epoch de l'émission. Le jeton vit UNE HEURE
	 * (`DIRECT_TOKEN_TTL_SECONDS`, convex/modules/direct/grants.ts) : au-delà,
	 * une reconnexion avec le même jeton est refusée par le SFU — il faut en
	 * redemander un.
	 */
	issuedAt: number
}

export interface DirectSessionState {
	sessionId: DirectSessionId | null
	credentials: DirectCredentials | null
	phase: DirectSessionPhase
	intent: DirectMediaIntent
	error: string | null
	/**
	 * Le rôle du DERNIER jeton obtenu, conservé après que les credentials ont
	 * été vidés : la query de rôle et `onDisconnected` peuvent arriver dans
	 * n'importe quel ordre, et sans cette mémoire une rétrogradation où le SFU
	 * gagne la course perdrait son message explicite.
	 */
	lastCredentialRole: DirectCredentialRole | null
	/**
	 * Ce que le direct a retenu de lui-même quand un APPEL a pris la ligne
	 * (`direct-call-coexistence.ts`) : le micro était-il allumé avant. `null`
	 * hors appel. Effacé par `leave` — un direct quitté n'a rien à rendre.
	 */
	callHold: LiveCallHold | null
	/**
	 * La carte flottante est-elle RÉDUITE en pilule (bureau) ? Une pose, pas
	 * une donnée métier : elle ne survit ni à `leave`, ni à un autre direct.
	 */
	cardMinimized: boolean
}

/** Durée de vie d'un jeton de direct, en millisecondes (miroir du serveur). */
export const DIRECT_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * L'intention par défaut : micro et caméra demandés, pas d'audio seul. C'est
 * l'intention que l'ancienne page appliquait en dur (`audio={isPublisher}`,
 * `video={isPublisher}`) — la rendre explicite ne change rien au comportement
 * observé, elle le rend seulement modifiable.
 */
export const DIRECT_DEFAULT_MEDIA_INTENT: DirectMediaIntent = {
	micEnabled: true,
	cameraEnabled: true,
	audioOnly: false,
}

const initialState: DirectSessionState = {
	sessionId: null,
	credentials: null,
	phase: "idle",
	intent: { ...DIRECT_DEFAULT_MEDIA_INTENT },
	error: null,
	lastCredentialRole: null,
	callHold: null,
	cardMinimized: false,
}

let state: DirectSessionState = initialState
let snapshot: DirectSessionState = state
const listeners = new Set<() => void>()

/**
 * Un direct est-il VIVANT pour la voix d'iAsted ? Connexion, diffusion ou
 * reconnexion : la session vocale se tait et coupe son micro, comme pendant un
 * appel (lot 0 du plan de comportement d'iAsted, 29/09/2026).
 */
export function isDirectSessionLive(input: Pick<DirectSessionState, "phase">): boolean {
	return (
		input.phase === "connecting" ||
		input.phase === "connected" ||
		input.phase === "reconnecting"
	)
}

function emit() {
	snapshot = { ...state }
	for (const l of listeners) l()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSnapshot() {
	return snapshot
}

export const directSessionStore = {
	getState(): DirectSessionState {
		return snapshot
	},

	/**
	 * Prend la session en charge. Sur une session DIFFÉRENTE, tout repart de
	 * zéro (y compris l'intention : l'audio seul choisi pour un direct ne se
	 * reporte pas sur le suivant). Sur la MÊME, l'intention déjà exprimée est
	 * conservée et seul le correctif passé en argument s'y applique — c'est ce
	 * qui permet à la préparation locale d'être rejouée sans effacer un choix.
	 */
	prepare(sessionId: DirectSessionId, intent?: Partial<DirectMediaIntent>) {
		const sameSession = state.sessionId === sessionId
		// ⚠️ Une session RELÂCHÉE (`leave`) n'est pas une AUTRE session.
		// `leave` garde l'intention par contrat ; si `prepare` la réinitialisait
		// en revenant, quitter puis re-rejoindre le même direct rallumerait la
		// caméra qu'on venait d'éteindre — exactement ce que `leave` promet
		// d'éviter.
		const keepIntent = sameSession || state.sessionId === null
		state = {
			sessionId,
			credentials: sameSession ? state.credentials : null,
			phase: sameSession && state.credentials !== null ? state.phase : "ready",
			intent: keepIntent
				? { ...state.intent, ...intent }
				: { ...DIRECT_DEFAULT_MEDIA_INTENT, ...intent },
			error: null,
			lastCredentialRole: sameSession ? state.lastCredentialRole : null,
			// La retenue d'appel et la pose de la carte appartiennent à la
			// session en cours : une autre session repart sans elles.
			callHold: sameSession ? state.callHold : null,
			cardMinimized: sameSession ? state.cardMinimized : false,
		}
		emit()
	},

	/**
	 * ⚠️ IGNORÉ si la session tenue n'est plus celle du jeton. Une action
	 * Convex met plusieurs centaines de millisecondes : la personne peut avoir
	 * quitté ce direct entre la demande et la réponse, et poser le jeton d'une
	 * session que l'on ne regarde plus ouvrirait une salle fantôme.
	 */
	setCredentials(args: {
		sessionId: DirectSessionId
		token: string
		wsUrl: string
		role: DirectCredentialRole
		issuedAt?: number
	}) {
		if (state.sessionId !== args.sessionId) return
		state = {
			...state,
			credentials: {
				token: args.token,
				wsUrl: args.wsUrl,
				role: args.role,
				issuedAt: args.issuedAt ?? Date.now(),
			},
			lastCredentialRole: args.role,
			phase: "connecting",
			error: null,
		}
		emit()
	},

	/**
	 * L'état opérationnel, posé par le propriétaire de la salle.
	 *
	 * ⚠️ `error` RETIRE les credentials : un jeton que le SFU refuse ne
	 * deviendra pas valide en réessayant, et laisser la salle montée la ferait
	 * boucler sur le même refus. Les autres phases n'y touchent jamais.
	 *
	 * Ignoré sans session tenue : `leave()` a pu passer entre l'événement
	 * LiveKit et son traitement, et le rendre à un état de connexion
	 * ressusciterait une session que l'on vient de quitter.
	 */
	setPhase(phase: DirectSessionPhase, error?: string | null) {
		if (state.sessionId === null) return
		state = {
			...state,
			phase,
			error: phase === "error" ? (error ?? state.error) : null,
			credentials: phase === "error" ? null : state.credentials,
		}
		emit()
	},

	/** Correctif d'intention — les champs absents ne bougent pas. */
	setIntent(intent: Partial<DirectMediaIntent>) {
		state = { ...state, intent: { ...state.intent, ...intent } }
		emit()
	},

	/**
	 * Ce que le direct retient de lui-même pendant un APPEL (le micro d'avant).
	 * Posé et effacé par `DirectCallCoexistence`, jamais par une présentation.
	 * Ignoré sans session tenue : il n'y a rien à retenir.
	 */
	setCallHold(hold: LiveCallHold | null) {
		if (state.sessionId === null) return
		if (state.callHold === hold) return
		if (
			state.callHold !== null &&
			hold !== null &&
			state.callHold.micWasEnabled === hold.micWasEnabled
		) {
			return
		}
		state = { ...state, callHold: hold }
		emit()
	},

	/** La carte flottante se réduit en pilule, ou se redéploie (bureau). */
	setCardMinimized(minimized: boolean) {
		if (state.cardMinimized === minimized) return
		state = { ...state, cardMinimized: minimized }
		emit()
	},

	/**
	 * La base a changé mon rôle : un JWT LiveKit est immuable, la connexion en
	 * cours garde SON ancien grant. On la ferme et on mémorise le rôle du
	 * jeton perdu pour que l'écran puisse dire ce qui s'est passé.
	 *
	 * Rend la transition constatée — `"none"` quand il n'y a rien à faire.
	 */
	syncSessionRole(
		sessionId: DirectSessionId,
		sessionRole: AntennaSessionRole,
	): "none" | "rejoin-speaker" | "rejoin-viewer" {
		if (state.sessionId !== sessionId) return "none"
		const credentialRole = state.credentials?.role ?? state.lastCredentialRole
		if (!credentialRole) return "none"
		const transition = credentialTransition(credentialRole, sessionRole)
		if (transition === "none") return "none"
		if (state.credentials === null) return transition
		state = {
			...state,
			credentials: null,
			lastCredentialRole: credentialRole,
			phase: "ready",
			error: null,
		}
		emit()
		return transition
	},

	/**
	 * Sortie — volontaire ou par démontage de la page. L'INTENTION SURVIT :
	 * revenir sur le direct ne doit pas rallumer une caméra que l'on venait
	 * d'éteindre. Tout le reste repart de zéro.
	 */
	leave() {
		state = { ...initialState, intent: { ...state.intent } }
		emit()
	},

	__resetForTests() {
		state = { ...initialState, intent: { ...DIRECT_DEFAULT_MEDIA_INTENT } }
		emit()
	},
}

export function useDirectSessionStore(): DirectSessionState {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Le micro doit-il être publié ? Un SPECTATEUR ne publie jamais — son jeton ne
 * le permet pas, et le lui proposer serait un bouton refusé.
 */
export function directWantsAudio(
	role: DirectCredentialRole,
	intent: DirectMediaIntent,
): boolean {
	return role === "speaker" && intent.micEnabled
}

/** La caméra ? Même règle, et l'audio seul l'emporte sur la caméra demandée. */
export function directWantsVideo(
	role: DirectCredentialRole,
	intent: DirectMediaIntent,
): boolean {
	return role === "speaker" && intent.cameraEnabled && !intent.audioOnly
}

/**
 * Le jeton est-il périmé ? Un direct de plus d'une heure qui perd le réseau ne
 * peut PAS se reconnecter avec son jeton d'origine : il faut en redemander un.
 */
export function directTokenExpired(
	credentials: Pick<DirectCredentials, "issuedAt"> | null,
	now: number,
): boolean {
	if (credentials === null) return false
	return now - credentials.issuedAt >= DIRECT_TOKEN_TTL_MS
}
