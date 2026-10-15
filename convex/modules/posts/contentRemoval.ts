// Dupliqué de socle/convex/modules/reseauPersonnel/contentRemoval.ts @ ad2e7fdc2 — adaptations : branche `page.postCount` retirée (les pages du moteur arrivent au lot 13, compteur en agrégat) ; le partage et le commentaire retirés se DÉCOMPTENT dans l'agrégat (`unrecordShare`, `unrecordComment`) au lieu de `shareCount` et `commentCount` sur la publication.
/**
 * Retrait transactionnel d'un contenu — le point unique des invariants de
 * décompte : retirer un partage le décompte de l'original. Idempotent : un
 * contenu déjà retiré ne fait jamais descendre un compteur une seconde fois.
 * Retiré, pas supprimé : la ligne demeure, son auteur continue de la voir.
 */
import type { Doc } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { unrecordComment, unrecordShare } from "./counters"

export async function markPostRemoved(ctx: MutationCtx, post: Doc<"posts">, removedAt: number): Promise<void> {
  if (post.status === "removed") return
  await ctx.db.patch(post._id, { status: "removed", removedAt, updatedAt: removedAt })
  await unrecordShare(ctx, post)
}

export async function markCommentRemoved(ctx: MutationCtx, comment: Doc<"postComments">, removedAt: number): Promise<void> {
  if (comment.status === "removed") return
  await ctx.db.patch(comment._id, { status: "removed", removedAt, updatedAt: removedAt })
  await unrecordComment(ctx, comment)
}
