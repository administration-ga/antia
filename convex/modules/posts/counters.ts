// Dupliqué de socle/convex/modules/reseauPersonnel/counters.ts @ ad2e7fdc2 — adaptations : réactions lues et écrites dans des FRAGMENTS (`postReactionShards`) au lieu des champs dénormalisés sur la publication (D01) ; partages (et commentaires, lot 8) comptés par l'agrégat `engineCounters` (une entrée par contenu compté, sous l'espace de noms de la publication) au lieu de `shareCount`/`commentCount` ; MA réaction lue par l'index `by_post_and_person` ; en-tête obsolète corrigé ; abonnés et publications d'une PAGE dans le même agrégat (lot 13, au lieu de `followerCount`/`postCount` sur la page).
/**
 * Décomptes d'engagement d'une publication — jamais écrits sur la publication.
 *
 * Un compteur recopié sur le document chaud fait entrer en conflit toutes les
 * écritures voisines (réagir, commenter, partager, éditer) : ici, les réactions
 * vivent dans des fragments (une personne retombe toujours sur le même), et
 * les contenus comptés (partages, commentaires) dans un agrégat — compter ne
 * balaie rien, écrire ne touche pas la publication.
 *
 * Aucune fonction Convex ici.
 */
import type { PersonalReactionKind } from "@antsia/social-domain/content"
import { DirectAggregate } from "@convex-dev/aggregate"

import { components } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"

/** Nombre de fragments d'un compteur de réactions. */
export const REACTION_SHARDS = 8

export type ReactionCounts = Record<PersonalReactionKind, number>

export const EMPTY_REACTION_COUNTS: ReactionCounts = { like: 0, bravo: 0, soutien: 0, instructif: 0 }

/** Le fragment d'une personne : stable (hachage FNV-1a de son identifiant). */
export function shardOf(personId: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < personId.length; index += 1) {
    hash ^= personId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % REACTION_SHARDS
}

/** Somme des fragments d'une publication. */
export async function readReactionCounts(ctx: Pick<QueryCtx, "db">, postId: Id<"posts">): Promise<{ counts: ReactionCounts; total: number }> {
  const shards = await ctx.db
    .query("postReactionShards")
    .withIndex("by_post_and_shard", (q) => q.eq("postId", postId))
    .take(REACTION_SHARDS)
  const counts = { ...EMPTY_REACTION_COUNTS }
  for (const shard of shards) {
    counts.like += shard.like
    counts.bravo += shard.bravo
    counts.soutien += shard.soutien
    counts.instructif += shard.instructif
  }
  return { counts, total: counts.like + counts.bravo + counts.soutien + counts.instructif }
}

export type ReactionSummary = { counts: ReactionCounts; total: number; mine: PersonalReactionKind | null }

/** Les réactions d'une publication et MA réaction — ce qu'allume le bouton. */
export async function summarizeReactions(ctx: Pick<QueryCtx, "db">, postId: Id<"posts">, readerPersonId: Id<"persons">): Promise<ReactionSummary> {
  const [summary, mine] = await Promise.all([
    readReactionCounts(ctx, postId),
    ctx.db
      .query("postReactions")
      .withIndex("by_post_and_person", (q) => q.eq("postId", postId).eq("personId", readerPersonId))
      .unique(),
  ])
  return { ...summary, mine: mine?.kind ?? null }
}

/** Ajoute (+1) ou retire (−1) une réaction du genre donné dans le fragment de la personne. */
export async function applyReactionDelta(
  ctx: MutationCtx,
  postId: Id<"posts">,
  personId: Id<"persons">,
  kind: PersonalReactionKind,
  delta: 1 | -1,
): Promise<void> {
  const shard = shardOf(personId)
  const row = await ctx.db
    .query("postReactionShards")
    .withIndex("by_post_and_shard", (q) => q.eq("postId", postId).eq("shard", shard))
    .unique()
  if (row) {
    await ctx.db.patch(row._id, { [kind]: Math.max(0, row[kind] + delta) })
    return
  }
  if (delta < 0) return
  await ctx.db.insert("postReactionShards", { postId, shard, ...EMPTY_REACTION_COUNTS, [kind]: 1 })
}

/**
 * L'agrégat générique des contenus comptés : une entrée par contenu (un
 * partage, un commentaire), sous l'espace de noms de ce qu'il compte.
 */
export const engineCounters = new DirectAggregate<{ Namespace: string; Key: number; Id: string }>(components.engineCounters)

const sharesOf = (postId: Id<"posts">) => `posts.shares:${postId}`
const commentsOf = (postId: Id<"posts">) => `posts.comments:${postId}`

const repliesOf = (commentId: Id<"postComments">) => `posts.replies:${commentId}`

/** Combien de COMMENTAIRES vivants sous cette publication, réponses comprises. */
export async function countComments(ctx: Pick<QueryCtx, "runQuery">, postId: Id<"posts">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: commentsOf(postId) })
}

/** Combien de RÉPONSES vivantes sous cette racine. */
export async function countReplies(ctx: Pick<QueryCtx, "runQuery">, rootCommentId: Id<"postComments">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: repliesOf(rootCommentId) })
}

type CountedComment = { _id: Id<"postComments">; postId: Id<"posts">; parentCommentId?: Id<"postComments">; createdAt: number }

/** Compte un commentaire (à sa publication, et à sa racine s'il répond). Idempotent. */
export async function recordComment(ctx: MutationCtx, comment: CountedComment): Promise<void> {
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: commentsOf(comment.postId), key: comment.createdAt, id: comment._id })
  if (comment.parentCommentId !== undefined) {
    await engineCounters.insertIfDoesNotExist(ctx, { namespace: repliesOf(comment.parentCommentId), key: comment.createdAt, id: comment._id })
  }
}

/** Décompte un commentaire (à son retrait). Idempotent. */
export async function unrecordComment(ctx: MutationCtx, comment: CountedComment): Promise<void> {
  await engineCounters.deleteIfExists(ctx, { namespace: commentsOf(comment.postId), key: comment.createdAt, id: comment._id })
  if (comment.parentCommentId !== undefined) {
    await engineCounters.deleteIfExists(ctx, { namespace: repliesOf(comment.parentCommentId), key: comment.createdAt, id: comment._id })
  }
}

/** Combien de PARTAGES vivants de cette publication circulent. */
export async function countShares(ctx: Pick<QueryCtx, "runQuery">, postId: Id<"posts">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: sharesOf(postId) })
}

/** Compte un partage (à sa publication). Idempotent. */
export async function recordShare(ctx: MutationCtx, share: { _id: Id<"posts">; sharedPostId?: Id<"posts">; publishedAt: number }): Promise<void> {
  if (share.sharedPostId === undefined) return
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: sharesOf(share.sharedPostId), key: share.publishedAt, id: share._id })
}

/** Décompte un partage (à son retrait). Idempotent. */
export async function unrecordShare(ctx: MutationCtx, share: { _id: Id<"posts">; sharedPostId?: Id<"posts">; publishedAt: number }): Promise<void> {
  if (share.sharedPostId === undefined) return
  await engineCounters.deleteIfExists(ctx, { namespace: sharesOf(share.sharedPostId), key: share.publishedAt, id: share._id })
}

const membersOf = (groupId: Id<"thematicGroups">) => `groups.members:${groupId}`

/** Combien de membres VIVANTS dans ce groupe thématique (D02 : jamais un champ du groupe). */
export async function countGroupMembers(ctx: Pick<QueryCtx, "runQuery">, groupId: Id<"thematicGroups">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: membersOf(groupId) })
}

/** Compte une appartenance vivante (une entrée par ligne d'appartenance). Idempotent. */
export async function recordGroupMember(ctx: MutationCtx, membership: { _id: Id<"thematicGroupMembers">; groupId: Id<"thematicGroups"> }): Promise<void> {
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: membersOf(membership.groupId), key: 0, id: membership._id })
}

/** Décompte une appartenance (départ, retrait, suppression du groupe). Idempotent. */
export async function unrecordGroupMember(ctx: MutationCtx, membership: { _id: Id<"thematicGroupMembers">; groupId: Id<"thematicGroups"> }): Promise<void> {
  await engineCounters.deleteIfExists(ctx, { namespace: membersOf(membership.groupId), key: 0, id: membership._id })
}

const pageFollowersOf = (pageId: Id<"pages">) => `pages.followers:${pageId}`
const pagePostsOf = (pageId: Id<"pages">) => `pages.posts:${pageId}`

/** Combien d'ABONNÉS vivants pour cette page (D02 : jamais un champ de la page). */
export async function countPageFollowers(ctx: Pick<QueryCtx, "runQuery">, pageId: Id<"pages">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: pageFollowersOf(pageId) })
}

/** Compte un abonnement (une entrée par ligne d'abonnement). Idempotent. */
export async function recordPageFollower(ctx: MutationCtx, follow: { _id: Id<"pageFollows">; pageId: Id<"pages">; createdAt: number }): Promise<void> {
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: pageFollowersOf(follow.pageId), key: follow.createdAt, id: follow._id })
}

/** Décompte un abonnement (désabonnement, effacement). Idempotent. */
export async function unrecordPageFollower(ctx: MutationCtx, follow: { _id: Id<"pageFollows">; pageId: Id<"pages">; createdAt: number }): Promise<void> {
  await engineCounters.deleteIfExists(ctx, { namespace: pageFollowersOf(follow.pageId), key: follow.createdAt, id: follow._id })
}

/** Combien de publications VIVANTES au nom de cette page. */
export async function countPagePosts(ctx: Pick<QueryCtx, "runQuery">, pageId: Id<"pages">): Promise<number> {
  return await engineCounters.count(ctx, { namespace: pagePostsOf(pageId) })
}

/** Compte une publication de page (à l'écriture). Idempotent ; sans page, rien. */
export async function recordPagePost(ctx: MutationCtx, post: { _id: Id<"posts">; pageId?: Id<"pages">; publishedAt: number }): Promise<void> {
  if (post.pageId === undefined) return
  await engineCounters.insertIfDoesNotExist(ctx, { namespace: pagePostsOf(post.pageId), key: post.publishedAt, id: post._id })
}

/** Décompte une publication de page (à son retrait, quel qu'en soit le chemin). Idempotent. */
export async function unrecordPagePost(ctx: MutationCtx, post: { _id: Id<"posts">; pageId?: Id<"pages">; publishedAt: number }): Promise<void> {
  if (post.pageId === undefined) return
  await engineCounters.deleteIfExists(ctx, { namespace: pagePostsOf(post.pageId), key: post.publishedAt, id: post._id })
}
