/** PA10 : les copies serveur réservées et les fichiers admis ne sont jamais des uploads abandonnés. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { findScanByStorageId } from "./admission"
import { reserveStagedFile } from "./staging"

export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000
export const ORPHAN_BATCH_SIZE = 100
export const ORPHAN_PAGE_MAX_BYTES = 256 * 1024

type PurgeArgs = { cursor?: string | null; before?: number }
type PurgeResult = { scanned: number; deleted: number; done: boolean }
const PURGE = makeFunctionReference<"mutation", PurgeArgs, PurgeResult>("modules/files/orphans:purge")
type ProtectArgs = { cursor: string | null; before: number }
type ProtectResult = { scanned: number; done: boolean }
const PROTECT = makeFunctionReference<"mutation", ProtectArgs, ProtectResult>("modules/files/orphans:protectStaged")
const STAGING_BATCH_SIZE = 20
const STAGED_FILES_MAX = 4

/** Porte du cron : toute la protection historique se termine avant la première purge. */
export const run = internalMutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    await ctx.scheduler.runAfter(0, PROTECT, { cursor: null, before: Date.now() - ORPHAN_MIN_AGE_MS })
    return null
  },
})

/** Une chaîne interrompue ne planifie aucune suppression ; les copies PA9 historiques restent protégées. */
export const protectStaged = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), before: v.number() },
  returns: v.object({ scanned: v.number(), done: v.boolean() }),
  handler: async (ctx, args): Promise<ProtectResult> => {
    if (!Number.isSafeInteger(args.before) || args.before < 0 || args.before > Date.now() - ORPHAN_MIN_AGE_MS) return fail("invalidArgument", { field: "before" })
    const page = await ctx.db.query("mirrors").paginate({ cursor: args.cursor, numItems: STAGING_BATCH_SIZE, maximumRowsRead: STAGING_BATCH_SIZE, maximumBytesRead: ORPHAN_PAGE_MAX_BYTES })
    for (const mirror of page.page) {
      const stored = mirror.mediaStored ?? []
      if (stored.length > STAGED_FILES_MAX) return fail("policyRefused")
      for (const storageId of new Set(stored)) if (!await findScanByStorageId(ctx, storageId)) await reserveStagedFile(ctx, mirror, storageId)
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, PROTECT, { cursor: page.continueCursor, before: args.before })
    else await ctx.scheduler.runAfter(0, PURGE, { before: args.before })
    return { scanned: page.page.length, done: page.isDone }
  },
})

/**
 * Primitive interne après protectStaged. Les suites gardent le même cutoff et le curseur
 * natif : aucun fichier devenu vieux pendant le passage n'y entre en cours.
 * Admission, réservation PA9 et asset catalogue protègent le blob, sans échéance par âge.
 */
export const purge = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), before: v.optional(v.number()) },
  returns: v.object({ scanned: v.number(), deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args): Promise<PurgeResult> => {
    const cutoff = Date.now() - ORPHAN_MIN_AGE_MS
    const before = args.before ?? cutoff
    if (!Number.isSafeInteger(before) || before < 0 || before > cutoff) return fail("invalidArgument", { field: "before" })
    const page = await ctx.db.system.query("_storage")
      .withIndex("by_creation_time", q => q.lt("_creationTime", before))
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: ORPHAN_BATCH_SIZE, maximumRowsRead: ORPHAN_BATCH_SIZE, maximumBytesRead: ORPHAN_PAGE_MAX_BYTES })
    let deleted = 0
    for (const candidate of page.page) {
      // L'admission et cette purge se sérialisent dans la même transaction.
      if (await findScanByStorageId(ctx, candidate._id)) continue
      if (await ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", candidate._id)).first()) continue
      if (await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_storage", q => q.eq("storageId", candidate._id)).first()) continue
      const current = await ctx.db.system.get("_storage", candidate._id)
      if (!current || current._creationTime >= before) continue
      await ctx.storage.delete(current._id)
      deleted += 1
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, PURGE, { cursor: page.continueCursor, before })
    return { scanned: page.page.length, deleted, done: page.isDone }
  },
})
