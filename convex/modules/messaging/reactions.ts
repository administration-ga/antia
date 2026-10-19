// Dupliqué de socle/convex/functions/chats.ts (l. 1575-1633, `toggleMessageReaction`) @ ad2e7fdc2 — adaptations : participant, réseau et blocage par la garde du fil ; règles de bascule du contrat partagé (`@antsia/social-contracts/messageReactions`) ; un message retiré n'accueille plus de réaction (refus indistinct) ; débit.
/**
 * Poser, remplacer ou RETIRER ma réaction à un message — reposer le genre déjà
 * donné le retire. La ligne (qui a réagi) et le décompte dénormalisé (combien)
 * se déplacent dans la MÊME transaction.
 */
import { applyMessageReactionDelta, nextMessageReactionKind } from "@antsia/social-contracts/messageReactions"
import { v } from "convex/values"

import { notFound } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { requireThread } from "./participation"
import { messageReactionCountsValidator, messageReactionKindValidator } from "./tables"
import { isHiddenFor } from "./threads"

export const toggleMessageReaction = networkMutation({
  minStatus: "declaree",
  args: { messageId: v.id("personalMessages"), kind: messageReactionKindValidator },
  returns: v.object({ kind: v.union(messageReactionKindValidator, v.null()), counts: messageReactionCountsValidator }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.react", ctx.person._id)
    const message = await ctx.db.get(args.messageId)
    if (!message) return notFound()
    await requireThread(ctx, ctx.networkId, message.threadId, ctx.person._id)
    if (message.deletedAt !== undefined || isHiddenFor(message, ctx.person._id)) return notFound()
    const existing = await ctx.db
      .query("personalMessageReactions")
      .withIndex("by_message_and_person", (q) => q.eq("messageId", message._id).eq("personId", ctx.person._id))
      .unique()
    const previous = existing?.kind ?? null
    const next = nextMessageReactionKind(previous, args.kind)
    const counts = applyMessageReactionDelta(message.reactionCounts, previous, next)
    if (next === null) {
      if (existing) await ctx.db.delete(existing._id)
    } else if (existing) {
      await ctx.db.patch(existing._id, { kind: next })
    } else {
      await ctx.db.insert("personalMessageReactions", { threadId: message.threadId, messageId: message._id, personId: ctx.person._id, kind: next, createdAt: Date.now() })
    }
    await ctx.db.patch(message._id, { reactionCounts: counts })
    return { kind: next, counts }
  },
})
