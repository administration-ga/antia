// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 1031-1097 : `reseauPersonnel_events`, `…EventParticipants`) @ ad2e7fdc2 — adaptations : `networkId` sur l'évènement et la participation ; personnes ; `participantCount` et `acceptedCount` retirés du document (agrégat `engineCounters`, D02) ; `eventStartAt` OBLIGATOIRE (le chemin hérité est supprimé) ; agenda indexé par réseau (`[networkId, organisateur, startAt]`, `[networkId, personne, eventStartAt]`) ; `by_user_and_status` non recopié (jamais lu).
/**
 * Évènements PERSONNELS d'un réseau — l'agenda d'une personne, jamais d'une
 * organisation. L'invitation et la réponse sont LA MÊME ligne de participation.
 */
import { PERSONAL_EVENT_PARTICIPATION_STATUSES, PERSONAL_EVENT_STATUSES } from "@antia/social-domain/events"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const eventStatusValidator = literals(PERSONAL_EVENT_STATUSES)
export const eventParticipationStatusValidator = literals(PERSONAL_EVENT_PARTICIPATION_STATUSES)

export const eventsTables = {
  events: defineTable({
    networkId: v.id("networks"),
    organizerPersonId: v.id("persons"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.number(),
    /** Le fuseau FIXÉ à la création — celui dans lequel l'évènement a été pensé. */
    timeZone: v.string(),
    status: eventStatusValidator,
    cancelledAt: v.optional(v.number()),
    /** La publication qui l'annonce : UNE seule (c'est l'idempotence de l'annonce). */
    announcePostId: v.optional(v.id("posts")),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizer_idempotency", ["organizerPersonId", "idempotencyKey"])
    .index("by_network_organizer_startAt", ["networkId", "organizerPersonId", "startAt"]),

  /** L'invitation ET la réponse : une ligne par (évènement, personne), `pending` est l'invitation. */
  eventParticipants: defineTable({
    networkId: v.id("networks"),
    eventId: v.id("events"),
    personId: v.id("persons"),
    invitedByPersonId: v.id("persons"),
    status: eventParticipationStatusValidator,
    /** Le début de l'évènement, recopié : l'agenda filtre DANS l'index, avant la limite. */
    eventStartAt: v.number(),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_event_person", ["eventId", "personId"])
    .index("by_event_status", ["eventId", "status"])
    .index("by_network_person_eventStartAt", ["networkId", "personId", "eventStartAt"]),
}
