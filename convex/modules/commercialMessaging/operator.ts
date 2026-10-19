/** P10 : ouverture du canal par réseau, décision administrative tracée. */
import { assertDecisionReason } from "@antsia/social-domain/audit"
import { v } from "convex/values"
import { operatorMutation, operatorQuery } from "../../lib/functions"
import { checked, notFound } from "../../lib/errors"
import { requirePlatformAdmin } from "../../lib/operatorIdentity"
import { enforceRateLimit } from "../../lib/rateLimit"
import { appendAudit, operatorCapacity } from "../platform/audit"

export const policy = operatorQuery({
  args: { networkId: v.id("networks") }, returns: v.object({ enabled: v.boolean() }),
  handler: async (ctx, args) => ({ enabled: (await ctx.db.query("commercialNetworkPolicies").withIndex("by_network", (q) => q.eq("networkId", args.networkId)).unique())?.enabled === true }),
})
export const setPolicy = operatorMutation({
  args: { networkId: v.id("networks"), enabled: v.boolean(), reason: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    requirePlatformAdmin(ctx)
    await enforceRateLimit(ctx, "shop.decide", ctx.person._id)
    const reason = checked(() => assertDecisionReason(args.reason, 10))
    const network = await ctx.db.get(args.networkId)
    if (network?.status !== "active") return notFound()
    const row = await ctx.db.query("commercialNetworkPolicies").withIndex("by_network", (q) => q.eq("networkId", args.networkId)).unique()
    if (row?.enabled === args.enabled) return null
    const fields = { networkId: args.networkId, enabled: args.enabled, updatedAt: Date.now(), updatedByPersonId: ctx.person._id }
    if (row) await ctx.db.patch(row._id, fields)
    else await ctx.db.insert("commercialNetworkPolicies", fields)
    await appendAudit(ctx, { action: "commercial.policy_set", capacity: operatorCapacity(ctx.operator), actorPersonId: ctx.person._id, networkId: args.networkId, subject: { table: "networks", id: args.networkId }, details: { reason, enabled: args.enabled } })
    return null
  },
})
