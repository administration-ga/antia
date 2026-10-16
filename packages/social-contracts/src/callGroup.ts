// Dupliqué de socle/convex/modules/iappel/group.ts @ ad2e7fdc2 — adaptations : module pur des CONTRATS et non du domaine (il lit le plafond d'appel de `groupCapacity`, qui y vit, et le domaine pur ne dépend d'aucun paquet) ; personnes (`personId`) ; plafond CONSTANT de onze (exemption du back-office retirée) ; borne de balayage des tickets ramenée de 1 000 à 32 (au plus une ligne par personne conviée : onze places, chacune réattribuable après un refus — IC-04 — sans redevenir la borne du back-office) ; titre composé → ses PARTIES (`groupCallTitleParts`), la phrase vit dans les locales de l'écran.
/**
 * L'APPEL DE GROUPE : plusieurs interlocuteurs, UN appel.
 *
 * Un appel de groupe n'est pas une réunion : il sonne, il se décroche, il se
 * raccroche, et il obéit aux réglages d'appel de CHACUN. Le nombre
 * d'interlocuteurs ne change rien à cela — mais trois règles du tête-à-tête
 * cessent d'être vraies, et les garder telles quelles casse le groupe :
 *
 *  1. **un refus n'est plus la fin de l'appel** : le refus d'un invité (ou son
 *     « ne pas déranger ») ne concerne QUE lui, les autres continuent de sonner ;
 *  2. **quitter n'est plus raccrocher pour tout le monde** : l'appel ne meurt
 *     que lorsqu'il ne reste plus personne en ligne ;
 *  3. **« décrocher » n'est plus l'affaire d'une seule personne** : chaque
 *     invité entre quand il veut, y compris après les autres.
 *
 * Module PUR : le serveur rassemble les faits, ce module tranche — et l'écran
 * l'importe pour compter les places exactement comme le serveur.
 */
import type { CallAdmissionReason, GroupCallInviteStatus } from "@antsia/social-domain/callJournal"

import { GROUP_CALL_DEFAULT_MAX_PARTICIPANTS, GROUP_CALL_MIN_PARTICIPANTS } from "./groupCapacity"

/**
 * Le plafond d'un APPEL de groupe — ONZE, appelant compris. Au-delà, on ne
 * téléphone plus : on se réunit (un direct, une conversation de groupe).
 */
export const GROUP_CALL_MAX_PARTICIPANTS = GROUP_CALL_DEFAULT_MAX_PARTICIPANTS

/**
 * Le minimum d'AUTRES personnes pour que ce soit un appel de groupe. À une
 * seule, c'est un tête-à-tête : la machinerie de groupe le priverait du refus
 * qui termine l'appel, de la messagerie vocale, de l'écran d'admission.
 */
export const GROUP_CALL_MIN_OTHERS = GROUP_CALL_MIN_PARTICIPANTS - 1

/**
 * La borne de BALAYAGE des personnes conviées d'un appel — distincte du plafond.
 *
 * ⚠️ Un appel porte PLUS de lignes que de places (IC-04) : un refus, un manqué
 * ou un « ne pas déranger » libèrent la place SANS retirer la ligne, et la
 * personne suivante en ajoute une. Une borne égale au plafond fermerait la
 * porte au remplaçant ; l'ajout refuse au-delà de celle-ci, si bien que la
 * lecture des lignes reste exhaustive par construction (une par personne).
 */
export const GROUP_CALL_INVITES_SCAN = 32

/** L'état d'un invité, tel que le ticket le porte. */
export interface GroupInviteView {
  personId: string
  status: GroupCallInviteStatus
  /** Renseigné quand le refus est AUTOMATIQUE (ses réglages), absent quand il est humain. */
  reason?: CallAdmissionReason | null
}

/** La présence, telle que la ligne de participation la porte. */
export interface GroupPresenceView {
  personId: string
  joinedAt?: number | null
  leftAt?: number | null
}

/**
 * L'état d'un participant TEL QUE L'ÉCRAN DOIT LE DIRE — le ticket (a-t-il
 * répondu ?) et la présence (est-il encore là ?) fusionnés, parce qu'aucun ne
 * suffit seul : un invité `joined` qui a raccroché est `left`.
 */
export type GroupParticipantState = "host" | "ringing" | "connected" | "left" | "declined" | "unavailable" | "missed"

export interface GroupParticipantView {
  personId: string
  state: GroupParticipantState
  /** Pourquoi il est `unavailable` — jamais autre chose qu'une raison connue. */
  reason: CallAdmissionReason | null
}

/**
 * L'état d'un invité, pour l'écran.
 *
 * ⚠️ L'ordre des tests est le fond du sujet. La PRÉSENCE prime sur le ticket :
 * quelqu'un qui a décroché puis raccroché est parti. À l'inverse, un ticket
 * `declined` prime sur une absence de présence — sans quoi un refus explicite
 * se lirait « n'a pas répondu ».
 */
export function participantStateOf(input: { isHost: boolean; invite: GroupInviteView | null; presence: GroupPresenceView | null }): GroupParticipantView {
  const personId = input.invite?.personId ?? input.presence?.personId ?? ""
  const reason = input.invite?.reason ?? null

  if (input.isHost) {
    // L'hôte qui a quitté n'est plus l'hôte à l'écran : il est parti.
    const gone = input.presence !== null && input.presence.leftAt !== undefined && input.presence.leftAt !== null
    return { personId, state: gone ? "left" : "host", reason: null }
  }

  const presence = input.presence
  const isPresent =
    presence !== null && presence.joinedAt !== undefined && presence.joinedAt !== null && (presence.leftAt === undefined || presence.leftAt === null)
  if (isPresent) return { personId, state: "connected", reason: null }

  const invite = input.invite
  // Aucun ticket : une ligne de participation sans invitation — le destinataire
  // d'un tête-à-tête qui sonne encore, avant toute promotion en groupe.
  if (invite === null) return { personId, state: "ringing", reason: null }

  switch (invite.status) {
    case "declined":
      // Un refus AUTOMATIQUE n'est pas un rejet : personne n'a vu l'appel. Les
      // confondre ferait lire « a refusé » là où le téléphone était en silence.
      return { personId, state: reason === null ? "declined" : "unavailable", reason }
    case "missed":
      return { personId, state: "missed", reason: null }
    case "joined":
      // Ticket `joined` sans présence vivante : il a décroché puis quitté.
      return { personId, state: "left", reason: null }
    case "ringing":
      return { personId, state: "ringing", reason: null }
  }
}

/** Décompte d'un appel de groupe — ce que l'en-tête de l'écran annonce. */
export interface GroupCallSummary {
  /** Personnes actuellement dans la salle (hôte compris). */
  connected: number
  /** Invités dont le téléphone sonne encore. */
  ringing: number
  /** Invités écartés : refus humain, réglages, ou sans réponse. */
  unreachable: number
  /** Total des personnes conviées, hôte compris. */
  invited: number
}

export function summarizeGroupCall(participants: readonly GroupParticipantView[]): GroupCallSummary {
  let connected = 0
  let ringing = 0
  let unreachable = 0
  for (const participant of participants) {
    switch (participant.state) {
      case "host":
      case "connected":
        connected += 1
        break
      case "ringing":
        ringing += 1
        break
      case "declined":
      case "unavailable":
      case "missed":
      case "left":
        unreachable += 1
        break
    }
  }
  return { connected, ringing, unreachable, invited: participants.length }
}

/**
 * Cet état OCCUPE-T-IL une place sur le plafond ? La règle UNIQUE de capacité
 * (IC-04), lue sur l'état projeté, jamais sur la présence seule : `host`,
 * `connected` et `ringing` réservent (on ne libère JAMAIS une place qui sonne
 * encore — deux personnes décrocheraient sur la même chaise) ; les états
 * terminaux la rendent, la ligne reste dans la grille.
 */
export function reservesSeat(state: GroupParticipantState): boolean {
  return state === "host" || state === "connected" || state === "ringing"
}

/** Les places RÉSERVÉES d'un appel — le chiffre que le plafond compare. */
export function countReservedSeats(participants: readonly GroupParticipantView[]): number {
  let reserved = 0
  for (const participant of participants) if (reservesSeat(participant.state)) reserved += 1
  return reserved
}

/**
 * L'APPEL DE GROUPE DOIT-IL SE TERMINER ? Il vit tant que quelqu'un est EN
 * LIGNE, fût-il seul. Une sonnerie en cours ne suffit PAS à le maintenir : si
 * plus personne n'est dans la salle, celui qui décrocherait entrerait dans le
 * vide — les téléphones qui sonnaient encore sont alors des appels MANQUÉS.
 */
export function groupCallShouldEnd(participants: readonly GroupParticipantView[]): boolean {
  return summarizeGroupCall(participants).connected === 0
}

/**
 * Les PARTIES du titre d'un appel ad hoc : au plus `max` noms (trois par
 * défaut — au-delà, le titre déborde de la pilule, du push et du journal),
 * puis le nombre de ceux qu'on tait. L'écran compose la phrase (« Appel de
 * groupe — A, B, C +2 ») dans sa langue.
 */
export function groupCallTitleParts(names: readonly string[], options?: { max?: number }): { shown: string[]; more: number } {
  const max = options?.max ?? 3
  const clean = names.map((name) => name.trim()).filter((name) => name.length > 0)
  return { shown: clean.slice(0, max), more: Math.max(0, clean.length - max) }
}

/**
 * Les invités RETENUS d'un appel ad hoc — dédoublonnés, sans l'appelant, dans
 * l'ordre d'arrivée. S'inviter soi-même ferait sonner chez soi pendant qu'on
 * parle ; un doublon compterait deux places pour une personne.
 */
export function normalizeGroupInvitees(personIds: readonly string[], callerId: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of personIds) {
    const id = String(raw)
    if (id === String(callerId) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
