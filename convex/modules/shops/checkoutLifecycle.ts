/** P11 : invalidation locale immédiate ; la libération PRO reste une annulation best effort. */
import { COMMERCE_ENVIRONMENTS, type CommerceEnvironment } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_CHECKOUT_CONTROL_CONTRACT, COMMERCE_CHECKOUT_CONTROL_TTL_MS } from "@antsia/social-domain/commerce-checkout"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalAction, internalMutation, type MutationCtx } from "../../_generated/server"
import { literals } from "../../lib/validators"
import { sendCheckoutControl } from "./checkoutClient"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { randomLinkId } from "./commerceLinkCrypto"

export type CheckoutErasureRelease = {
  networkId: Id<"networks">; attemptId: string; configFingerprint: string; source: string; environment: CommerceEnvironment;
  shopRef: string; subjectRef: string; checkoutRef?: string; originalRequestId: string; originalRequestSha256: string; authorizedAt: number;
}
export const checkoutErasureReleaseValidator = v.object({ networkId: v.id("networks"), attemptId: v.string(), configFingerprint: v.string(), source: v.string(), environment: literals(COMMERCE_ENVIRONMENTS), shopRef: v.string(), subjectRef: v.string(), checkoutRef: v.optional(v.string()), originalRequestId: v.string(), originalRequestSha256: v.string(), authorizedAt: v.number() })

/** Cible de scheduler exclusivement interne : pas de session à réadopter et aucune
 * préparation. Un résultat initial inconnu sans checkoutRef reste soumis à l'expiration
 * garantie du hold PRO (15 min) : on ne fabrique pas une corrélation après effacement. */
export const releaseAfterErasure = internalAction({
  args: { release: checkoutErasureReleaseValidator }, returns: v.null(),
  handler: async (_ctx, { release }) => {
    if (!release.checkoutRef || !Number.isSafeInteger(release.authorizedAt) || release.authorizedAt > Date.now() || Date.now() - release.authorizedAt > 300_000) return null
    const config = await readCommerceLinkConfig()
    if (!config || config.fingerprint !== release.configFingerprint || config.source !== release.source || config.environment !== release.environment) return null
    const now = Date.now()
    await sendCheckoutControl(config, { contract: COMMERCE_CHECKOUT_CONTROL_CONTRACT, version: 1, operation: "release", source: config.source, environment: config.environment, requestId: randomLinkId(), shopRef: release.shopRef, subject: { kind: "buyer", ref: release.subjectRef, authVerifiedAt: release.authorizedAt }, issuedAt: now, expiresAt: now + COMMERCE_CHECKOUT_CONTROL_TTL_MS, payload: { checkoutRef: release.checkoutRef } })
    // Une réponse ou une panne n'annule jamais la révocation locale, ni ne retarde l'effacement.
    if ((await readCommerceLinkConfig())?.fingerprint !== release.configFingerprint) return null
    return null
  },
})

/** À appeler DÈS la demande d'effacement puis jusqu'à done. Le coordinateur met les
 * contrôles opaques dans sa file de libération avant la suppression définitive.
 * Aucun échec distant ne réautorise une tentative ; le hold PRO expire en 15 minutes. */
export async function revokeCheckoutsForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<{ done: boolean; releases: CheckoutErasureRelease[] }> {
  const authorizedAt = (await ctx.db.get(personId))?.deletionRequestedAt
  const attempts = await ctx.db.query("checkoutAttempts").withIndex("by_person_cancelled", (q) => q.eq("personId", personId).eq("cancelledAt", undefined)).take(26)
  const releases: CheckoutErasureRelease[] = []
  for (const row of attempts.slice(0, 25)) {
    // P12 : une demande de données ne devient pas un ordre d'annulation financière.
    // Même révoquée localement, une intention peut encore recevoir une preuve fournisseur.
    const payment = await ctx.db.query("shopPaymentAttempts").withIndex("by_person_checkout", q => q.eq("personId", row.personId).eq("networkId", row.networkId).eq("checkoutAttemptId", row.attemptId)).unique()
    if (!payment && authorizedAt !== undefined && row.blocksUntil > Date.now() && ["held", "reconfirm", "unknown"].includes(row.state)) releases.push({ networkId: row.networkId, attemptId: row.attemptId, configFingerprint: row.configFingerprint, source: row.source, environment: row.environment, shopRef: row.shopRef, subjectRef: row.subjectRef, ...(row.checkoutRef ? { checkoutRef: row.checkoutRef } : {}), originalRequestId: row.requestId, originalRequestSha256: row.bodySha256, authorizedAt })
    await ctx.db.patch(row._id, { cancelledAt: Date.now(), rawBody: undefined, leaseToken: undefined, leaseUntil: undefined, blocksUntil: 0, reason: "erasure_requested", updatedAt: Date.now() })
  }
  const requests = await ctx.db.query("checkoutRequests").withIndex("by_person_cancelled", (q) => q.eq("personId", personId).eq("cancelledAt", undefined)).take(26)
  for (const row of requests.slice(0, 25)) await ctx.db.patch(row._id, { cancelledAt: Date.now(), rawBody: undefined, options: undefined, leaseToken: undefined, leaseUntil: undefined })
  return { done: attempts.length <= 25 && requests.length <= 25, releases }
}

const continuation = makeFunctionReference<"mutation", Record<string, never>, null>("modules/shops/checkoutLifecycle:purgeExpired")
/** File bornée, indépendante de toute vitrine/source/session encore disponible. */
export const purgeExpired = internalMutation({
  args: {}, returns: v.null(), handler: async (ctx) => {
    const attempts = await ctx.db.query("checkoutAttempts").withIndex("by_purged_private_until", (q) => q.eq("privatePurgedAt", undefined).lte("privateUntil", Date.now())).take(26)
    for (const row of attempts.slice(0, 25)) await ctx.db.patch(row._id, { rawBody: undefined, leaseToken: undefined, leaseUntil: undefined, privatePurgedAt: Date.now() })
    const requests = await ctx.db.query("checkoutRequests").withIndex("by_purged_private_until", (q) => q.eq("privatePurgedAt", undefined).lte("privateUntil", Date.now())).take(26)
    for (const row of requests.slice(0, 25)) await ctx.db.patch(row._id, { rawBody: undefined, options: undefined, leaseToken: undefined, leaseUntil: undefined, privatePurgedAt: Date.now() })
    if (attempts.length > 25 || requests.length > 25) await ctx.scheduler.runAfter(0, continuation, {})
    return null
  },
})
