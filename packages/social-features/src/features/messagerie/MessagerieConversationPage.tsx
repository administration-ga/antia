// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessagerieConversationPage.tsx @ ad2e7fdc2 — adaptations : adresses INJECTÉES par l'application (`useRoutes()` de `@antia/api/network` : le profil par `routes.profile(handle)`, la liste par `routes.messages()`) au lieu du chemin de profil de l'espace agent écrit en dur et de `MESSAGES_URL` (l'application encode le handle) ; routeur par `@antia/api/routing` ; le chrome est celui de la coque légère du moteur.
"use client"

/**
 * MessagerieConversationPage — UNE conversation, plein écran, au téléphone.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA COLONNE, ET POURQUOI LE COMPOSEUR EST SON DERNIER ENFANT STATIQUE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une colonne en `height: var(--vv-height, 100dvh)` — la hauteur VISIBLE,
 * clavier compris (`useVisualViewport`, monté par la vue) : en-tête, fil qui
 * défile, composeur. Le composeur est le DERNIER ENFANT, en flux normal.
 *
 * ⚠️ Jamais `position: fixed; bottom: 0`. Sur iOS, ouvrir le clavier ne change
 * ni `100dvh` ni `window.innerHeight` : la page garde sa hauteur et REMONTE.
 * Un composeur fixé au bas du viewport se retrouve alors DERRIÈRE le clavier,
 * et le seul moyen de l'atteindre est de faire défiler un écran qui ne devait
 * pas défiler. La colonne mesurée par `visualViewport` n'a pas ce défaut : sa
 * hauteur recule quand le clavier monte, et le dernier enfant reste visible.
 *
 * ⚠️ La coque de l'application monte cette page en IMMERSIF (sans en-tête de
 * réseau, sans barre d'onglets, sans réserve basse à contourner) : elle
 * occupe tout.
 *
 * Aucune adresse n'est écrite ici : le profil et la liste viennent de la table
 * des routes de l'application (`useRoutes()`).
 */

import { useRoutes } from "@antia/api/network"
import { useRouter } from "@antia/api/routing"
import { useDockState } from "./dock-store"
import { MessagerieConversationView } from "./MessagerieConversationView"
import { draftTextFor, type ConversationKey } from "./messagerie-dock"
import { MessagerieStyles } from "./messagerie-styles"
import { useInfosPanneau } from "./use-infos-panneau"
import { useMessagerieRouterNav } from "./use-messagerie-router-nav"

export function MessagerieConversationPage({
	conversationKey,
}: {
	conversationKey: ConversationKey
}) {
	const nav = useMessagerieRouterNav()
	const router = useRouter()
	const routes = useRoutes()
	// Le brouillon de frappe vit dans le store MÊME ici : quitter la page
	// démonte le composant, et un `useState` local emporterait la frappe.
	const dock = useDockState()
	const infos = useInfosPanneau()

	return (
		<>
			<MessagerieStyles />
			<div
				className="msg-panel"
				data-variant="page"
				data-fill="screen"
				data-open="true"
			>
				<MessagerieConversationView
					conversationKey={conversationKey}
					variant="page"
					nav={nav}
					draft={draftTextFor(dock, conversationKey)}
					onOpenProfile={(handle) => router.push(routes.profile(handle))}
					infosOpen={infos.ouvert}
					onOpenInfos={infos.ouvrir}
					onCloseInfos={infos.fermer}
					// Quitter ou supprimer : la conversation n'existe plus pour nous.
					// Revenir en arrière ramènerait sur une adresse qui ne désigne
					// plus rien — on va à la liste.
					onLeftGroup={() => router.replace(routes.messages())}
				/>
			</div>
		</>
	)
}
