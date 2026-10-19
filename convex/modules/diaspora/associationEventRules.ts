/**
 * Règles pures des événements d'association (DG-010, DG-023), lues par le module `events/`
 * du moteur. Le moteur n'importe le domaine de DIASPORALE que dans sa tranche : les
 * `events/pageEvent*.ts` passent par ce module, sans changer leurs chemins d'API.
 * PROPRIÉTAIRE : DIASPORALE.
 */
export {
  ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS,
  ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE,
  associationEventAttendanceCode,
  associationEventAttendanceWindow,
  associationEventReminderAt,
  checkAssociationEventCapacityChange,
  isAssociationEventAttendanceOpen,
  isAssociationEventGalleryOpen,
  isAssociationEventRegistrationOpen,
  parseAssociationEventAttendanceCode,
  parseAssociationEventCapacity,
  parseAssociationEventDeadline,
  type AssociationEventReminderState,
} from "@diasporale/domain"
