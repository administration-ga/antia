// Dupliqué de socle/packages/agent-features/src/features/iappel/call-timer.ts @ ad2e7fdc2 — adaptations : heure relative du journal traduite par i18n (`locale` puis `t` ajoutés en derniers paramètres de `formatClockTime`, clés `iappel:callTimer.…`) ; dates formatées dans la langue courante (`Intl` avec `locale`, plus de `fr-FR` en dur).
/**
 * call-timer — combien de temps dure un appel, et depuis quand.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE MODULE DÉCIDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le chrono d'un appel se recalcule à chaque tick (`setInterval`), et une
 * horloge d'appel a deux défauts à éviter absolument : reculer (un décalage
 * d'horloge, un `startedAt` mal ordonné) et afficher `NaN` (une division par
 * une valeur non numérique qui remonte jusqu'à l'écran sans planter). Les deux
 * sont corrigés ICI, une seule fois, plutôt que dans chaque composant qui
 * affiche une durée.
 *
 * `formatClockTime` répond à un besoin différent : un journal d'appels
 * (manqués, reçus, passés) ne montre pas une DURÉE mais un INSTANT, et cet
 * instant doit rester lisible d'un coup d'œil — proche dans le temps, on le
 * dit en relatif (« à l'instant », « il y a 12 min ») ; plus loin, on retombe
 * sur une heure ou une date, jamais sur les deux à la fois.
 *
 * Aucun import React, aucun import LiveKit : module pur, testable en
 * environnement `node`. La langue et la traduction sont REÇUES (`locale`,
 * `t`, clés qualifiées `iappel:callTimer.…`).
 */

import type { TFunction } from "i18next"

/**
 * Rend une durée au format d'un chronomètre d'appel : `MM:SS`, ou `H:MM:SS`
 * au-delà d'une heure (les minutes ne débordent jamais au-delà de 59 tant
 * qu'il n'y a pas d'heure à afficher).
 *
 * Une valeur négative ou non numérique (`NaN`, `Infinity`) rend `"00:00"` :
 * un chrono d'appel ne recule jamais et n'affiche jamais un artefact de
 * calcul.
 */
export function formatElapsed(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "00:00"

	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	const mm = String(minutes).padStart(2, "0")
	const ss = String(seconds).padStart(2, "0")
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Millisecondes écoulées depuis `startedAt`, jamais négatives.
 *
 * `startedAt` absent (appel pas encore décroché, pas encore établi) rend `0`
 * plutôt que de propager `null`/`undefined` jusqu'au calcul — c'est sinon
 * chaque site d'appel qui devrait réécrire la même garde.
 */
export function elapsedSince(startedAt: number | null | undefined, now: number): number {
	if (startedAt === null || startedAt === undefined) return 0
	const diff = now - startedAt
	return diff > 0 ? diff : 0
}

/** Un jour civil, comparé sur l'heure LOCALE de la machine — jamais en UTC. */
function isSameLocalDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	)
}

/**
 * Heure relative COURTE pour un journal d'appels, dans la langue de l'écran.
 *
 * L'échelle est volontairement dégressive : plus l'instant est proche, plus
 * la phrase est parlée (« à l'instant », « il y a 12 min ») ; plus il est
 * loin, plus elle redevient un repère calendaire (heure du jour, « hier »,
 * puis jour + mois — avec l'année seulement si elle diffère de celle de
 * `now`, sans quoi CHAQUE ligne d'un vieux journal l'afficherait pour rien).
 *
 * Les jours se comparent sur l'heure LOCALE de la machine qui affiche : c'est
 * un journal lu par une personne sur son appareil, pas un log serveur en UTC.
 */
export function formatClockTime(at: number, now: number, locale: string, t: TFunction): string {
	const diffMs = now - at

	// Un horodatage dans le futur (dérive d'horloge, ligne qui vient d'arriver
	// pendant le calcul) ne doit pas produire une durée négative absurde : il
	// se traite comme le cas le plus proche, « à l'instant ».
	if (diffMs < 60_000) return t("iappel:callTimer.justNow")
	if (diffMs < 3_600_000) return t("iappel:callTimer.minutesAgo", { minutes: Math.floor(diffMs / 60_000) })

	const date = new Date(at)
	const today = new Date(now)
	if (isSameLocalDay(date, today)) {
		return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date)
	}

	const yesterday = new Date(today)
	yesterday.setDate(yesterday.getDate() - 1)
	if (isSameLocalDay(date, yesterday)) return t("iappel:callTimer.yesterday")

	const sameYear = date.getFullYear() === today.getFullYear()
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: sameYear ? undefined : "numeric",
	}).format(date)
}
