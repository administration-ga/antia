// Dupliqué de socle/convex/crons/notificationsRetention.ts @ 25398f565 — adaptations : cloche sociale seulement ; purge ACTIVE par défaut, index readAt, jamais lue à 365 jours ; chaîne bornée et nettoyage des files sans contenu.
import { DELIVERY_RETENTION_MS, READ_NOTIFICATION_RETENTION_MS, UNREAD_NOTIFICATION_RETENTION_MS, WEEK_MS } from "@antsia/social-domain/notificationDelivery"
import { v } from "convex/values"
import { internal } from "../../_generated/api"
import { internalMutation } from "../../_generated/server"

const PAGE_SIZE = 100
export const run = internalMutation({ args: { dryRun: v.optional(v.boolean()) }, handler: async (ctx, args): Promise<{ dryRun: boolean }> => {
  const dryRun = args.dryRun === true
  await ctx.scheduler.runAfter(0, internal.modules.notifications.retention.purge, { pass: "read", now: Date.now(), dryRun, cursor: null })
  return { dryRun }
} })

export const purge = internalMutation({
  args: { pass: v.union(v.literal("read"), v.literal("unread"), v.literal("jobs"), v.literal("digests"), v.literal("usage")), now: v.number(), dryRun: v.boolean(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<{ deleted: number; done: boolean }> => {
    const options = { cursor: args.cursor, numItems: PAGE_SIZE }
    let deleted = 0, done = true, cursor = ""
    if (args.pass === "read" || args.pass === "unread") {
      const page = args.pass === "read"
        ? await ctx.db.query("notifications").withIndex("by_readAt_createdAt", (q) => q.gte("readAt", 0).lt("readAt", args.now - READ_NOTIFICATION_RETENTION_MS)).paginate(options)
        : await ctx.db.query("notifications").withIndex("by_readAt_createdAt", (q) => q.eq("readAt", undefined).lt("createdAt", args.now - UNREAD_NOTIFICATION_RETENTION_MS)).paginate(options)
      for (const row of page.page) if (!args.dryRun) { await ctx.db.delete(row._id); deleted += 1 }
      done = page.isDone; cursor = page.continueCursor
    } else if (args.pass === "jobs") {
      const page = await ctx.db.query("notificationDeliveryJobs").withIndex("by_createdAt", (q) => q.lt("createdAt", args.now - DELIVERY_RETENTION_MS)).paginate(options)
      for (const row of page.page) if (!args.dryRun) { await ctx.db.delete(row._id); deleted += 1 }
      done = page.isDone; cursor = page.continueCursor
    } else if (args.pass === "digests") {
      const page = await ctx.db.query("notificationDigestReceipts").withIndex("by_createdAt", (q) => q.lt("createdAt", args.now - DELIVERY_RETENTION_MS)).paginate(options)
      for (const row of page.page) if (!args.dryRun) { await ctx.db.delete(row._id); deleted += 1 }
      done = page.isDone; cursor = page.continueCursor
    } else {
      const page = await ctx.db.query("notificationWeeklyUsage").withIndex("by_week", (q) => q.lt("weekStart", args.now - 4 * WEEK_MS)).paginate(options)
      for (const row of page.page) if (!args.dryRun) { await ctx.db.delete(row._id); deleted += 1 }
      done = page.isDone; cursor = page.continueCursor
    }
    const passes = ["read", "unread", "jobs", "digests", "usage"] as const
    const next = passes[passes.indexOf(args.pass) + 1]
    if (!done) await ctx.scheduler.runAfter(0, internal.modules.notifications.retention.purge, { ...args, cursor })
    else if (next) await ctx.scheduler.runAfter(0, internal.modules.notifications.retention.purge, { ...args, pass: next, cursor: null })
    return { deleted, done }
  },
})
