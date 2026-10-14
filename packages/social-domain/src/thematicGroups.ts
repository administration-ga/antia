// Dupliqué de socle/convex/modules/reseauPersonnel/domain.ts (l. 756-805 et 896-937) @ ad2e7fdc2 — adaptations : section des groupes thématiques isolée dans son module ; `ReseauPersonnelViolation` → `DomainViolation`.
/**
 * Groupes THÉMATIQUES — bornes et autorité.
 *
 * ⚠️ À ne pas confondre avec les CONVERSATIONS de groupe (`./groupThreads.ts`) :
 * celles-là sont une messagerie fermée ; ceux-ci sont des lieux de PUBLICATION
 * à thème, découvrables dans leur réseau, ouverts à l'adhésion. Ni les uns ni
 * les autres n'appartiennent à une organisation : des personnes, dans un réseau.
 */
import { DomainViolation } from "./violation"

export const THEMATIC_GROUP_NAME_MIN_LENGTH = 3
export const THEMATIC_GROUP_NAME_MAX_LENGTH = 80
export const THEMATIC_GROUP_DESCRIPTION_MAX_LENGTH = 500

/**
 * Trois rôles, un ordre d'autorité : `owner` (créateur, unique) > `moderator`
 * > `member`. La modération — épingler, retirer une publication — appartient
 * aux DEUX premiers ; la gestion des rôles au seul `owner`.
 */
export const THEMATIC_GROUP_ROLES = ["owner", "moderator", "member"] as const
export type ThematicGroupRole = (typeof THEMATIC_GROUP_ROLES)[number]

export function assertThematicGroupName(raw: string): string {
  const name = raw.trim()
  if (name.length < THEMATIC_GROUP_NAME_MIN_LENGTH || name.length > THEMATIC_GROUP_NAME_MAX_LENGTH) {
    throw new DomainViolation("GROUP_NAME_LENGTH", { min: THEMATIC_GROUP_NAME_MIN_LENGTH, max: THEMATIC_GROUP_NAME_MAX_LENGTH })
  }
  return name
}

export function assertThematicGroupDescription(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length > THEMATIC_GROUP_DESCRIPTION_MAX_LENGTH) {
    throw new DomainViolation("GROUP_DESCRIPTION_TOO_LONG", { max: THEMATIC_GROUP_DESCRIPTION_MAX_LENGTH })
  }
  return trimmed
}

/** L'autorité de MODÉRATION d'un groupe : épingler, retirer une publication. */
export function isThematicGroupModerator(role: ThematicGroupRole): boolean {
  return role === "owner" || role === "moderator"
}

/**
 * Qui peut retirer qui : on ne se retire pas soi-même par cette voie (c'est
 * `leave`) ; l'`owner` retire n'importe qui d'autre ; un `moderator` ne retire
 * que les simples membres — jamais un pair, jamais l'`owner`.
 */
export function canRemoveThematicGroupMember(input: {
  actorRole: ThematicGroupRole
  targetRole: ThematicGroupRole
  isSelf: boolean
}): boolean {
  if (input.isSelf) return false
  if (input.actorRole === "owner") return true
  if (input.actorRole === "moderator") return input.targetRole === "member"
  return false
}

/**
 * Le seul `owner` promeut et rétrograde, et jamais un `owner` (donc jamais
 * lui-même) : le groupe garde exactement un propriétaire.
 */
export function canSetThematicGroupRole(input: { actorRole: ThematicGroupRole; targetRole: ThematicGroupRole }): boolean {
  return input.actorRole === "owner" && input.targetRole !== "owner"
}

/**
 * L'`owner` ne QUITTE pas son groupe : sans transfert de propriété, son départ
 * laisserait un groupe sans personne pour le modérer.
 */
export function canLeaveThematicGroup(role: ThematicGroupRole): boolean {
  return role !== "owner"
}
