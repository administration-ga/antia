// Dupliqué de socle/convex/modules/iappel/validators.ts @ ad2e7fdc2 — adaptations : validateurs PRÉCIS dérivés des listes du domaine (`@antsia/social-domain/callJournal`, une seule source pour les littéraux) ; portées (`dndScope`, `callScope`), environnement, politique et autorité de poste, horaires et priorité retirés ; raison d'admission sans `outside_hours` ni `secretariat_unavailable` ; « ne pas déranger » et silence de réunion sans portée ; bornes de saisie déplacées dans le contrat `@antsia/social-contracts/calls` (l'écran les lit aussi).
import { RELATION_PRESENCE_STATUSES } from "@antsia/social-contracts/calls"
import {
  CALL_ADMISSION_REASONS,
  CALL_END_REASONS,
  CALL_KINDS,
  CALL_LIFECYCLE_STATUSES,
  CALL_MEDIA_TYPES,
  CALL_STATUSES,
  GROUP_CALL_INVITE_STATUSES,
} from "@antsia/social-domain/callJournal"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const callKindValidator = literals(CALL_KINDS)
export const callMediaTypeValidator = literals(CALL_MEDIA_TYPES)
export const callLifecycleStatusValidator = literals(CALL_LIFECYCLE_STATUSES)
export const callStatusValidator = literals(CALL_STATUSES)
export const callAdmissionReasonValidator = literals(CALL_ADMISSION_REASONS)
export const callEndReasonValidator = literals(CALL_END_REASONS)
export const groupCallInviteStatusValidator = literals(GROUP_CALL_INVITE_STATUSES)
export const relationPresenceStatusValidator = literals(RELATION_PRESENCE_STATUSES)

/** Qui a composé (`host`) et qui a été appelé (`participant`). */
export const callParticipantRoleValidator = v.union(v.literal("host"), v.literal("participant"))

/**
 * Appels de personnes HORS de mes relations. Absent = `ring` : le téléphone
 * sonne (« un membre appelle un membre », EXF-AN-23). `silent` refuse l'appel
 * comme une valeur, le journalise, et le DIT à l'appelant — personne n'est
 * bloqué en silence.
 */
export const outsideRelationsCallsValidator = v.union(v.literal("ring"), v.literal("silent"))

export const ringtonePrefsValidator = v.object({ muted: v.optional(v.boolean()), vibrate: v.optional(v.boolean()) })

/** « Ne pas déranger » : fin du silence en millisecondes UTC. Un `until` passé est ignoré, jamais nettoyé. */
export const dndStateValidator = v.object({ until: v.number(), startedAt: v.number() })

/**
 * Silence AUTOMATIQUE pendant un évènement accepté de l'agenda du réseau.
 * Opt-in : personne ne doit découvrir que ses appels ont été refusés parce
 * qu'un évènement traînait dans son agenda.
 */
export const autoMeetingDndValidator = v.object({ enabled: v.boolean() })

/** La présence d'un écran : en ligne (battement frais), ou parti. */
export const presenceStatusValidator = v.union(v.literal("online"), v.literal("offline"))
