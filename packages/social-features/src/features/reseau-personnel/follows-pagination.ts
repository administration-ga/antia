// Adaptation interne de packages/social-features/src/features/reseau-albums/albums-pagination.ts @ 8d4754d — adaptations : pages natives des abonnements ; réduction commune dans cursor-pages, identités de montage contre les rapports périmés, retrait local seulement après succès de la mutation.
import type { api } from "@antsia/api/engine"
import type { FunctionReturnType } from "convex/server"
import {
  appendCursorPage,
  initialCursorPages,
  mergedCursorRows,
  nextCursor,
  recordCursorPage,
  removeCursorRows,
  type CursorPageMount,
  type CursorPageSnapshot,
  type CursorPagesState,
} from "./cursor-pages"

export type FollowsPage = FunctionReturnType<typeof api.modules.graph.follows.paginateMyFollows>
export type FollowRow = FollowsPage["page"][number]
export type FollowPageMount = CursorPageMount
export type FollowPageSnapshot = CursorPageSnapshot<FollowRow>
export type FollowsPagesState = CursorPagesState<FollowRow>

export const initialFollowsPages = initialCursorPages<FollowRow>
export const recordFollowPage = recordCursorPage<FollowRow>
export const nextFollowsCursor = nextCursor<FollowRow>
export const appendFollowPage = appendCursorPage<FollowRow>
export function mergedFollowRows(state: FollowsPagesState): FollowRow[] {
  return mergedCursorRows(state, (row) => row.targetPersonId)
}
export function removeFollowRow(state: FollowsPagesState, targetPersonId: string): FollowsPagesState {
  return removeCursorRows(state, (row) => row.targetPersonId === targetPersonId)
}
