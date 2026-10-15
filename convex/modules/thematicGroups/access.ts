// Dupliqué de socle/convex/modules/reseauPersonnel/groupesThematiquesAccess.ts @ ad2e7fdc2 — adaptations : personnes ; libellés remplacés par des codes (`notFound`, `groupMembershipRequired`) ; le groupe doit appartenir au réseau de l'acte (le contrôle du réseau est chez l'appelant, qui passe son `networkId`).
/**
 * L'APPARTENANCE à un groupe thématique — les lectures que tout le monde
 * partage.
 *
 * Aucune fonction Convex ici : ce sont des aides, importées par la garde de
 * visibilité (`posts/access.ts`), par l'écriture d'une publication et par l'API
 * des groupes (lot 9). Les mettre ici évite le cycle d'imports, et garantit
 * qu'il n'existe qu'UNE définition de « membre vivant » : celle dont dépend
 * l'audience `group` du fil.
 */
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { fail, notFound } from "../../lib/errors"

type ReadCtx = Pick<QueryCtx, "db">

/**
 * Un groupe fermé, archivé ou en cours de suppression n'ouvre plus aucun droit
 * social. La ligne peut demeurer pour l'archive ; les gardes, elles, ferment.
 */
export function isActiveThematicGroup(group: Doc<"thematicGroups">): boolean {
  return group.closedAt === undefined && group.archivedAt === undefined && group.deletingAt === undefined
}

/** La ligne d'appartenance VIVANTE d'une personne, ou `null`. */
export async function liveThematicGroupMembership(
  ctx: ReadCtx,
  groupId: Id<"thematicGroups">,
  personId: Id<"persons">,
): Promise<Doc<"thematicGroupMembers"> | null> {
  const row = await ctx.db
    .query("thematicGroupMembers")
    .withIndex("by_group_and_person", (q) => q.eq("groupId", groupId).eq("personId", personId))
    .unique()
  if (!row || row.leftAt !== undefined) return null
  return row
}

/** Membre VIVANT d'un groupe vivant ? — la question que pose la garde d'audience `group`. */
export async function isLiveThematicGroupMember(ctx: ReadCtx, groupId: Id<"thematicGroups">, personId: Id<"persons">): Promise<boolean> {
  const group = await ctx.db.get(groupId)
  if (!group || !isActiveThematicGroup(group)) return false
  return (await liveThematicGroupMembership(ctx, groupId, personId)) !== null
}

/**
 * Le groupe ET mon appartenance vivante — la garde des actes de MEMBRE.
 * Groupe inconnu, d'un autre réseau ou fermé : `notFound` ; non-membre ou
 * membre parti : `groupMembershipRequired` — explicite, et c'est un choix : la
 * fiche d'un groupe est découvrable, son existence n'est un secret pour
 * personne. Ce qui reste indistinct, c'est la LECTURE d'une publication de
 * groupe (`assertVisiblePost`).
 */
export async function requireLiveThematicGroupMembership(
  ctx: ReadCtx,
  networkId: Id<"networks">,
  groupId: Id<"thematicGroups">,
  personId: Id<"persons">,
): Promise<{ group: Doc<"thematicGroups">; membership: Doc<"thematicGroupMembers"> }> {
  const group = await ctx.db.get(groupId)
  if (!group || group.networkId !== networkId || !isActiveThematicGroup(group)) return notFound()
  const membership = await liveThematicGroupMembership(ctx, groupId, personId)
  if (!membership) return fail("groupMembershipRequired")
  return { group, membership }
}
