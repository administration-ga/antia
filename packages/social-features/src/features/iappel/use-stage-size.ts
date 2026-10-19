// Dupliqué de socle/packages/agent-features/src/features/iappel/use-stage-size.ts @ ad2e7fdc2 — adaptations : aucune (mesure de la scène, sans texte affiché ni dépendance au socle).
"use client"

/**
 * useStageSize — LA TAILLE RÉELLE de la scène d'appel (IC-10).
 *
 * La grille de groupe se décidait sur un booléen d'ÉCRAN (`useIsReseauMobile`,
 * media query ≤ 959 px) alors que la surface réelle est une fenêtre de 400 px
 * de large : sur un grand écran, la disposition « bureau » posait quatre
 * colonnes dans 400 px, soit 86 px par personne une fois les marges ôtées.
 * L'écran était large ; la fenêtre ne l'était pas.
 *
 * On mesure donc le CONTENEUR, par `ResizeObserver` — la même mécanique que
 * `VerticalPager` et `useSurfaceInsets`. `null` tant qu'aucune mesure n'est
 * arrivée : l'appelant replie alors sur `viewport`, il ne devine pas une
 * largeur (une valeur inventée ferait clignoter la grille au premier rendu).
 *
 * ⚠️ Aucun remontage de salle ici : le hook ne rend qu'un couple de nombres.
 * Changer de disposition ne doit JAMAIS démonter `Room` — LiveKit ré-applique
 * audio et vidéo à chaque reconnexion, et la caméra s'éteindrait au passage.
 */

import { useEffect, useState, type RefObject } from "react"

export interface StageSize {
	width: number
	height: number
}

export function useStageSize(
	ref: RefObject<HTMLElement | null>,
): StageSize | null {
	const [size, setSize] = useState<StageSize | null>(null)

	useEffect(() => {
		const node = ref.current
		if (node === null) return
		if (typeof ResizeObserver === "undefined") {
			// Environnements sans observateur (tests node, très vieux moteurs) :
			// une mesure unique vaut mieux que rien, et le repli `viewport`
			// prend le relais si elle est nulle.
			const rect = node.getBoundingClientRect()
			if (rect.width > 0) {
				setSize({ width: Math.round(rect.width), height: Math.round(rect.height) })
			}
			return
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry === undefined) return
			const rect = entry.contentRect
			const width = Math.round(rect.width)
			const height = Math.round(rect.height)
			// Une surface repliée (fenêtre réduite, onglet caché) mesure 0 : la
			// garder ferait basculer la grille en « scène » pour rien, et le
			// retour en grand rendrait une disposition calculée sur du vide.
			if (width <= 0 || height <= 0) return
			setSize((current) =>
				current !== null && current.width === width && current.height === height
					? current
					: { width, height },
			)
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [ref])

	return size
}
