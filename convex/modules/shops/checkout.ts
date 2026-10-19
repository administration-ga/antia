/** P11 : le contexte public reste P09 ; reçus et historique appartiennent au seul acheteur. */
import { COMMERCE_CHECKOUT_CONSENT_VERSION } from "@antsia/social-domain/commerce-checkout"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { v } from "convex/values"

import { networkMutation, networkQuery } from "../../lib/functions"
import { fail } from "../../lib/errors"
import { getActiveIdentity } from "../../lib/session"
import { findPageByHandle } from "../pages/access"
import { shopOfPage } from "./access"
import { catalogOfferByHandle } from "./catalogRead"
import { catalogOfferValidator } from "./catalogValidators"
import { checkoutCatalogAuthority, checkoutHasPayment } from "./checkoutFlow"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { sha256Hex } from "./commerceLinkCrypto"
import { CHECKOUT_LINES_MAX, cartContextValidator, checkoutAttemptValidator, checkoutIntentLookupValidator, checkoutStopIntentValidator, projectCheckoutAttempt, type CartContext } from "./checkoutRules"

const validAttempt = (id: string) => id.length >= 8 && id.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)

/** P13 : dix lignes d'une seule vitrine, sans prix ni consentement persistés dans le panier. */
export const cartContext = networkQuery({
  minStatus: "declaree", args: { handle: v.string(), items: v.array(v.object({ offerRef: v.string(), variantRef: v.optional(v.string()), quantity: v.number() })) }, returns: cartContextValidator,
  handler: async (ctx, args) => {
    if (args.handle.length > 100 || args.items.length < 1 || args.items.length > CHECKOUT_LINES_MAX || args.items.some((item) => item.offerRef.length > 200 || (item.variantRef?.length ?? 0) > 200 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) || new Set(args.items.map((item) => `${item.offerRef}|${item.variantRef ?? ""}`)).size !== args.items.length) return fail("invalidArgument", { field: "items" })
    const config = await readCommerceLinkConfig(), current = await checkoutCatalogAuthority(ctx, ctx.networkId, args.handle)
    const items: CartContext["items"] = []
    for (const item of args.items) {
      const offer = await catalogOfferByHandle(ctx, { root: ctx.rootNetwork, network: ctx.network, readerPersonId: ctx.person._id }, args.handle, item.offerRef)
      const selected = offer && (item.variantRef ? offer.variants.some((variant) => variant.variantRef === item.variantRef) : offer.variants.length === 0 && ["fixed", "unit"].includes(offer.price.mode))
      items.push({ offerRef: item.offerRef, variantRef: item.variantRef ?? null, quantity: item.quantity, offer, available: !!current && !!selected })
    }
    const page = await findPageByHandle(ctx, args.handle), shop = page ? await shopOfPage(ctx, page._id) : null
    const pending = shop ? await ctx.db.query("checkoutAttempts").withIndex("by_person_shop_blocks", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("shopId", shop._id).gt("blocksUntil", Date.now())).order("desc").first() : null
    const available = items.every((item) => item.available)
    return { items, available, reason: !config ? "configuration_missing" as const : !current ? "policy_closed" as const : !available ? "unavailable" as const : null, consentTextVersion: COMMERCE_CHECKOUT_CONSENT_VERSION, pending: pending && ctx.person.deletionRequestedAt === undefined ? projectCheckoutAttempt(pending, Date.now(), false) : null }
  },
})

/** Une erreur de lecture n'est jamais convertie en absence certaine. */
export const findByClientRequestId = networkQuery({
  minStatus: "declaree", args: { clientRequestId: v.string() }, returns: checkoutIntentLookupValidator,
  handler: async (ctx, args) => {
    if (!validAttempt(args.clientRequestId)) return fail("invalidArgument", { field: "clientRequestId" })
    if (ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return fail("notFound")
    const row = await ctx.db.query("checkoutAttempts").withIndex("by_client", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("clientRequestId", args.clientRequestId)).unique()
    if (row) return { outcome: "attempt" as const, attempt: projectCheckoutAttempt(row, Date.now(), false) }
    const fence = await ctx.db.query("checkoutClientIntentFences").withIndex("by_client", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("clientRequestId", args.clientRequestId)).unique()
    return fence ? { outcome: "stopped" as const } : { outcome: "absent" as const }
  },
})

/** Ferme seulement une clé dont aucun envoi PRO n'a été créé. L'insertion d'une
 * tentative et cette barrière sont sérialisées par le même index by_client. */
export const stopClientIntent = networkMutation({
  writeBucket: "checkout.intent.stop", args: { clientRequestId: v.string() }, returns: checkoutStopIntentValidator,
  handler: async (ctx, args) => {
    if (!validAttempt(args.clientRequestId)) return fail("invalidArgument", { field: "clientRequestId" })
    if (ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return fail("notFound")
    const attempt = await ctx.db.query("checkoutAttempts").withIndex("by_client", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("clientRequestId", args.clientRequestId)).unique()
    if (attempt) return { outcome: "attempt" as const, attempt: projectCheckoutAttempt(attempt, Date.now(), false) }
    const existing = await ctx.db.query("checkoutClientIntentFences").withIndex("by_client", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("clientRequestId", args.clientRequestId)).unique()
    if (!existing) await ctx.db.insert("checkoutClientIntentFences", { networkId: ctx.networkId, personId: ctx.person._id, clientRequestId: args.clientRequestId, stoppedAt: Date.now() })
    return { outcome: "stopped" as const }
  },
})

export const context = networkQuery({
  minStatus: "declaree", args: { handle: v.string(), offerRef: v.string() },
  returns: v.object({ offer: v.union(catalogOfferValidator, v.null()), available: v.boolean(), reason: v.union(v.literal("configuration_missing"), v.literal("policy_closed"), v.literal("unavailable"), v.null()), consentTextVersion: v.string(), pending: v.union(checkoutAttemptValidator, v.null()) }),
  handler: async (ctx, args) => {
    const config = await readCommerceLinkConfig()
    const offer = await catalogOfferByHandle(ctx, { root: ctx.rootNetwork, network: ctx.network, readerPersonId: ctx.person._id }, args.handle, args.offerRef)
    const current = await checkoutCatalogAuthority(ctx, ctx.networkId, args.handle)
    const page = await findPageByHandle(ctx, args.handle), shop = page ? await shopOfPage(ctx, page._id) : null
    const pending = shop ? await ctx.db.query("checkoutAttempts").withIndex("by_person_shop_blocks", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId).eq("shopId", shop._id).gt("blocksUntil", Date.now())).order("desc").first() : null
    const payment = pending ? await checkoutHasPayment(ctx, pending) : false
    const available = !!current && !!offer && (["fixed", "unit"].includes(offer.price.mode) || offer.variants.length > 0)
    return { offer, available, reason: !config ? "configuration_missing" as const : !current ? "policy_closed" as const : !available ? "unavailable" as const : null, consentTextVersion: COMMERCE_CHECKOUT_CONSENT_VERSION,
      pending: pending && ctx.person.deletionRequestedAt === undefined ? projectCheckoutAttempt(pending, Date.now(), !!current && current.sessionDigest === pending.sessionDigest && !payment) : null }
  },
})

export const getAttempt = networkQuery({
  minStatus: "declaree", args: { attemptId: v.string() }, returns: v.union(checkoutAttemptValidator, v.null()),
  handler: async (ctx, args) => {
    if (!validAttempt(args.attemptId) || ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return null
    const row = await ctx.db.query("checkoutAttempts").withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId)).unique()
    if (!row || row.networkId !== ctx.networkId || row.personId !== ctx.person._id || row.cancelledAt) return null
    const identity = await getActiveIdentity(ctx), config = await readCommerceLinkConfig()
    const sameSession = !!identity && typeof identity.sessionId === "string" && await sha256Hex(identity.sessionId) === row.sessionDigest && config?.fingerprint === row.configFingerprint
    const result = projectCheckoutAttempt(row, Date.now(), sameSession)
    const current = await checkoutCatalogAuthority(ctx, ctx.networkId, row.handle)
    const payment = await checkoutHasPayment(ctx, row)
    return { ...result, canRetry: result.canRetry && !!current && !payment, canReconfirm: result.canReconfirm && !!current && !payment, canRelease: result.canRelease && !payment }
  },
})

export const listMy = networkQuery({
  minStatus: "declaree", args: { paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(checkoutAttemptValidator),
  handler: async (ctx, args) => {
    if (ctx.person.deletionRequestedAt !== undefined || ctx.person.erasedAt !== undefined) return { page: [], isDone: true, continueCursor: "" }
    const result = await ctx.db.query("checkoutAttempts").withIndex("by_person_network", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(12, Math.floor(args.paginationOpts.numItems))), maximumRowsRead: 24, maximumBytesRead: 512 * 1024 })
    // L'historique ne déclenche aucun contrôle ; le détail rejuge les possibilités d'action.
    return { ...result, page: result.page.filter((row) => !row.cancelledAt).map((row) => projectCheckoutAttempt(row, Date.now(), false)) }
  },
})
