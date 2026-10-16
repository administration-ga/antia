/** Mes protections personnelles : projection minimale, deux sources paginées sans migration. */
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { networkQuery } from "../../lib/functions"

export type PersonalBlockDto = { targetPersonId: Id<"persons">; at: number }

const PAGE_MAX = 50
const PAGE_BYTES = 2 * 1024 * 1024

export const paginateMine = networkQuery({
  minStatus: "en_attente",
  args: { source: v.union(v.literal("intents"), v.literal("legacy")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<PersonalBlockDto>> => {
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(Math.max(Math.trunc(args.paginationOpts.numItems), 1), PAGE_MAX),
      maximumBytesRead: Math.min(args.paginationOpts.maximumBytesRead ?? PAGE_BYTES, PAGE_BYTES),
    }
    if (args.source === "intents") {
      const result = await ctx.db.query("personBlocks")
        .withIndex("by_blocker_createdAt", (q) => q.eq("blockerPersonId", ctx.person._id))
        .order("desc")
        .paginate(paginationOpts)
      return { ...result, page: result.page.map((row) => ({ targetPersonId: row.targetPersonId, at: row.createdAt })) }
    }
    const result = await ctx.db.query("connections")
      .withIndex("by_blocker_status_updatedAt", (q) => q.eq("blockedByPersonId", ctx.person._id).eq("status", "blocked"))
      .order("desc")
      .paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map((row) => ({ targetPersonId: row.personIdLow === ctx.person._id ? row.personIdHigh : row.personIdLow, at: row.updatedAt })),
    }
  },
})
