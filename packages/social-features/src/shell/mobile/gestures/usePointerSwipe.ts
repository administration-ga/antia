// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/gestures/usePointerSwipe.ts @ ad2e7fdc2 — adaptations : code inchangé ; déplacé dans la coque (`shell/mobile/gestures/`).
"use client"

/**
 * usePointerSwipe — hook FIN qui étale `swipe.ts` sur des handlers pointer.
 *
 * Aucune décision n'est prise ici : `beginTrack`/`moveTrack`/`endTrack`,
 * `offsetAlong`, `velocityAlong` et `shouldCommit` (tous dans `./swipe`)
 * portent la machine. Ce hook ne fait que router les événements pointer vers
 * ces fonctions et exposer le résultat à l'appelant — d'où l'absence de
 * `.test.ts` colocalisé : `packages/agent-features` tourne en environnement
 * `node` SANS testing-library (cf. CLAUDE.md), et un hook qui ne DÉCIDE rien
 * n'a rien à vérifier qui ne le soit déjà dans `swipe.test.ts`.
 *
 * L'état du geste vit dans une `ref`, jamais dans un `useState` : un geste
 * avance à la fréquence des `pointermove` (jusqu'à 120 Hz), et re-rendre le
 * composant à cette cadence pour une valeur que seul un `MotionValue` doit
 * porter serait exactement le genre de ralentissement qu'un pager plein écran
 * ne pardonne pas. `onOffset` est le SEUL canal de sortie pendant le geste :
 * à l'appelant de le brancher sur un `useMotionValue` (`VerticalPager` le
 * fait). `onCommit` ne parle qu'une fois, au relâchement.
 *
 * ⚠️ LA CAPTURE DE POINTEUR SE POSE À L'ENGAGEMENT, JAMAIS AU `pointerdown`.
 * Une capture prise au down re-cible TOUS les événements suivants sur
 * l'élément capteur (spec Pointer Events) : les enfants — zone de tap du
 * lecteur de stories, boutons d'un slide de direct, bulle de message — ne
 * reçoivent plus jamais leur `pointerup` ni leur `click`. Vécu : le lecteur
 * de stories restait en pause DÉFINITIVE dès le premier tap. La décision
 * « quand l'axe s'engage-t-il ? » vit dans `swipe.ts` (`justEngaged`) ; ce
 * hook ne fait qu'appliquer la capture à cet instant-là. La capture posée
 * pendant un `pointermove` ne prend effet qu'à l'événement SUIVANT — le move
 * qui engage a donc déjà bouillonné normalement chez les enfants.
 */

import { useRef } from "react"
import {
	beginTrack,
	endTrack,
	justEngaged,
	moveTrack,
	offsetAlong,
	shouldCommit,
	velocityAlong,
	type SwipeAxis,
	type SwipeState,
} from "./swipe"

/**
 * Repos avant tout geste — distinct de `done` : aucun `pointerdown` n'a
 * encore eu lieu. `moveTrack`/`endTrack` traitent les deux en no-op.
 */
const IDLE_STATE: SwipeState = {
	phase: "idle",
	axis: null,
	startX: 0,
	startY: 0,
	x: 0,
	y: 0,
	startedAt: 0,
	updatedAt: 0,
	samples: [],
}

export interface UsePointerSwipeOptions {
	/** Le SEUL axe que ce geste peut engager — passé tel quel en `lockAxis` à `moveTrack`. */
	axis: SwipeAxis
	/** Direction retenue au relâchement (`-1`, `0` ou `1`) — cf. convention de signe dans `swipe.ts`. */
	onCommit: (direction: -1 | 0 | 1) => void
	/** Appelé à chaque mouvement engagé, offset signé — jamais de re-render : à brancher sur un `MotionValue`. */
	onOffset: (offset: number) => void
	/** Handlers no-op et `touchAction: "none"` tant que vrai. */
	disabled?: boolean
	/** Taille du conteneur le long de l'axe, en px — sert au calcul du seuil de commit. */
	size: number
}

export interface PointerSwipeHandlers {
	onPointerDown: (event: React.PointerEvent) => void
	onPointerMove: (event: React.PointerEvent) => void
	onPointerUp: (event: React.PointerEvent) => void
	onPointerCancel: (event: React.PointerEvent) => void
	/**
	 * `touch-action` recommandé pour l'élément qui porte ces handlers. Axe
	 * verrouillé sur `y` ⇒ `pan-x` (le navigateur garde le panoramique
	 * horizontal natif, JS possède seul le vertical) ; sur `x` ⇒ `pan-y` ;
	 * `disabled` ⇒ `none`, rien ne doit paraître pilotable.
	 */
	touchAction: "pan-y" | "pan-x" | "none"
}

export function usePointerSwipe(options: UsePointerSwipeOptions): PointerSwipeHandlers {
	const { axis, onCommit, onOffset, disabled = false, size } = options
	const stateRef = useRef<SwipeState>(IDLE_STATE)

	const isActive = (state: SwipeState) => state.phase !== "idle" && state.phase !== "done"

	const settle = (event: React.PointerEvent) => {
		if (disabled || !isActive(stateRef.current)) return
		const ended = endTrack(stateRef.current, event.timeStamp)
		stateRef.current = ended
		onCommit(shouldCommit(offsetAlong(ended), velocityAlong(ended), size))
	}

	const onPointerDown = (event: React.PointerEvent) => {
		if (disabled) return
		// Aucune capture ici — cf. l'en-tête : elle se prend à l'engagement.
		stateRef.current = beginTrack(event.clientX, event.clientY, event.timeStamp)
	}

	const onPointerMove = (event: React.PointerEvent) => {
		if (disabled || !isActive(stateRef.current)) return
		const prev = stateRef.current
		const next = moveTrack(prev, event.clientX, event.clientY, event.timeStamp, {
			lockAxis: axis,
		})
		stateRef.current = next
		if (justEngaged(prev, next)) {
			// Le `try` couvre un pointeur devenu inactif entre-temps
			// (`setPointerCapture` lève `NotFoundError` dans ce cas) : le geste
			// continue alors sans capture, ce qui dégrade sans casser.
			try {
				event.currentTarget.setPointerCapture(event.pointerId)
			} catch {
				// Pointeur déjà relâché — rien à capturer.
			}
		}
		onOffset(offsetAlong(next))
	}

	const onPointerUp = (event: React.PointerEvent) => {
		settle(event)
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
		}
	}

	const onPointerCancel = (event: React.PointerEvent) => {
		settle(event)
	}

	const touchAction: "pan-y" | "pan-x" | "none" = disabled
		? "none"
		: axis === "y"
			? "pan-x"
			: "pan-y"

	return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, touchAction }
}
