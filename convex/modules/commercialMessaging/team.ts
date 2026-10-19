import { COMMERCIAL_TEAM_MAX, commercialMandateValid } from "@antsia/social-domain/commercialContact"
import { v } from "convex/values"
import { makeFunctionReference } from "convex/server"

import { fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { counterpartOf } from "../messaging/participation"
import { liveSignatoryRole, signatoryRowsOf } from "../pages/access"
import { isStorefrontInReadingContext } from "../shops/access"
import { appendAudit } from "../platform/audit"
import { liveMandate, livingMember, mandateOf, requireContactManager } from "./access"

const rights = { canRead: v.boolean(), canReply: v.boolean(), canDecide: v.boolean(), canCall: v.boolean() }
const label = { personId: v.id("persons"), displayName: v.union(v.string(), v.null()), handle: v.union(v.string(), v.null()) }
const revalidateCalls = makeFunctionReference<"mutation", { cursor?: string }, number>("modules/commercialMessaging/retention:revalidateCalls")
export const list = networkQuery({
  args: { shopId: v.id("shops") },
  returns: v.object({ items: v.array(v.object({ ...label, ...rights, accepted: v.boolean(), revoked: v.boolean() })), candidates: v.array(v.object(label)), canManage: v.boolean(), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    const { shop, page } = await requireContactManager(ctx, ctx.networkId, ctx.person._id, args.shopId)
    const rows = await ctx.db.query("shopContactMandates").withIndex("by_shop_revoked", (q) => q.eq("shopId", shop._id).eq("revokedAt", undefined)).take(COMMERCIAL_TEAM_MAX + 1)
    const items = []
    for (const row of rows.slice(0, COMMERCIAL_TEAM_MAX)) {
      if (!await livingMember(ctx, shop.networkId, row.personId) || await liveSignatoryRole(ctx, page, row.personId) === null) continue
      const who = await counterpartOf(ctx, row.personId)
      items.push({ personId: row.personId, displayName: who.displayName, handle: who.handle, canRead: row.canRead, canReply: row.canReply, canDecide: row.canDecide, canCall: row.canCall, accepted: row.acceptedAt !== undefined, revoked: false })
    }
    const candidates = []
    for (const row of await signatoryRowsOf(ctx, page._id)) {
      if (!await livingMember(ctx, shop.networkId, row.personId) || await liveSignatoryRole(ctx, page, row.personId) === null) continue
      const who = await counterpartOf(ctx, row.personId)
      candidates.push({ personId: row.personId, displayName: who.displayName, handle: who.handle })
    }
    return { items, candidates, canManage: true, truncated: rows.length > COMMERCIAL_TEAM_MAX }
  },
})
export const grant = networkMutation({
  writeBucket: "commercial.team", args: { shopId: v.id("shops"), personId: v.id("persons"), ...rights }, returns: v.null(),
  handler: async (ctx, args) => {
    const { shop, page } = await requireContactManager(ctx, ctx.networkId, ctx.person._id, args.shopId)
    if (!commercialMandateValid(args)) return fail("invalidArgument", { field: "canRead" })
    if (!await livingMember(ctx, shop.networkId, args.personId) || await liveSignatoryRole(ctx, page, args.personId) === null) return notFound()
    const old = await mandateOf(ctx, shop._id, args.personId)
    if (!old || old.revokedAt !== undefined) {
      const active = await ctx.db.query("shopContactMandates").withIndex("by_shop_revoked", (q) => q.eq("shopId", shop._id).eq("revokedAt", undefined)).take(COMMERCIAL_TEAM_MAX)
      if (active.length >= COMMERCIAL_TEAM_MAX) return fail("invalidArgument", { field: "team" })
    }
    const now = Date.now()
    const fields = { networkId: shop.networkId, shopId: shop._id, personId: args.personId, canRead: args.canRead, canReply: args.canReply, canDecide: args.canDecide, canCall: args.canCall, revision: (old?.revision ?? 0) + 1, acceptedAt: args.personId === ctx.person._id ? now : undefined, revokedAt: undefined, updatedAt: now }
    if (old) await ctx.db.patch(old._id, fields)
    else await ctx.db.insert("shopContactMandates", { ...fields, createdAt: now })
    await appendAudit(ctx, { action: "commercial.mandate_grant", capacity: "page_admin", actorPersonId: ctx.person._id, networkId: shop.networkId, subject: { table: "persons", id: args.personId }, details: { revision: fields.revision, shopId: shop._id }, at: now })
    await ctx.scheduler.runAfter(0, revalidateCalls, {})
    return null
  },
})
export const accept = networkMutation({
  writeBucket: "commercial.team", args: { shopId: v.id("shops") }, returns: v.null(),
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId)
    const mandate = await mandateOf(ctx, args.shopId, ctx.person._id)
    const page = shop?.pageId ? await ctx.db.get(shop.pageId) : null
    if (!shop || !page || !mandate || mandate.revokedAt !== undefined || !await livingMember(ctx, shop.networkId, ctx.person._id) || !await isStorefrontInReadingContext(ctx, shop, ctx.network) || await liveSignatoryRole(ctx, page, ctx.person._id) === null) return notFound()
    if (mandate.acceptedAt === undefined) {
      const now = Date.now()
      await ctx.db.patch(mandate._id, { acceptedAt: now, updatedAt: now })
      await appendAudit(ctx, { action: "commercial.mandate_accept", capacity: "member", actorPersonId: ctx.person._id, networkId: shop.networkId, subject: { table: "persons", id: ctx.person._id }, details: { revision: mandate.revision, shopId: shop._id }, at: now })
    }
    return null
  },
})
export const revoke = networkMutation({
  writeBucket: "commercial.team", args: { shopId: v.id("shops"), personId: v.id("persons") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { shop } = await requireContactManager(ctx, ctx.networkId, ctx.person._id, args.shopId)
    const old = await mandateOf(ctx, args.shopId, args.personId)
    if (old && old.revokedAt === undefined) {
      const now = Date.now()
      await ctx.db.patch(old._id, { revokedAt: now, updatedAt: now, revision: old.revision + 1 })
      await appendAudit(ctx, { action: "commercial.mandate_revoke", capacity: "page_admin", actorPersonId: ctx.person._id, networkId: shop.networkId, subject: { table: "persons", id: args.personId }, details: { revision: old.revision + 1, shopId: shop._id }, at: now })
    }
    await ctx.scheduler.runAfter(0, revalidateCalls, {})
    return null
  },
})
export const myInvitations = networkQuery({
  args: {}, returns: v.object({ items: v.array(v.object({ shopId: v.id("shops"), shopName: v.string(), shopHandle: v.string(), ...rights })), truncated: v.boolean() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("shopContactMandates").withIndex("by_person_acceptance", (q) => q.eq("personId", ctx.person._id).eq("revokedAt", undefined).eq("acceptedAt", undefined)).take(51)
    const items = []
    for (const row of rows.slice(0, 50)) {
      if (row.acceptedAt !== undefined || row.revokedAt !== undefined) continue
      const shop = await ctx.db.get(row.shopId)
      const page = shop?.pageId ? await ctx.db.get(shop.pageId) : null
      if (!shop || !page || !await livingMember(ctx, shop.networkId, ctx.person._id) || !await isStorefrontInReadingContext(ctx, shop, ctx.network) || await liveSignatoryRole(ctx, page, ctx.person._id) === null) continue
      items.push({ shopId: shop._id, shopName: page.name, shopHandle: page.handle, canRead: row.canRead, canReply: row.canReply, canDecide: row.canDecide, canCall: row.canCall })
    }
    return { items, truncated: rows.length > 50 }
  },
})
export const myShops = networkQuery({
  args: {}, returns: v.object({ items: v.array(v.object({ shopId: v.id("shops"), shopName: v.string(), shopHandle: v.string(), ...rights })), truncated: v.boolean() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("shopContactMandates").withIndex("by_person_acceptance", (q) => q.eq("personId", ctx.person._id).eq("revokedAt", undefined).gt("acceptedAt", 0)).take(51)
    const items = []
    for (const row of rows.slice(0, 50)) {
      const shop = await ctx.db.get(row.shopId)
      const page = shop?.pageId ? await ctx.db.get(shop.pageId) : null
      if (!shop || !page || !await isStorefrontInReadingContext(ctx, shop, ctx.network) || !await liveMandate(ctx, shop, ctx.person._id, ctx.networkId)) continue
      items.push({ shopId: shop._id, shopName: page.name, shopHandle: page.handle, canRead: row.canRead, canReply: row.canReply, canDecide: row.canDecide, canCall: row.canCall })
    }
    return { items, truncated: rows.length > 50 }
  },
})
