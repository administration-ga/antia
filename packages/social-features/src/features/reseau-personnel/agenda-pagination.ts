/** DG-023 : quatre chaînes de curseurs natifs, sous une frontière d'agenda figée. */
import type { AgendaRow } from "./association-agenda"
import { appendCursorPage, initialCursorPages, mergedCursorRows, nextCursor, recordCursorPage, type CursorPageMount, type CursorPageSnapshot, type CursorPagesState } from "./cursor-pages"

export const AGENDA_NATIVE_PAGE_SIZE = 20
export const AGENDA_STREAMS = [
  { key: "organized:upcoming", source: "organized", period: "upcoming" },
  { key: "organized:history", source: "organized", period: "history" },
  { key: "participations:upcoming", source: "participations", period: "upcoming" },
  { key: "participations:history", source: "participations", period: "history" },
] as const
export type AgendaStream = (typeof AGENDA_STREAMS)[number]
export type AgendaStreamKey = AgendaStream["key"]

export interface AgendaPagesState {
  readonly streams: Readonly<Record<AgendaStreamKey, CursorPagesState<AgendaRow>>>
  readonly failed: boolean
}

export function initialAgendaPages(): AgendaPagesState {
  return { failed: false, streams: {
    "organized:upcoming": initialCursorPages<AgendaRow>(), "organized:history": initialCursorPages<AgendaRow>(),
    "participations:upcoming": initialCursorPages<AgendaRow>(), "participations:history": initialCursorPages<AgendaRow>(),
  } }
}

export function recordAgendaPage(state: AgendaPagesState, stream: AgendaStreamKey, mount: CursorPageMount, snapshot: CursorPageSnapshot<AgendaRow>): AgendaPagesState {
  if (state.failed) return state
  const chain = state.streams[stream]
  const index = chain.mounts.findIndex((candidate) => candidate.id === mount.id && candidate.cursor === mount.cursor)
  if (index < 0) return state
  const invalidCursor = snapshot.data !== undefined && !snapshot.data.isDone && (!snapshot.data.continueCursor || chain.mounts.slice(0, index + 1).some((candidate) => candidate.cursor === snapshot.data?.continueCursor))
  // Un refus efface les lignes et reste fermé jusqu'à une reprise explicite.
  if (snapshot.isError || invalidCursor) return { ...initialAgendaPages(), failed: true }
  const next = recordCursorPage(chain, mount, snapshot)
  return next === chain ? state : { ...state, streams: { ...state.streams, [stream]: next } }
}

export function appendAgendaPages(state: AgendaPagesState): AgendaPagesState {
  if (state.failed || agendaPageState(state).waiting) return state
  let changed = false
  const streams = { ...state.streams }
  for (const stream of AGENDA_STREAMS) {
    const current = streams[stream.key]
    const next = appendCursorPage(current)
    if (next !== current) { streams[stream.key] = next; changed = true }
  }
  return changed ? { ...state, streams } : state
}

export function agendaPageState(state: AgendaPagesState) {
  const waiting = !state.failed && AGENDA_STREAMS.some(({ key }) => state.streams[key].mounts.some((mount) => {
    const page = state.streams[key].pages[mount.id]
    return !page?.data || page.isPending
  }))
  const canLoadMore = !state.failed && AGENDA_STREAMS.some(({ key }) => nextCursor(state.streams[key]) !== null)
  const exhausted = !state.failed && !waiting && AGENDA_STREAMS.every(({ key }) => {
    const stream = state.streams[key]
    const last = stream.mounts[stream.mounts.length - 1]
    return last !== undefined && stream.pages[last.id]?.data?.isDone === true
  })
  const loadingMore = waiting && AGENDA_STREAMS.some(({ key }) => state.streams[key].mounts.length > 1)
  return { waiting, canLoadMore, exhausted, loadingMore }
}

/** L'organisateur personnel gagne sur sa copie de participation ; ordre total stable. */
export function mergedAgendaRows(state: AgendaPagesState): AgendaRow[] {
  if (state.failed || agendaPageState(state).waiting) return []
  const byEvent = new Map<string, AgendaRow>()
  for (const { key, source } of AGENDA_STREAMS) {
    for (const row of mergedCursorRows(state.streams[key], (item) => item.event.eventId)) {
      const current = byEvent.get(row.event.eventId)
      if (!current || (source === "organized" && row.kind === "personal")) byEvent.set(row.event.eventId, row)
    }
  }
  return [...byEvent.values()].sort((a, b) => a.event.startAt - b.event.startAt || a.event.eventId.localeCompare(b.event.eventId))
}
