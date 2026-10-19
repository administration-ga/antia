import type { Id } from "@antsia/api/engine"
import { describe, expect, it } from "vitest"

import { AGENDA_NATIVE_PAGE_SIZE, AGENDA_STREAMS, agendaPageState, appendAgendaPages, initialAgendaPages, mergedAgendaRows, recordAgendaPage, type AgendaPagesState, type AgendaStreamKey } from "./agenda-pagination"
import type { AgendaRow, AssociationAgendaItem } from "./association-agenda"
import type { CursorPage } from "./cursor-pages"
import type { EvenementListItem } from "./evenements-list"

const NOW = Date.UTC(2026, 9, 18, 12)
const ORGANIZED = "organized:upcoming"

function personal(id: string, startAt = NOW + 3_600_000, isOrganizer = true): AgendaRow {
  const event: EvenementListItem = {
    eventId: id as Id<"events">, title: id, description: null, location: null, startAt, endAt: startAt + 3_600_000,
    timeZone: "UTC", status: "scheduled", cancelledAt: null, isOrganizer, myParticipation: null,
    organizer: { personId: "person" as Id<"persons">, displayName: "Awa NDONG", handle: "awa", headline: null, avatarUrl: null, source: "published" },
    participantCount: 0, acceptedCount: 0, announcePostId: null, createdAt: NOW,
  }
  return { kind: "personal", event }
}

function collective(id: string): AgendaRow {
  const event: AssociationAgendaItem = {
    kind: "association", eventId: id as Id<"events">, pageId: "page" as Id<"pages">, title: id, description: null, location: null,
    startAt: NOW + 7_200_000, endAt: NOW + 10_800_000, timeZone: "UTC", status: "scheduled", cancelledAt: null,
    version: 1, organizer: { name: "Association", handle: "association" }, registration: "waitlisted",
  }
  return { kind: "association", event }
}

function ready(page: readonly AgendaRow[] = [], continueCursor = "", isDone = true): CursorPage<AgendaRow> { return { page, continueCursor, isDone } }
function recordLast(state: AgendaPagesState, stream: AgendaStreamKey, data: CursorPage<AgendaRow>): AgendaPagesState {
  const mounts = state.streams[stream].mounts
  const mount = mounts[mounts.length - 1]!
  return recordAgendaPage(state, stream, mount, { data, isPending: false, isError: false })
}
function settled(): AgendaPagesState {
  let state = initialAgendaPages()
  for (const { key } of AGENDA_STREAMS) state = recordLast(state, key, ready())
  return state
}

describe("pagination native de l'agenda", () => {
  it("dépasse 200 événements par de vraies suites de pages20, sans plafond local", () => {
    let state = settled()
    for (let page = 0; page < 12; page += 1) {
      const rows = Array.from({ length: AGENDA_NATIVE_PAGE_SIZE }, (_, offset) => personal(`event-${page * 20 + offset}`, NOW + (page * 20 + offset) * 60_000))
      state = recordLast(state, ORGANIZED, ready(rows, `native-${page + 1}`, page === 11))
      if (page < 11) state = appendAgendaPages(state)
    }
    expect(state.streams[ORGANIZED].mounts).toHaveLength(12)
    expect(mergedAgendaRows(state)).toHaveLength(240)
    expect(new Set(mergedAgendaRows(state).map((row) => row.event.eventId)).size).toBe(240)
    expect(agendaPageState(state)).toMatchObject({ waiting: false, canLoadMore: false, exhausted: true })
  })

  it("une page filtrée vide n'épuise pas son curseur ni les autres flux", () => {
    let state = recordLast(settled(), ORGANIZED, ready([], "next-visible", false))
    expect(mergedAgendaRows(state)).toEqual([])
    expect(agendaPageState(state)).toMatchObject({ waiting: false, canLoadMore: true, exhausted: false })
    state = appendAgendaPages(state)
    expect(state.streams[ORGANIZED].mounts.map((mount) => mount.cursor)).toEqual([null, "next-visible"])
    expect(state.streams["participations:history"].mounts).toHaveLength(1)
    state = recordLast(state, ORGANIZED, ready([personal("visible")]))
    expect(mergedAgendaRows(state).map((row) => row.event.eventId)).toEqual(["visible"])
    expect(agendaPageState(state).exhausted).toBe(true)
  })

  it("une frontière modifiée retire le suffixe et refuse son ancien retour", () => {
    let state = recordLast(settled(), ORGANIZED, ready([personal("upstream")], "old", false))
    state = appendAgendaPages(state)
    const staleMount = state.streams[ORGANIZED].mounts[1]!
    state = recordLast(state, ORGANIZED, ready([collective("old-private")]))
    const firstMount = state.streams[ORGANIZED].mounts[0]!
    state = recordAgendaPage(state, ORGANIZED, firstMount, { data: ready([personal("upstream")], "new", false), isPending: false, isError: false })
    expect(mergedAgendaRows(state)).toEqual([])
    expect(state.streams[ORGANIZED].mounts[1]?.cursor).toBe("new")
    const current = state
    state = recordAgendaPage(state, ORGANIZED, staleMount, { data: ready([collective("late-private")]), isPending: false, isError: false })
    expect(state).toBe(current)
    state = recordLast(state, ORGANIZED, ready([personal("replacement")]))
    expect(mergedAgendaRows(state).map((row) => row.event.eventId)).toEqual(["replacement", "upstream"])
  })

  it("déduplique globalement, préfère l'organisateur personnel et trie les égalités", () => {
    let state = recordLast(settled(), "participations:upcoming", ready([personal("same", NOW, false), personal("b", NOW)]))
    state = recordLast(state, ORGANIZED, ready([personal("same", NOW, true), personal("a", NOW)]))
    expect(mergedAgendaRows(state).map((row) => row.event.eventId)).toEqual(["a", "b", "same"])
    const winner = mergedAgendaRows(state).find((row) => row.event.eventId === "same")
    expect(winner?.kind === "personal" && winner.event.isOrganizer).toBe(true)
  })

  it("ferme toutes les lignes en relecture et verrouille tout refus jusqu'à reprise explicite", () => {
    let state = recordLast(settled(), "participations:upcoming", ready([collective("private")]))
    const mount = state.streams["participations:upcoming"].mounts[0]!
    state = recordAgendaPage(state, "participations:upcoming", mount, { data: undefined, isPending: true, isError: false })
    expect(mergedAgendaRows(state)).toEqual([])
    state = recordAgendaPage(state, "participations:upcoming", mount, { data: undefined, isPending: false, isError: true })
    expect(state.failed).toBe(true)
    expect(mergedAgendaRows(state)).toEqual([])
    const refused = state
    state = recordLast(state, "participations:upcoming", ready([collective("late-private")]))
    expect(state).toBe(refused)
    expect(appendAgendaPages(state)).toBe(refused)
    expect(mergedAgendaRows(initialAgendaPages())).toEqual([])
  })

  it("un curseur vide ou cyclique non terminal refuse la suite au lieu de boucler", () => {
    expect(recordLast(settled(), ORGANIZED, ready([], "", false)).failed).toBe(true)
    let state = appendAgendaPages(recordLast(settled(), ORGANIZED, ready([], "loop", false)))
    state = recordLast(state, ORGANIZED, ready([], "loop", false))
    expect(state.failed).toBe(true)
  })
})
