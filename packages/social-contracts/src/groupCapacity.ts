// Dupliqué de socle/convex/lib/groupCapacity.ts @ ad2e7fdc2 — adaptations : plafond de STRUCTURE d'un fil ramené à 256 (le socle : 1 000, arbitré pour l'administration ; un réseau social porte ses audiences par les groupes thématiques et les pages — owner map §6.11, « à reconsidérer à la baisse ») ; plafond d'appel CONSTANT de onze (exemption du back-office `resolveGroupCallCapacity` et réglage d'organisation retirés : ni l'un ni l'autre n'existe dans le moteur) ; bornes du titre, de la description et de la composition d'un fil (dupliquées de `modules/reseauPersonnel/groupes.ts`, l. 124-133) jugées ici par des règles du domaine.
/**
 * LA CAPACITÉ D'UN GROUPE ET D'UN APPEL DE GROUPE — décidée en un seul endroit.
 *
 * Deux plafonds DISTINCTS : ce qu'un fil peut porter (la STRUCTURE, qui borne
 * aussi les lectures : au-delà, on ne rendrait plus la liste des membres ni ne
 * ferait sonner tout le monde) et ce qu'un appel réunit (la POLITIQUE : au-delà
 * de onze, on ne téléphone plus, on se réunit).
 *
 * Module PUR : l'écran l'importe pour composer exactement ce que le serveur
 * acceptera — un écran qui laisse composer ce qu'il refusera fait perdre le
 * geste entier.
 */
import { DomainViolation } from "@antia/social-domain/violation"

/**
 * Le plafond de STRUCTURE d'un fil de groupe, créateur compris. Il borne aussi
 * les lectures du module (membres vivants, invitations en attente, saisie) et
 * la diffusion d'un message : le relever, c'est relever le coût de chaque envoi.
 */
export const GROUP_MEMBERS_MAX = 256

/**
 * En deçà de deux AUTRES personnes, la conversation est un 1:1 : elle a déjà sa
 * surface, et un « groupe de deux » donnerait deux fils pour la même paire.
 */
export const GROUP_MIN_OTHERS = 2

export const GROUP_TITLE_MAX_LENGTH = 120

export const GROUP_DESCRIPTION_MAX_LENGTH = 500

/** Le plafond d'un appel de groupe, appelant compris. */
export const GROUP_CALL_DEFAULT_MAX_PARTICIPANTS = 11

/** Combien de CORRESPONDANTS un appel de groupe fait sonner d'un coup : dix. */
export const GROUP_CALL_MAX_OTHERS = GROUP_CALL_DEFAULT_MAX_PARTICIPANTS - 1

/** Un appel de groupe réunit l'appelant et au moins deux correspondants. */
export const GROUP_CALL_MIN_PARTICIPANTS = 3

/**
 * Le plafond effectif d'un appel DÉJÀ POSÉ : une propriété de l'appel, figée
 * par son hôte au lancement — jamais celle de qui veut y ajouter quelqu'un.
 */
export function callCapacityOf(meeting: { maxParticipants?: number | null } | null | undefined): number {
  const declared = meeting?.maxParticipants
  if (typeof declared === "number" && declared > 0) return declared
  return GROUP_CALL_DEFAULT_MAX_PARTICIPANTS
}

/** Le titre d'un fil, nettoyé : entre 1 et 120 caractères, jamais blanc. */
export function assertGroupTitle(raw: string): string {
  const title = raw.trim()
  if (title.length === 0 || title.length > GROUP_TITLE_MAX_LENGTH) throw new DomainViolation("GROUP_NAME_LENGTH", { min: 1, max: GROUP_TITLE_MAX_LENGTH })
  return title
}

/** La description d'un fil : `null` pour la retirer (une chaîne blanche aussi), bornée sinon. */
export function normalizeGroupDescription(raw: string | null): string | null {
  const description = raw?.trim() ?? ""
  if (description.length === 0) return null
  if (description.length > GROUP_DESCRIPTION_MAX_LENGTH) throw new DomainViolation("GROUP_DESCRIPTION_TOO_LONG", { max: GROUP_DESCRIPTION_MAX_LENGTH })
  return description
}

/** La composition d'un fil à sa création : au moins deux AUTRES personnes, au plus le plafond (créateur compris). */
export function assertGroupComposition(othersCount: number): void {
  if (othersCount < GROUP_MIN_OTHERS) throw new DomainViolation("GROUP_TOO_FEW_MEMBERS", { min: GROUP_MIN_OTHERS + 1 })
  if (othersCount + 1 > GROUP_MEMBERS_MAX) throw new DomainViolation("GROUP_FULL", { max: GROUP_MEMBERS_MAX })
}

/** Une place reste-t-elle pour une personne de plus ? */
export function assertGroupHasRoom(memberCount: number): void {
  if (memberCount >= GROUP_MEMBERS_MAX) throw new DomainViolation("GROUP_FULL", { max: GROUP_MEMBERS_MAX })
}
