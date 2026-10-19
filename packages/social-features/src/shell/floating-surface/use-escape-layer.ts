// Dupliqué de socle/packages/agent-features/src/features/floating-surface/use-escape-layer.ts @ ad2e7fdc2 — adaptations : code inchangé (écouteur unique, phase bulle) ; déplacé dans la coque (`shell/floating-surface/`).
"use client"

/**
 * useEscapeLayer — inscrire une surface dans la pile Échap (IC-12).
 *
 * UN SEUL écouteur `window` pour toute l'application, posé PARESSEUSEMENT au
 * premier `push` et retiré quand la pile se vide. Avant, chaque surface
 * s'abonnait pour son compte : l'ordre d'exécution était celui du montage,
 * c'est-à-dire l'inverse de la superposition visuelle.
 *
 * ⚠️ Phase BULLE — voir `escape-stack.ts` : en capture, la pile courrait avant
 * le conteneur racine de React et volerait la frappe aux `onKeyDown` qui la
 * préviennent (composeur, recherche mobile, fenêtre iCom du poste).
 *
 * `onEscape` est lu par référence à chaque frappe : la couche n'est PAS
 * réinscrite quand le callback change d'identité — sinon toute surface qui
 * rend une closure inline remonterait en tête de récence à chaque rendu.
 */

import { useEffect, useRef } from "react"
import { escapeStack, type EscapeLayer } from "./escape-stack"

let listenerCount = 0
let detach: (() => void) | null = null

/** Pose l'écouteur unique au premier inscrit, le retire au dernier partant. */
function retainListener(): () => void {
	listenerCount += 1
	if (detach === null && typeof window !== "undefined") {
		const onKeyDown = (event: KeyboardEvent) => {
			escapeStack.dispatch(event)
		}
		window.addEventListener("keydown", onKeyDown)
		detach = () => window.removeEventListener("keydown", onKeyDown)
	}
	return () => {
		listenerCount -= 1
		if (listenerCount <= 0) {
			listenerCount = 0
			detach?.()
			detach = null
		}
	}
}

export interface UseEscapeLayerOptions extends Omit<EscapeLayer, "onEscape"> {
	/**
	 * `false` retire la couche sans démonter le composant — une surface repliée
	 * ou masquée ne doit pas manger la frappe de celle qui reste visible.
	 */
	enabled?: boolean
	onEscape: () => boolean | void
}

export function useEscapeLayer({
	id,
	priority,
	enabled = true,
	onEscape,
}: UseEscapeLayerOptions): void {
	const handler = useRef(onEscape)
	handler.current = onEscape

	useEffect(() => {
		if (!enabled) return
		const release = retainListener()
		const remove = escapeStack.push({
			id,
			priority,
			onEscape: () => handler.current(),
		})
		return () => {
			remove()
			release()
		}
	}, [id, priority, enabled])
}
