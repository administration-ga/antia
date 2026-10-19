/** PA8 : générations matérialisées par tranches de vingt-cinq, aucun auteur dans un job. */
import { TRANSPARENCY_MIN_CASES } from "@antsia/social-domain/moderationPolicy"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import { internalMutation } from "../../_generated/server"
import { getRootNetwork } from "../../lib/access"
import { hasNativePostAuthor } from "../posts/nativeAuthor"
import { publicPageEligible, publicPostEligible } from "./access"
import { publicStageValidator } from "./tables"

export const PUBLIC_AGGREGATE_BATCH = 25
export const PUBLIC_AGGREGATE_SCAN_MAX = 5_000
export const PUBLIC_TRENDS_TAG_MAX = 50
export const PUBLIC_MEASUREMENT_WINDOW_MS = 7 * 86_400_000
const JOB_LEASE_MS = 30 * 60_000

/** Un refresh concurrent garde le job vivant ; un ancien bail peut être remplacé sans double compte. */
export const refresh = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const root = await getRootNetwork(ctx)
    if (!root) return null
    const current = await ctx.db.query("publicAggregateJobs").withIndex("by_network", (q) => q.eq("networkId", root._id)).unique()
    const now = Date.now()
    if (current && current.stage !== "done" && current.startedAt + JOB_LEASE_MS > now) return null
    const generation = (current?.generation ?? 0) + 1
    const data = { networkId: root._id, generation, stage: "posts" as const, cursor: null, startedAt: now, cutoff: now, periodStart: now - PUBLIC_MEASUREMENT_WINDOW_MS, scanned: 0, publishedPosts: 0, officialPages: 0, tags: [], bounded: false }
    if (current) await ctx.db.patch(current._id, data)
    else await ctx.db.insert("publicAggregateJobs", data)
    await ctx.scheduler.runAfter(0, internal.modules.public.aggregate.step, { networkId: root._id, generation, stage: "posts", cursor: null })
    return null
  },
})

/** Stage/génération/curseur attendus : une répétition ou une ancienne chaîne est sans effet. */
export const step = internalMutation({
  args: { networkId: v.id("networks"), generation: v.number(), stage: publicStageValidator, cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const root = await ctx.db.get(args.networkId)
    const job = await ctx.db.query("publicAggregateJobs").withIndex("by_network", (q) => q.eq("networkId", args.networkId)).unique()
    if (!root || root.kind !== "root" || root.status !== "active" || !job || job.generation !== args.generation || job.stage !== args.stage || job.cursor !== args.cursor || job.stage === "done") return null
    const context = { root, reader: null }
    const opts = { numItems: PUBLIC_AGGREGATE_BATCH, cursor: job.cursor, maximumRowsRead: PUBLIC_AGGREGATE_BATCH, maximumBytesRead: 1_048_576 }
    let publishedPosts = job.publishedPosts
    let officialPages = job.officialPages
    let bounded = job.bounded
    let examined = 0
    let result: { isDone: boolean; continueCursor: string }
    const tags = job.tags.map((tag) => ({ ...tag }))
    if (job.stage === "posts") {
      const page = await ctx.db.query("posts").withIndex("by_root_status_publishedAt", (q) => q.eq("onRoot", true).eq("status", "published").gte("publishedAt", job.periodStart).lte("publishedAt", job.cutoff)).order("desc").paginate(opts)
      const authorsInBatch = new Map<string, Set<string>>()
      for (const post of page.page) {
        examined += 1
        if (!await publicPostEligible(ctx, context, post)) continue
        const authorId = post.pageId ?? (hasNativePostAuthor(post) ? post.authorPersonId : undefined)
        if (authorId === undefined) continue
        publishedPosts += 1
        for (const tag of new Set(post.tags ?? [])) {
          let measured = tags.find((entry) => entry.tag === tag)
          if (!measured) {
            if (tags.length >= PUBLIC_TRENDS_TAG_MAX) { bounded = true; continue }
            measured = { tag, posts: 0, authorsLowerBound: 0 }
            tags.push(measured)
          }
          measured.posts += 1
          const authors = authorsInBatch.get(tag) ?? new Set<string>()
          // Ces identifiants vivent seulement dans la mutation, jamais dans la ligne ni le prochain job.
          authors.add(authorId)
          authorsInBatch.set(tag, authors)
        }
      }
      for (const [tag, authors] of authorsInBatch) {
        const measured = tags.find((entry) => entry.tag === tag)
        if (measured) measured.authorsLowerBound = Math.max(measured.authorsLowerBound, Math.min(TRANSPARENCY_MIN_CASES, authors.size))
      }
      result = page
    } else {
      const page = await ctx.db.query("pages").withIndex("by_root_status_trustRank_createdAt", (q) => q.eq("onRoot", true).eq("status", "active")).paginate(opts)
      for (const record of page.page) {
        examined += 1
        if (record.createdAt <= job.cutoff && await publicPageEligible(ctx, context, record)) officialPages += 1
      }
      result = page
    }
    const scanned = job.scanned + examined
    const capped = scanned >= PUBLIC_AGGREGATE_SCAN_MAX && !result.isDone
    bounded ||= capped
    const finishedStage = result.isDone || capped
    const stage = finishedStage ? (job.stage === "posts" ? "pages" as const : "done" as const) : job.stage
    const cursor = finishedStage ? null : result.continueCursor
    await ctx.db.patch(job._id, { stage, cursor, scanned: finishedStage ? 0 : scanned, publishedPosts, officialPages, tags, bounded })
    if (stage === "done") {
      const snapshot = await ctx.db.query("publicSnapshots").withIndex("by_network", (q) => q.eq("networkId", root._id)).unique()
      const data = { networkId: root._id, generation: job.generation, generatedAt: Date.now(), periodStart: job.periodStart, periodEnd: job.cutoff, publishedPosts, officialPages, trends: tags.filter((tag) => tag.posts >= TRANSPARENCY_MIN_CASES && tag.authorsLowerBound >= TRANSPARENCY_MIN_CASES).sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag)).slice(0, 10).map(({ tag, posts }) => ({ tag, posts })), bounded }
      if (snapshot) await ctx.db.patch(snapshot._id, data)
      else await ctx.db.insert("publicSnapshots", data)
    } else await ctx.scheduler.runAfter(0, internal.modules.public.aggregate.step, { networkId: root._id, generation: job.generation, stage, cursor })
    return null
  },
})
