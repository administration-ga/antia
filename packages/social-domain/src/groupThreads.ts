// Dupliqué de socle/convex/modules/reseauPersonnel/domain.ts (l. 1461-1633) @ ad2e7fdc2 — adaptations : section des fils de groupe isolée dans son module ; scope « poste »/« personnel » retiré (`GroupThreadScope`, `GROUP_SCOPE_*`, `groupThreadScopeOf`, `groupThreadMatchesScope`) : dans le moteur, tout fil est personnel et appartient à un réseau.
/**
 * Administration d'un fil de GROUPE : UN propriétaire, PLUSIEURS
 * administrateurs, des membres qui n'ont d'autorité que sur eux-mêmes.
 * L'admissibilité d'un invité (une relation acceptée avec l'invitant, dans le
 * même réseau) vit dans la mutation, qui seule a la base.
 */

/** Le rôle d'un membre dans un fil de groupe. */
export type GroupThreadRole = "owner" | "admin" | "member"

/** Peut administrer le fil : inviter, retirer, renommer. */
export function isGroupThreadManager(role: GroupThreadRole): boolean {
  return role === "owner" || role === "admin"
}

/** Renommer le fil. */
export function canRenameGroupThread(role: GroupThreadRole): boolean {
  return isGroupThreadManager(role)
}

/**
 * Inviter quelqu'un. ⚠️ Ce prédicat ne dit QUE l'autorité ; l'admissibilité de
 * l'invité est vérifiée par la mutation.
 */
export function canInviteToGroupThread(role: GroupThreadRole): boolean {
  return isGroupThreadManager(role)
}

/**
 * Retirer QUELQU'UN D'AUTRE. Trois refus : soi-même (c'est « quitter ») ; le
 * propriétaire (personne ne le dépossède) ; un pair administrateur (deux
 * administrateurs qui se retirent l'un l'autre donnent le groupe au plus rapide).
 */
export function canRemoveGroupThreadMember(input: { actorRole: GroupThreadRole; targetRole: GroupThreadRole; isSelf: boolean }): boolean {
  if (input.isSelf) return false
  if (!isGroupThreadManager(input.actorRole)) return false
  if (input.targetRole === "owner") return false
  if (input.targetRole === "admin") return input.actorRole === "owner"
  return true
}

/**
 * Changer le rôle de quelqu'un : le PROPRIÉTAIRE seul distribue et retire
 * l'administration, et le rôle `owner` ne s'attribue pas — il se transmet.
 */
export function canSetGroupThreadRole(input: {
  actorRole: GroupThreadRole
  targetRole: GroupThreadRole
  nextRole: GroupThreadRole
  isSelf: boolean
}): boolean {
  if (input.actorRole !== "owner") return false
  if (input.isSelf) return false
  if (input.targetRole === "owner") return false
  if (input.nextRole === "owner") return false
  return input.nextRole !== input.targetRole
}

/** Quitter : tout le monde, y compris le propriétaire (la propriété suit). */
export function canLeaveGroupThread(): boolean {
  return true
}

/** SUPPRIMER le fil pour tout le monde — le propriétaire, et lui seul. */
export function canDeleteGroupThread(role: GroupThreadRole): boolean {
  return role === "owner"
}

/**
 * Le successeur d'un propriétaire qui s'en va : le plus ANCIEN des restants,
 * départagé par l'identifiant (les membres créés ensemble partagent la même
 * milliseconde). `null` quand il ne reste personne — le fil se ferme.
 */
export function nextGroupThreadOwner<T extends { _id: string; joinedAt: number }>(restants: readonly T[]): T | null {
  if (restants.length === 0) return null
  return restants.reduce((meilleur, candidat) => {
    if (candidat.joinedAt !== meilleur.joinedAt) return candidat.joinedAt < meilleur.joinedAt ? candidat : meilleur
    return candidat._id < meilleur._id ? candidat : meilleur
  })
}
