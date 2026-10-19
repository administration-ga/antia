/** P13 : purge bornée sans ordre financier ni effet distant d'effacement. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"

export async function revokePurchaseDataForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<boolean> {
  const snapshots = await ctx.db.query("shopPurchaseSnapshots").withIndex("by_person_revoked", (q) => q.eq("personId", personId).eq("privacyRevokedAt", undefined)).take(26)
  for (const row of snapshots.slice(0, 25)) await ctx.db.patch(row._id, { privacyRevokedAt: Date.now(), order: { ...row.order, messages: [], messagesTruncated: row.order.messagesTruncated || row.order.messages.length > 0 }, privateUntil: Date.now(), privatePurgedAt: Date.now() })
  const requests = await ctx.db.query("shopPurchaseRequests").withIndex("by_person_revoked", (q) => q.eq("personId", personId).eq("privacyRevokedAt", undefined)).take(26)
  for (const row of requests.slice(0, 25)) await ctx.db.patch(row._id, { privacyRevokedAt: Date.now(), rawBody: undefined, leaseToken: undefined, leaseUntil: undefined, generation: row.generation + 1, privateUntil: Date.now(), privatePurgedAt: Date.now(), updatedAt: Date.now() })
  return snapshots.length <= 25 && requests.length <= 25
}
const continuation = makeFunctionReference<"mutation", Record<string, never>, null>("modules/shops/purchaseLifecycle:purgeExpired")
export const purgeExpired = internalMutation({
  args: {}, returns: v.null(), handler: async (ctx) => {
    const snapshots = await ctx.db.query("shopPurchaseSnapshots").withIndex("by_private_until", (q) => q.eq("privatePurgedAt", undefined).lte("privateUntil", Date.now())).take(26)
    for (const row of snapshots.slice(0, 25)) await ctx.db.patch(row._id, { order: { ...row.order, messages: [], messagesTruncated: row.order.messagesTruncated || row.order.messages.length > 0 }, privatePurgedAt: Date.now() })
    const requests = await ctx.db.query("shopPurchaseRequests").withIndex("by_private_until", (q) => q.eq("privatePurgedAt", undefined).lte("privateUntil", Date.now())).take(26)
    for (const row of requests.slice(0, 25)) await ctx.db.patch(row._id, { rawBody: undefined, leaseToken: undefined, leaseUntil: undefined, privatePurgedAt: Date.now(), generation: row.generation + 1 })
    if (snapshots.length > 25 || requests.length > 25) await ctx.scheduler.runAfter(0, continuation, {})
    return null
  },
})
