// Dupliqué de socle/convex/modules/reseauPersonnel/groupes.ts (l. 192-570 : `assertAdmissible`, `historyFloor`, `liveMembershipOrNull`, `requireLiveMembership`, `liveMembers`, `blockedCache`, `isDeletedForUser`, `isClearedForMember`) @ ad2e7fdc2 — adaptations : le fil appartient au RÉSEAU de la fonction appelée (un fil d'un autre réseau est introuvable) ; `assertGroupScope` et la branche poste retirés (dans le moteur, tout fil est personnel) ; mécanique d'appel retirée (`isLiveMemberOfGroupCall`, `liveGroupThreadIdOfCall`, `liveActiveCall`, `revokeActiveGroupCallParticipation` : point d'accroche du lot 15) ; admissibilité = relation acceptée DANS le réseau, sans blocage (le « compte public » n'existe pas dans le moteur) ; masquage « pour moi » lu dans `groupMessageHides` (D22) ; effectif par l'agrégat `engineCounters` (D02) ; refus à code.
/**
 * La garde d'un fil de groupe : il existe, il est de CE réseau, il n'est pas en
 * suppression, et j'en suis membre VIVANT. Fil inconnu, d'un autre réseau,
 * dont je ne suis pas membre ou que j'ai quitté : le MÊME refus — distinguer
 * révélerait qu'un fil existe entre des tiers.
 */
import { GROUP_MEMBERS_MAX } from "@antsia/social-contracts/groupCapacity"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"
import { engineCounters } from "../posts/counters"

type ReadCtx = Pick<QueryCtx, "db">

/** L'appartenance VIVANTE d'une personne à un fil, sans transformer son absence en erreur observable. */
export async function liveMembershipOrNull(ctx: ReadCtx, threadId: Id<"groupThreads">, personId: Id<"persons">): Promise<Doc<"groupMembers"> | null> {
  const member = await ctx.db
    .query("groupMembers")
    .withIndex("by_thread_person", (q) => q.eq("threadId", threadId).eq("personId", personId))
    .unique()
  return member && member.leftAt === undefined ? member : null
}

/** La ligne d'appartenance, vivante ou partie (un retour la ranime). */
export async function membershipRowOrNull(ctx: ReadCtx, threadId: Id<"groupThreads">, personId: Id<"persons">): Promise<Doc<"groupMembers"> | null> {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_thread_person", (q) => q.eq("threadId", threadId).eq("personId", personId))
    .unique()
}

/** La garde UNIQUE d'accès à un fil — tout autre chemin rend le refus indistinct. */
export async function requireLiveMembership(
  ctx: ReadCtx,
  networkId: Id<"networks">,
  threadId: Id<"groupThreads">,
  personId: Id<"persons">,
): Promise<{ thread: Doc<"groupThreads">; member: Doc<"groupMembers"> }> {
  const thread = await ctx.db.get(threadId)
  if (!thread || thread.networkId !== networkId || thread.deletingAt !== undefined) return notFound()
  const member = await liveMembershipOrNull(ctx, threadId, personId)
  if (!member) return notFound()
  return { thread, member }
}

/** Les membres VIVANTS d'un fil — bornés au plafond, par construction. */
export async function liveMembers(ctx: ReadCtx, threadId: Id<"groupThreads">): Promise<Doc<"groupMembers">[]> {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_thread_leftAt", (q) => q.eq("threadId", threadId).eq("leftAt", undefined))
    .take(GROUP_MEMBERS_MAX)
}

/**
 * QUI PEUT ENTRER dans un groupe : une personne en relation ACCEPTÉE avec
 * l'INVITANT, dans ce réseau, sans blocage. Un administrateur ajoute quelqu'un
 * de SON réseau, que le créateur ne connaît pas. Refus INDISTINCT — dire lequel
 * des motifs manque renseignerait qui connaît qui, et qui a bloqué qui.
 */
export async function assertAdmissible(ctx: ReadCtx, networkId: Id<"networks">, inviterId: Id<"persons">, inviteeId: Id<"persons">): Promise<void> {
  if (await isBlockedBetween(ctx, inviterId, inviteeId)) return notFound()
  if (!(await isConnectedTo(ctx, networkId, inviterId, inviteeId))) return notFound()
}

/**
 * LE PLANCHER DE L'HISTOIRE — un membre lit à partir de SON arrivée, plancher
 * INCLUSIF (son propre « a rejoint » est écrit dans la même milliseconde).
 * Inviter quelqu'un, c'est l'ajouter à une conversation, pas lui ouvrir des
 * archives ; un membre qui revient repart de son retour.
 */
export function historyFloor(member: Pick<Doc<"groupMembers">, "joinedAt">): number {
  return member.joinedAt
}

/** Ce message appartient-il à la partie que CE membre a effacée ? */
export function isClearedForMember(message: Pick<Doc<"groupMessages">, "_creationTime">, member: Pick<Doc<"groupMembers">, "clearedThroughCreationTime">): boolean {
  return member.clearedThroughCreationTime !== undefined && message._creationTime <= member.clearedThroughCreationTime
}

/** Ce message est-il caché POUR cette personne (suppression « pour moi ») ? Une lecture indexée. */
export async function isHiddenForPerson(ctx: ReadCtx, messageId: Id<"groupMessages">, personId: Id<"persons">): Promise<boolean> {
  return (
    (await ctx.db
      .query("groupMessageHides")
      .withIndex("by_message_person", (q) => q.eq("messageId", messageId).eq("personId", personId))
      .first()) !== null
  )
}

/** Mémoïse `isBlockedBetween(moi, x)` sur la durée d'un appel : une page relit le même expéditeur des dizaines de fois. */
export function blockedCache(ctx: ReadCtx, me: Id<"persons">): (other: Id<"persons">) => Promise<boolean> {
  const cache = new Map<string, boolean>()
  return async (other) => {
    if (other === me) return false
    const hit = cache.get(other)
    if (hit !== undefined) return hit
    const blocked = await isBlockedBetween(ctx, me, other)
    cache.set(other, blocked)
    return blocked
  }
}

// ═══════════════════════════════════════════════════════════════
// Effectif — l'agrégat, jamais un champ du fil (D02)
// ═══════════════════════════════════════════════════════════════

const membersOf = (threadId: Id<"groupThreads">) => `groupThreads.members:${threadId}`

/** Combien de membres VIVANTS dans ce fil. */
export async function countThreadMembers(ctx: Pick<QueryCtx, "runQuery">, threadId: Id<"groupThreads">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: membersOf(threadId) })
}

/** Compte une appartenance vivante (une entrée par ligne). Idempotent. */
export async function recordThreadMember(ctx: MutationCtx, member: { _id: Id<"groupMembers">; threadId: Id<"groupThreads"> }): Promise<void> {
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: membersOf(member.threadId), key: 0, id: member._id })
}

/** Décompte une appartenance (départ, retrait, suppression du fil). Idempotent. */
export async function unrecordThreadMember(ctx: MutationCtx, member: { _id: Id<"groupMembers">; threadId: Id<"groupThreads"> }): Promise<void> {
  await engineCounters.deleteIfExists(ctx, { namespace: membersOf(member.threadId), key: 0, id: member._id })
}
