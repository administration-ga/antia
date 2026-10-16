// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-relation-search.ts @ ad2e7fdc2 — adaptations : `reseauPersonnel.connections.searchMine` → `graph.connections.searchMine` du moteur (mes relations acceptées DANS le réseau courant, `networkId` par `useNetwork()`) ; `RelationSearchHit` = `ConnectionPersonDto` du moteur (badges calculés, sans fonction ni administration) ; `useDebouncedValue` de `@antsia/ui` ; contrat du hook inchangé.
"use client"

/**
 * useRelationSearch — chercher une personne parmi MES relations, côté serveur.
 *
 * Le sélecteur de destinataires (nouveau message, nouvel appel) filtrait la
 * première page de 25 relations : la 26e était déclarée inexistante (IC-05,
 * audit du 2026-09-06). Ce hook interroge `graph.connections.searchMine`, qui
 * cherche par le nom ET par le `@handle` parmi l'ensemble des relations
 * acceptées du réseau courant — et rien d'autre : jamais l'annuaire.
 *
 * Trois disciplines, partagées par tous les champs qui le montent :
 *
 *  - **une pause de frappe** (`useDebouncedValue`, 300 ms) avant d'atteindre
 *    Convex — une requête par caractère serait une charge pour rien ;
 *  - **un seuil de deux caractères** : un seul caractère n'est pas une
 *    recherche, et le pré-filtre local suffit ;
 *  - **`isPending` ne ment jamais** : une requête désactivée reste `pending`
 *    en TanStack v5 (IC-07) — ici, hors seuil, elle est simplement inactive.
 *
 * Le contrat (`items`, `isPending`, `isError`, `refetch`, `enabled`) est
 * celui que le Lot 01 (`AddToCallPanel`) et le Lot 09A (invitations) montent
 * à leur tour : un seul sélecteur de relations, trois points d'entrée.
 */

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useDebouncedValue } from "@antsia/ui"
import type { FunctionReturnType } from "convex/server"
import { useCallback } from "react"

/** En deçà, on ne cherche pas : le pré-filtre local des pages chargées suffit. */
export const RELATION_SEARCH_MIN_CHARS = 2
/** Le plafond serveur (`RELATION_SEARCH_LIMIT_MAX` de `graph/connections.ts`) — demandé en entier. */
export const RELATION_SEARCH_LIMIT = 25

/** Une relation trouvée : le `ConnectionPersonDto` du moteur. */
export type RelationSearchHit = FunctionReturnType<typeof api.modules.graph.connections.searchMine>[number]

/** Le terme, une fois ébarbé, mérite-t-il une requête serveur ? */
export function isRelationSearchTerm(term: string): boolean {
  return term.trim().length >= RELATION_SEARCH_MIN_CHARS
}

export interface RelationSearchResult {
  /** Les relations trouvées — vides tant que la recherche n'est pas active. */
  items: RelationSearchHit[]
  /** Une requête est EN ROUTE pour le terme envoyé (jamais vrai hors seuil). */
  isPending: boolean
  isError: boolean
  refetch: () => void
  /** Le terme envoyé (après la pause de frappe) atteint le seuil. */
  enabled: boolean
  /**
   * Le terme SAISI atteint le seuil — avant même la pause de frappe. C'est ce
   * qui décide que l'écran est « en mode recherche », et non les pages locales.
   */
  eligible: boolean
  /**
   * Les résultats correspondent au terme saisi et plus rien n'est en route :
   * un résultat vide est alors EXHAUSTIF, et l'écran peut le dire.
   */
  settled: boolean
  /** Le terme réellement envoyé au serveur. */
  term: string
}

export function useRelationSearch(
  query: string,
  options?: { limit?: number },
): RelationSearchResult {
  const { networkId } = useNetwork()
  const term = query.trim()
  const debounced = useDebouncedValue(term)
  const eligible = isRelationSearchTerm(term)
  const enabled = isRelationSearchTerm(debounced)
  const limit = options?.limit ?? RELATION_SEARCH_LIMIT

  const result = useAuthenticatedConvexQuery(
    api.modules.graph.connections.searchMine,
    enabled ? { networkId, query: debounced, limit } : "skip",
  )
  const { refetch: refetchQuery } = result
  const refetch = useCallback(() => {
    void refetchQuery()
  }, [refetchQuery])

  const isPending = enabled && result.isPending
  const isError = enabled && result.isError
  return {
    items: enabled && result.data ? result.data : [],
    isPending,
    isError,
    refetch,
    enabled,
    eligible,
    settled: enabled && debounced === term && !isPending && !isError,
    term: debounced,
  }
}
