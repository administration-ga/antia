/** P13 : l'engagement privé, pas la présence publique actuelle du vendeur, donne le droit. */
import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { paymentAuthority, ownedPaymentAttempt } from "./paymentAccess"
import type { Infer } from "convex/values"
import { v } from "convex/values"
import { purchaseScopeFields } from "./purchaseTables"

export const purchaseScopeValidator = v.object(purchaseScopeFields)
export type PurchaseScope = Infer<typeof purchaseScopeValidator>
export async function purchaseAuthority(ctx: QueryCtx, networkId: Id<"networks">, purchaseId: string) {
  const access = await paymentAuthorityForId(ctx, networkId, purchaseId)
  if (!access) return null
  const { current, payment, orderRef, paymentRef } = access
  const s = current.scope
  const scope: PurchaseScope = { networkId, personId: s.personId, purchaseId, checkoutAttemptId: s.checkoutAttemptId, shopId: s.shopId, checkoutRef: s.checkoutRef, shopRef: s.shopRef, subjectRef: s.subjectRef, source: s.source, environment: s.environment, sessionDigest: s.sessionDigest, configFingerprint: s.configFingerprint, orderRef, paymentRef }
  return { ...access, scope, config: current.config }
}

async function paymentAuthorityForId(ctx: QueryCtx, networkId: Id<"networks">, purchaseId: string) {
  // Le constructeur public ou la mutation interne a déjà borné le réseau ; paymentAuthority le relit.
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const payment = await ctx.db.query("shopPaymentAttempts").withIndex("by_attempt", (q) => q.eq("paymentAttemptId", purchaseId)).unique()
  if (!payment || payment.networkId !== networkId) return null
  const current = await paymentAuthority(ctx, networkId, payment.checkoutAttemptId, false)
  if (!current || !await ownedPaymentAttempt(ctx, networkId, current.access.person._id, purchaseId)) return null
  const orderRef = payment.orderRef ?? payment.snapshot?.orderRef, paymentRef = payment.paymentRef ?? payment.snapshot?.paymentRef
  if (!orderRef || !paymentRef || payment.orderRef && payment.snapshot?.orderRef && payment.orderRef !== payment.snapshot.orderRef || payment.paymentRef && payment.snapshot?.paymentRef && payment.paymentRef !== payment.snapshot.paymentRef) return null
  if (payment.personId !== current.scope.personId || payment.shopId !== current.scope.shopId || payment.shopRef !== current.scope.shopRef || payment.subjectRef !== current.scope.subjectRef || payment.checkoutRef !== current.scope.checkoutRef || payment.source !== current.scope.source || payment.environment !== current.scope.environment) return null
  return { current, payment, orderRef, paymentRef }
}

export function samePurchaseScope(left: PurchaseScope, right: PurchaseScope): boolean {
  return left.networkId === right.networkId && left.personId === right.personId && left.purchaseId === right.purchaseId && left.checkoutAttemptId === right.checkoutAttemptId && left.shopId === right.shopId && left.orderRef === right.orderRef && left.paymentRef === right.paymentRef && left.checkoutRef === right.checkoutRef && left.shopRef === right.shopRef && left.subjectRef === right.subjectRef && left.source === right.source && left.environment === right.environment && left.sessionDigest === right.sessionDigest && left.configFingerprint === right.configFingerprint
}
