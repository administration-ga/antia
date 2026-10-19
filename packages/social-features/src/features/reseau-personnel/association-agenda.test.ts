import type { Id } from "@antsia/api/engine"
import { describe, expect, it } from "vitest"

import { agendaRowsForRail, groupAgendaEvents, type AssociationAgendaItem } from "./association-agenda"
import type { EvenementListItem } from "./evenements-list"

const NOW = Date.UTC(2026, 9, 25, 22, 30)
const collective: AssociationAgendaItem = {
  kind: "association", eventId: "collective" as Id<"events">, pageId: "page" as Id<"pages">,
  title: "Rencontre", description: null, location: null, startAt: NOW + 3_600_000, endAt: NOW + 7_200_000,
  timeZone: "Europe/Paris", status: "scheduled", cancelledAt: null, version: 1,
  organizer: { name: "Association de recette", handle: "association-recette" }, registration: "waitlisted",
}
const personal: EvenementListItem = {
  eventId: "personal" as Id<"events">, title: "Invitation personnelle", description: null, location: null,
  startAt: NOW + 1_800_000, endAt: NOW + 3_600_000, timeZone: "UTC", status: "scheduled", cancelledAt: null,
  isOrganizer: false, myParticipation: { participationId: "participation" as Id<"eventParticipants">, status: "pending" },
  organizer: { personId: "person" as Id<"persons">, displayName: "Awa NDONG", handle: "awa", headline: null, avatarUrl: null, source: "published" },
  participantCount: 1, acceptedCount: 0, announcePostId: null, createdAt: NOW,
}

describe("agenda personnel et inscriptions associatives réunis", () => {
  it("garde l'attente associative dans le temps, distincte des invitations à accepter", () => {
    const result = groupAgendaEvents([personal], [collective], NOW, "Europe/Paris")
    expect(result.pendingInvitations.map((row) => row.event.eventId)).toEqual([personal.eventId])
    expect(result.upcoming.map((row) => row.event.eventId)).toEqual([collective.eventId])
    expect(result.today).toEqual([])
    expect(result.upcoming[0]?.kind).toBe("association")
  })

  it("classe le même instant selon le jour du lecteur, sans doublon ni faux organisateur", () => {
    const paris = groupAgendaEvents([], [collective, collective], NOW, "Europe/Paris")
    const tokyo = groupAgendaEvents([], [collective], NOW, "Asia/Tokyo")
    expect(paris.upcoming).toHaveLength(1)
    expect(tokyo.today).toHaveLength(1)
    const row = tokyo.today[0]
    expect(row?.event.organizer).not.toHaveProperty("personId")
  })

  it("conserve l'annulation en historique et l'écarte du rail des prochaines dates", () => {
    // Un AUTRE événement, annulé : le dédoublonnage par identifiant ne doit pas le confondre avec la date programmée.
    const cancelled = { ...collective, eventId: "collective-annulee" as Id<"events">, status: "cancelled" as const, cancelledAt: NOW, startAt: NOW - 3 * 86_400_000, endAt: NOW - 2 * 86_400_000 }
    expect(groupAgendaEvents([], [cancelled], NOW, "UTC").past[0]?.event.status).toBe("cancelled")
    expect(agendaRowsForRail([personal], [cancelled, collective], NOW, "UTC").map((row) => row.event.eventId)).toEqual([personal.eventId, collective.eventId])
    expect(agendaRowsForRail([personal], [collective], NOW, "UTC", 1)).toHaveLength(1)
    expect(agendaRowsForRail([personal], [collective], NOW, "UTC", 0)).toEqual([])
  })
})
