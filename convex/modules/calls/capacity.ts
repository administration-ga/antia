// Dupliqué de socle/convex/modules/iappel/capacity.ts @ ad2e7fdc2 — adaptations : plafond d'appel CONSTANT (onze) — configuration d'organisation (`resolveGroupCallCapacity`), exemption du back-office et capacité des réunions (`resolveMeetingCapacity`, `MEETING_FLOOR`, `MEETING_DEFAULT_MAX`) retirées ; borne haute ramenée au plafond d'appel (le socle bornait à 1 000, le plafond des groupes) ; `photographedGroupCallCapacity`, qu'aucun chemin du socle ne lisait hors de ses tests, devient LA lecture du plafond d'un appel en cours.
/**
 * Capacité d'un appel de groupe — le plafond est PHOTOGRAPHIÉ sur l'appel au
 * lancement (`calls.maxParticipants`) : changer la règle ne rétrécit pas un
 * appel en cours. La valeur relue est BORNÉE : une valeur aberrante ne doit ni
 * rendre l'appel de groupe impossible (moins de trois) ni ouvrir une salle
 * au-delà du plafond.
 *
 * Module PUR.
 */
import { GROUP_CALL_DEFAULT_MAX_PARTICIPANTS, GROUP_CALL_MIN_PARTICIPANTS } from "@antia/social-contracts/groupCapacity"

/** Un appel de GROUPE réunit l'appelant et au moins deux correspondants. */
export const GROUP_CALL_FLOOR = GROUP_CALL_MIN_PARTICIPANTS

/** Le plafond d'un appel de groupe EN COURS : la ligne fait foi, bornée à [3, 11] ; une valeur absente ou illisible vaut le plafond. */
export function photographedGroupCallCapacity(stored: number | undefined): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return GROUP_CALL_DEFAULT_MAX_PARTICIPANTS
  const rounded = Math.floor(stored)
  if (rounded < GROUP_CALL_FLOOR) return GROUP_CALL_FLOOR
  if (rounded > GROUP_CALL_DEFAULT_MAX_PARTICIPANTS) return GROUP_CALL_DEFAULT_MAX_PARTICIPANTS
  return rounded
}
