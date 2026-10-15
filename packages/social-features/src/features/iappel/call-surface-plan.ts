// Dupliqué de socle/packages/agent-features/src/features/iappel/call-surface-plan.ts @ ad2e7fdc2 — adaptations : branche de la file du centre d'appels élaguée (`kind === "queue"`, absente du moteur) : tout slot non terminé est un appel de cette surface.
/**
 * call-surface-plan — OÙ et COMMENT la surface d'appel se pose.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE DÉCISION PURE, ET PAS UN `useState` DANS LA SURFACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La surface d'appel doit survivre à tout : changer de page, ouvrir une story,
 * réduire l'appel, en prendre un second, revenir. Tant que la pose se décidait
 * dans le composant, chaque montage repartait de zéro — et un appel réduit
 * redevenait plein écran au premier changement de route.
 *
 * Ici, la pose est une FONCTION de l'état (slots + viewport + réduit). Le
 * composant n'a plus d'état propre à perdre : il lit.
 *
 * ── Les quatre poses ──────────────────────────────────────────────────────
 *  · `hidden`     — aucun appel : rien n'est monté ;
 *  · `fullscreen` — au téléphone : l'appel prend l'écran, comme un téléphone ;
 *  · `floating`   — au bureau : une fenêtre NON modale, la page reste
 *    utilisable pendant l'appel (on prend des notes en parlant) ;
 *  · `minimized`  — la pilule : l'appel continue, la surface se retire.
 *
 * ⚠️ `viewport: "unknown"` rend `hidden` À DESSEIN. Le rendu serveur ne connaît
 * pas la largeur ; deviner produirait une bascule visible au premier rendu
 * client. Une frame sans surface est invisible ; une surface qui saute de la
 * fenêtre au plein écran ne l'est pas.
 *
 * Tout slot non terminé concerne cette surface : le moteur n'a qu'un genre de
 * slot (`direct`, de personne à personne) — la FILE du centre d'appels du
 * socle, qui avait son propre écran, n'existe pas ici.
 *
 * Aucun import React : module pur.
 */

import type { CallSlotKind } from "./call-types"

export type CallPresentation = "fullscreen" | "floating" | "minimized" | "hidden"

export type SurfaceViewport = "mobile" | "desktop" | "unknown"

/** Un slot, réduit à ce qui décide de la pose. */
export interface SurfaceSlotView {
	meetingId: string
	status: "incoming" | "connecting" | "active" | "held" | "ended"
	kind?: CallSlotKind
	/** Depuis quand ce slot est en attente — ordonne les puces. */
	heldSince?: number | null
	/** Quand il a été rejoint — départage deux slots également candidats. */
	joinedAt?: number | null
}

export interface CallSurfacePlanInput {
	slots: readonly SurfaceSlotView[]
	activeSlotId: string | null
	minimized: boolean
	viewport: SurfaceViewport
}

export interface CallSurfacePlan {
	/**
	 * L'appel AU PREMIER PLAN — celui dont on voit la scène.
	 *
	 * ⚠️ `null` UNIQUEMENT quand il n'y a aucun appel de surface. Il valait
	 * aussi `null` dès que tous les appels étaient parqués, ce qui figeait la
	 * surface en pilule inerte : `children` jeté, « Raccrocher » sans cible,
	 * « Restaurer » sans effet. Un appel parqué reste un appel qu'on pilote.
	 */
	front: string | null
	/** L'appel de tête est-il lui-même en attente ? */
	frontIsHeld: boolean
	/** Les appels EN ATTENTE, **hors** celui de tête, du plus ancien au plus récent. */
	held: string[]
	presentation: CallPresentation
	/** Faut-il rendre les puces « en attente » ? */
	showHeldChips: boolean
}

/** Un slot qui compte pour cette surface : pas terminé. */
function isSurfaceSlot(slot: SurfaceSlotView): boolean {
	// `kind` absent = slot posé par un chemin historique (API scalaire du
	// store) : direct, comme tous les slots du moteur.
	return slot.status !== "ended"
}

export function planCallSurface(input: CallSurfacePlanInput): CallSurfacePlan {
	const slots = input.slots.filter(isSurfaceSlot)
	if (slots.length === 0) {
		return {
			front: null,
			frontIsHeld: false,
			held: [],
			presentation: "hidden",
			showHeldChips: false,
		}
	}

	const byId = new Map(slots.map((s) => [s.meetingId, s]))
	const active = input.activeSlotId === null ? null : byId.get(input.activeSlotId)

	/**
	 * L'ordre de promotion, explicite, et sans issue vide.
	 *
	 *  1. l'actif, s'il vit et n'est pas parqué ;
	 *  2. sinon le premier candidat non parqué — après un raccrochage, la
	 *     surface se reporte seule sur l'appel restant ;
	 *  3. sinon l'actif même parqué — c'est LUI que l'usager regardait ;
	 *  4. sinon le plus RÉCEMMENT parqué : le dernier qu'il a quitté.
	 *
	 * Le quatrième cas est celui qui manquait. Sans lui, « tout est en
	 * attente » rendait `front: null`, et la pose était forcée à `minimized`
	 * sans échappatoire.
	 */
	const nonParque = slots.find((s) => s.status !== "held") ?? null
	const parquesRecentsDAbord = slots
		.filter((s) => s.status === "held")
		.slice()
		.sort(
			(a, b) =>
				(b.heldSince ?? b.joinedAt ?? 0) - (a.heldSince ?? a.joinedAt ?? 0),
		)

	const front =
		active && active.status !== "held"
			? active
			: (nonParque ?? active ?? parquesRecentsDAbord[0] ?? null)

	if (front === null) {
		return {
			front: null,
			frontIsHeld: false,
			held: [],
			presentation: "hidden",
			showHeldChips: false,
		}
	}

	// Les puces ne montrent JAMAIS l'appel de tête : il est déjà à l'écran, et
	// l'y répéter ferait croire à deux appels là où il n'y en a qu'un.
	const held = slots
		.filter((s) => s.status === "held" && s.meetingId !== front.meetingId)
		.slice()
		.sort((a, b) => (a.heldSince ?? 0) - (b.heldSince ?? 0))
		.map((s) => s.meetingId)

	if (input.viewport === "unknown") {
		return {
			front: front.meetingId,
			frontIsHeld: front.status === "held",
			held,
			presentation: "hidden",
			showHeldChips: false,
		}
	}

	const presentation: CallPresentation = input.minimized
		? "minimized"
		: input.viewport === "mobile"
			? "fullscreen"
			: "floating"

	return {
		front: front.meetingId,
		frontIsHeld: front.status === "held",
		held,
		presentation,
		// En pilule, la place manque : le nombre d'appels tenus s'y dit par un
		// compteur, pas par une rangée de puces.
		showHeldChips: held.length > 0 && presentation !== "minimized",
	}
}
