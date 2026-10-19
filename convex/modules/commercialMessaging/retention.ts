/** P10 : reprise durable bornée ; aucun effacement des engagements CRM séparés. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { finishCall } from "../calls/state"
import { purgeStoredFile } from "../files/purge"
import { canParticipateCommercialCall } from "./access"
import { prepareCommercialRetention } from "./crm"
import { stopCommercialCalls } from "./threads"

const purgeNext = makeFunctionReference<"mutation", Record<string, never>, number>("modules/commercialMessaging/retention:purgeExpired")
const revalidateNext = makeFunctionReference<"mutation", { cursor?: string }, number>("modules/commercialMessaging/retention:revalidateCalls")
/** Un seul fil et 20 messages (40 blobs au plus) par transaction. */
export async function purgeCommercialThreadSlice(ctx: MutationCtx, threadId: Id<"commercialThreads">): Promise<boolean> {
  const thread = await ctx.db.get(threadId)
  if (!thread) return true
  if (!await prepareCommercialRetention(ctx, threadId)) {
    // Le retrait externe est durable : une panne ne transforme pas l'attente en effacement acquis.
    await ctx.db.patch(threadId, { purgeAt: Date.now() + 24 * 60 * 60 * 1000 })
    return false
  }
  await stopCommercialCalls(ctx, threadId)
  const messages = await ctx.db.query("commercialMessages").withIndex("by_thread", (q) => q.eq("threadId", threadId)).take(20)
  for (const message of messages) {
    for (const file of message.attachmentFiles ?? []) await purgeStoredFile(ctx, file.storageId)
    const moderation = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "commercialMessage").eq("targetId", message._id)).unique()
    if (moderation) await ctx.db.delete(moderation._id)
    await ctx.db.delete(message._id)
  }
  if (messages.length === 20) return false
  const states = await ctx.db.query("commercialReadStates").withIndex("by_thread", (q) => q.eq("threadId", threadId)).take(21)
  for (const state of states) await ctx.db.delete(state._id)
  if (states.length === 21) return false
  const blocks = await ctx.db.query("commercialBlocks").withIndex("by_thread", (q) => q.eq("threadId", threadId)).take(2)
  if (blocks.length > 0) {
    // L'intention de paire demeure jusqu'au déblocage explicite ; aucun contenu ne demeure.
    await ctx.db.patch(threadId, { offerRef: undefined, assignedRespondentPersonId: undefined, buyerCallsAllowed: false, purgeAt: undefined })
  } else await ctx.db.delete(threadId)
  return true
}
export const purgeExpired = internalMutation({
  args: {}, returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const row = await ctx.db.query("commercialThreads").withIndex("by_purgeAt", (q) => q.gt("purgeAt", 0).lte("purgeAt", Date.now())).first()
    if (!row) return 0
    await purgeCommercialThreadSlice(ctx, row._id)
    await ctx.scheduler.runAfter(0, purgeNext, {})
    return 1
  },
})
/** Les changements externes d'adhésion/page ferment aussi les salles déjà ouvertes. */
export const revalidateCalls = internalMutation({
  args: { cursor: v.optional(v.string()) }, returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const window = await ctx.db.query("calls").withIndex("by_status_commercial_thread", (q) => q.eq("status", "active").gt("commercialThreadId", undefined)).paginate({ cursor: args.cursor ?? null, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 256 * 1024 })
    let ended = 0
    for (const call of window.page) {
      if (await canParticipateCommercialCall(ctx, call, call.createdByPersonId)) continue
      await finishCall(ctx, call, { callStatus: "ended", endReason: "normal" }, Date.now())
      ended += 1
    }
    if (!window.isDone) await ctx.scheduler.runAfter(0, revalidateNext, { cursor: window.continueCursor })
    return ended
  },
})
