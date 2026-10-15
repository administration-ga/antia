// Dupliqué de socle/packages/agent-features/src/features/iappel/media-errors.ts @ ad2e7fdc2 — adaptations : phrases traduites par i18n, texte français du socle à l'identique (`t` ajouté en dernier paramètre de `describeCameraError`, `describeMicError`, `describeCallMediaError`, `describeMicBlockedInCall` et `describeCameraFailure` ; clés `iappel:mediaErrors.…`).
/**
 * media-errors — traduire les erreurs `getUserMedia` en phrases utiles.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * D'OÙ ÇA VIENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `describeCameraError` et `describeMicError` vivaient dans `DirectCallView`,
 * couplées à un composant React alors qu'elles ne dépendent d'aucun DOM ni
 * d'aucun hook : c'est une simple traduction de `DOMException.name` vers une
 * phrase. Les extraire ici les rend réutilisables — le store d'appel a besoin
 * de savoir si une erreur caméra est un REFUS DE PERMISSION pour décider de
 * revenir en arrière sur l'intention caméra — et testables sans monter le
 * composant.
 *
 * Les messages sont ceux du socle, À L'IDENTIQUE en français : ils sont déjà
 * rédigés et éprouvés en production, ce n'est pas le moment de les
 * reformuler. Ils vivent dans les locales (clés `iappel:mediaErrors.…`).
 *
 * Aucun import React, aucun import LiveKit : module pur, testable en
 * environnement `node`. La traduction est REÇUE (`t`).
 */

import type { TFunction } from "i18next"

/**
 * Nom d'erreur `getUserMedia`, lu au mieux-disant : l'objet qui arrive ici
 * n'est pas toujours une vraie `DOMException` (les navigateurs, les polyfills
 * et les mocks de test rendent parfois un simple objet `{ name }`).
 */
function errorName(err: unknown): string {
	return (err as { name?: string } | null)?.name ?? ""
}

/**
 * Une permission REFUSÉE ne se réessaie pas toute seule : contrairement à
 * « pas de périphérique » ou « déjà utilisé ailleurs », relancer
 * `getUserMedia` sans action de l'utilisateur (rouvrir la permission dans le
 * navigateur) échoue de nouveau à coup sûr. Sert à décider si le store doit
 * REVENIR EN ARRIÈRE sur l'intention caméra plutôt que de laisser un bouton
 * qui échouerait en boucle silencieuse.
 */
export function isPermissionDenied(err: unknown): boolean {
	const name = errorName(err)
	return name === "NotAllowedError" || name === "PermissionDeniedError"
}

/** Traduit une erreur d'activation de CAMÉRA en phrase affichable. */
export function describeCameraError(err: unknown, t: TFunction): string {
	const name = errorName(err)
	if (name === "NotAllowedError" || name === "PermissionDeniedError") {
		return t("iappel:mediaErrors.camera.denied")
	}
	if (name === "NotFoundError" || name === "DevicesNotFoundError") {
		return t("iappel:mediaErrors.camera.notFound")
	}
	if (name === "NotReadableError" || name === "TrackStartError") {
		return t("iappel:mediaErrors.camera.inUse")
	}
	return t("iappel:mediaErrors.camera.generic")
}

/** Traduit une erreur d'activation de MICRO en phrase affichable. */
export function describeMicError(err: unknown, t: TFunction): string {
	const name = errorName(err)
	if (name === "NotAllowedError" || name === "PermissionDeniedError") {
		return t("iappel:mediaErrors.mic.denied")
	}
	if (name === "NotFoundError" || name === "DevicesNotFoundError") {
		return t("iappel:mediaErrors.mic.notFound")
	}
	if (name === "NotReadableError" || name === "TrackStartError") {
		return t("iappel:mediaErrors.mic.inUse")
	}
	return t("iappel:mediaErrors.mic.generic")
}

/**
 * Les noms d'erreur que `getUserMedia` produit — et EUX SEULS.
 *
 * ⚠️ Sert à ne pas confondre deux pannes que rien ne rapproche. Le `onError`
 * d'un `<LiveKitRoom>` reçoit aussi bien un refus de micro qu'un échec de
 * WebSocket ; répondre « vérifiez votre réseau » à une permission refusée, ou
 * « autorisez le micro » à une coupure de réseau, envoie l'usager chercher la
 * panne exactement là où elle n'est pas.
 */
const MEDIA_ERROR_NAMES: ReadonlySet<string> = new Set([
	"NotAllowedError",
	"PermissionDeniedError",
	"NotFoundError",
	"DevicesNotFoundError",
	"NotReadableError",
	"TrackStartError",
	"OverconstrainedError",
	"ConstraintNotSatisfiedError",
])

/** L'échec vient-il de l'ACCÈS aux périphériques, et non du réseau ? */
export function isMediaAccessError(err: unknown): boolean {
	return MEDIA_ERROR_NAMES.has(errorName(err))
}

/**
 * La phrase à dire quand un APPEL n'a pas pu prendre ses périphériques —
 * `null` quand l'échec n'a rien à voir avec eux, pour que l'appelant garde
 * son message de réseau.
 *
 * `useLiveKitRoom` publie micro, caméra et partage d'écran dans un SEUL
 * `Promise.all` : la promesse rejetée ne dit pas lequel a échoué. On s'en
 * remet donc à ce que l'appel demandait — la seule information sûre.
 */
export function describeCallMediaError(
	err: unknown,
	options: { video?: boolean } | undefined,
	t: TFunction,
): string | null {
	if (!isMediaAccessError(err)) return null
	if (options?.video !== true) return describeMicError(err, t)

	const name = errorName(err)
	if (name === "NotAllowedError" || name === "PermissionDeniedError") {
		return t("iappel:mediaErrors.callMedia.denied")
	}
	if (name === "NotFoundError" || name === "DevicesNotFoundError") {
		return t("iappel:mediaErrors.callMedia.notFound")
	}
	if (name === "NotReadableError" || name === "TrackStartError") {
		return t("iappel:mediaErrors.callMedia.inUse")
	}
	return t("iappel:mediaErrors.callMedia.generic")
}

/**
 * UN MICRO QUI NE DÉMARRE PAS NE FAIT PLUS TOMBER L'APPEL (recette du 22/09).
 *
 * Jusque-là, un micro refusé titrait l'écran « Connexion impossible » avec un
 * seul bouton, Raccrocher — pendant que le correspondant lisait « En
 * communication » : la salle était jointe, seul le micro manquait. L'appel
 * continue désormais en ÉCOUTE SEULE, la commande devient « Micro bloqué », et
 * cette phrase dit ce qui se passe et la seule action qui débloque. Le tap sur
 * « Micro bloqué » RÉESSAIE : un micro autorisé entre-temps dans la barre
 * d'adresse repart sans recharger la page — donc sans perdre l'appel, ce que
 * « puis rechargez la page » imposait.
 *
 * `failure` est une valeur de `MediaDeviceFailure` (livekit-client) : ce module
 * reste pur et ne l'importe pas.
 */
export function describeMicBlockedInCall(failure: string | null | undefined, t: TFunction): string {
	const suite = t("iappel:mediaErrors.micBlocked.consequence")
	if (failure === "PermissionDenied") {
		return t("iappel:mediaErrors.micBlocked.denied", { consequence: suite })
	}
	if (failure === "NotFound") {
		return t("iappel:mediaErrors.micBlocked.notFound", { consequence: suite })
	}
	if (failure === "DeviceInUse") {
		return t("iappel:mediaErrors.micBlocked.inUse", { consequence: suite })
	}
	return t("iappel:mediaErrors.micBlocked.generic", { consequence: suite })
}

/**
 * La même traduction pour la CAMÉRA, depuis une valeur de `MediaDeviceFailure` :
 * les phrases éprouvées de `describeCameraError`, sans les recopier.
 */
export function describeCameraFailure(failure: string | null | undefined, t: TFunction): string {
	const name =
		failure === "PermissionDenied"
			? "NotAllowedError"
			: failure === "NotFound"
				? "NotFoundError"
				: failure === "DeviceInUse"
					? "NotReadableError"
					: ""
	return describeCameraError({ name }, t)
}
