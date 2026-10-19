import { COMMERCIAL_ATTACHMENTS_MAX, commercialCanSend, commercialIdempotencyKey, commercialText } from "@antsia/social-domain/commercialContact"
import { type PaginationResult, paginationOptsValidator, paginationResultValidator } from "convex/server"
import { type Infer, v } from "convex/values"

import { fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { guardUploadUrl } from "../../lib/uploadPolicy"
import { purgeStoredFile } from "../files/purge"
import { withheldCodeValidator } from "../files/storageGuard"
import { attachmentFileValidator } from "../messaging/attachmentStorage"
import { counterpartOf, deliverAttachments } from "../messaging/participation"
import { canReadModeratedContent } from "../moderation/policy"
import { readStateOf, requireCommercialThread } from "./access"
import { admitCommercialAttachments } from "./attachments"
import { onCommercialActivity } from "./hooks"
import { commercialDigest } from "./threads"

export const commercialMessageValidator = v.object({
  messageId: v.id("commercialMessages"), senderPersonId: v.id("persons"), senderKind: v.union(v.literal("requester"), v.literal("shop")),
  sender: v.object({ displayName: v.union(v.string(), v.null()), handle: v.union(v.string(), v.null()) }),
  isMine: v.boolean(), content: v.union(v.string(), v.null()), deleted: v.boolean(), withheld: v.boolean(), createdAt: v.number(),
  attachmentFiles: v.array(v.object({ filename: v.string(), mimeType: v.string(), sizeBytes: v.number(), durationMs: v.union(v.number(), v.null()), url: v.union(v.string(), v.null()), withheld: v.union(withheldCodeValidator, v.null()) })),
})
export type CommercialMessageDto = Infer<typeof commercialMessageValidator>
export const paginateMessages = networkQuery({
  args: { threadId: v.id("commercialThreads"), paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(commercialMessageValidator),
  handler: async (ctx, args): Promise<PaginationResult<CommercialMessageDto>> => {
    await requireCommercialThread(ctx, ctx.networkId, ctx.person._id, args.threadId)
    const window = await ctx.db.query("commercialMessages").withIndex("by_thread_createdAt", (q) => q.eq("threadId", args.threadId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(40, Math.max(1, args.paginationOpts.numItems)), maximumRowsRead: 80, maximumBytesRead: 512 * 1024 })
    const page: CommercialMessageDto[] = []
    for (const row of window.page) {
      if (row.networkId !== ctx.networkId) continue
      const deleted = row.deletedAt !== undefined
      const withheld = !deleted && !await canReadModeratedContent(ctx, "commercialMessage", row._id, ctx.person._id)
      const who = await counterpartOf(ctx, row.senderPersonId)
      page.push({ messageId: row._id, senderPersonId: row.senderPersonId, senderKind: row.senderKind, sender: { displayName: who.displayName, handle: who.handle }, isMine: row.senderPersonId === ctx.person._id, content: deleted || withheld ? null : row.content ?? null, deleted, withheld, attachmentFiles: deleted || withheld ? [] : await deliverAttachments(ctx, row.attachmentFiles ?? []), createdAt: row.createdAt })
    }
    return { ...window, page }
  },
})
export const generateUploadUrl = networkMutation({
  args: { threadId: v.id("commercialThreads") }, returns: v.string(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "upload.url", ctx.person._id)
    const access = await requireCommercialThread(ctx, ctx.networkId, ctx.person._id, args.threadId)
    if (!commercialCanSend(access.thread.state, access.blocked, access.viewerKind === "requester" || access.mandate?.canReply === true)) return notFound()
    return await guardUploadUrl(ctx, "chat_attachment")
  },
})
export const sendMessage = networkMutation({
  writeBucket: "commercial.message",
  args: { threadId: v.id("commercialThreads"), text: v.string(), attachments: v.optional(v.array(attachmentFileValidator)), idempotencyKey: v.string() },
  returns: v.object({ messageId: v.id("commercialMessages"), deduplicated: v.boolean() }),
  handler: async (ctx, args) => {
    const access = await requireCommercialThread(ctx, ctx.networkId, ctx.person._id, args.threadId)
    const text = commercialText(args.text, (args.attachments?.length ?? 0) > 0)
    if (text === null || !commercialIdempotencyKey(args.idempotencyKey)) return fail("invalidArgument", { field: text === null ? "text" : "idempotencyKey" })
    if ((args.attachments?.length ?? 0) > COMMERCIAL_ATTACHMENTS_MAX) return fail("invalidArgument", { field: "attachments" })
    const digest = await commercialDigest(["message", args.threadId, text, (args.attachments ?? []).map((file) => [file.storageId, file.filename, file.mimeType, file.sizeBytes, file.durationMs ?? null])])
    const replay = await ctx.db.query("commercialMessages").withIndex("by_network_sender_key", (q) => q.eq("networkId", ctx.networkId).eq("senderPersonId", ctx.person._id).eq("idempotencyKey", args.idempotencyKey)).unique()
    if (replay) {
      if (replay.digest !== digest || replay.threadId !== args.threadId || replay.deletedAt !== undefined) return notFound()
      return { messageId: replay._id, deduplicated: true }
    }
    if (!commercialCanSend(access.thread.state, access.blocked, access.viewerKind === "requester" || access.mandate?.canReply === true)) return notFound()
    const attachmentFiles = await admitCommercialAttachments(ctx, args.attachments, { networkId: ctx.networkId, senderPersonId: ctx.person._id })
    const now = Date.now()
    const messageId = await ctx.db.insert("commercialMessages", { networkId: ctx.networkId, threadId: args.threadId, senderPersonId: ctx.person._id, senderKind: access.viewerKind, ...(text ? { content: text } : {}), ...(attachmentFiles ? { attachmentFiles } : {}), idempotencyKey: args.idempotencyKey, digest, createdAt: now })
    await ctx.db.patch(args.threadId, { lastMessageAt: now, updatedAt: now, revision: access.thread.revision + 1 })
    const state = await readStateOf(ctx, args.threadId, ctx.person._id)
    if (state) await ctx.db.patch(state._id, { readAt: now, updatedAt: now })
    else await ctx.db.insert("commercialReadStates", { networkId: ctx.networkId, threadId: args.threadId, personId: ctx.person._id, readAt: now, updatedAt: now })
    await onCommercialActivity(ctx, { threadId: args.threadId, actorPersonId: ctx.person._id, kind: "message", messageId })
    return { messageId, deduplicated: false }
  },
})
export const removeMessage = networkMutation({
  writeBucket: "commercial.message", args: { threadId: v.id("commercialThreads"), messageId: v.id("commercialMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    await requireCommercialThread(ctx, ctx.networkId, ctx.person._id, args.threadId)
    const row = await ctx.db.get(args.messageId)
    if (!row || row.networkId !== ctx.networkId || row.threadId !== args.threadId || row.senderPersonId !== ctx.person._id) return notFound()
    if (row.deletedAt !== undefined) return null
    for (const file of row.attachmentFiles ?? []) await purgeStoredFile(ctx, file.storageId)
    await ctx.db.patch(row._id, { content: undefined, attachmentFiles: undefined, deletedAt: Date.now() })
    return null
  },
})
