/** P09 : rattachement volontaire d'une référence d'offre aux publications natives de sa page. */
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { v } from "convex/values"

import { notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { appendAudit } from "../platform/audit"
import { canSeePostDoc } from "../posts/access"
import { schedulePostFeed } from "../posts/feedMaterialization"
import { hasNativePostAuthor } from "../posts/nativeAuthor"
import { requireManagedShop } from "./access"
import { resolveCatalogOffer } from "./catalogRead"

const eligiblePostValidator = v.object({ postId: v.id("posts"), body: v.string(), publishedAt: v.number(), offerRef: v.union(v.string(), v.null()) })

export const eligiblePosts = networkQuery({
  args: { shopId: v.id("shops"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(eligiblePostValidator),
  handler: async (ctx, args) => {
    const managed = await requireManagedShop(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.shopId)
    if (!managed.page) return notFound()
    const result = await ctx.db.query("posts")
      .withIndex("by_network_page_status_publishedAt", (q) => q.eq("networkId", ctx.networkId).eq("pageId", managed.page!._id).eq("status", "published"))
      .order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(10, args.paginationOpts.numItems)) })
    const page = []
    for (const post of result.page) {
      if (!hasNativePostAuthor(post) || post.sharedPostId || !await canSeePostDoc(ctx, { network: ctx.network, personId: ctx.person._id }, post)) continue
      page.push({ postId: post._id, body: post.body, publishedAt: post.publishedAt, offerRef: post.commerceOffer?.shopId === args.shopId ? post.commerceOffer.offerRef : null })
    }
    return { ...result, page }
  },
})

export const setPostOffer = networkMutation({
  args: { shopId: v.id("shops"), postId: v.id("posts"), offerRef: v.union(v.string(), v.null()) },
  returns: v.object({ changed: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "catalog.post.link", ctx.person._id)
    const managed = await requireManagedShop(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.shopId)
    const post = await ctx.db.get(args.postId)
    if (!managed.page || !post || post.pageId !== managed.page._id || post.networkId !== ctx.networkId ||
      post.status !== "published" || post.sharedPostId || !hasNativePostAuthor(post) ||
      !await canSeePostDoc(ctx, { network: ctx.network, personId: ctx.person._id }, post)) return notFound()
    if (args.offerRef !== null) {
      if (args.offerRef.length > 200) return notFound()
      if (!await resolveCatalogOffer(ctx, { root: ctx.rootNetwork, readerPersonId: ctx.person._id, network: ctx.network }, args.shopId, args.offerRef)) return notFound()
    }
    await ctx.db.patch(post._id, { commerceOffer: args.offerRef === null ? undefined : { shopId: args.shopId, offerRef: args.offerRef } })
    await schedulePostFeed(ctx, post._id)
    await appendAudit(ctx, { action: "page.post_edit", capacity: "page_admin", actorPersonId: ctx.person._id,
      networkId: ctx.networkId, subject: { table: "posts", id: post._id }, details: { commerceOfferLinked: args.offerRef !== null } })
    return { changed: true as const }
  },
})
