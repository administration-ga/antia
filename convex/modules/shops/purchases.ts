/** P13 : historique du seul acheteur, y compris après retrait de la vitrine. */
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { networkQuery } from "../../lib/functions"
import { ownedPaymentAttempt } from "./paymentAccess"
import { purchaseAuthority } from "./purchaseAccess"
import { PURCHASE_FRESH_MS, purchaseValidator, type Purchase } from "./purchaseRules"

async function project(ctx: QueryCtx, networkId: Id<"networks">, personId: Id<"persons">, payment: Doc<"shopPaymentAttempts">): Promise<Purchase | null> {
  const orderRef = payment.orderRef ?? payment.snapshot?.orderRef
  if (!orderRef || payment.personId !== personId || payment.networkId !== networkId || payment.privacyRevokedAt !== undefined) return null
  const cached = await ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", personId).eq("networkId", networkId).eq("purchaseId", payment.paymentAttemptId)).unique()
  const valid = cached && cached.privacyRevokedAt === undefined && cached.orderRef === orderRef && cached.checkoutRef === payment.checkoutRef && cached.paymentRef === (payment.paymentRef ?? payment.snapshot?.paymentRef) && cached.subjectRef === payment.subjectRef && cached.shopRef === payment.shopRef && cached.source === payment.source && cached.environment === payment.environment
  const order = valid ? cached.privateUntil <= Date.now() ? { ...cached.order, messages: [], messagesTruncated: cached.order.messagesTruncated || cached.order.messages.length > 0 } : cached.order : null
  const actions = await ctx.db.query("shopPurchaseRequests").withIndex("by_purchase_actions", (q) => q.eq("personId", personId).eq("networkId", networkId).eq("purchaseId", payment.paymentAttemptId).eq("businessAction", true)).order("desc").take(5)
  return { purchaseId: payment.paymentAttemptId, paymentAttemptId: payment.paymentAttemptId, checkoutAttemptId: payment.checkoutAttemptId, handle: payment.handle, orderRef, order, observedAt: valid ? cached.observedAt : null, stale: !valid || Date.now() - cached.observedAt > PURCHASE_FRESH_MS,
    available: !!await purchaseAuthority(ctx, networkId, payment.paymentAttemptId), pendingActions: actions.filter((row) => row.privacyRevokedAt === undefined && !!row.actionId).map((row) => ({ actionId: row.actionId!, operation: row.operation, state: row.state, reason: row.reason ?? null, createdAt: row.createdAt, canRetry: (row.state === "unknown" || row.state === "not_found") && row.rawBody !== undefined && row.privateUntil > Date.now() && (row.leaseUntil ?? 0) <= Date.now() })) }
}
export const get = networkQuery({
  minStatus: "declaree", args: { purchaseId: v.string() }, returns: v.union(purchaseValidator, v.null()),
  handler: async (ctx, args) => {
    if (ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return null
    const payment = await ownedPaymentAttempt(ctx, ctx.networkId, ctx.person._id, args.purchaseId)
    return payment ? await project(ctx, ctx.networkId, ctx.person._id, payment) : null
  },
})
export const listMy = networkQuery({
  minStatus: "declaree", args: { paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(purchaseValidator),
  handler: async (ctx, args) => {
    if (ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return { page: [], continueCursor: "", isDone: true }
    const window = await ctx.db.query("shopPaymentAttempts").withIndex("by_person_network", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(12, args.paginationOpts.numItems)), maximumRowsRead: 24, maximumBytesRead: 512 * 1024 })
    const page: Purchase[] = []
    for (const payment of window.page) { const item = await project(ctx, ctx.networkId, ctx.person._id, payment); if (item) page.push(item) }
    return { ...window, page }
  },
})
