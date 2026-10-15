// Dupliqué de socle/packages/agent-features/src/features/iappel/SpeakerPickerPanel.tsx @ ad2e7fdc2 — adaptations : titre traduit (i18n `iappel`) ; pile Échap lue dans la coque (`shell/floating-surface`) ; `useModalA11y` de @antia/ui.
"use client"

/**
 * SpeakerPickerPanel — CHOISIR LA SORTIE AUDIO, au bureau.
 *
 * Là où le navigateur sait router (`supportsAudioOutputSelection()` et au
 * moins deux sorties), un bouton qui CYCLE ne suffit pas : avec un casque,
 * des enceintes et un écran, il faut trois appuis pour revenir, et rien à
 * l'écran ne dit où l'on en est. Ce panneau nomme les sorties et marque celle
 * qui joue.
 *
 * NI `Sheet` NI `Dialog` NI portail — le cliquet du dossier les interdit
 * (`iappel-surface.ratchet.test.ts` : `data-[side=bottom]:h-auto` de
 * `SheetContent` avait réduit la scène vidéo à zéro pixel, et un portail vers
 * `<body>` sortirait le panneau de la carte iCom, ADR-0148). Patron
 * d'`AddToCallPanel` : mêmes classes `iappel-launcher-*` (jetons de rôle,
 * aucune couleur en dur), même pose ancrée, même pile Échap.
 *
 * ⚠️ `role="menu"` + `menuitemradio`, pas `listbox` : ce sont des ACTIONS qui
 * s'appliquent immédiatement (le son change au clic), et l'une d'elles est
 * vraie — `aria-checked` le dit. Un `listbox` promettrait une validation qui
 * n'existe pas.
 *
 * ⚠️ NON MODAL (`trapFocus: false`) : un appel vit derrière. Piéger Tab
 * rendrait « Raccrocher » inatteignable au clavier, et Échap appartient à la
 * pile de l'application, qui seule sait qui est au-dessus de qui.
 */

import { Check, Volume2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useModalA11y } from "@antia/ui"
import { ESCAPE_PRIORITY } from "../../shell/floating-surface/escape-stack"
import { useEscapeLayer } from "../../shell/floating-surface/use-escape-layer"
import type { SpeakerPickerOption } from "./audio-route"

export interface SpeakerPickerPanelProps {
	options: readonly SpeakerPickerOption[]
	/** Applique le choix — le magasin n'est écrit qu'au retour de la salle. */
	onSelect: (deviceId: string) => void
	onClose: () => void
	/**
	 * La POSE, dans la feuille de style (`[data-pose=…]`) — jamais un
	 * `position` en ligne, qui ignorerait le clavier et la carte hôte.
	 */
	pose?: "sheet" | "anchored"
}

export function SpeakerPickerPanel({
	options,
	onSelect,
	onClose,
	pose = "anchored",
}: SpeakerPickerPanelProps) {
	const { t } = useTranslation("iappel")
	const rootRef = useRef<HTMLDivElement | null>(null)

	// Focus initial sur la sortie ACTIVE (à défaut, la première) : on ouvre le
	// menu là où l'on est, pas en haut d'une liste.
	const activeRef = useRef<HTMLButtonElement | null>(null)

	useModalA11y({
		containerRef: rootRef,
		initialFocusRef: activeRef,
		onClose,
		trapFocus: false,
		skipInert: true,
	})

	useEscapeLayer({
		id: "speaker-picker",
		priority: ESCAPE_PRIORITY.OVERLAY,
		onEscape: onClose,
	})

	// Fermer au clic extérieur — le panneau n'est pas modal : l'appel continue
	// derrière, et on doit pouvoir le piloter.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const root = rootRef.current
			if (root !== null && !root.contains(event.target as Node)) onClose()
		}
		window.addEventListener("mousedown", onClick)
		return () => window.removeEventListener("mousedown", onClick)
	}, [onClose])

	return (
		<div
			ref={rootRef}
			className="iappel-launcher-panel"
			data-pose={pose}
			role="menu"
			aria-labelledby="iappel-speaker-title"
		>
			<div className="iappel-launcher-head">
				<span className="iappel-launcher-title" id="iappel-speaker-title">
					<Volume2 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
					{t("speakerPickerPanel.title")}
				</span>
			</div>
			<div className="iappel-launcher-list">
				{options.map((option) => (
					<button
						key={option.deviceId}
						ref={option.active ? activeRef : undefined}
						type="button"
						role="menuitemradio"
						aria-checked={option.active}
						className="iappel-launcher-row"
						data-selected={option.active ? "true" : "false"}
						onClick={() => {
							onSelect(option.deviceId)
							onClose()
						}}
					>
						<span className="iappel-launcher-check" aria-hidden="true">
							{option.active ? <Check className="h-3 w-3" /> : null}
						</span>
						<span className="iappel-launcher-person">
							<span className="iappel-launcher-name">{option.label}</span>
						</span>
					</button>
				))}
			</div>
		</div>
	)
}
