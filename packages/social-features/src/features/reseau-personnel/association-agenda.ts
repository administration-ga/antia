/** DG-023 : réunir les dates sans confondre une file d'attente et une invitation. */
import type { api } from "@antsia/api/engine"
import { civilDayKey } from "@antsia/api/civil-date"
import type { FunctionReturnType } from "convex/server"

import { groupEvents, isPastEvent, type EventSectionKey, type EvenementListItem } from "./evenements-list"

export type AssociationAgendaItem = NonNullable<FunctionReturnType<typeof api.modules.events.events.myAgenda>["associationItems"]>[number]
export type AgendaRow = { readonly kind: "personal"; readonly event: EvenementListItem } | { readonly kind: "association"; readonly event: AssociationAgendaItem }

export function groupAgendaEvents(personal: readonly EvenementListItem[], collective: readonly AssociationAgendaItem[], now: number, timeZone: string): Record<EventSectionKey, AgendaRow[]> {
  const grouped = groupEvents(personal, now, timeZone)
  const result: Record<EventSectionKey, AgendaRow[]> = {
    upcoming: grouped.upcoming.map((event) => ({ kind: "personal", event })),
    today: grouped.today.map((event) => ({ kind: "personal", event })),
    pendingInvitations: grouped.pendingInvitations.map((event) => ({ kind: "personal", event })),
    past: grouped.past.map((event) => ({ kind: "personal", event })),
  }
  const seen = new Set(personal.map((event) => event.eventId))
  const today = civilDayKey(now, timeZone)
  for (const event of collective) {
    if (seen.has(event.eventId)) continue
    seen.add(event.eventId)
    const section = isPastEvent(event, now, timeZone) ? "past" : civilDayKey(event.startAt, timeZone) === today ? "today" : "upcoming"
    result[section].push({ kind: "association", event })
  }
  for (const rows of Object.values(result)) rows.sort((a, b) => a.event.startAt - b.event.startAt || a.event.eventId.localeCompare(b.event.eventId))
  return result
}

export function agendaRowsForRail(personal: readonly EvenementListItem[], collective: readonly AssociationAgendaItem[], now: number, timeZone: string, limit = 3): AgendaRow[] {
  if (limit <= 0) return []
  const grouped = groupAgendaEvents(personal, collective, now, timeZone)
  return [...grouped.pendingInvitations, ...grouped.today, ...grouped.upcoming].filter(({ event }) => event.status !== "cancelled").slice(0, limit)
}
