// @vitest-environment edge-runtime
/** Lot 17 — les crons poursuivent un lot plein, gardent le vivant et terminent. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { internal } from "../_generated/api"
import { SEED_CONFIRMATION } from "../seeds/foundations"
import { testConvex } from "../test.setup"

const NOW = Date.UTC(2026, 9, 16, 12)
const OLD = NOW - 200 * 24 * 60 * 60_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("maintenance — chaînes bornées", () => {
  it.each(["personal", "group"] as const)("saisie %s : 500 puis la suite, signaux actifs et échéance exacte conservés", async (kind) => {
    const t = testConvex()
    const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    await t.run(async (ctx) => {
      const creator = await ctx.db.insert("persons", { authUserId: "cron-owner", createdAt: NOW, updatedAt: NOW })
      const personal = await ctx.db.insert("personalThreads", { networkId: root, personLow: creator, personHigh: creator, initiatedByPersonId: creator, status: "active", createdAt: NOW })
      const group = await ctx.db.insert("groupThreads", { networkId: testClosed, title: "Cron", createdByPersonId: creator, idempotencyKey: "cron", createdAt: NOW })
      for (let index = 0; index < 503; index += 1) {
        const personId = await ctx.db.insert("persons", { authUserId: `cron-${index}`, createdAt: NOW, updatedAt: NOW })
        const expiresAt = index < 501 ? NOW - 1 : index === 501 ? NOW : NOW + 60_000
        if (kind === "personal") await ctx.db.insert("personalTyping", { threadId: personal, personId, expiresAt })
        else await ctx.db.insert("groupTyping", { threadId: group, personId, expiresAt })
      }
    })
    const cron = kind === "personal" ? internal.modules.messaging.typing.purgeExpiredTyping : internal.modules.groups.typing.purgeExpiredGroupTyping
    const rows = () => t.run((ctx) => ctx.db.query(kind === "personal" ? "personalTyping" : "groupTyping").take(504))
    expect(await t.mutation(cron, {})).toEqual({ purged: 500 })
    expect(await rows()).toHaveLength(3)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await rows()).map((row) => row.expiresAt).sort()).toEqual([NOW, NOW + 60_000])
    expect(await t.mutation(cron, {})).toEqual({ purged: 0 })
  })

  it("analyses perdues : 50 par état puis la suite, plafond de tentatives et analyses fraîches conservés", async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      for (const status of ["pending", "running"] as const) {
        for (let index = 0; index < 51; index += 1) {
          const storageId = await ctx.storage.store(new Blob([`${status}-${index}`]))
          await ctx.db.insert("fileScans", { storageId, status, source: "message", attempts: 3, createdAt: OLD, updatedAt: OLD })
        }
        const storageId = await ctx.storage.store(new Blob([`${status}-fresh`]))
        await ctx.db.insert("fileScans", { storageId, status, source: "message", attempts: 3, createdAt: NOW, updatedAt: NOW })
      }
    })
    expect(await t.mutation(internal.modules.files.mutations.retryStale, {})).toBe(100)
    expect(await t.run((ctx) => ctx.db.query("fileScans").withIndex("by_status_updatedAt", (q) => q.eq("status", "error")).take(105))).toHaveLength(100)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const rows = await t.run((ctx) => ctx.db.query("fileScans").take(105))
    expect(rows.filter((row) => row.status === "error" && row.verdictReason === "STALE_JOB")).toHaveLength(102)
    expect(rows.filter((row) => row.updatedAt === NOW && row.status !== "error")).toHaveLength(2)
    expect(await t.mutation(internal.modules.files.mutations.retryStale, {})).toBe(0)
  })

  it("quarantaine : 50 puis la suite, blob retiré, trace unique ; récent et propre conservés", async () => {
    const t = testConvex()
    const protectedFiles = await t.run(async (ctx) => {
      for (let index = 0; index < 51; index += 1) {
        const storageId = await ctx.storage.store(new Blob([`infected-${index}`]))
        await ctx.db.insert("fileScans", { storageId, status: "infected", source: "message", attempts: 1, createdAt: OLD, updatedAt: OLD })
      }
      const ids = []
      for (const status of ["infected", "clean"] as const) {
        const storageId = await ctx.storage.store(new Blob([status]))
        await ctx.db.insert("fileScans", { storageId, status, source: "message", attempts: 1, createdAt: NOW, updatedAt: status === "clean" ? OLD : NOW })
        ids.push(storageId)
      }
      return ids
    })
    expect(await t.mutation(internal.modules.files.mutations.purgeQuarantinedBlobs, {})).toBe(50)
    expect(await t.run((ctx) => ctx.db.query("fileScans").take(54))).toHaveLength(53)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const rows = await t.run((ctx) => ctx.db.query("fileScans").take(54))
    const purged = rows.filter((row) => row.blobPurgedAt !== undefined)
    expect(purged).toHaveLength(51)
    await t.run(async (ctx) => {
      for (const row of purged) expect(await ctx.storage.getUrl(row.storageId)).toBeNull()
      for (const id of protectedFiles) expect(await ctx.storage.getUrl(id)).not.toBeNull()
    })
    expect(await t.mutation(internal.modules.files.mutations.purgeQuarantinedBlobs, {})).toBe(0)
    const audit = await t.run((ctx) => ctx.db.query("engineAudit").take(55))
    expect(audit).toHaveLength(51)
    expect(audit.every((row) => row.action === "file.purge_blob" && row.capacity === "system")).toBe(true)
  })
})
