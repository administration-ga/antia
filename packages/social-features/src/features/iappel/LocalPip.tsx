// Dupliqué de socle/packages/agent-features/src/features/iappel/LocalPip.tsx @ ad2e7fdc2 — adaptations : nom accessible traduit (i18n `iappel`) ; coin suivant borné pour `noUncheckedIndexedAccess` (repli sur le premier coin).
"use client"

/**
 * LocalPip — la vignette de MA caméra, posée en incrustation sur la scène.
 *
 * ⚠️ Elle est DÉPLAÇABLE, et ce n'est pas un gadget : sur un cadrage serré,
 * une vignette fixe finit presque toujours par recouvrir le visage du
 * correspondant — c'est le reproche le plus courant fait aux écrans d'appel,
 * téléphone comme visioconférence. Le TOUCHER de la vignette la fait tourner
 * au coin suivant plutôt que d'ouvrir un menu de position : un geste unique,
 * pas un choix à faire pendant qu'on parle.
 */

import { VideoTrack, type TrackReference } from "@livekit/components-react"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"

export type PipCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface LocalPipProps {
	/** Référence de piste LiveKit, telle que `useTracks` la rend. */
	trackRef: TrackReference
	/** Coin courant. */
	corner: PipCorner
	/** Déplace la vignette au coin suivant (rotation horaire). */
	onMove: () => void
	/** Miroir : on se regarde comme dans un miroir de salle de bain. */
	mirror?: boolean
}

// Rotation HORAIRE : l'ordre dans lequel un pouce balaie naturellement les
// quatre coins d'un écran tenu en main.
const PIP_CORNER_ORDER: readonly PipCorner[] = [
	"top-left",
	"top-right",
	"bottom-right",
	"bottom-left",
]

/**
 * Le coin suivant, en rotation horaire — module pur, testable sans DOM ni
 * dépendance à LiveKit : l'intégrateur s'en sert pour faire évoluer l'état.
 */
export function nextPipCorner(corner: PipCorner): PipCorner {
	const index = PIP_CORNER_ORDER.indexOf(corner)
	return PIP_CORNER_ORDER[(index + 1) % PIP_CORNER_ORDER.length] ?? "top-left"
}

// 12px du bord correspondant au coin — jamais un raccourci CSS `inset`, qui
// figerait les quatre côtés à la fois et empêcherait la transition posée par
// `.iappel-pip` de ne bouger QUE les deux côtés concernés par le coin visé.
const PIP_EDGE_OFFSET = 12

function pipPositionStyle(corner: PipCorner): CSSProperties {
	switch (corner) {
		case "top-left":
			return { top: PIP_EDGE_OFFSET, left: PIP_EDGE_OFFSET }
		case "top-right":
			return { top: PIP_EDGE_OFFSET, right: PIP_EDGE_OFFSET }
		case "bottom-left":
			return { bottom: PIP_EDGE_OFFSET, left: PIP_EDGE_OFFSET }
		case "bottom-right":
			return { bottom: PIP_EDGE_OFFSET, right: PIP_EDGE_OFFSET }
	}
}

export function LocalPip({ trackRef, corner, onMove, mirror }: LocalPipProps) {
	const { t } = useTranslation("iappel")
	return (
		<button
			type="button"
			className="iappel-pip"
			// `data-mirror="false"` est le SEUL cas non-miroir déclaré en CSS
			// (`.iappel-pip[data-mirror="false"] > video`) : absent ou `true`
			// valent tous deux « miroir », comme la prop le documente.
			data-mirror={mirror !== false}
			style={pipPositionStyle(corner)}
			onClick={onMove}
			aria-label={t("localPip.move")}
		>
			{/* Le miroir lui-même (scaleX) est posé par `.iappel-pip > video` en
			    CSS, pas ici — une transformation qui dépend d'un data-attribute
			    du parent se déclare une seule fois, au même endroit que ce
			    data-attribute. `h-full w-full object-cover` en revanche N'EST PAS
			    fourni par `.iappel-pip` (qui ne dimensionne que le conteneur) :
			    sans ces classes, la vidéo garderait sa taille intrinsèque au lieu
			    de remplir les 84×116px de la vignette. */}
			<VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
		</button>
	)
}
