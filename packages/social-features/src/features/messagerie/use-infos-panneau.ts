// Dupliqué de socle/packages/agent-features/src/features/messagerie/use-infos-panneau.ts @ ad2e7fdc2 — adaptations : import du routage par `@antia/api/routing` ; en-tête de provenance.
"use client"

/**
 * useInfosPanneau — l'ouverture et la fermeture du panneau d'informations,
 * adressées par `?infos=1`.
 *
 * ⚠️ Ce hook ne vit QUE dans les deux poses « page ». Il appelle
 * `useSearchParams`, qui exige une frontière `<Suspense>` au-dessus du
 * composant pour le prerender Next.js. Le monter dans
 * `MessagerieConversationView` l'aurait embarqué dans le DOCK, présent sur des
 * pages quelconques qui n'ont aucune raison d'en avoir une.
 *
 * ── Fermer : `back()` si NOUS avons ouvert, `replace` sinon ───────────────
 * Ouvrir POUSSE une entrée d'historique — c'est ce qui fait que le bouton
 * retour du système referme le panneau. Le bouton « Revenir à la
 * conversation » doit donc consommer cette entrée plutôt qu'en empiler une
 * seconde, sans quoi il faudrait deux retours système pour sortir.
 *
 * Mais un usager peut ARRIVER sur `?infos=1` (lien partagé, rechargement) :
 * l'entrée n'est alors pas la nôtre, et `back()` ferait sortir de l'application
 * au lieu de fermer le panneau. D'où le drapeau — quatre lignes, et les deux
 * chemins sont justes.
 */

import { usePathname, useRouter, useSearchParams } from "@antia/api/routing"
import { useCallback, useRef } from "react"
import { hrefAvecInfos, infosOuvertes } from "./messagerie-routes"

export interface InfosPanneau {
	ouvert: boolean
	ouvrir: () => void
	fermer: () => void
}

export function useInfosPanneau(): InfosPanneau {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const pousseParNous = useRef(false)

	const search = searchParams.toString()
	const ouvert = infosOuvertes(search)

	const ouvrir = useCallback(() => {
		pousseParNous.current = true
		router.push(hrefAvecInfos(pathname, search, true), { scroll: false })
	}, [router, pathname, search])

	const fermer = useCallback(() => {
		if (pousseParNous.current) {
			pousseParNous.current = false
			router.back()
			return
		}
		router.replace(hrefAvecInfos(pathname, search, false), { scroll: false })
	}, [router, pathname, search])

	return { ouvert, ouvrir, fermer }
}
