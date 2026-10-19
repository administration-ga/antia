// Dupliqué de socle/packages/agent-features/src/hooks/useDebouncedValue.ts @ ad2e7fdc2 — adaptations : renommé en kebab-case (convention du moteur) ; contenu inchangé.
/**
 * useDebouncedValue — valeur retardée, partagée par les sélecteurs de
 * destinataires (recherche de relations, de pages, d'annuaire).
 *
 * Extrait de `useContactSearch` (Lot 02 du plan espace agent, 2026-09-06)
 * pour que chaque champ de recherche serveur attende la même pause de frappe
 * avant d'atteindre Convex : une requête par caractère serait une charge pour
 * rien, et un délai différent par écran une incohérence perceptible.
 */

import { useEffect, useState } from "react"

/** Pause de frappe avant qu'un terme n'atteigne le serveur. */
export const SEARCH_DEBOUNCE_MS = 300

export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const handle = setTimeout(() => setDebounced(value), delay)
		return () => clearTimeout(handle)
	}, [value, delay])
	return debounced
}
