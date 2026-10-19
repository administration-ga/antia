// Dupliqué de socle/packages/agent-features/src/features/iappel/media-watchdog.ts @ ad2e7fdc2 — adaptations : phrase de la caméra muette traduite par i18n — la constante `CAMERA_START_TIMEOUT_MESSAGE` devient la fonction `cameraStartTimeoutMessage(t)` (clé `iappel:mediaWatchdog.cameraTimeout`).
/**
 * media-watchdog — « la caméra a-t-elle RÉPONDU ? »
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE (recette du 2026-09-13, appel de groupe)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `localParticipant.setCameraEnabled(true)` peut ne JAMAIS aboutir, sans lever
 * la moindre erreur : `getUserMedia` reste en attente quand l'autorisation est
 * accordée APRÈS COUP dans la barre d'adresse (Chrome exige alors un
 * rechargement), quand l'invite de permission n'est jamais tranchée, ou quand
 * le périphérique ne répond pas. Les journaux LiveKit ne montrent alors qu'une
 * chose : les appels suivants attendent la publication en cours et abandonnent
 * (« waiting for pending publication promise timed out »), tandis que
 * l'intention « caméra » reste allumée dans le magasin. Le bouton disait
 * « Caméra », la vignette montrait un avatar, et rien ne disait pourquoi.
 *
 * Ce module ne connaît ni LiveKit ni React : il tranche une course entre une
 * promesse et une horloge, et fournit la phrase à afficher (traduite par le
 * `t` reçu). La décision (éteindre l'intention, avertir) reste à l'appelant.
 */

import type { TFunction } from "i18next"

/**
 * Délai avant de déclarer la caméra muette. Supérieur aux 10 s que
 * livekit-client accorde à une publication en attente : on ne veut pas parler
 * avant lui, seulement après.
 */
export const CAMERA_START_TIMEOUT_MS = 15_000

/** Ce qu'on dit à l'usager quand la caméra ne répond pas. */
export function cameraStartTimeoutMessage(t: TFunction): string {
	return t("iappel:mediaWatchdog.cameraTimeout")
}

export type MediaStartOutcome = "settled" | "timeout"

/**
 * Attend `attempt` au plus `timeoutMs`. Un échec de `attempt` vaut « réglé » :
 * l'erreur, elle, est traitée par l'appelant sur la promesse d'origine — ce
 * module ne juge que le SILENCE.
 */
export async function raceMediaStart(
	attempt: Promise<unknown>,
	timeoutMs: number,
): Promise<MediaStartOutcome> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const clock = new Promise<MediaStartOutcome>((resolve) => {
		timer = setTimeout(() => resolve("timeout"), timeoutMs)
	})
	const settled = attempt.then(
		(): MediaStartOutcome => "settled",
		(): MediaStartOutcome => "settled",
	)
	try {
		return await Promise.race([settled, clock])
	} finally {
		if (timer !== undefined) clearTimeout(timer)
	}
}
