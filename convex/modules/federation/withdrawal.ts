/** Retrait source d’une page : purge bornée de ses copies, même après réactivation locale. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { markPostRemoved } from "../posts/contentRemoval"
import { clearFederatedMedia } from "./mediaJobs"

type WithdrawalArgs = { pageMirrorId: Id<"mirrors">; revision: number; cursor: string | null; withdrawnAt: number }
const continuation = makeFunctionReference<"mutation", WithdrawalArgs, null>("modules/federation/withdrawal:continuePageWithdrawal")

export async function queuePageWithdrawal(ctx: MutationCtx, pageMirrorId: Id<"mirrors">, revision: number, withdrawnAt: number): Promise<void> {
  await ctx.scheduler.runAfter(0, continuation, { pageMirrorId, revision, cursor: null, withdrawnAt })
}

export const continuePageWithdrawal = internalMutation({
  args: { pageMirrorId: v.id("mirrors"), revision: v.number(), cursor: v.union(v.string(), v.null()), withdrawnAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageMirrorId)
    if (!page || page.localTable !== "pages") return null
    const batch = await ctx.db.query("mirrors").withIndex("by_parent", (q) => q.eq("emitterId", page.emitterId).eq("environment", page.environment).eq("parentObjectRef", page.objectRef)).paginate({ cursor: args.cursor, numItems: 10, maximumRowsRead: 20, maximumBytesRead: 524_288 })
    for (const child of batch.page) {
      if (child.localTable !== "posts" || child.networkId !== page.networkId || child.contract !== page.contract || (child.parentSourceRevision ?? Number.MAX_SAFE_INTEGER) > args.revision) continue
      const id = child.localId ? ctx.db.normalizeId("posts", child.localId) : null
      const post = id ? await ctx.db.get(id) : null
      if (!post || post.federationSource?.emitterId !== page.emitterId || post.federationSource.objectRef !== child.objectRef) continue
      await clearFederatedMedia(ctx, child)
      await markPostRemoved(ctx, post, args.withdrawnAt)
      await ctx.db.patch(post._id, { body: "", tags: undefined, searchText: "", federationMedia: undefined, mentionedPersonIds: undefined })
    }
    if (!batch.isDone) await ctx.scheduler.runAfter(0, continuation, { ...args, cursor: batch.continueCursor })
    return null
  },
})
