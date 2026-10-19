// @vitest-environment edge-runtime
import { READ_NOTIFICATION_RETENTION_MS, UNREAD_NOTIFICATION_RETENTION_MS } from "@antsia/social-domain/notificationDelivery"
import { afterEach, describe, expect, it, vi } from "vitest"
import { internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

afterEach(() => vi.useRealTimers())
describe("rétention active de la cloche", () => {
  it("purge plusieurs lots et garde les frontières, les vieilles lignes lues récemment", async () => {
    vi.useFakeTimers(); const now = Date.UTC(2026, 9, 16); vi.setSystemTime(now)
    const t = testConvex(), { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    const personId = await t.run(async (ctx) => await ctx.db.insert("persons", { authUserId: "fixture", createdAt: now, updatedAt: now }))
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i += 1) {
        await ctx.db.insert("notifications", { networkId: root, recipientPersonId: personId, kind: "new_follower", dedupKey: `read-${i}`, createdAt: 0, readAt: now - READ_NOTIFICATION_RETENTION_MS - 1 })
        await ctx.db.insert("notifications", { networkId: root, recipientPersonId: personId, kind: "new_follower", dedupKey: `unread-${i}`, createdAt: now - UNREAD_NOTIFICATION_RETENTION_MS - 1 })
      }
      await ctx.db.insert("notifications", { networkId: root, recipientPersonId: personId, kind: "new_follower", dedupKey: "recent-read", createdAt: 0, readAt: now })
      await ctx.db.insert("notifications", { networkId: root, recipientPersonId: personId, kind: "new_follower", dedupKey: "read-boundary", createdAt: 0, readAt: now - READ_NOTIFICATION_RETENTION_MS })
      await ctx.db.insert("notifications", { networkId: root, recipientPersonId: personId, kind: "new_follower", dedupKey: "unread-boundary", createdAt: now - UNREAD_NOTIFICATION_RETENTION_MS })
    })
    expect(await t.mutation(internal.modules.notifications.retention.run, {})).toEqual({ dryRun: false })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await t.run(async (ctx) => await ctx.db.query("notifications").take(10))).map((row) => row.dedupKey).sort()).toEqual(["read-boundary", "recent-read", "unread-boundary"])
  })
  it("le mode à blanc doit être explicite", async () => {
    vi.useFakeTimers(); const now = Date.UTC(2026, 9, 16); vi.setSystemTime(now)
    const t = testConvex(), { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    await t.run(async (ctx) => { const recipientPersonId = await ctx.db.insert("persons", { authUserId: "fixture", createdAt: 0, updatedAt: 0 }); await ctx.db.insert("notifications", { networkId: root, recipientPersonId, kind: "new_follower", dedupKey: "old", createdAt: 0 }) })
    await t.mutation(internal.modules.notifications.retention.run, { dryRun: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run(async (ctx) => await ctx.db.query("notifications").take(10))).toHaveLength(1)
  })
})
