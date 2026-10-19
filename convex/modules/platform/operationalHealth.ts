/** PA10 : observation bornée des tâches planifiées du moteur, distincte d'un log drain. */
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { getRootNetwork } from "../../lib/access"
import { notFound } from "../../lib/errors"
import { operatorQuery } from "../../lib/functions"
import { operationalSnapshotFields } from "./operationalTables"

export const OPERATIONAL_JOB_LIMIT = 200
export const OPERATIONAL_WINDOW_MS = 60 * 60 * 1000
const SNAPSHOT_STALE_MS = 15 * 60 * 1000

type JobState = "pending" | "inProgress" | "success" | "failed" | "canceled"
type ScheduledState = { scheduledTime: number; completedTime?: number; state: { kind: JobState } }
export type OperationalSnapshot = {
  observedAt: number
  windowStart: number
  windowEnd: number
  scanned: number
  failed: number
  pending: number
  inProgress: number
  successful: number
  canceled: number
  coverage: "complete" | "bounded"
}

/** Seuls les états et dates sont lus ; aucun champ libre n'entre dans la projection. */
export function summarizeScheduledJobs(rows: readonly ScheduledState[], now: number, complete: boolean): OperationalSnapshot {
  const sample = rows.slice(0, OPERATIONAL_JOB_LIMIT)
  const snapshot: OperationalSnapshot = {
    observedAt: now, windowStart: now - OPERATIONAL_WINDOW_MS, windowEnd: now,
    scanned: sample.length, failed: 0, pending: 0, inProgress: 0, successful: 0, canceled: 0,
    coverage: complete && rows.length <= OPERATIONAL_JOB_LIMIT ? "complete" : "bounded",
  }
  for (const row of sample) {
    const at = row.completedTime ?? row.scheduledTime
    if (!Number.isFinite(at) || at < snapshot.windowStart || at > snapshot.windowEnd) continue
    switch (row.state.kind) {
      case "failed": snapshot.failed++; break
      case "pending": snapshot.pending++; break
      case "inProgress": snapshot.inProgress++; break
      case "success": snapshot.successful++; break
      case "canceled": snapshot.canceled++; break
    }
  }
  return snapshot
}

/** Les tâches sont globales au moteur : leur état est rangé une fois sous la racine active. */
export const observe = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const root = await getRootNetwork(ctx)
    if (!root) return null
    // borné : 200 documents et 1 Mio au maximum dans cette observation, sans continuation asynchrone.
    const page = await ctx.db.system.query("_scheduled_functions").order("desc").paginate({
      cursor: null, numItems: OPERATIONAL_JOB_LIMIT, maximumRowsRead: OPERATIONAL_JOB_LIMIT, maximumBytesRead: 1_048_576,
    })
    const snapshot = summarizeScheduledJobs(page.page, Date.now(), page.isDone)
    const previous = await ctx.db.query("operationalSnapshots").withIndex("by_network_key", q => q.eq("networkId", root._id).eq("key", "scheduled_jobs")).unique()
    if (previous) await ctx.db.patch(previous._id, snapshot)
    else await ctx.db.insert("operationalSnapshots", { networkId: root._id, key: "scheduled_jobs", ...snapshot })
    return null
  },
})

/** L'autorité opérateur reste vivante ; aucun état global n'est attribué à un réseau particulier. */
export const get = operatorQuery({
  args: { networkId: v.id("networks") },
  returns: v.union(v.null(), v.object({
    ...operationalSnapshotFields,
    scope: v.literal("engine"), scanLimit: v.number(), warning: v.boolean(), stale: v.boolean(),
    synchronousErrors: v.literal("not_measured"),
  })),
  handler: async (ctx, args) => {
    const network = await ctx.db.get(args.networkId)
    if (!network || network.status !== "active") return notFound()
    const root = await getRootNetwork(ctx)
    if (!root) return null
    const row = await ctx.db.query("operationalSnapshots").withIndex("by_network_key", q => q.eq("networkId", root._id).eq("key", "scheduled_jobs")).unique()
    if (!row) return null
    return {
      scope: "engine" as const, scanLimit: OPERATIONAL_JOB_LIMIT,
      observedAt: row.observedAt, windowStart: row.windowStart, windowEnd: row.windowEnd,
      scanned: row.scanned, failed: row.failed, pending: row.pending, inProgress: row.inProgress,
      successful: row.successful, canceled: row.canceled, coverage: row.coverage,
      warning: row.failed > 0, stale: Date.now() - row.observedAt > SNAPSHOT_STALE_MS,
      synchronousErrors: "not_measured" as const,
    }
  },
})
