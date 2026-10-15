// Dupliqué de socle/convex/modules/reseauPersonnel/contentRemoval.ts @ ad2e7fdc2 — adaptations : la publication d'une PAGE se décompte dans l'agrégat (`unrecordPagePost`, au lieu de `page.postCount`) ; le partage et le commentaire retirés se DÉCOMPTENT dans l'agrégat (`unrecordShare`, `unrecordComment`) au lieu de `shareCount` et `commentCount` sur la publication ; une RACINE retirée emporte ses réponses (lots bornés, suite planifiée) — le socle les laissait comptées sans plus aucune lecture pour les rendre.
/**
 * Retrait transactionnel d'un contenu — le point unique des invariants de
 * décompte : retirer un partage le décompte de l'original, retirer une racine
 * de commentaires retire aussi ses réponses. Idempotent : un contenu déjà
 * retiré ne fait jamais descendre un compteur une seconde fois.
 * Retiré, pas supprimé : la ligne demeure, son auteur continue de la voir.
 */
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { unrecordComment, unrecordPagePost, unrecordShare } from "./counters"

/** Réponses retirées avec leur racine dans une même transaction ; au-delà, la suite part en lots planifiés. */
const REPLIES_REMOVAL_BATCH = 100

export async function markPostRemoved(ctx: MutationCtx, post: Doc<"posts">, removedAt: number): Promise<void> {
  if (post.status === "removed") return
  await ctx.db.patch(post._id, { status: "removed", removedAt, updatedAt: removedAt })
  await unrecordShare(ctx, post)
  // Écrivain UNIQUE du décompte au retrait, quel que soit le chemin (signataire, modération).
  await unrecordPagePost(ctx, post)
}

/**
 * Retirer un commentaire — par son auteur, l'auteur de la publication ou la
 * modération, toujours ici. Une RACINE emporte ses réponses : plus aucune
 * lecture ne les rend (la liste ne sert que des racines vivantes,
 * `paginateReplies` refuse une racine retirée), et comptées, elles feraient
 * dire « 1 commentaire » à une liste vide. Le compte reste égal à ce qui se lit.
 */
export async function markCommentRemoved(ctx: MutationCtx, comment: Doc<"postComments">, removedAt: number): Promise<void> {
  if (comment.status === "removed") return
  await ctx.db.patch(comment._id, { status: "removed", removedAt, updatedAt: removedAt })
  await unrecordComment(ctx, comment)
  if (comment.parentCommentId === undefined) await removeRepliesBatch(ctx, comment.postId, comment._id, removedAt)
}

/** Un lot de réponses VIVANTES d'une racine retirée : retirées et décomptées ; un lot plein planifie la suite. */
async function removeRepliesBatch(ctx: MutationCtx, postId: Id<"posts">, rootCommentId: Id<"postComments">, removedAt: number): Promise<void> {
  const replies = await ctx.db
    .query("postComments")
    .withIndex("by_post_parent_status_createdAt", (q) => q.eq("postId", postId).eq("parentCommentId", rootCommentId).eq("status", "published"))
    .take(REPLIES_REMOVAL_BATCH)
  for (const reply of replies) {
    await ctx.db.patch(reply._id, { status: "removed", removedAt, updatedAt: removedAt })
    await unrecordComment(ctx, reply)
  }
  if (replies.length === REPLIES_REMOVAL_BATCH) {
    await ctx.scheduler.runAfter(0, internal.modules.posts.contentRemoval.continueRepliesRemoval, { postId, rootCommentId, removedAt })
  }
}

/** Continuation interne du retrait des réponses d'une racine retirée — bornée, idempotente. */
export const continueRepliesRemoval = internalMutation({
  args: { postId: v.id("posts"), rootCommentId: v.id("postComments"), removedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const root = await ctx.db.get(args.rootCommentId)
    // Racine effacée depuis (son effacement emporte ses réponses) : rien à poursuivre.
    if (!root || root.status !== "removed") return null
    await removeRepliesBatch(ctx, args.postId, args.rootCommentId, args.removedAt)
    return null
  },
})
