// Dupliqué de socle/packages/agent-features/src/features/floating-surface/surface-drag.ts @ ad2e7fdc2 — adaptations : code inchangé (placement pur) ; déplacé dans la coque (`shell/floating-surface/`).
/**
 * surface-drag — où se pose une surface d'appel qu'on déplace.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX DÉCISIONS, ET POURQUOI ELLES NE VONT PAS DE SOI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **1. Quatre coins de repos, pas un rail libre.**
 * La sphère iAsted s'ancre à un rail latéral, à n'importe quelle hauteur :
 * c'est juste pour une orbe de 64 px. Une fenêtre d'appel fait 400 × 680 —
 * posée à mi-hauteur, elle mange une colonne entière de la page et recouvre ce
 * qu'on essayait de lire pendant l'appel. Les quatre coins sont les seules
 * positions de repos qui laissent la page utilisable.
 *
 * **2. On persiste le COIN ; les pixels ne sont qu'un indice.**
 * `reanchor` recalcule la position depuis le coin à chaque redimensionnement
 * et à chaque apparition d'obstacle. Persister des pixels bruts est
 * exactement ce qui fait revenir une fenêtre hors champ sur un écran plus
 * petit — ou sous une barre latérale qui n'était pas là la veille.
 *
 * Aucun import, aucun DOM, aucun `window` : module pur, testable en `node`.
 * Le hook qui l'applique (`use-surface-drag.ts`) ne fait que lire des
 * évènements de pointeur et écrire un style.
 */

export type SurfaceCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface DragPoint {
	x: number
	y: number
}

/** Les dimensions de la surface déplacée. */
export interface DragBox {
	width: number
	height: number
}

export interface DragViewport {
	width: number
	height: number
}

/**
 * Ce que la surface ne doit pas recouvrir : barre latérale à gauche, barre de
 * navigation en bas… Mesuré par `use-surface-insets.ts`.
 */
export interface DragInsets {
	top: number
	right: number
	bottom: number
	left: number
}

/** Ce qu'on retient d'un déplacement, d'une session à l'autre. */
export interface StoredPlacement {
	corner: SurfaceCorner
	/** Indice de position — recalculé depuis le coin s'il n'est plus tenable. */
	x: number
	y: number
}

/**
 * `corner` conserve le comportement historique iAppel. `free` garde les
 * pixels choisis par l'utilisateur et ne les corrige que pour rester visibles.
 */
export type SurfacePlacementMode = "corner" | "free"

/**
 * Le seuil au-delà duquel un glissement compte comme un déplacement.
 *
 * ⚠️ Sans lui, un clic un peu tremblant sur l'en-tête déplacerait la fenêtre
 * de deux pixels et consommerait le clic. Trois pixels : la même valeur que la
 * sphère iAsted, éprouvée.
 */
export const SURFACE_DRAG_HYSTERESIS_PX = 3

/** Marge minimale entre la surface et le bord de l'écran. */
export const SURFACE_DRAG_MARGIN = 16

/** Pas de déplacement au clavier — flèches seules. */
export const SURFACE_DRAG_NUDGE_PX = 16

/** Pas rapide — flèches avec Maj. */
export const SURFACE_DRAG_NUDGE_FAST_PX = 64

const CORNERS: readonly SurfaceCorner[] = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
]

/** Les bornes utiles, une fois retirés marges et obstacles. */
function frame(box: DragBox, viewport: DragViewport, insets: DragInsets) {
	const minX = insets.left + SURFACE_DRAG_MARGIN
	const minY = insets.top + SURFACE_DRAG_MARGIN
	const maxX = viewport.width - insets.right - SURFACE_DRAG_MARGIN - box.width
	const maxY = viewport.height - insets.bottom - SURFACE_DRAG_MARGIN - box.height
	return { minX, minY, maxX, maxY }
}

/**
 * Ramène une position dans le cadre.
 *
 * ⚠️ Quand la fenêtre est PLUS GRANDE que la place disponible — écran étroit,
 * clavier ouvert, viewport pas encore mesuré et donc à zéro — `maxX` passe
 * sous `minX`. On préfère alors le bord haut-gauche : une surface qui déborde
 * en bas à droite cache ses propres commandes, celle qui déborde en bas les
 * garde atteignables.
 */
export function clampToFrame(
	pos: DragPoint,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): DragPoint {
	const { minX, minY, maxX, maxY } = frame(box, viewport, insets)
	return {
		x: maxX < minX ? minX : Math.min(Math.max(pos.x, minX), maxX),
		y: maxY < minY ? minY : Math.min(Math.max(pos.y, minY), maxY),
	}
}

/** La position exacte d'un coin, obstacles compris. */
export function cornerPosition(
	corner: SurfaceCorner,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): DragPoint {
	const { minX, minY, maxX, maxY } = frame(box, viewport, insets)
	const gauche = corner === "top-left" || corner === "bottom-left"
	const haut = corner === "top-left" || corner === "top-right"
	return clampToFrame(
		{ x: gauche ? minX : maxX, y: haut ? minY : maxY },
		box,
		viewport,
		insets,
	)
}

/** Le coin dont le CENTRE de la surface est le plus proche. */
export function nearestCorner(
	pos: DragPoint,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): SurfaceCorner {
	const centre = { x: pos.x + box.width / 2, y: pos.y + box.height / 2 }
	let meilleur: SurfaceCorner = CORNERS[0] as SurfaceCorner
	let distance = Number.POSITIVE_INFINITY
	for (const corner of CORNERS) {
		const p = cornerPosition(corner, box, viewport, insets)
		const c = { x: p.x + box.width / 2, y: p.y + box.height / 2 }
		const d = (c.x - centre.x) ** 2 + (c.y - centre.y) ** 2
		// `<` strict : à égalité parfaite, l'ordre de `CORNERS` tranche, ce qui
		// rend le résultat déterministe et donc testable.
		if (d < distance) {
			distance = d
			meilleur = corner
		}
	}
	return meilleur
}

/** Où la surface se pose quand on la relâche. */
export function settleToCorner(
	pos: DragPoint,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): { corner: SurfaceCorner; pos: DragPoint } {
	const corner = nearestCorner(pos, box, viewport, insets)
	return { corner, pos: cornerPosition(corner, box, viewport, insets) }
}

/** Où poser et quoi persister après un déplacement selon la surface. */
export function settlePlacement(
	pos: DragPoint,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
	mode: SurfacePlacementMode = "corner",
): { placement: StoredPlacement; pos: DragPoint } {
	if (mode === "corner") {
		const settled = settleToCorner(pos, box, viewport, insets)
		return {
			placement: {
				corner: settled.corner,
				x: settled.pos.x,
				y: settled.pos.y,
			},
			pos: settled.pos,
		}
	}

	const bounded = clampToFrame(pos, box, viewport, insets)
	return {
		// Le coin reste un repli lisible par les anciennes versions du format ;
		// en mode libre, x/y sont cependant la source de vérité.
		placement: {
			corner: nearestCorner(bounded, box, viewport, insets),
			x: bounded.x,
			y: bounded.y,
		},
		pos: bounded,
	}
}

/**
 * L'ancrage d'origine : en bas à droite.
 *
 * C'est là que `.iappel-float` et `.iappel-pill` étaient clouées avant d'être
 * déplaçables. Une nouvelle installation ne doit rien voir changer.
 */
export function defaultPlacement(
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): StoredPlacement {
	const pos = cornerPosition("bottom-right", box, viewport, insets)
	return { corner: "bottom-right", x: pos.x, y: pos.y }
}

/** Le geste a-t-il dépassé le seuil de déplacement ? */
export function hasEngaged(
	from: DragPoint,
	to: DragPoint,
	hysteresis: number = SURFACE_DRAG_HYSTERESIS_PX,
): boolean {
	return Math.abs(to.x - from.x) >= hysteresis || Math.abs(to.y - from.y) >= hysteresis
}

/**
 * Le coin visé par une touche de BORD — `null` si la touche n'en vise aucun.
 *
 * `Origine` mène en haut à gauche, `Fin` en bas à droite : la métaphore du
 * document, et non un cycle entre les quatre coins. Un cycle obligerait à
 * appuyer jusqu'à trois fois sans savoir où l'on va ; deux touches qui mènent
 * TOUJOURS au même endroit se retiennent du premier coup.
 *
 * Les deux autres coins restent atteignables aux flèches : le relâchement
 * accroche au coin le plus proche (`settleToCorner`), donc une seule poussée
 * dans la bonne direction suffit.
 */
export function cornerForEdgeKey(key: string): SurfaceCorner | null {
	if (key === "Home") return "top-left"
	if (key === "End") return "bottom-right"
	return null
}

/** Un pas de déplacement au clavier, borné comme le reste. */
export function nudge(
	pos: DragPoint,
	dx: number,
	dy: number,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): DragPoint {
	return clampToFrame({ x: pos.x + dx, y: pos.y + dy }, box, viewport, insets)
}

/**
 * Recalcule la position depuis le COIN retenu.
 *
 * Appelé au montage, à chaque redimensionnement, et quand un obstacle
 * apparaît ou disparaît. C'est ce qui empêche une fenêtre de revenir hors
 * champ sur un écran plus petit que celui où elle a été posée.
 */
export function reanchor(
	stored: StoredPlacement,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
): DragPoint {
	return cornerPosition(stored.corner, box, viewport, insets)
}

/** Relit un placement selon le mode, notamment après un resize. */
export function restorePlacement(
	stored: StoredPlacement,
	box: DragBox,
	viewport: DragViewport,
	insets: DragInsets,
	mode: SurfacePlacementMode = "corner",
): DragPoint {
	return mode === "free"
		? clampToFrame({ x: stored.x, y: stored.y }, box, viewport, insets)
		: reanchor(stored, box, viewport, insets)
}

function isCorner(value: unknown): value is SurfaceCorner {
	return typeof value === "string" && (CORNERS as readonly string[]).includes(value)
}

/**
 * Relit ce qui a été rangé — et refuse tout ce qui n'est pas exactement ça.
 *
 * Un stockage local survit aux versions du code : une charge d'un format
 * antérieur, tronquée, ou écrite par une extension, doit retomber sur le
 * placement par défaut plutôt que de poser la fenêtre à `NaN` pixels.
 */
export function parseStoredPlacement(raw: string | null): StoredPlacement | null {
	if (!raw) return null
	let brut: unknown
	try {
		brut = JSON.parse(raw)
	} catch {
		return null
	}
	if (typeof brut !== "object" || brut === null) return null
	const o = brut as Record<string, unknown>
	if (!isCorner(o.corner)) return null
	const x = typeof o.x === "number" && Number.isFinite(o.x) ? o.x : 0
	const y = typeof o.y === "number" && Number.isFinite(o.y) ? o.y : 0
	return { corner: o.corner, x, y }
}

export function serializePlacement(placement: StoredPlacement): string {
	return JSON.stringify(placement)
}
