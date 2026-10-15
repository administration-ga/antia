// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessagerieComposePage.tsx @ ad2e7fdc2 — adaptations : doc : renvoi au chrome de l'espace agent (`personalChromeFor`) remplacé par la règle de la page ; code inchangé.
"use client"

/**
 * MessagerieComposePage — les deux composeurs, plein écran, au téléphone.
 *
 * Un écran de rédaction est aussi immersif qu'une conversation : le clavier y
 * prend la moitié de la hauteur, et une barre d'onglets sous lui n'aurait
 * nulle part où se poser. Les deux composeurs occupent donc l'écran, sans la
 * barre basse d'iCom (montée par la seule page de liste).
 *
 * ⚠️ Deux composeurs, et non deux modes d'un seul : ils n'ont ni la même
 * source (l'annuaire publié pour écrire à quelqu'un, MES connexions pour
 * réunir un groupe) ni la même sortie (un brouillon dans un cas, une création
 * immédiate dans l'autre). C'est la même distinction que fait `DockView`.
 */

import { useDockState } from "./dock-store"
import { MessagerieComposeView } from "./MessagerieComposeView"
import { MessagerieGroupeCompose } from "./MessagerieGroupeCompose"
import { MessagerieStyles } from "./messagerie-styles"
import { useMessagerieRouterNav } from "./use-messagerie-router-nav"

export function MessagerieComposePage({
	kind,
}: {
	kind: "personne" | "groupe"
}) {
	const nav = useMessagerieRouterNav()
	// Le composeur de groupe lit l'état du dock pour savoir s'il est déplié ;
	// sur la page il l'est toujours, mais l'abonnement garde les deux surfaces
	// en phase quand on passe de l'une à l'autre sur la même session.
	useDockState()

	return (
		<>
			<MessagerieStyles />
			<div
				className="msg-panel"
				data-variant="page"
				data-fill="screen"
				data-open="true"
			>
				{kind === "groupe" ? (
					<MessagerieGroupeCompose variant="page" nav={nav} open />
				) : (
					<MessagerieComposeView variant="page" nav={nav} />
				)}
			</div>
		</>
	)
}
