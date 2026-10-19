// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/useVisualViewport.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

/**
 * useVisualViewport — publie la hauteur RÉELLEMENT visible et la place prise
 * par le clavier, en deux propriétés CSS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI `100dvh` NE SUFFIT PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `dvh` suit les barres du NAVIGATEUR (l'URL qui se replie au défilement) —
 * il ne suit pas le CLAVIER. Sur iOS, ouvrir le clavier ne change ni `100dvh`
 * ni `window.innerHeight` : la page garde sa hauteur et se contente de
 * remonter. Une vue immersive calée sur `100dvh` place donc son composeur
 * DERRIÈRE le clavier, et la seule façon de l'atteindre est de faire défiler
 * un écran qui ne devait pas défiler.
 *
 * `window.visualViewport` est la seule mesure qui recule quand le clavier
 * monte. On la publie sur `document.documentElement` :
 *
 *  · `--vv-height` — la hauteur visible, en pixels ;
 *  · `--kb-inset`  — ce que le clavier prend en bas, en pixels, jamais négatif.
 *
 * `offsetTop` est retranché : quand la page est repoussée vers le haut (iOS
 * fait cela plutôt que de redimensionner), la hauteur visible seule
 * sur-estimerait la place restante d'exactement ce décalage.
 *
 * ⚠️ Publié sur `documentElement` et non sur un nœud : les surfaces qui en ont
 * besoin sont rendues par un PORTAIL vers `<body>` (cf. `ImmersiveOverlay`) et
 * n'ont donc aucun ancêtre commun avec la page qui monte ce hook.
 *
 * ⚠️ Le repli est l'ABSENCE de la variable, pas une valeur inventée : les
 * appelants écrivent `height: var(--vv-height, 100dvh)`. Poser une hauteur
 * calculée depuis `innerHeight` quand l'API manque donnerait une valeur figée
 * qui ne suivrait plus rien — pire qu'un `dvh` honnête.
 */

import { useEffect } from "react"

const HEIGHT_VAR = "--vv-height"
const KEYBOARD_VAR = "--kb-inset"

export function useVisualViewport(): void {
	useEffect(() => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return
		}
		const viewport = window.visualViewport
		const root = document.documentElement
		if (!viewport) {
			// Pas d'API : on ne publie RIEN, et `var(--vv-height, 100dvh)` prend
			// le repli déclaré au point d'usage.
			return
		}

		const publish = () => {
			const height = viewport.height
			// Ce que le clavier (ou toute autre surface système) mange en bas.
			// `Math.max(0, …)` : un arrondi sous-pixel peut rendre −0,5, et une
			// réserve négative décollerait le composeur du bas de l'écran.
			const keyboard = Math.max(
				0,
				window.innerHeight - height - viewport.offsetTop,
			)
			root.style.setProperty(HEIGHT_VAR, `${Math.round(height)}px`)
			root.style.setProperty(KEYBOARD_VAR, `${Math.round(keyboard)}px`)
		}

		publish()
		// `resize` suit le clavier ; `scroll` suit le décalage `offsetTop`, qui
		// change SANS resize quand iOS pousse la page au lieu de la réduire.
		viewport.addEventListener("resize", publish)
		viewport.addEventListener("scroll", publish)

		return () => {
			viewport.removeEventListener("resize", publish)
			viewport.removeEventListener("scroll", publish)
			// Nettoyage : une hauteur figée survivant au démontage cadrerait des
			// écrans qui n'ont rien demandé.
			root.style.removeProperty(HEIGHT_VAR)
			root.style.removeProperty(KEYBOARD_VAR)
		}
	}, [])
}
