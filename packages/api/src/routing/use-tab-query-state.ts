// Dupliqué de socle/packages/routing/src/use-tab-query-state.ts @ ad2e7fdc2 — adaptations : paragraphe sur le contrat de navigation d'iAsted retiré (assistant du socle, hors du moteur) ; code inchangé.
"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "./hooks"

/**
 * useTabQueryState — synchronise l'onglet actif d'une page avec un paramètre
 * de query (`?tab=…`), pour que chaque volet soit adressable par URL.
 *
 * Bénéfices : liens profonds partageables, onglet conservé au rechargement,
 * bouton retour cohérent.
 *
 * - Une valeur de query inconnue retombe sur `defaultValue` (pas d'onglet mort).
 * - Sélectionner l'onglet par défaut NETTOIE la query (URL canonique).
 * - `router.replace` (pas push) : changer d'onglet ne pollue pas l'historique.
 *
 * ⚠️ Next.js : `useSearchParams` exige une frontière <Suspense> au-dessus du
 * composant appelant pour le prerender — envelopper la page si besoin.
 */
export function useTabQueryState(
  param: string,
  defaultValue: string,
  validValues?: readonly string[],
): [string, (next: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const raw = searchParams.get(param)
  const value =
    raw && (!validValues || validValues.includes(raw)) ? raw : defaultValue

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === defaultValue) {
        params.delete(param)
      } else {
        params.set(param, next)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, param, defaultValue],
  )

  return [value, setValue]
}
