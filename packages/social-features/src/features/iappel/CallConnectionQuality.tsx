// Dupliqué de socle/packages/agent-features/src/features/iappel/CallConnectionQuality.tsx @ ad2e7fdc2 — adaptations : libellé de qualité traduit (`qualityLabel` reçoit `t` en dernier paramètre).
"use client"

/**
 * CallConnectionQuality — la puce de qualité du lien, posée sur la scène.
 *
 * ⚠️ Elle ne rend RIEN quand la qualité n'inquiète pas (`degraded` faux) :
 * cf. `call-controls.ts`, `qualityLabel`. Une pastille verte affichée en
 * permanence n'informe de rien de plus qu'un silence, et finit ignorée à
 * force d'être toujours là — l'écran ne montre que ce qui doit alerter.
 */

import { useTranslation } from "react-i18next"

import { qualityLabel, type ConnectionQualityLevel } from "./call-controls"

export interface CallConnectionQualityProps {
	level: ConnectionQualityLevel
}

export function CallConnectionQuality({ level }: CallConnectionQualityProps) {
	const { t } = useTranslation("iappel")
	const { bars, text, degraded } = qualityLabel(level, t)

	if (!degraded) return null

	return (
		<span className="iappel-chip">
			{/* Les barreaux SEULS ne suffiraient pas : quelqu'un qui ne distingue
			    pas les nuances d'opacité ne verrait qu'un pictogramme muet. Le
			    texte qui suit est donc VISIBLE, pas seulement porté par un
			    `aria-label` — c'est l'information, pas sa doublure. */}
			<span className="iappel-quality" data-bars={bars}>
				<span />
				<span />
				<span />
			</span>
			{text}
		</span>
	)
}
