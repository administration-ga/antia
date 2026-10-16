// Adaptation interne de packages/social-features/src/features/reseau-albums/albums-pagination.ts @ 8d4754d — adaptations : pages natives des abonnements, identités de montage contre les rapports périmés, retrait local seulement après succès de la mutation ; aucun type ni contrat d'album partagé.
import type { api } from "@antsia/api/engine"
import type { FunctionReturnType } from "convex/server"

export type FollowsPage = FunctionReturnType<typeof api.modules.graph.follows.paginateMyFollows>
export type FollowRow = FollowsPage["page"][number]

export interface FollowPageMount {
  readonly id: number
  readonly cursor: string | null
}

export interface FollowPageSnapshot {
  readonly data: FollowsPage | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

export interface FollowsPagesState {
  readonly mounts: readonly FollowPageMount[]
  readonly pages: Readonly<Record<number, FollowPageSnapshot>>
  readonly nextId: number
}

export function initialFollowsPages(): FollowsPagesState {
  return { mounts: [{ id: 0, cursor: null }], pages: {}, nextId: 1 }
}

/** Un curseur remonté plus tard possède une autre identité : son ancien
 * abonnement ne peut plus lui rendre sa réponse ni son erreur. */
export function recordFollowPage(state: FollowsPagesState, mount: FollowPageMount, incoming: FollowPageSnapshot): FollowsPagesState {
  const index = state.mounts.findIndex((candidate) => candidate.id === mount.id && candidate.cursor === mount.cursor)
  if (index < 0) return state
  const previous = state.pages[mount.id]
  const snapshot = { ...incoming, data: incoming.data ?? previous?.data }
  if (previous?.data === snapshot.data && previous?.isPending === snapshot.isPending && previous?.isError === snapshot.isError) return state
  const pages = { ...state.pages, [mount.id]: snapshot }
  const nextMounted = state.mounts[index + 1]

  if (incoming.data !== undefined && nextMounted !== undefined && (incoming.data.isDone || incoming.data.continueCursor !== nextMounted.cursor)) {
    const mounts = state.mounts.slice(0, index + 1)
    let nextId = state.nextId
    if (!incoming.data.isDone && !mounts.some((candidate) => candidate.cursor === incoming.data?.continueCursor)) {
      mounts.push({ id: nextId++, cursor: incoming.data.continueCursor })
    }
    const retained: Record<number, FollowPageSnapshot> = {}
    for (const candidate of mounts) {
      const page = pages[candidate.id]
      if (page !== undefined) retained[candidate.id] = page
    }
    return { mounts, pages: retained, nextId }
  }
  return { ...state, pages }
}

/** isDone et le curseur font autorité, même pour une page filtrée vide. */
export function nextFollowsCursor(state: FollowsPagesState): string | null {
  const last = state.mounts[state.mounts.length - 1]
  if (!last) return null
  const page = state.pages[last.id]
  if (!page?.data || page.isError || page.isPending || page.data.isDone || state.mounts.some((mount) => mount.cursor === page.data?.continueCursor)) return null
  return page.data.continueCursor
}

export function appendFollowPage(state: FollowsPagesState): FollowsPagesState {
  if (state.mounts.some((mount) => state.pages[mount.id]?.isError)) return state
  const cursor = nextFollowsCursor(state)
  return cursor === null ? state : {
    ...state,
    mounts: [...state.mounts, { id: state.nextId, cursor }],
    nextId: state.nextId + 1,
  }
}

/** La page amont gagne sur une copie aval, y compris son profil actualisé. */
export function mergedFollowRows(state: FollowsPagesState): FollowRow[] {
  const rows = new Map<string, FollowRow>()
  for (const mount of state.mounts) {
    for (const row of state.pages[mount.id]?.data?.page ?? []) {
      if (!rows.has(row.targetPersonId)) rows.set(row.targetPersonId, row)
    }
  }
  return [...rows.values()]
}

export function removeFollowRow(state: FollowsPagesState, targetPersonId: string): FollowsPagesState {
  return {
    ...state,
    pages: Object.fromEntries(Object.entries(state.pages).map(([id, snapshot]) => [id, {
      ...snapshot,
      data: snapshot.data === undefined ? undefined : {
        ...snapshot.data,
        page: snapshot.data.page.filter((row) => row.targetPersonId !== targetPersonId),
      },
    }])),
  }
}
