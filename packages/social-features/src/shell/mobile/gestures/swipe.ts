// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/gestures/swipe.ts @ ad2e7fdc2 — adaptations : décisions inchangées ; `velocityAlong` garde explicitement ses accès indexés (`noUncheckedIndexedAccess` du moteur), même résultat ; déplacé dans la coque (`shell/mobile/gestures/`).
/**
 * swipe — machine de suivi de geste PURE pour le pager vertical (LOT M2).
 *
 * `packages/agent-features` tourne en environnement `node`, SANS
 * testing-library : aucun test de composant n'y est possible (cf. CLAUDE.md).
 * Ce qui est une DÉCISION ici — quand un geste engage un axe, quand il
 * déclenche un changement d'élément, comment il résiste au bord — vit donc
 * dans ce module pur et vérifiable, jamais dans `VerticalPager.tsx` ni dans
 * le hook `usePointerSwipe`, qui ne font qu'APPLIQUER ce qui est décidé ici.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONVENTION DE SIGNE — LA PARTIE QUI COMPTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `shouldCommit` ne connaît pas d'axe : il ne voit qu'un offset et une
 * vélocité SIGNÉS, et rend une direction dans ce même repère. Pour le pager
 * vertical qui consomme ce module, l'axe est `y`, et la convention retenue
 * est celle d'un fil façon Reels/TikTok :
 *
 *   glisser vers le HAUT (le doigt monte, `y` DIMINUE, offset NÉGATIF)
 *   ⇒ élément SUIVANT, direction `1`
 *
 *   glisser vers le BAS (offset POSITIF)
 *   ⇒ élément PRÉCÉDENT, direction `-1`
 *
 * `settleTarget` respecte la même convention : le point de repos d'un commit
 * « suivant » est `-size` (le même signe que l'offset qui l'a déclenché),
 * jamais `+size`.
 *
 * Aucun import : ce module ne connaît que des nombres et des horodatages.
 */

/** En-deçà de ce seuil, aucun axe n'est engagé — le geste reste `pending`. */
export const SWIPE_HYSTERESIS_PX = 10

/** Fraction de la taille du conteneur au-delà de laquelle un commit par distance est acquis. */
export const SWIPE_COMMIT_FRACTION = 0.25

/** Vitesse (px/ms) au-delà de laquelle un commit par vélocité est acquis, même sur un petit déplacement. */
export const SWIPE_COMMIT_VELOCITY = 0.5

/**
 * Constante de résistance au bord (formule à la UIScrollView :
 * `x·d·c / (d + c·x)`, asymptotique vers `d`). Plus elle est proche de `1`,
 * moins ça résiste.
 */
export const SWIPE_RUBBER_BAND = 0.35

/**
 * Nombre d'échantillons conservés pour le calcul de vélocité — fenêtre
 * glissante par COMPTE, distincte de la fenêtre TEMPORELLE ci-dessous.
 */
const SWIPE_SAMPLE_LIMIT = 8

/** Fenêtre TEMPORELLE (ms) sur laquelle `velocityAlong` moyenne le déplacement le plus récent. */
const SWIPE_VELOCITY_WINDOW_MS = 100

export type SwipeAxis = "x" | "y"

export type SwipePhase = "idle" | "pending" | "tracking" | "done"

/** Un point de mesure : offset cumulé (depuis le début du geste) sur l'axe engagé, et son horodatage. */
type SwipeSample = { d: number; t: number }

export interface SwipeState {
	phase: SwipePhase
	/** `null` tant qu'aucun axe n'est engagé. */
	axis: SwipeAxis | null
	startX: number
	startY: number
	x: number
	y: number
	startedAt: number
	updatedAt: number
	/** Bornés à `SWIPE_SAMPLE_LIMIT`, alimentés uniquement une fois `tracking`. */
	samples: readonly { d: number; t: number }[]
}

/** Démarre un suivi — toujours `pending` : aucun axe n'est encore engagé. */
export function beginTrack(x: number, y: number, t: number): SwipeState {
	return {
		phase: "pending",
		axis: null,
		startX: x,
		startY: y,
		x,
		y,
		startedAt: t,
		updatedAt: t,
		samples: [],
	}
}

/**
 * Avance le suivi d'une position. Reste `pending` tant que
 * `max(|dx|, |dy|) < hysteresis` : c'est ce qui évite qu'un tap ou un léger
 * tremblement de la main n'engage jamais un axe. Passé ce seuil, l'axe engagé
 * est le DOMINANT — sauf si `lockAxis` impose LEQUEL peut s'engager, auquel
 * cas l'autre direction est purement et simplement ignorée : elle n'entre ni
 * dans le test d'engagement, ni (une fois engagé) dans `offsetAlong`.
 *
 * Une fois engagé, l'axe ne change plus : les appels suivants ne réévaluent
 * jamais ce choix, même si `lockAxis` change d'un appel à l'autre.
 *
 * Un appel sur un état `idle` ou `done` est un no-op — `endTrack` FIGE la
 * phase, et `idle` signifie qu'aucun geste n'a jamais commencé.
 */
export function moveTrack(
	state: SwipeState,
	x: number,
	y: number,
	t: number,
	opts?: { lockAxis?: SwipeAxis; hysteresis?: number },
): SwipeState {
	if (state.phase === "idle" || state.phase === "done") return state

	const dx = x - state.startX
	const dy = y - state.startY
	const hysteresis = opts?.hysteresis ?? SWIPE_HYSTERESIS_PX

	let phase = state.phase
	let axis = state.axis

	if (phase === "pending") {
		if (opts?.lockAxis) {
			const candidate = opts.lockAxis
			const delta = candidate === "x" ? dx : dy
			if (Math.abs(delta) >= hysteresis) {
				axis = candidate
				phase = "tracking"
			}
		} else if (Math.max(Math.abs(dx), Math.abs(dy)) >= hysteresis) {
			axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y"
			phase = "tracking"
		}
	}

	const samples =
		phase === "tracking"
			? appendSample(state.samples, axis === "x" ? dx : dy, t)
			: state.samples

	return { ...state, phase, axis, x, y, updatedAt: t, samples }
}

function appendSample(
	samples: readonly SwipeSample[],
	d: number,
	t: number,
): readonly SwipeSample[] {
	const trimmed = samples.length >= SWIPE_SAMPLE_LIMIT ? samples.slice(1) : samples
	return [...trimmed, { d, t }]
}

/**
 * Le geste vient-il de s'engager sur son axe — à CET appel précisément ?
 *
 * C'est le moment, et le SEUL, où l'appelant a le droit de poser une capture
 * de pointeur (`setPointerCapture`). La poser au `pointerdown` — comme le hook
 * l'a fait jusqu'au 2026-08-20 — re-ciblait TOUS les événements suivants sur
 * le conteneur du pager : le `pointerup` n'atteignait plus jamais les enfants,
 * et le lecteur de stories restait en pause définitive dès le premier tap
 * (`setPaused(true)` au down, jamais relâché). Différer la capture à
 * l'engagement laisse un tap ou un appui long se dérouler ENTIÈREMENT chez
 * l'enfant, et ne confisque le flux qu'une fois le glissé avéré.
 */
export function justEngaged(prev: SwipeState, next: SwipeState): boolean {
	return prev.phase === "pending" && next.phase === "tracking"
}

/** Fige la phase à `done` — plus aucun `moveTrack` ultérieur n'a d'effet. */
export function endTrack(state: SwipeState, t: number): SwipeState {
	if (state.phase === "idle" || state.phase === "done") return state
	return { ...state, phase: "done", updatedAt: t }
}

/** Offset cumulé sur l'axe engagé — `0` tant qu'aucun axe n'est engagé. */
export function offsetAlong(state: SwipeState): number {
	if (state.axis === null) return 0
	return state.axis === "x" ? state.x - state.startX : state.y - state.startY
}

/**
 * Vitesse signée (px/ms) sur la fenêtre des ~`SWIPE_VELOCITY_WINDOW_MS`
 * dernières millisecondes de suivi — PAS une moyenne sur tout le geste, pour
 * qu'un flick tardif l'emporte sur un début de geste hésitant.
 *
 * `0` si indéterminable : moins de deux échantillons, ou les deux échantillons
 * les plus récents partagent le même horodatage.
 */
export function velocityAlong(state: SwipeState): number {
	const { samples } = state
	if (samples.length < 2) return 0

	const latest = samples[samples.length - 1]
	if (latest === undefined) return 0
	let earliest = latest
	for (let i = samples.length - 2; i >= 0; i -= 1) {
		const candidate = samples[i]
		if (candidate === undefined || latest.t - candidate.t > SWIPE_VELOCITY_WINDOW_MS) break
		earliest = candidate
	}

	const dt = latest.t - earliest.t
	if (dt <= 0) return 0
	return (latest.d - earliest.d) / dt
}

/**
 * Décide si le geste doit ABOUTIR à un changement d'élément — par distance OU
 * par vélocité — et dans quel sens.
 *
 * Convention (cf. en-tête du module) : un offset OU une vélocité NÉGATIFS
 * rendent `1` (suivant) ; POSITIFS rendent `-1` (précédent). Une vélocité de
 * signe OPPOSÉ à l'offset annule le commit : c'est ce qui évite de valider un
 * geste revenu en arrière juste avant le relâchement (survol puis retour).
 */
export function shouldCommit(
	offset: number,
	velocity: number,
	size: number,
	opts?: { fraction?: number; velocity?: number },
): -1 | 0 | 1 {
	if (size <= 0) return 0

	const distanceThreshold = size * (opts?.fraction ?? SWIPE_COMMIT_FRACTION)
	const velocityThreshold = opts?.velocity ?? SWIPE_COMMIT_VELOCITY

	const byDistance = Math.abs(offset) >= distanceThreshold
	const byVelocity = Math.abs(velocity) >= velocityThreshold
	if (!byDistance && !byVelocity) return 0

	if (offset !== 0 && velocity !== 0 && Math.sign(offset) !== Math.sign(velocity)) {
		return 0
	}

	const sign = offset !== 0 ? Math.sign(offset) : Math.sign(velocity)
	if (sign < 0) return 1
	if (sign > 0) return -1
	return 0
}

/** Index suivant, borné à `[0, count - 1]` — une liste vide rend `0`. */
export function nextIndex(current: number, direction: -1 | 0 | 1, count: number): number {
	if (count <= 0) return 0
	return Math.min(Math.max(current + direction, 0), count - 1)
}

/**
 * Position de repos à atteindre une fois la décision prise — même convention
 * de signe qu'`offsetAlong` : `1` (suivant) termine sa course à `-size`,
 * `-1` (précédent) à `+size`, `0` revient à `0`.
 *
 * ⚠️ `0` est un cas à part, pas un raccourci de la formule générale :
 * `-direction * size` vaudrait `-0` pour `direction = 0` (signe IEEE754 du
 * produit d'un zéro négatif par un `size` positif), et `Object.is(-0, 0)` est
 * `false` — `toBe(0)` y échouerait bien qu'`-0 === 0` soit vrai partout
 * ailleurs. On rend donc un `0` positif explicite.
 */
export function settleTarget(direction: -1 | 0 | 1, size: number): number {
	if (direction === 0) return 0
	return -direction * size
}

/**
 * Amortit un offset AU BORD (formule à la UIScrollView : approche `size`
 * asymptotiquement, ne le dépasse jamais, quelle que soit l'ampleur du
 * dépassement). Hors bord — ou à offset nul —, c'est l'IDENTITÉ.
 */
export function rubberBand(offset: number, atEdge: boolean, size: number): number {
	if (!atEdge || offset === 0 || size <= 0) return offset
	const sign = Math.sign(offset)
	const magnitude = Math.abs(offset)
	const damped = (magnitude * size * SWIPE_RUBBER_BAND) / (size + SWIPE_RUBBER_BAND * magnitude)
	return sign * damped
}
