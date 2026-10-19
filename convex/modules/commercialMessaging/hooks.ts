/** P10 : effets de conversation, sans copie de contenu dans les notifications/jobs. */
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { notifyPerson } from "../notifications/notify"
import { moderateContentWrite } from "../moderation/policy"
import { canReadCommercialThread, liveRespondents } from "./access"
import { withdrawTransfer } from "./crm"

export async function onCommercialActivity(ctx: MutationCtx, args: {
  threadId: Id<"commercialThreads">; actorPersonId: Id<"persons">;
  kind: "requested" | "accepted" | "declined" | "message" | "blocked" | "closed";
  messageId?: Id<"commercialMessages">;
}): Promise<void> {
  const thread = await ctx.db.get(args.threadId)
  if (!thread) return
  if (args.kind === "blocked" || args.kind === "closed" || args.kind === "declined") {
    const transfer = await ctx.db.query("commercialCrmTransfers").withIndex("by_thread", (q) => q.eq("threadId", thread._id)).unique()
    if (transfer) await withdrawTransfer(ctx, transfer)
    return
  }
  if (args.messageId) {
    const message = await ctx.db.get(args.messageId)
    if (!message || !await moderateContentWrite(ctx, { networkId: thread.networkId, ownerPersonId: message.senderPersonId, kind: "commercialMessage", id: message._id, text: message.content ?? "" })) return
  }
  const shop = await ctx.db.get(thread.shopId)
  if (!shop) return
  const recipients = args.actorPersonId === thread.requesterPersonId
    ? (await liveRespondents(ctx, { thread, shop })).map((mandate) => mandate.personId)
    : [thread.requesterPersonId]
  for (const personId of recipients) if (await canReadCommercialThread(ctx, thread.networkId, personId, thread._id)) {
    await notifyPerson(ctx, { networkId: thread.networkId, recipientPersonId: personId, actorPersonId: args.actorPersonId, kind: "commercial_contact", subject: { commercialThread: thread._id } })
  }
}
