// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/useIsReseauMobile.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

/**
 * useIsReseauMobile — quel ARBRE monter : la coquille mobile ou celle du
 * bureau. Trois réponses, pas deux.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : la source est
 * réellement extérieure à React (la liste de médias du navigateur), et le hook
 * dédié garantit qu'aucun rendu concurrent ne lit une valeur périmée.
 *
 * ⚠️ `getServerSnapshot` rend `null`, et c'est le point délicat.
 * React appelle cet instantané pour le rendu SERVEUR **et** pour le rendu
 * d'HYDRATATION. Y rendre un booléen ferait choisir un arbre au serveur, qui
 * ne sait rien de la largeur de l'écran : le client rendrait l'autre, et
 * l'hydratation échouerait — ou pire, réussirait en gardant l'arbre du serveur.
 * `null` dit « je ne sais pas encore » ; l'appelant rend alors une ossature, et
 * le premier effet client tranche.
 *
 * ⚠️ L'instantané serveur DOIT être une constante stable. Le rendre par une
 * expression littérale à chaque appel suffirait ici (les primitives se
 * comparent par valeur), mais la constante nommée rend l'invariant explicite :
 * un jour où cette valeur deviendrait un objet, une nouvelle référence à chaque
 * appel ferait boucler React à l'infini.
 */

import { useSyncExternalStore } from "react"
import { RESEAU_MOBILE_QUERY, resolveMobileViewport } from "./mobile-shell"

/** Instantané serveur — STABLE, et volontairement non booléen. */
const SERVER_SNAPSHOT: boolean | null = null

function mediaQueryList(): MediaQueryList | null {
	if (typeof window === "undefined") return null
	if (typeof window.matchMedia !== "function") return null
	return window.matchMedia(RESEAU_MOBILE_QUERY)
}

function subscribe(onStoreChange: () => void): () => void {
	const mql = mediaQueryList()
	if (mql === null) return () => {}
	// `addEventListener` et non `addListener` : le second est déprécié, et
	// Safari 14+ comme tous les moteurs cibles portent le premier.
	mql.addEventListener("change", onStoreChange)
	return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean | null {
	const mql = mediaQueryList()
	return resolveMobileViewport(mql === null ? undefined : mql.matches)
}

function getServerSnapshot(): boolean | null {
	return SERVER_SNAPSHOT
}

/**
 * `true` : coquille mobile. `false` : arbre du bureau. `null` : on ne sait pas
 * encore — rendre une ossature, jamais l'un des deux arbres.
 */
export function useIsReseauMobile(): boolean | null {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
