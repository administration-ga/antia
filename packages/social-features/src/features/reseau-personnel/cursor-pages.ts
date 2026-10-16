// Adaptation interne de packages/social-features/src/features/reseau-personnel/follows-pagination.ts @ d2a782b — adaptations : état générique des pages natives, identité des lignes fournie par chaque collection ; mêmes protections contre les réponses périmées et les changements de frontière.
export interface CursorPage<Row> {
  readonly page: readonly Row[]
  readonly isDone: boolean
  readonly continueCursor: string
}

export interface CursorPageMount {
  readonly id: number
  readonly cursor: string | null
}

export interface CursorPageSnapshot<Row> {
  readonly data: CursorPage<Row> | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

export interface CursorPagesState<Row> {
  readonly mounts: readonly CursorPageMount[]
  readonly pages: Readonly<Record<number, CursorPageSnapshot<Row>>>
  readonly nextId: number
}

export function initialCursorPages<Row>(): CursorPagesState<Row> {
  return { mounts: [{ id: 0, cursor: null }], pages: {}, nextId: 1 }
}

/** L'identité de montage protège même un curseur abandonné puis réutilisé. */
export function recordCursorPage<Row>(state: CursorPagesState<Row>, mount: CursorPageMount, incoming: CursorPageSnapshot<Row>): CursorPagesState<Row> {
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
    const retained: Record<number, CursorPageSnapshot<Row>> = {}
    for (const candidate of mounts) {
      const page = pages[candidate.id]
      if (page !== undefined) retained[candidate.id] = page
    }
    return { mounts, pages: retained, nextId }
  }
  return { ...state, pages }
}

/** Une page filtrée vide peut encore annoncer une suite native. */
export function nextCursor<Row>(state: CursorPagesState<Row>): string | null {
  const last = state.mounts[state.mounts.length - 1]
  if (!last) return null
  const page = state.pages[last.id]
  if (!page?.data || page.isError || page.isPending || page.data.isDone || state.mounts.some((mount) => mount.cursor === page.data?.continueCursor)) return null
  return page.data.continueCursor
}

export function appendCursorPage<Row>(state: CursorPagesState<Row>): CursorPagesState<Row> {
  if (state.mounts.some((mount) => state.pages[mount.id]?.isError)) return state
  const cursor = nextCursor(state)
  return cursor === null ? state : {
    ...state,
    mounts: [...state.mounts, { id: state.nextId, cursor }],
    nextId: state.nextId + 1,
  }
}

/** La page amont gagne sur une copie aval de la même ligne. */
export function mergedCursorRows<Row>(state: CursorPagesState<Row>, keyOf: (row: Row) => string): Row[] {
  const rows = new Map<string, Row>()
  for (const mount of state.mounts) {
    for (const row of state.pages[mount.id]?.data?.page ?? []) {
      const key = keyOf(row)
      if (!rows.has(key)) rows.set(key, row)
    }
  }
  return [...rows.values()]
}

/** Appelé après une mutation réussie, jamais avant sa réponse. */
export function removeCursorRows<Row>(state: CursorPagesState<Row>, matches: (row: Row) => boolean): CursorPagesState<Row> {
  return {
    ...state,
    pages: Object.fromEntries(Object.entries(state.pages).map(([id, snapshot]) => [id, {
      ...snapshot,
      data: snapshot.data === undefined ? undefined : {
        ...snapshot.data,
        page: snapshot.data.page.filter((row) => !matches(row)),
      },
    }])),
  }
}
