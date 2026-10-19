// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/useBodyScrollLock.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

/**
 * useBodyScrollLock — empêche la page de défiler DERRIÈRE une surface
 * immersive, sans lui faire perdre sa position.
 *
 * ⚠️ Le nœud verrouillé n'est PAS `<body>` en premier lieu, et c'est le point
 * qui compte. Dans l'espace personnel, ce n'est pas le document qui défile :
 * c'est `#espace-main` (`PersonalSpaceLanding`, `overflow-y: auto` sur une
 * colonne en `h-dvh`). Verrouiller `<body>`, qui ne défile pas, n'aurait
 * rigoureusement aucun effet — et le défaut serait invisible au poste de
 * travail, où l'on n'ouvre pas de vue immersive.
 *
 * `<body>` reste le repli : la même coquille peut être montée par un hôte qui
 * laisse le document défiler.
 *
 * ⚠️ Aucun saut de position. On ne touche QUE `overflow` — jamais
 * `position: fixed` sur le nœud, recette répandue qui ramène le défilement à
 * zéro à l'ouverture puis oblige à le restaurer à la main. La valeur d'origine
 * est relue au montage (y compris « absente ») et remise telle quelle au
 * démontage : deux surfaces empilées ne peuvent donc pas se déverrouiller
 * l'une l'autre par erreur, la seconde restaurant `hidden`.
 */

import { useEffect } from "react"

/** Le scroller de l'espace personnel — cf. `PersonalSpaceLanding`. */
const ESPACE_SCROLLER_ID = "espace-main"

export function useBodyScrollLock(active: boolean): void {
	useEffect(() => {
		if (!active) return
		if (typeof document === "undefined") return

		const target =
			document.getElementById(ESPACE_SCROLLER_ID) ?? document.body
		if (!target) return

		// La valeur EN LIGNE d'origine, et non la valeur calculée : c'est elle
		// qu'il faudra remettre, et une chaîne vide signifie « aucune, laisse la
		// feuille de style décider » — ce qui n'est pas la même chose que `visible`.
		const previousOverflow = target.style.overflow
		target.style.overflow = "hidden"

		return () => {
			target.style.overflow = previousOverflow
		}
	}, [active])
}
