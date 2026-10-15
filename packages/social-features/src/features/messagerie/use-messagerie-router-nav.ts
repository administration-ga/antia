// Dupliqué de socle/packages/agent-features/src/features/messagerie/use-messagerie-router-nav.ts @ ad2e7fdc2 — adaptations : routeur par `@antia/api/routing` ; base de la messagerie INJECTÉE (`useRoutes().messages()` de `@antia/api/network`) et passée aux fabriques d'adresses de `messagerie-routes` (plus de `MESSAGES_URL`).
"use client"

/**
 * use-messagerie-router-nav — la navigation de la MESSAGERIE, version pages.
 *
 * Le pendant de `DOCK_NAV` (`MessagerieDock.tsx`) : là où la carte change
 * d'ÉTAT, la page change d'ADRESSE. Les deux implémentent le même contrat
 * (`MessagerieNav`), ce qui permet aux trois vues d'ignorer complètement où
 * elles sont montées.
 *
 * L'adresse de la liste est celle de l'APPLICATION (`useRoutes().messages()`) :
 * ce hook ne connaît aucune URL, il les compose.
 *
 * ⚠️ Le retour n'est PAS `router.back()`. L'historique peut venir d'ailleurs —
 * une notification, un lien reçu, un rechargement — et remonter d'un cran
 * ferait alors sortir de la messagerie, voire de l'application. On pousse la
 * LISTE : c'est la destination, et elle est vraie quel que soit le chemin
 * parcouru pour arriver là.
 */

import { useRoutes } from "@antia/api/network"
import { useRouter } from "@antia/api/routing"
import { useMemo } from "react"
import type { ConversationKey } from "./messagerie-dock"
import {
	composeGroupeHref,
	composeHref,
	conversationHref,
} from "./messagerie-routes"
import type { MessagerieNav } from "./messagerie-views"

export function useMessagerieRouterNav(): MessagerieNav {
	const router = useRouter()
	const liste = useRoutes().messages()
	return useMemo<MessagerieNav>(
		() => ({
			openConversation: (key: ConversationKey) => {
				// Une clé abîmée ne doit pas envoyer sur `/undefined` : on ramène à la
				// liste, seul endroit qui ne dépend de rien.
				router.push(conversationHref(key, liste) ?? liste)
			},
			openCompose: () => router.push(composeHref(liste)),
			openComposeGroupe: () => router.push(composeGroupeHref(liste)),
			back: () => router.push(liste),
		}),
		[router, liste],
	)
}
