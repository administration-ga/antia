// Dupliqué de socle/packages/agent-features/src/features/messagerie/NewMessagesPill.tsx @ ad2e7fdc2 — adaptations : libellé traduit (`newMessagesLabel(count, t)`, espace de noms `messagerie`).
"use client"

/**
 * NewMessagesPill — « 3 nouveaux messages », flottant au bas du fil.
 *
 * Elle n'apparaît QUE lorsqu'on lit plus haut et que des messages arrivent
 * (`conversation-scroll.ts` le décide, pas ce composant). Sans elle, deux
 * conduites également mauvaises : faire sauter le fil au bas à chaque arrivée
 * (on perd sa place au milieu d'une lecture), ou ne rien dire (on ne sait pas
 * qu'on a du retard).
 *
 * ⚠️ `position: absolute` dans un parent `relative`, jamais `fixed` : la
 * messagerie du bureau vit sous `.rp-scope`, qui déclare
 * `container-type: inline-size` — donc `contain: layout` — et cadre tout
 * descendant fixe sur la grille du fil au lieu du viewport. Le voile
 * défilerait avec elle. Même piège que `SharePostDialog` et
 * `ImmersiveOverlay`, mêmes conséquences.
 */

import { ArrowDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { newMessagesLabel } from "./conversation-scroll"

export function NewMessagesPill({
	count,
	onJump,
}: {
	count: number
	onJump: () => void
}) {
	const { t } = useTranslation("messagerie")
	const label = newMessagesLabel(count, t)
	// Chaîne vide = rien à annoncer : le module pur l'a déjà tranché, on ne
	// recompte pas ici.
	if (label.length === 0) return null

	return (
		<button type="button" className="msg-pill" onClick={onJump}>
			<ArrowDown aria-hidden="true" size={14} />
			{label}
		</button>
	)
}
