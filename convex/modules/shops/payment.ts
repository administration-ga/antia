/** P12 : aucune lecture privée ne démarre de paiement ou de requête fournisseur. */
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { v } from "convex/values"
import { networkQuery } from "../../lib/functions"
import { ownedPaymentAttempt, ownedPaymentCheckout, paymentAuthority, paymentPolicyOpen } from "./paymentAccess"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { PAYMENT_CONSENT_VERSION, paymentAttemptValidator, paymentContextValidator, projectPaymentAttempt, type PaymentContext } from "./paymentRules"

export const context = networkQuery({
  minStatus: "declaree", args: { checkoutAttemptId: v.string() }, returns: v.union(paymentContextValidator, v.null()),
  handler: async (ctx, args): Promise<PaymentContext | null> => {
    const checkout = await ownedPaymentCheckout(ctx, ctx.networkId, ctx.person._id, args.checkoutAttemptId)
    if (!checkout || ctx.person.deletionRequestedAt !== undefined) return null
    const config = await readCommerceLinkConfig()
    const current = await paymentAuthority(ctx, ctx.networkId, args.checkoutAttemptId, false)
    const existing = await ctx.db.query("shopPaymentAttempts").withIndex("by_person_checkout", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("checkoutAttemptId", args.checkoutAttemptId)).unique()
    const cached = await ctx.db.query("shopPaymentOptions").withIndex("by_person_checkout", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("checkoutAttemptId", args.checkoutAttemptId)).unique()
    const policyOpen = await paymentPolicyOpen(ctx, ctx.networkId)
    const fresh = !!current && !!cached && cached.sessionDigest === current.scope.sessionDigest && cached.configFingerprint === current.config.fingerprint && cached.validUntil > Date.now()
    const options = fresh ? cached.options : null
    const canStart = policyOpen && checkout.state === "held" && (checkout.result?.expiresAt ?? 0) > Date.now() && !!await paymentAuthority(ctx, ctx.networkId, args.checkoutAttemptId, true)
    const reason: PaymentContext["reason"] = !config || config.environment !== "sandbox" ? "configuration_missing" : !policyOpen ? "policy_closed" : !canStart ? "checkout_unavailable" : !options ? "refresh_required" : options.reason
    return { checkoutAttemptId: args.checkoutAttemptId, available: canStart && options?.available === true && options.readinessRef !== null && (options.readinessExpiresAt ?? 0) > Date.now(), reason,
      amount: checkout.result?.total ?? null, expiresAt: checkout.result?.expiresAt ?? null, providerLabel: options?.providerLabel ?? null, beneficiaryLabel: options?.beneficiaryLabel ?? null, modes: options?.modes ?? [], consentTextVersion: PAYMENT_CONSENT_VERSION,
      readinessRef: options?.readinessRef ?? null, readinessExpiresAt: options?.readinessExpiresAt ?? null, existing: existing && existing.privacyRevokedAt === undefined ? projectPaymentAttempt(existing, !!current) : null }
  },
})

export const getAttempt = networkQuery({
  minStatus: "declaree", args: { paymentAttemptId: v.string() }, returns: v.union(paymentAttemptValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ownedPaymentAttempt(ctx, ctx.networkId, ctx.person._id, args.paymentAttemptId)
    if (!row || ctx.person.deletionRequestedAt !== undefined) return null
    const authority = await paymentAuthority(ctx, ctx.networkId, row.checkoutAttemptId, false)
    const dto = projectPaymentAttempt(row, !!authority)
    return { ...dto, canRetry: dto.canRetry && authority?.scope.sessionDigest === row.sessionDigest && !!await paymentAuthority(ctx, ctx.networkId, row.checkoutAttemptId, true) }
  },
})
export const listMy = networkQuery({
  minStatus: "declaree", args: { paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(paymentAttemptValidator),
  handler: async (ctx, args) => {
    const window = await ctx.db.query("shopPaymentAttempts").withIndex("by_person_network", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(20, args.paginationOpts.numItems)), maximumRowsRead: 40, maximumBytesRead: 256 * 1024 })
    return { ...window, page: window.page.filter((row) => row.privacyRevokedAt === undefined && ctx.person.deletionRequestedAt === undefined).map((row) => projectPaymentAttempt(row)) }
  },
})
