import { v } from "convex/values"

import { networkMutation, networkQuery } from "../../lib/functions"
import { appendAudit } from "../platform/audit"
import { contactNetworkEnabled, contactSettings, requireContactManager } from "./access"

export const get = networkQuery({
  args: { shopId: v.id("shops") },
  returns: v.object({ shopId: v.id("shops"), acceptRequests: v.boolean(), networkEnabled: v.boolean(), canManage: v.boolean() }),
  handler: async (ctx, args) => {
    const { shop } = await requireContactManager(ctx, ctx.networkId, ctx.person._id, args.shopId)
    return { shopId: shop._id, acceptRequests: (await contactSettings(ctx, shop._id))?.acceptRequests === true, networkEnabled: await contactNetworkEnabled(ctx, ctx.networkId) && await contactNetworkEnabled(ctx, shop.networkId), canManage: true }
  },
})
export const setAcceptRequests = networkMutation({
  writeBucket: "commercial.manage",
  args: { shopId: v.id("shops"), acceptRequests: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const { shop } = await requireContactManager(ctx, ctx.networkId, ctx.person._id, args.shopId)
    const old = await contactSettings(ctx, shop._id)
    const fields = { networkId: shop.networkId, shopId: shop._id, acceptRequests: args.acceptRequests, updatedAt: Date.now(), updatedByPersonId: ctx.person._id }
    if (old) await ctx.db.patch(old._id, fields)
    else await ctx.db.insert("shopContactSettings", fields)
    await appendAudit(ctx, { action: "commercial.shop_settings_set", capacity: "page_admin", actorPersonId: ctx.person._id, networkId: shop.networkId, subject: { table: "shops", id: shop._id }, details: { acceptRequests: args.acceptRequests }, at: fields.updatedAt })
    return null
  },
})
