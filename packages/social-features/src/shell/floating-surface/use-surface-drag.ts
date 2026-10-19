// Dupliqué de socle/packages/agent-features/src/features/floating-surface/use-surface-drag.ts @ ad2e7fdc2 — adaptations : code inchangé — la clé de stockage reste fournie par l'appelant, qui la préfixe du `storagePrefix` du réseau (`useNetwork()`) ; déplacé dans la coque (`shell/floating-surface/`).
"use client"

/**
 * useSurfaceDrag — déplacer une surface flottante sans lui voler ses clics.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS COUCHES POUR QUE « RACCROCHER » RÉPONDE TOUJOURS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le risque d'un déplacement au pointeur n'est pas de mal placer la fenêtre :
 * c'est de consommer le clic sur le geste le plus urgent de la plateforme.
 * Trois protections, dont aucune ne suffit seule :
 *
 *  1. **La poignée n'est PAS la surface.** Elle est passée à part
 *     (`handleProps`) et se pose sur l'en-tête ; aucune commande n'est dedans ;
 *  2. **Hystérésis de trois pixels** — rien ne bouge tant que le seuil n'est
 *     pas franchi, donc un clic un peu tremblant reste un clic ;
 *  3. **`consumeClickAfterDrag()`** — le `click` synthétique qui suit un
 *     glissement est absorbé, une fois. ⚠️ Cette couche-là est CÂBLÉE sur la
 *     poignée (`handleProps.onClick`), et pas seulement offerte : rendue par
 *     le crochet mais appelée par personne, elle ne gardait rien.
 *
 * ── Au clavier ────────────────────────────────────────────────────────────
 * Flèches (16 px, 64 px avec `Maj`), `Origine` et `Fin` pour les coins haut
 * gauche et bas droit, `Échap` pour annuler LE GESTE EN COURS — et seulement
 * lui : au repos la touche remonte à la surface, à qui elle appartient.
 *
 * ── La capture du pointeur se prend À L'ENGAGEMENT, jamais au `pointerdown` ─
 * Prise au `down`, elle prive les enfants de leur `pointerup` : les boutons de
 * l'en-tête cesseraient de répondre. C'est la même précaution que
 * `gestures/usePointerSwipe.ts`, pour la même raison.
 *
 * ── Pendant le geste, on écrit dans le NŒUD, pas dans l'état React ─────────
 * Un glissement produit des évènements à la cadence de l'écran, et la surface
 * contient une `<video>` vivante : la rendre à chaque déplacement de souris
 * ferait tomber l'appel en saccades.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
	clampToFrame,
	cornerForEdgeKey,
	cornerPosition,
	defaultPlacement,
	hasEngaged,
	nudge,
	parseStoredPlacement,
	restorePlacement,
	serializePlacement,
	settlePlacement,
	SURFACE_DRAG_NUDGE_FAST_PX,
	SURFACE_DRAG_NUDGE_PX,
	type DragInsets,
	type DragPoint,
	type StoredPlacement,
	type SurfacePlacementMode,
} from "./surface-drag"
import { useSurfaceInsets } from "./use-surface-insets"

export interface SurfaceDragHandleProps {
	onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
	onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
	onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
	onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
	onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
	/** Absorbe le `click` synthétique qui suit un glissement (3ᵉ couche). */
	onClick: (event: React.MouseEvent<HTMLElement>) => void
	onDoubleClick: () => void
	tabIndex: number
	role: string
	"aria-label": string
	style: React.CSSProperties
}

export interface SurfaceDrag {
	/** À poser sur la surface déplacée. */
	ref: React.RefObject<HTMLElement | null>
	/** Position courante — nombres nus, React ajoute les pixels. */
	style: React.CSSProperties
	/** À étaler sur la POIGNÉE, jamais sur une commande. */
	handleProps: SurfaceDragHandleProps
	dragging: boolean
	/** À appeler en tête d'un `onClick` de la poignée. */
	consumeClickAfterDrag: () => boolean
}

export type SurfacePlacementStorage = "local" | "session"

function stockage(kind: SurfacePlacementStorage): Storage {
	return kind === "session" ? window.sessionStorage : window.localStorage
}

function lire(
	cle: string,
	kind: SurfacePlacementStorage,
): StoredPlacement | null {
	if (typeof window === "undefined") return null
	try {
		return parseStoredPlacement(stockage(kind).getItem(cle))
	} catch {
		// Stockage refusé (navigation privée, réglages stricts) : la fenêtre
		// reste déplaçable, elle ne se souvient simplement de rien.
		return null
	}
}

function ecrire(
	cle: string,
	placement: StoredPlacement,
	kind: SurfacePlacementStorage,
): void {
	if (typeof window === "undefined") return
	try {
		stockage(kind).setItem(cle, serializePlacement(placement))
	} catch {
		// Idem — un quota plein ne doit pas casser un appel en cours.
	}
}

export function useSurfaceDrag(options: {
	/** Une clé par pose : la fenêtre et la pilule ne partagent pas leur coin. */
	storageKey: string
	/** Faux au téléphone et au rendu serveur. */
	enabled: boolean
	/** Nom accessible de la poignée. */
	label: string
	/** iAppel reste durable ; iCom choisit la durée de l'onglet. */
	storage?: SurfacePlacementStorage
	/** iAppel s'accroche aux coins ; une fenêtre de travail peut rester libre. */
	placementMode?: SurfacePlacementMode
}): SurfaceDrag {
	const {
		storageKey,
		enabled,
		label,
		storage = "local",
		placementMode = "corner",
	} = options
	const ref = useRef<HTMLElement | null>(null)
	const insets = useSurfaceInsets(enabled)

	const [placement, setPlacement] = useState<StoredPlacement | null>(null)
	const [dragging, setDragging] = useState(false)

	const positionRef = useRef<DragPoint | null>(null)
	const origineRef = useRef<{ pointer: DragPoint; position: DragPoint } | null>(null)
	const engageRef = useRef(false)
	const clicAConsommerRef = useRef(false)
	/**
	 * Qui capture le pointeur, et lequel — pour pouvoir relâcher SANS
	 * évènement. `Échap` n'en fournit pas : sans ces deux valeurs, annuler
	 * laisserait la capture en place et la poignée continuerait d'avaler les
	 * mouvements bien après la fin du geste.
	 */
	const captureRef = useRef<{ el: Element; pointerId: number } | null>(null)
	const insetsRef = useRef<DragInsets>(insets)
	insetsRef.current = insets

	const mesures = useCallback(() => {
		const el = ref.current
		const rect = el?.getBoundingClientRect()
		return {
			box: { width: rect?.width ?? 0, height: rect?.height ?? 0 },
			viewport: {
				width: typeof window === "undefined" ? 0 : window.innerWidth,
				height: typeof window === "undefined" ? 0 : window.innerHeight,
			},
		}
	}, [])

	/** Écrit la position sur le nœud — sans passer par React. */
	const poser = useCallback((pos: DragPoint) => {
		positionRef.current = pos
		const el = ref.current
		if (!el) return
		el.style.left = `${pos.x}px`
		el.style.top = `${pos.y}px`
	}, [])

	// Placement initial AVANT peinture : sans cela, retirer `right`/`bottom` du
	// CSS ferait clignoter la fenêtre en haut à gauche à chaque montage.
	useLayoutEffect(() => {
		if (!enabled) return
		const { box, viewport } = mesures()
		const range = lire(storageKey, storage)
		const place = range ?? defaultPlacement(box, viewport, insetsRef.current)
		setPlacement(place)
		poser(
			restorePlacement(
				place,
				box,
				viewport,
				insetsRef.current,
				placementMode,
			),
		)
	}, [enabled, storageKey, storage, placementMode, mesures, poser])

	// Un écran qui rétrécit, une barre qui apparaît : le mode `corner` repart du
	// coin ; le mode `free` conserve x/y et les borne au nouveau cadre.
	useEffect(() => {
		if (!enabled || placement === null) return
		if (typeof window === "undefined") return
		const recaler = () => {
			const { box, viewport } = mesures()
			poser(
				restorePlacement(
					placement,
					box,
					viewport,
					insetsRef.current,
					placementMode,
				),
			)
		}
		recaler()
		window.addEventListener("resize", recaler)
		window.addEventListener("orientationchange", recaler)
		return () => {
			window.removeEventListener("resize", recaler)
			window.removeEventListener("orientationchange", recaler)
		}
	}, [enabled, placement, insets, placementMode, mesures, poser])

	const onPointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (!enabled) return
			// Le bouton secondaire ouvre le menu du système : ce n'est pas un
			// déplacement, et le lui voler serait hostile.
			if (event.button !== 0) return
			const pos = positionRef.current
			if (!pos) return
			origineRef.current = {
				pointer: { x: event.clientX, y: event.clientY },
				position: pos,
			}
			engageRef.current = false
		},
		[enabled],
	)

	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const origine = origineRef.current
			if (!origine) return
			const pointer = { x: event.clientX, y: event.clientY }

			if (!engageRef.current) {
				if (!hasEngaged(origine.pointer, pointer)) return
				engageRef.current = true
				setDragging(true)
				try {
					event.currentTarget.setPointerCapture(event.pointerId)
					captureRef.current = {
						el: event.currentTarget,
						pointerId: event.pointerId,
					}
				} catch {
					// Pointeur déjà relâché, ou capture refusée : on continue sans
					// elle. Un déplacement sans capture s'interrompt au premier
					// survol d'un autre élément — dégradé, jamais cassé.
				}
			}

			const { box, viewport } = mesures()
			poser(
				clampToFrame(
					{
						x: origine.position.x + (pointer.x - origine.pointer.x),
						y: origine.position.y + (pointer.y - origine.pointer.y),
					},
					box,
					viewport,
					insetsRef.current,
				),
			)
		},
		[mesures, poser],
	)

	const terminer = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const origine = origineRef.current
			origineRef.current = null
			if (!origine) return
			try {
				event.currentTarget.releasePointerCapture(event.pointerId)
			} catch {
				// Jamais capturé : rien à relâcher.
			}
			captureRef.current = null
			if (!engageRef.current) return
			engageRef.current = false

			const pos = positionRef.current
			if (pos) {
				const { box, viewport } = mesures()
				const arrivee = settlePlacement(
					pos,
					box,
					viewport,
					insetsRef.current,
					placementMode,
				)
				poser(arrivee.pos)
				const place = arrivee.placement
				setPlacement(place)
				ecrire(storageKey, place, storage)
			}

			// Le `click` synthétique n'est pas encore parti : le drapeau doit
			// encore être levé quand il arrive.
			clicAConsommerRef.current = true
			setDragging(false)
		},
		[mesures, poser, storageKey, storage, placementMode],
	)

	/**
	 * ANNULER le geste en cours — et rien d'autre.
	 *
	 * La fenêtre revient exactement où elle était au `pointerdown` : c'est ce
	 * qu'« annuler » veut dire. Calculer une autre arrivée ferait d'`Échap` un
	 * second moyen de DÉPLACER.
	 *
	 * Rend `false` quand il n'y avait rien à annuler — l'appelant laisse alors
	 * la touche passer : au repos, `Échap` appartient à la surface (réduire),
	 * et la lui voler fermerait une échappatoire pour en offrir aucune.
	 */
	const annulerGeste = useCallback((): boolean => {
		const origine = origineRef.current
		if (!origine || !engageRef.current) return false
		origineRef.current = null
		engageRef.current = false
		const capture = captureRef.current
		captureRef.current = null
		if (capture) {
			try {
				;(capture.el as Element & {
					releasePointerCapture(id: number): void
				}).releasePointerCapture(capture.pointerId)
			} catch {
				// Capture déjà perdue : rien à relâcher.
			}
		}
		poser(origine.position)
		// Le `pointerup` qui suivra trouvera `origineRef` vide et ne fera rien,
		// mais le `click` synthétique, lui, part quand même : on l'absorbe.
		clicAConsommerRef.current = true
		setDragging(false)
		return true
	}, [poser])

	/**
	 * ⚠️ `Échap` s'écoute sur la FENÊTRE, pas sur la poignée.
	 *
	 * Un `pointerdown` ne donne pas systématiquement le focus (Safari ne le
	 * donne pas aux éléments non-formulaire) : la touche n'atteindrait donc pas
	 * le gestionnaire de la poignée au moment précis où l'on en a besoin.
	 * L'écouteur n'existe QUE pendant le geste — au repos, `Échap` retourne
	 * intégralement à la surface.
	 */
	useEffect(() => {
		if (!dragging || typeof window === "undefined") return
		const surEchap = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			if (annulerGeste()) event.preventDefault()
		}
		window.addEventListener("keydown", surEchap, true)
		return () => window.removeEventListener("keydown", surEchap, true)
	}, [dragging, annulerGeste])

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			if (!enabled) return
			const pas = event.shiftKey ? SURFACE_DRAG_NUDGE_FAST_PX : SURFACE_DRAG_NUDGE_PX
			const deltas: Record<string, [number, number]> = {
				ArrowLeft: [-pas, 0],
				ArrowRight: [pas, 0],
				ArrowUp: [0, -pas],
				ArrowDown: [0, pas],
			}
			// `Échap` d'abord : pendant un geste elle l'annule, au repos elle
			// n'est PAS consommée et remonte à la surface, qui la réduit.
			if (event.key === "Escape") {
				if (annulerGeste()) event.preventDefault()
				return
			}

			// `Origine` / `Fin` : un coin franc, sans passer par les flèches.
			const coin = cornerForEdgeKey(event.key)
			if (coin !== null) {
				event.preventDefault()
				const { box, viewport } = mesures()
				const cible = cornerPosition(coin, box, viewport, insetsRef.current)
				poser(cible)
				const placeCoin: StoredPlacement = {
					corner: coin,
					x: cible.x,
					y: cible.y,
				}
				setPlacement(placeCoin)
				ecrire(storageKey, placeCoin, storage)
				return
			}

			const delta = deltas[event.key]
			if (!delta) return
			event.preventDefault()
			const pos = positionRef.current
			if (!pos) return
			const { box, viewport } = mesures()
			const suivant = nudge(pos, delta[0], delta[1], box, viewport, insetsRef.current)
			poser(suivant)
			const arrivee = settlePlacement(
				suivant,
				box,
				viewport,
				insetsRef.current,
				placementMode,
			)
			const place: StoredPlacement = {
				corner: arrivee.placement.corner,
				x: suivant.x,
				y: suivant.y,
			}
			setPlacement(place)
			ecrire(storageKey, place, storage)
		},
		[
			enabled,
			annulerGeste,
			mesures,
			poser,
			storageKey,
			storage,
			placementMode,
		],
	)

	/** Double-clic sur la poignée : retour à l'ancrage d'origine. */
	const onDoubleClick = useCallback(() => {
		if (!enabled) return
		const { box, viewport } = mesures()
		const place = defaultPlacement(box, viewport, insetsRef.current)
		setPlacement(place)
		poser(
			restorePlacement(
				place,
				box,
				viewport,
				insetsRef.current,
				placementMode,
			),
		)
		ecrire(storageKey, place, storage)
	}, [enabled, mesures, poser, storageKey, storage, placementMode])

	const consumeClickAfterDrag = useCallback(() => {
		if (!clicAConsommerRef.current) return false
		clicAConsommerRef.current = false
		return true
	}, [])

	/**
	 * La troisième couche, POSÉE et non seulement offerte.
	 *
	 * Elle vivait jusqu'ici en pure API : rendue par le crochet, appelée par
	 * personne. Une garde qui ne garde rien n'est pas une garde — et compter
	 * sur chaque appelant pour s'en souvenir revient à compter sur l'oubli.
	 * On la câble donc sur la poignée elle-même : le `click` synthétique qui
	 * suit un glissement est absorbé ICI, et ne remonte pas à un ancêtre qui
	 * deviendrait cliquable un jour.
	 *
	 * `consumeClickAfterDrag` reste exporté pour les commandes qu'un appelant
	 * placerait DANS la poignée — le contrat ne change pas, il gagne un usage.
	 */
	const onHandleClick = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (consumeClickAfterDrag()) {
				event.preventDefault()
				event.stopPropagation()
			}
		},
		[consumeClickAfterDrag],
	)

	return {
		ref,
		style: enabled ? {} : { left: undefined, top: undefined },
		handleProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp: terminer,
			onPointerCancel: terminer,
			onKeyDown,
			onClick: onHandleClick,
			onDoubleClick,
			tabIndex: 0,
			role: "button",
			"aria-label": label,
			style: {
				// `none` et non `manipulation` : au doigt, le défilement de la
				// page doit céder la place au déplacement sur cette zone-là.
				touchAction: "none",
				cursor: dragging ? "grabbing" : "grab",
			},
		},
		dragging,
		consumeClickAfterDrag,
	}
}
