// Dupliqué de socle/convex/modules/reseauPersonnel/engagement.ts (l. 30-138) @ ad2e7fdc2 — adaptations : réagir dans un réseau (`networkMutation`, adhésion déclarée) ; publication hors réseau, retirée ou invisible = refus indistinct ; compteur FRAGMENTÉ au lieu des champs de la publication (dette D01) ; limitation de débit ; la cloche de l'auteur arrive avec le module notifications (PA3). Commentaires (paginés, dette D03) : PA3.
/**
 * Réactions : UNE par (publication, personne) ; changer de genre remplace,
 * rejouer le même genre retire.
 */
import { isVisibleTo } from "@antia/social-domain/visibility"
import { v } from "convex/values"

import { notFound } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { reactionKindValidator } from "../../lib/validators"
import { applyReactionDelta } from "../posts/counters"

export const toggleReaction = networkMutation({
  minStatus: "declaree",
  args: { postId: v.id("posts"), kind: reactionKindValidator },
  returns: v.object({ mine: v.union(reactionKindValidator, v.null()) }),
  handler: async (ctx, { postId, kind }) => {
    await enforceRateLimit(ctx, "reaction.toggle", ctx.person._id)
    const post = await ctx.db.get(postId)
    if (!post || post.networkId !== ctx.networkId || post.status !== "published") return notFound()
    const visible = isVisibleTo({
      audience: post.audience,
      status: post.status,
      visibility: post.visibility,
      isAuthor: post.authorPersonId === ctx.person._id,
      isConnected: false,
      isGroupMember: false,
      isBlockedWithAuthor: false,
      isMemberOfPostNetwork: true,
      isMemberOfRoot: true,
    })
    if (!visible) return notFound()

    const existing = await ctx.db
      .query("postReactions")
      .withIndex("by_post_and_person", (q) => q.eq("postId", postId).eq("personId", ctx.person._id))
      .unique()
    if (existing && existing.kind === kind) {
      await ctx.db.delete(existing._id)
      await applyReactionDelta(ctx, postId, ctx.person._id, kind, -1)
      return { mine: null }
    }
    if (existing) {
      await applyReactionDelta(ctx, postId, ctx.person._id, existing.kind, -1)
      await ctx.db.patch(existing._id, { kind, createdAt: Date.now() })
    } else {
      await ctx.db.insert("postReactions", { networkId: ctx.networkId, postId, personId: ctx.person._id, kind, createdAt: Date.now() })
    }
    await applyReactionDelta(ctx, postId, ctx.person._id, kind, 1)
    return { mine: kind }
  },
})
