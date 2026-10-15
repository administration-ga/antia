// Dupliqué de socle/packages/agent-features/src/features/stories/StoryProgressBar.tsx @ ad2e7fdc2 — adaptations : nom accessible du segment actif traduit (clé `stories:storyProgressBar.segmentLabel`).
"use client"

/**
 * StoryProgressBar — la barre segmentée en tête d'une série : un segment par
 * story, plein pour ce qui est passé, en cours pour celle qu'on regarde, vide
 * pour ce qui reste.
 *
 * ⚠️ Le `<progress>` natif n'irait pas : il n'y en aurait qu'un pour une série
 * de huit, et la seule information qui compte ici est « où en suis-je dans la
 * SÉRIE », pas « où en suis-je dans ce média ». D'où la rangée, et d'où le rôle
 * `progressbar` porté par le segment ACTIF seul — sept barres de progression
 * annoncées d'affilée ne diraient plus rien.
 *
 * ⚠️ La largeur du remplissage est un `style` en ligne, et il n'y a pas
 * d'autre issue : elle change soixante fois par seconde. Ce n'est PAS une
 * couleur — le cliquet `no-hardcoded-colors` n'interdit que celles-là, et les
 * deux teintes viennent des classes `.esp-story-progress` /
 * `.esp-story-progress-fill`.
 */

import { useTranslation } from "react-i18next"

export interface StoryProgressBarProps {
	count: number
	/** Index de la story en cours, dans `[0, count - 1]`. */
	index: number
	/** Avancement de la story en cours, entre `0` et `1`. */
	progress: number
}

export function StoryProgressBar({
	count,
	index,
	progress,
}: StoryProgressBarProps) {
	const { t } = useTranslation("stories")
	if (count <= 0) return null

	return (
		<div className="st-progress">
			{Array.from({ length: count }, (_unused, position) => {
				const active = position === index
				// Ce qui est DERRIÈRE est plein, ce qui est DEVANT est vide : sans
				// cette règle, revenir en arrière laisserait les segments suivants
				// pleins et la série paraîtrait déjà vue.
				const ratio = active ? progress : position < index ? 1 : 0
				return (
					<div
						key={position}
						className="st-progress-seg esp-story-progress"
						{...(active
							? {
									role: "progressbar" as const,
									"aria-label": t("storyProgressBar.segmentLabel", {
										position: index + 1,
										total: count,
									}),
									"aria-valuemin": 0,
									"aria-valuemax": 100,
									"aria-valuenow": Math.round(progress * 100),
								}
							: {})}
					>
						<div
							className="st-progress-head esp-story-progress-fill"
							style={{ width: `${Math.round(ratio * 100)}%` }}
						/>
					</div>
				)
			})}
		</div>
	)
}
