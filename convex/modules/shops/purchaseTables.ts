/** P13 : caches personnels ; aucun solde ni ordre de paiement local. */
import { COMMERCE_ENVIRONMENTS } from "@antsia/social-domain/commerce/primitives"
import { defineTable } from "convex/server"
import { v } from "convex/values"
import { literals } from "../../lib/validators"
import { purchaseActionStateValidator, purchaseOperationValidator, purchaseOrderValidator } from "./purchaseRules"

export const purchaseScopeFields = { networkId: v.id("networks"), personId: v.id("persons"), purchaseId: v.string(), checkoutAttemptId: v.string(), shopId: v.id("shops"), orderRef: v.string(), paymentRef: v.string(), checkoutRef: v.string(), shopRef: v.string(), subjectRef: v.string(), source: v.string(), environment: literals(COMMERCE_ENVIRONMENTS), sessionDigest: v.string(), configFingerprint: v.string() }
export const purchaseTables = {
  shopPurchaseSnapshots: defineTable({ ...purchaseScopeFields, order: purchaseOrderValidator, orderDigest: v.string(), observedAt: v.number(), privateUntil: v.number(), privatePurgedAt: v.optional(v.number()), privacyRevokedAt: v.optional(v.number()) })
    .index("by_purchase", ["personId", "networkId", "purchaseId"]).index("by_person_order", ["personId", "networkId", "orderRef"]).index("by_person_revoked", ["personId", "privacyRevokedAt"]).index("by_private_until", ["privatePurgedAt", "privateUntil"]),
  shopPurchaseRequests: defineTable({ ...purchaseScopeFields, requestId: v.string(), operation: purchaseOperationValidator, actionId: v.optional(v.string()), targetActionId: v.optional(v.string()), businessAction: v.boolean(), intentDigest: v.optional(v.string()), state: purchaseActionStateValidator,
    bodySha256: v.string(), rawBody: v.optional(v.string()), issuedAt: v.number(), expiresAt: v.number(), privateUntil: v.number(), privatePurgedAt: v.optional(v.number()), leaseToken: v.optional(v.string()), leaseUntil: v.optional(v.number()), generation: v.number(), lastLookupAt: v.optional(v.number()), lastLookupSessionDigest: v.optional(v.string()), lookupState: v.optional(literals(["accepted", "not_found"] as const)),
    reason: v.optional(v.string()), completedAt: v.optional(v.number()), privacyRevokedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_request", ["requestId"]).index("by_action", ["personId", "networkId", "purchaseId", "actionId"]).index("by_purchase", ["personId", "networkId", "purchaseId"]).index("by_purchase_actions", ["personId", "networkId", "purchaseId", "businessAction"]).index("by_person_revoked", ["personId", "privacyRevokedAt"]).index("by_private_until", ["privatePurgedAt", "privateUntil"]),
}
