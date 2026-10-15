// Dupliqué de socle/convex/modules/reseauPersonnel/contentRemoval.ts @ ad2e7fdc2 — adaptations : branche `page.postCount` retirée (les pages du moteur arrivent au lot 13, compteur en agrégat) ; le partage retiré se DÉCOMPTE dans l'agrégat (`unrecordShare`) au lieu de `shareCount` sur l'original ; retrait d'un commentaire avec le module engagement (lot 8).
/**
 * Retrait transactionnel d'un contenu — le point unique des invariants de
 * décompte : retirer un partage le décompte de l'original. Idempotent : un
 * contenu déjà retiré ne fait jamais descendre un compteur une seconde fois.
 * Retiré, pas supprimé : la ligne demeure, son auteur continue de la voir.
 */
import type { Doc } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { unrecordShare } from "./counters"

export async function markPostRemoved(ctx: MutationCtx, post: Doc<"posts">, removedAt: number): Promise<void> {
  if (post.status === "removed") return
  await ctx.db.patch(post._id, { status: "removed", removedAt, updatedAt: removedAt })
  await unrecordShare(ctx, post)
}
