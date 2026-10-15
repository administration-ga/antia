// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-dual-connection-pagination.ts @ ad2e7fdc2 — adaptations : UN seul graphe par réseau — `reseauPersonnel.connections.*` et `reseau.connections.*` deviennent `graph.connections.paginateMine` (deux côtés `low`/`high`) et `graph.connections.paginatePendingForMe` (un seul index, présenté comme une paire au côté haut épuisé) ; `networkId` lu par `useNetwork()` ; DTO `ConnectionPersonDto` du moteur (type `PersonalConnection` exporté) ; hook interne paramétré par une SOURCE typée (requête, arguments, lecture de la réponse) au lieu de références forcées par transtypage ; `useCoreConnections` et `useCorePendingConnections` retirés (annuaire administratif) ; horodatage `at` hors du rendu.
"use client"

import { api, type Id } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useNetwork } from "@antia/api/network"
import type { FunctionReference, FunctionReturnType } from "convex/server"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  appendDualPage,
  currentDualCursors,
  dualContinuation,
  dualPagesLoaded,
  FIRST_DUAL_CURSORS,
  initialDualPages,
  isFirstDualCursors,
  mergeDualRows,
  recordDualPage,
  removeDualRow,
  type DualCursors,
  type DualPageData,
  type DualPagesState,
  type DualSide,
} from "./dual-pagination-pages"

const DEFAULT_PAGE_SIZE = 25

/** Une relation acceptée, telle que le moteur la rend (`ConnectionPersonDto`). */
export type PersonalConnection = FunctionReturnType<typeof api.modules.graph.connections.paginateMine>["low"]["page"][number]

/** Une demande reçue — même DTO, avec le mot joint à la demande quand il y en a un. */
export type PersonalPendingConnection = FunctionReturnType<typeof api.modules.graph.connections.paginatePendingForMe>["page"][number]

/**
 * D'où viennent les pages : la requête, ses arguments pour un couple de curseurs
 * donné, et la lecture de sa réponse comme une paire de côtés. Constantes de
 * module : leur identité ne change jamais d'un rendu à l'autre.
 */
interface DualSource<Query extends FunctionReference<"query">, T> {
  query: Query
  args: (networkId: Id<"networks">, cursors: DualCursors, numItems: number) => Query["_args"]
  page: (data: FunctionReturnType<Query>) => DualPageData<T>
}

interface DualPaginationOptions<T> {
  autoLoad?: boolean
  pageSize?: number
  timestamp: (item: T) => number
}

interface DualPaginationResult<T> {
  items: T[]
  isLoading: boolean
  isLoadingMore: boolean
  isError: boolean
  hasMore: boolean
  loadMore: () => void
  remove: (connectionId: unknown) => void
  retry: () => void
}

/** Le côté haut d'une source qui n'en a qu'un : vide, épuisé, et son curseur de fin. */
const EXHAUSTED_SIDE: DualSide<never> = Object.freeze({ page: [], isDone: true, continueCursor: "" })

/** Mes connexions : la paire canonique, un curseur natif par côté. */
const MINE_SOURCE: DualSource<typeof api.modules.graph.connections.paginateMine, PersonalConnection> = {
  query: api.modules.graph.connections.paginateMine,
  args: (networkId, cursors, numItems) => ({
    networkId,
    lowPaginationOpts: { cursor: cursors.low, numItems },
    highPaginationOpts: { cursor: cursors.high, numItems },
  }),
  page: (data) => data,
}

/**
 * Les demandes qui m'attendent : UN index (celui du destinataire), donc un seul
 * curseur — porté par le côté bas ; le côté haut est épuisé dès la première page.
 */
const PENDING_SOURCE: DualSource<typeof api.modules.graph.connections.paginatePendingForMe, PersonalPendingConnection> = {
  query: api.modules.graph.connections.paginatePendingForMe,
  args: (networkId, cursors, numItems) => ({
    networkId,
    paginationOpts: { cursor: cursors.low, numItems },
  }),
  page: (data) => ({ low: data, high: EXHAUSTED_SIDE }),
}

/** L'ordre de la liste : la relation la plus récente d'abord (`at` du serveur). */
const byAt = (item: { at: number }) => item.at

/**
 * Assemble les deux côtés de la paire canonique sans perdre leur curseur
 * natif. La CHAÎNE des pages — lesquelles sont montées, laquelle suit, quand
 * l'abandonner — est décidée par `dual-pagination-pages.ts` (pur, testé) ; ce
 * hook l'abonne et la câble.
 *
 * Deux abonnements seulement : la PREMIÈRE page, toujours, et la page
 * COURANTE, la dernière montée. Les pages intermédiaires sont des instantanés :
 * quand la première page change de frontière (une relation y entre ou en
 * sort), la chaîne se réaligne sur elle et abandonne ces instantanés, au lieu
 * de garder une page périmée — ligne disparue ou relation fantôme.
 */
function useDualConnectionPagination<Query extends FunctionReference<"query">, T extends { connectionId: unknown }>(
  source: DualSource<Query, T>,
  options: DualPaginationOptions<T>,
): DualPaginationResult<T> {
  const { networkId } = useNetwork()
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const [chain, setChain] = useState<DualPagesState<T>>(() => initialDualPages<T>())
  const current = currentDualCursors(chain)
  const onFirstPage = isFirstDualCursors(current)

  const firstPage = useAuthenticatedConvexQuery(source.query, source.args(networkId, FIRST_DUAL_CURSORS, pageSize))
  const currentPage = useAuthenticatedConvexQuery(source.query, onFirstPage ? "skip" : source.args(networkId, current, pageSize))
  const page = onFirstPage ? firstPage : currentPage

  // La première page est TOUJOURS vivante : l'enregistrer réaligne la chaîne
  // dès que sa frontière avec la suivante a bougé (`rebaseDualPages`).
  useEffect(() => {
    const data = firstPage.data
    if (data === undefined) return
    setChain((state) => recordDualPage(state, FIRST_DUAL_CURSORS, source.page(data)))
  }, [firstPage.data, source])

  // La page courante — sa réponse est ignorée si la chaîne a été réalignée
  // entre-temps : elle ressusciterait une page abandonnée.
  useEffect(() => {
    const data = currentPage.data
    if (onFirstPage || data === undefined) return
    setChain((state) => recordDualPage(state, current, source.page(data)))
  }, [current, currentPage.data, onFirstPage, source])

  const items = useMemo(() => mergeDualRows(chain, options.timestamp), [chain, options.timestamp])

  const pageData = page.data
  const next = pageData === undefined ? null : dualContinuation(source.page(pageData))
  const hasMore = next !== null
  const loadMore = useCallback(() => {
    if (pageData === undefined) return
    // `current` dit de quelle page on a lu la suite : si la chaîne a été
    // réalignée depuis, le geste est périmé et `appendDualPage` l'ignore.
    setChain((state) => appendDualPage(state, current, dualContinuation(source.page(pageData))))
  }, [current, pageData, source])
  // Masque OPTIMISTE, immédiat : la relation sort de toutes les pages reçues
  // sans attendre le serveur — une page vivante qui la rendrait encore l'y
  // remettrait, parce que c'est lui qui a raison.
  const remove = useCallback((connectionId: unknown) => {
    setChain((state) => removeDualRow(state, connectionId))
  }, [])

  useEffect(() => {
    if (options.autoLoad && hasMore && !page.isPending) loadMore()
  }, [hasMore, loadMore, options.autoLoad, page.isPending])

  const loadedAnyPage = dualPagesLoaded(chain)
  return {
    items,
    isLoading: page.isPending && !loadedAnyPage,
    isLoadingMore: (page.isPending && loadedAnyPage) || Boolean(options.autoLoad && hasMore),
    isError: firstPage.isError || currentPage.isError,
    hasMore,
    loadMore,
    remove,
    retry: () => {
      void firstPage.refetch()
      if (!onFirstPage) void currentPage.refetch()
    },
  }
}

/** Mes connexions acceptées dans le réseau courant. */
export function usePersonalConnections(options?: { autoLoad?: boolean; pageSize?: number }) {
  return useDualConnectionPagination(MINE_SOURCE, { ...options, timestamp: byAt })
}

/** Les demandes de connexion qui m'attendent dans le réseau courant. */
export function usePersonalPendingConnections(options?: { autoLoad?: boolean; pageSize?: number }) {
  return useDualConnectionPagination(PENDING_SOURCE, { ...options, timestamp: byAt })
}
