// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessagesRoute.tsx @ ad2e7fdc2 — adaptations : seuil mobile par `@antia/ui/overlay` (`useIsReseauMobile`) ; annonce de chargement traduite (clé `messagesRoute.loading`) ; doc : routes décrites depuis la base injectée de l'application (aucune adresse de l'espace agent), renvoi au chrome de l'espace agent (`personal-chrome.ts`) retiré ; aiguillage inchangé.
"use client"

/**
 * MessagesRoute — l'AIGUILLAGE des pages de la messagerie, et le seul.
 *
 * Les quatre coquilles de route de l'application (liste, conversation, les
 * deux composeurs — sous la base `useRoutes().messages()`) montent toutes CE
 * composant : il rend la page iCom au téléphone et transmet l'intention au
 * téléphone détaché sur ordinateur. Répartir ce choix dans quatre coquilles le
 * ferait diverger.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS RÉPONSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `useIsReseauMobile()` rend `null` au rendu serveur ET au premier passage
 * client : la largeur n'est pas connue. On rend alors une OSSATURE — jamais
 * l'un des deux arbres. Choisir au serveur ferait échouer l'hydratation, ou
 * pire, la ferait réussir en gardant l'arbre du serveur : un téléphone
 * garderait une présentation prévue pour une autre largeur.
 *
 * ⚠️ La LISTE porte la barre basse d'iCom (`MessagerieListPage`) ; la
 * conversation et les deux composeurs sont immersifs — aucune barre, l'écran
 * entier. Ce composant n'a rien à retirer ni à réserver : il se contente de
 * remplir ce qu'on lui laisse.
 */

import { useIsReseauMobile } from "@antia/ui/overlay"
import { useTranslation } from "react-i18next"
import { MessagerieComposePage } from "./MessagerieComposePage"
import { MessagerieConversationPage } from "./MessagerieConversationPage"
import { MessagerieDesktopPage } from "./MessagerieDesktopPage"
import { MessagerieListPage } from "./MessagerieListPage"
import { MessagerieStyles } from "./messagerie-styles"
import { parseConversationRoute } from "./messagerie-routes"

export interface MessagesRouteProps {
	/** Le genre d'URL — `chat`, `groupe` ou `a`. Absent sur la liste. */
	kind?: string
	/** L'identifiant, DÉJÀ décodé par la coquille de route. */
	id?: string
	/** L'un des deux composeurs. */
	compose?: "personne" | "groupe"
}

export function MessagesRoute({ kind, id, compose }: MessagesRouteProps) {
	const { t } = useTranslation("messagerie")
	const isMobile = useIsReseauMobile()
	const conversationKey =
		kind === undefined || id === undefined
			? null
			: parseConversationRoute(kind, id)

	if (isMobile === null) {
		return (
			<>
				<MessagerieStyles />
				<div className="msg-skeleton" aria-hidden="true">
					<span className="msg-skeleton-row" />
					<span className="msg-skeleton-row" />
					<span className="msg-skeleton-row" />
				</div>
				{/* L'ossature est décorative ; la phrase, elle, s'annonce. */}
				<p className="sr-only">{t("messagesRoute.loading")}</p>
			</>
		)
	}

	if (isMobile) {
		if (compose !== undefined) return <MessagerieComposePage kind={compose} />
		if (conversationKey !== null) {
			return <MessagerieConversationPage conversationKey={conversationKey} />
		}
		return <MessagerieListPage />
	}

	// Au bureau, l'adresse reste compatible mais ne rend aucune grande
	// messagerie. Elle ouvre l'unique téléphone iCom, détaché, sur l'accueil.
	return (
		<MessagerieDesktopPage
			conversationKey={conversationKey}
			compose={compose}
		/>
	)
}
