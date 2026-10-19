import type { AlbumListPage, AlbumSummary } from "./albums-api"

export type AlbumsCursor = string | null

export interface AlbumPageSnapshot {
  readonly data: AlbumListPage | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

export interface AlbumsPagesState {
  readonly cursors: readonly AlbumsCursor[]
  readonly pages: Readonly<Record<string, AlbumPageSnapshot>>
}

export const albumCursorKey = (cursor: AlbumsCursor) => cursor === null ? "start" : `cursor:${cursor}`

export function initialAlbumsPages(): AlbumsPagesState {
  return { cursors: [null], pages: {} }
}

/** Une réponse périmée ne peut remonter une page abandonnée. */
export function recordAlbumPage(state: AlbumsPagesState, cursor: AlbumsCursor, incoming: AlbumPageSnapshot): AlbumsPagesState {
  const index = state.cursors.indexOf(cursor)
  if (index < 0) return state
  const key = albumCursorKey(cursor)
  const previous = state.pages[key]
  const snapshot = { ...incoming, data: incoming.data ?? previous?.data }
  if (previous?.data === snapshot.data && previous?.isPending === snapshot.isPending && previous?.isError === snapshot.isError) return state

  const pages = { ...state.pages, [key]: snapshot }
  const nextMounted = state.cursors[index + 1]
  // Toute page reste abonnée. Si sa frontière bouge, ses descendants ne
  // décrivent plus la même liste : seule la nouvelle frontière est remontée.
  if (incoming.data !== undefined && nextMounted !== undefined && (incoming.data.isDone || incoming.data.continueCursor !== nextMounted)) {
    const cursors = state.cursors.slice(0, index + 1)
    if (!incoming.data.isDone && !cursors.includes(incoming.data.continueCursor)) cursors.push(incoming.data.continueCursor)
    const retained: Record<string, AlbumPageSnapshot> = {}
    for (const mounted of cursors) {
      const mountedKey = albumCursorKey(mounted)
      const page = pages[mountedKey]
      if (page !== undefined) retained[mountedKey] = page
    }
    return { cursors, pages: retained }
  }
  return { cursors: state.cursors, pages }
}

export function nextAlbumsCursor(state: AlbumsPagesState): string | null {
  const current = state.cursors[state.cursors.length - 1] ?? null
  const page = state.pages[albumCursorKey(current)]
  if (!page?.data || page.isError || page.isPending || page.data.isDone || state.cursors.includes(page.data.continueCursor)) return null
  return page.data.continueCursor
}

export function appendAlbumPage(state: AlbumsPagesState): AlbumsPagesState {
  const next = nextAlbumsCursor(state)
  return next === null ? state : { ...state, cursors: [...state.cursors, next] }
}

/** Une version plus récente de la page amont gagne sur un doublon aval. */
export function mergedAlbumRows(state: AlbumsPagesState): AlbumSummary[] {
  const rows = new Map<string, AlbumSummary>()
  for (const cursor of state.cursors) {
    for (const album of state.pages[albumCursorKey(cursor)]?.data?.page ?? []) {
      if (!rows.has(album.albumId)) rows.set(album.albumId, album)
    }
  }
  return [...rows.values()]
}
