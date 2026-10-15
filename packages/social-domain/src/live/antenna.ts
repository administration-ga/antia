// Dupliqué de socle/convex/modules/direct/antenna.ts (constantes pures, l. 43-49 et 70-79, avec les vocabulaires de l'antenne de socle/convex/modules/direct/validators.ts, l. 199-204 et 228-255) @ ad2e7fdc2 — adaptations : seules les CONSTANTES pures de l'antenne sortent du backend vers le domaine (l'écran les lit sans importer `convex/`) — la borne de la console (`ANTENNA_STATE_SCAN`), les réponses de l'hôte à une main levée, les statuts d'une main levée et l'état d'une personne vis-à-vis d'une invitation, posés en listes `as const`, source unique des validateurs du backend (`AntennaInviteState` en dérive au lieu d'être inféré du validateur) ; les gestes, gardes et DTO de l'antenne (`HostAntennaState`, `MyAntennaState`, `AntennaInviteCandidate`) restent dans `convex/modules/live/antenna.ts`.
/**
 * L'ANTENNE participative d'un direct — son VOCABULAIRE, sans I/O.
 *
 * Deux faits durables, deux tables (`liveAntennaRequests`,
 * `liveAntennaInvitations`) : la DEMANDE appartient au spectateur déjà admis
 * dans la salle ; l'INVITATION appartient à une personne que l'hôte adresse.
 * Les statuts d'une invitation vivent avec leur expiration dérivée
 * (`domain.ts`, `DIRECT_ANTENNA_INVITATION_STATUSES`).
 */

/** Une file interactive reste petite ; au-delà, l'hôte traite les plus récents. */
export const ANTENNA_STATE_SCAN = 40

/** Ce que l'hôte (ou un délégué portant `admitToStage`) RÉPOND à une main levée. */
export const DIRECT_ANTENNA_RESPONSES = ["accepted", "declined"] as const
export type DirectAntennaResponse = (typeof DIRECT_ANTENNA_RESPONSES)[number]

/** Statut d'une MAIN LEVÉE — une ligne durable par spectateur et direct. */
export const DIRECT_ANTENNA_REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const
export type DirectAntennaRequestStatus = (typeof DIRECT_ANTENNA_REQUEST_STATUSES)[number]

/**
 * L'état d'une personne VIS-À-VIS d'une invitation à l'antenne — ce que la
 * console de l'hôte affiche par ligne (D-10).
 *
 * Deux familles dans une seule liste, et c'est voulu : l'ÉLIGIBILITÉ (jugée
 * par `assertInvitableTarget`) et l'INTENTION déjà exprimée (invitation en
 * cours, main levée). L'écran n'a qu'un état à rendre par personne, il ne doit
 * pas les recomposer lui-même.
 *
 * ⚠️ `outside_audience`, `not_connected` et `blocked` sont trois refus
 * SENSIBLES : le client les regroupe sous un libellé unique — les distinguer à
 * l'écran apprendrait à l'hôte quelque chose sur le lien entre deux personnes.
 */
export const DIRECT_ANTENNA_INVITE_STATES = [
  "eligible",
  "self",
  "outside_audience",
  "not_connected",
  "blocked",
  "banned",
  "on_stage",
  "no_profile",
  "invited_pending",
  "invited_accepted",
  "invited_declined",
  "hand_raised",
] as const
export type AntennaInviteState = (typeof DIRECT_ANTENNA_INVITE_STATES)[number]
