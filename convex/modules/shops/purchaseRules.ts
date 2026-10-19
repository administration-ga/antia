/** P13 : projections privées de PRO, sans seconde comptabilité. */
import { COMMERCE_ORDER_STATES, COMMERCE_PAYMENT_STATES } from "@antsia/social-domain/commerce/lifecycle"
import { COMMERCE_PAYMENT_REFUND_STATES, COMMERCE_PAYMENT_STOCK_STATES } from "@antsia/social-domain/commerce-payment"
import { COMMERCE_ORDER_CONTROL_OPERATIONS } from "@antsia/social-domain/commerce-orders"
import { type Infer, v } from "convex/values"
import { literals } from "../../lib/validators"
import { checkoutMoneyValidator } from "./checkoutRules"

export const PURCHASE_PRIVATE_TTL_MS = 30 * 60_000
export const PURCHASE_FRESH_MS = 5 * 60_000
export const PURCHASE_LEASE_MS = 30_000
export const purchaseOperationValidator = literals(COMMERCE_ORDER_CONTROL_OPERATIONS)
export const purchaseActionStateValidator = literals(["accepted", "unknown", "refused", "not_found"] as const)
export const purchaseOrderValidator = v.object({
  orderRef: v.string(), checkoutRef: v.string(), paymentRef: v.string(), shopRef: v.string(), reference: v.string(), sellerLabel: v.union(v.string(), v.null()), createdAt: v.number(), updatedAt: v.number(), revision: v.number(), paymentRevision: v.number(),
  lines: v.array(v.object({ offerRef: v.string(), variantRef: v.union(v.string(), v.null()), label: v.string(), quantity: v.number(), unitAmount: checkoutMoneyValidator, lineAmount: checkoutMoneyValidator })),
  fees: v.array(v.object({ label: v.string(), amount: checkoutMoneyValidator })), amount: checkoutMoneyValidator,
  orderState: literals(COMMERCE_ORDER_STATES), paymentState: literals(COMMERCE_PAYMENT_STATES), stockState: literals(COMMERCE_PAYMENT_STOCK_STATES), refundState: literals(COMMERCE_PAYMENT_REFUND_STATES), reviewRequired: v.boolean(),
  fulfillment: v.object({ mode: literals(["pickup", "seller_delivery", "unknown"] as const), state: literals(["preparing", "ready", "shipped", "delivered", "received", "unknown"] as const), locality: v.union(v.string(), v.null()), leadTimeDays: v.union(v.number(), v.null()) }),
  receipt: v.union(v.object({ confirmationRef: v.string(), confirmedAt: v.number() }), v.null()),
  settlementState: literals(["withheld", "eligible", "paid", "refund", "unknown"] as const), cancellationState: literals(["none", "requested", "accepted", "rejected"] as const), returnState: literals(["none", "requested", "resolved", "rejected"] as const),
  history: v.array(v.object({ status: literals(COMMERCE_ORDER_STATES), at: v.number() })), historyTruncated: v.boolean(), messages: v.array(v.object({ messageRef: v.string(), side: literals(["buyer", "seller"] as const), text: v.string(), createdAt: v.number() })), messagesTruncated: v.boolean(),
  capabilities: v.object({ canCancel: v.boolean(), canConfirmReceipt: v.boolean(), canRequestReturn: v.boolean(), canMessage: v.boolean(), canRequestRefund: v.boolean() }), consentTextVersion: v.string(),
})
export const purchasePendingActionValidator = v.object({ actionId: v.string(), operation: purchaseOperationValidator, state: purchaseActionStateValidator, reason: v.union(v.string(), v.null()), createdAt: v.number(), canRetry: v.boolean() })
export type PurchaseAction = Infer<typeof purchasePendingActionValidator>
export const purchaseValidator = v.object({ purchaseId: v.string(), paymentAttemptId: v.string(), checkoutAttemptId: v.string(), handle: v.string(), orderRef: v.string(), order: v.union(purchaseOrderValidator, v.null()), observedAt: v.union(v.number(), v.null()), stale: v.boolean(), available: v.boolean(), pendingActions: v.array(purchasePendingActionValidator) })
export type Purchase = Infer<typeof purchaseValidator>
export const purchaseActionResultValidator = v.union(v.object({ outcome: v.literal("purchase"), purchaseId: v.string(), action: v.union(v.object({ actionId: v.string(), state: purchaseActionStateValidator }), v.null()) }), v.object({ outcome: literals(["unavailable", "refused"] as const) }))
export type PurchaseActionResult = Infer<typeof purchaseActionResultValidator>
