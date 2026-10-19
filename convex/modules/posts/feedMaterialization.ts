/** PA10 : projection bornée, durable, sans contenu dans les jobs ni vérité d'audience copiée. */
import { MATERIALIZED_FEED_BATCH, MATERIALIZED_FEED_HISTORY_MS, MATERIALIZED_FEED_REBUILD_MS } from "@antsia/social-domain/feedScale"
import { makeFunctionReference, type PaginationResult } from "convex/server"
import { v } from "convex/values"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { getRootNetwork, isActiveMember } from "../../lib/access"
import { networkMutation } from "../../lib/functions"
import { feedAccessVersion, liveFeedReason } from "./feedPolicy"

type BackfillArgs = { cursorId: Id<"feedCursors">; generation: number; step: number }
type FanoutArgs = { jobId: Id<"feedFanoutJobs">; generation: number; step: number }
const backfillRef = makeFunctionReference<"mutation", BackfillArgs, null>("modules/posts/feedMaterialization:backfill")
const fanoutRef = makeFunctionReference<"mutation", FanoutArgs, null>("modules/posts/feedMaterialization:fanout")
const purgeRef = makeFunctionReference<"mutation", { postId: Id<"posts">; networkId?: Id<"networks"> }, null>("modules/posts/feedMaterialization:purgePost")
const refreshPersonRef = makeFunctionReference<"mutation", { personId: Id<"persons">; cursor: string | null }, null>("modules/posts/feedMaterialization:refreshPerson")
const retentionRef = makeFunctionReference<"mutation", Record<string, never>, null>("modules/posts/feedMaterialization:retention")
const BACKFILL_PHASES = ["self", "connectionsLow", "connectionsHigh", "follows", "pages", "signatories", "done"] as const
const FANOUT_PHASES = ["self", "connectionsLow", "connectionsHigh", "followers", "pageFollowers", "pageSignatories", "done"] as const
const STALE_MS = 5 * 60_000
const PAGE_BYTES = 256 * 1024

async function liveReader(ctx: Pick<MutationCtx, "db">, networkId: Id<"networks">, personId: Id<"persons">): Promise<Doc<"networks"> | null> {
  const [person, network] = await Promise.all([ctx.db.get(personId), ctx.db.get(networkId)])
  return person && person.erasedAt === undefined && person.deletionRequestedAt === undefined && network?.status === "active" && await isActiveMember(ctx, networkId, personId) ? network : null
}

/** Unicité transactionnelle par destinataire/réseau/post ; les expirations suivent publishedAt. */
async function putEntry(ctx: MutationCtx, network: Doc<"networks">, personId: Id<"persons">, post: Doc<"posts">): Promise<void> {
  const now = Date.now()
  if (post.publishedAt < now - MATERIALIZED_FEED_HISTORY_MS || post.publishedAt > now || !await liveReader(ctx, network._id, personId)) return
  if (await liveFeedReason(ctx, { network, personId }, post, "pour_vous") === null) return
  const existing = await ctx.db.query("feedEntries").withIndex("by_reader_post", q => q.eq("networkId", network._id).eq("personId", personId).eq("scope", "pour_vous").eq("postId", post._id)).unique()
  if (!existing) await ctx.db.insert("feedEntries", { networkId: network._id, personId, scope: "pour_vous", postId: post._id, publishedAt: post.publishedAt, postCreationTime: post._creationTime, expiresAt: post.publishedAt + MATERIALIZED_FEED_HISTORY_MS, createdAt: now })
}

/** Une modification de lien remplace la génération, jamais une chaîne déjà prête en silence. */
export async function refreshReaderFeed(ctx: MutationCtx, networkId: Id<"networks">, personId: Id<"persons">, force = true): Promise<void> {
  const network = await liveReader(ctx, networkId, personId)
  if (!network) return
  const current = await ctx.db.query("feedCursors").withIndex("by_reader", q => q.eq("networkId", networkId).eq("personId", personId).eq("scope", "pour_vous")).unique()
  const accessVersion = await feedAccessVersion(ctx, { network, personId })
  if (!force && current && current.accessVersion === accessVersion) {
    if (current.status === "building") {
      if (current.updatedAt <= Date.now() - STALE_MS) {
        await ctx.db.patch(current._id, { updatedAt: Date.now() })
        await ctx.scheduler.runAfter(0, backfillRef, { cursorId: current._id, generation: current.generation, step: current.step })
      }
      return
    }
    if ((current.completedAt ?? 0) > Date.now() - MATERIALIZED_FEED_REBUILD_MS) return
  }
  const now = Date.now(), generation = (current?.generation ?? 0) + 1
  const data = { networkId, personId, scope: "pour_vous" as const, generation, step: 0, sourceDone: false, status: "building" as const, phase: "self" as const, sourceCursor: null, postCursor: null, activePersonId: personId, activePageId: undefined, accessVersion, windowStart: now - MATERIALIZED_FEED_HISTORY_MS, cutoff: now, startedAt: now, updatedAt: now, completedAt: undefined }
  const cursorId = current?._id ?? await ctx.db.insert("feedCursors", data)
  if (current) await ctx.db.patch(cursorId, data)
  await ctx.scheduler.runAfter(0, backfillRef, { cursorId, generation, step: 0 })
}

/** Les pages peuvent être suivies depuis la racine et depuis leur réseau d'origine. */
export async function refreshReaderContexts(ctx: MutationCtx, networkId: Id<"networks">, personId: Id<"persons">): Promise<void> {
  await refreshReaderFeed(ctx, networkId, personId)
  const root = await getRootNetwork(ctx)
  if (root && root._id !== networkId) await refreshReaderFeed(ctx, root._id, personId)
}

/** Un blocage vaut dans tous les réseaux déjà préparés, pas seulement celui du geste. */
export async function scheduleReaderRefresh(ctx: Pick<MutationCtx, "scheduler">, personId: Id<"persons">): Promise<void> {
  await ctx.scheduler.runAfter(0, refreshPersonRef, { personId, cursor: null })
}
export const refreshPerson = internalMutation({
  args: { personId: v.id("persons"), cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const person = await ctx.db.get(args.personId)
    if (!person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined) return null
    const page = await ctx.db.query("feedCursors").withIndex("by_person", q => q.eq("personId", args.personId)).paginate({ cursor: args.cursor, numItems: MATERIALIZED_FEED_BATCH, maximumRowsRead: MATERIALIZED_FEED_BATCH, maximumBytesRead: PAGE_BYTES })
    for (const row of page.page) await refreshReaderFeed(ctx, row.networkId, args.personId)
    if (!page.isDone) await ctx.scheduler.runAfter(0, refreshPersonRef, { personId: args.personId, cursor: page.continueCursor })
    return null
  },
})

/** Admission réseau + budget social.write du constructeur ; aucun identifiant personnel fourni par le client. */
export const prepareMyFeed = networkMutation({
  minStatus: "en_attente", args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => { await refreshReaderFeed(ctx, ctx.networkId, ctx.person._id, false); return null },
})

type Source = { personId?: Id<"persons">; pageId?: Id<"pages">; cursor: string; done: boolean }
/** Une source par transaction ; chaque source peut ensuite avoir plusieurs pages de posts. */
async function nextSource(ctx: MutationCtx, network: Doc<"networks">, job: Doc<"feedCursors">): Promise<Source> {
  const opts = { cursor: job.sourceCursor, numItems: 1, maximumRowsRead: 1, maximumBytesRead: PAGE_BYTES }
  if (job.phase === "connectionsLow" || job.phase === "connectionsHigh") {
    const low = job.phase === "connectionsLow"
    const page = low
      ? await ctx.db.query("connections").withIndex("by_network_low_status", q => q.eq("networkId", network._id).eq("personIdLow", job.personId).eq("status", "accepted")).paginate(opts)
      : await ctx.db.query("connections").withIndex("by_network_high_status", q => q.eq("networkId", network._id).eq("personIdHigh", job.personId).eq("status", "accepted")).paginate(opts)
    const row = page.page[0]
    return { ...(row ? { personId: low ? row.personIdHigh : row.personIdLow } : {}), cursor: page.continueCursor, done: page.isDone }
  }
  if (job.phase === "follows") {
    const page = await ctx.db.query("follows").withIndex("by_network_follower_createdAt", q => q.eq("networkId", network._id).eq("followerPersonId", job.personId)).paginate(opts)
    return { personId: page.page[0]?.targetPersonId, cursor: page.continueCursor, done: page.isDone }
  }
  if (job.phase === "pages") {
    const page = network.kind === "root"
      ? await ctx.db.query("pageFollows").withIndex("by_person_createdAt", q => q.eq("personId", job.personId)).paginate(opts)
      : await ctx.db.query("pageFollows").withIndex("by_network_person_createdAt", q => q.eq("networkId", network._id).eq("personId", job.personId)).paginate(opts)
    return { pageId: page.page[0]?.pageId, cursor: page.continueCursor, done: page.isDone }
  }
  if (job.phase === "signatories") {
    const page = network.kind === "root"
      ? await ctx.db.query("pageSignatories").withIndex("by_person", q => q.eq("personId", job.personId)).paginate(opts)
      : await ctx.db.query("pageSignatories").withIndex("by_network_person", q => q.eq("networkId", network._id).eq("personId", job.personId)).paginate(opts)
    return { pageId: page.page[0]?.pageId, cursor: page.continueCursor, done: page.isDone }
  }
  return { cursor: "", done: true }
}

async function sourcePosts(ctx: MutationCtx, network: Doc<"networks">, job: Doc<"feedCursors">): Promise<PaginationResult<Doc<"posts">>> {
  const opts = { cursor: job.postCursor, numItems: MATERIALIZED_FEED_BATCH, maximumRowsRead: MATERIALIZED_FEED_BATCH, maximumBytesRead: PAGE_BYTES }
  if (job.activePageId !== undefined) {
    const pageId = job.activePageId
    return network.kind === "root"
      ? await ctx.db.query("posts").withIndex("by_root_page_status_publishedAt", q => q.eq("onRoot", true).eq("pageId", pageId).eq("status", "published").gte("publishedAt", job.windowStart).lte("publishedAt", job.cutoff)).order("desc").paginate(opts)
      : await ctx.db.query("posts").withIndex("by_network_page_status_publishedAt", q => q.eq("networkId", network._id).eq("pageId", pageId).eq("status", "published").gte("publishedAt", job.windowStart).lte("publishedAt", job.cutoff)).order("desc").paginate(opts)
  }
  const personId = job.activePersonId
  return network.kind === "root"
    ? await ctx.db.query("posts").withIndex("by_root_author_status_publishedAt", q => q.eq("onRoot", true).eq("authorPersonId", personId).eq("status", "published").gte("publishedAt", job.windowStart).lte("publishedAt", job.cutoff)).order("desc").paginate(opts)
    : await ctx.db.query("posts").withIndex("by_network_author_status_publishedAt", q => q.eq("networkId", network._id).eq("authorPersonId", personId).eq("status", "published").gte("publishedAt", job.windowStart).lte("publishedAt", job.cutoff)).order("desc").paginate(opts)
}

async function advanceBackfill(ctx: MutationCtx, job: Doc<"feedCursors">, patch: Partial<Omit<Doc<"feedCursors">, "_id" | "_creationTime">>): Promise<void> {
  const step = job.step + 1
  await ctx.db.patch(job._id, { ...patch, step, updatedAt: Date.now() })
  if (patch.status !== "ready") await ctx.scheduler.runAfter(0, backfillRef, { cursorId: job._id, generation: job.generation, step })
}
function nextBackfillPhase(job: Doc<"feedCursors">) {
  return BACKFILL_PHASES[BACKFILL_PHASES.indexOf(job.phase) + 1] ?? "done"
}
export const backfill = internalMutation({
  args: { cursorId: v.id("feedCursors"), generation: v.number(), step: v.number() }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.db.get(args.cursorId)
    if (!job || job.status !== "building" || job.generation !== args.generation || job.step !== args.step) return null
    const network = await liveReader(ctx, job.networkId, job.personId)
    if (!network) return null
    if (job.accessVersion !== await feedAccessVersion(ctx, { network, personId: job.personId })) {
      await refreshReaderFeed(ctx, job.networkId, job.personId)
      return null
    }
    if (job.activePersonId !== undefined || job.activePageId !== undefined) {
      // Un auteur effacé ne peut plus être une source, même si le job a commencé avant son effacement.
      const sourcePerson = job.activePersonId === undefined ? null : await ctx.db.get(job.activePersonId)
      const sourceLive = job.activePersonId === undefined || (sourcePerson !== null && sourcePerson.erasedAt === undefined && sourcePerson.deletionRequestedAt === undefined && await isActiveMember(ctx, job.networkId, sourcePerson._id))
      const page = sourceLive ? await sourcePosts(ctx, network, job) : null
      if (page) for (const post of page.page) await putEntry(ctx, network, job.personId, post)
      if (page && !page.isDone) await advanceBackfill(ctx, job, { postCursor: page.continueCursor })
      else {
        const move = job.phase === "self" || job.sourceDone
        await advanceBackfill(ctx, job, { activePersonId: undefined, activePageId: undefined, postCursor: null, ...(move ? { phase: nextBackfillPhase(job), sourceCursor: null, sourceDone: false } : {}) })
      }
      return null
    }
    if (job.phase === "done") {
      await advanceBackfill(ctx, job, { status: "ready", completedAt: Date.now() })
      return null
    }
    const source = await nextSource(ctx, network, job)
    if (source.personId === undefined && source.pageId === undefined) {
      await advanceBackfill(ctx, job, source.done ? { phase: nextBackfillPhase(job), sourceCursor: null, sourceDone: false } : { sourceCursor: source.cursor })
    } else await advanceBackfill(ctx, job, { activePersonId: source.personId, activePageId: source.pageId, postCursor: null, sourceCursor: source.cursor, sourceDone: source.done })
    return null
  },
})

/** Au plus deux jobs, un par contexte de lecture ; aucune boucle sur l'audience dans l'écriture du post. */
export async function schedulePostFeed(ctx: MutationCtx, postId: Id<"posts">): Promise<void> {
  const post = await ctx.db.get(postId)
  if (!post || post.status !== "published" || post.audience === "group" || post.publishedAt < Date.now() - MATERIALIZED_FEED_HISTORY_MS) return
  const origin = await ctx.db.get(post.networkId)
  if (!origin || origin.status !== "active") return
  const root = post.onRoot === true ? await getRootNetwork(ctx) : null
  const networks = root && root._id !== origin._id ? [origin, root] : [origin]
  for (const network of networks) {
    const current = await ctx.db.query("feedFanoutJobs").withIndex("by_network_post", q => q.eq("networkId", network._id).eq("postId", postId)).unique()
    const now = Date.now(), generation = (current?.generation ?? 0) + 1
    const data = { networkId: network._id, postId, generation, step: 0, status: "pending" as const, phase: "self" as const, cursor: null, startedAt: now, updatedAt: now, expiresAt: post.publishedAt + MATERIALIZED_FEED_HISTORY_MS }
    const jobId = current?._id ?? await ctx.db.insert("feedFanoutJobs", data)
    if (current) await ctx.db.patch(current._id, data)
    await ctx.scheduler.runAfter(Math.max(0, post.publishedAt - now), fanoutRef, { jobId, generation, step: 0 })
  }
}

async function fanoutRecipients(ctx: MutationCtx, job: Doc<"feedFanoutJobs">, post: Doc<"posts">): Promise<{ persons: Id<"persons">[]; done: boolean; cursor: string }> {
  const opts = { cursor: job.cursor, numItems: MATERIALIZED_FEED_BATCH, maximumRowsRead: MATERIALIZED_FEED_BATCH, maximumBytesRead: PAGE_BYTES }
  if (job.phase === "self") return { persons: post.authorPersonId === undefined ? [] : [post.authorPersonId], done: true, cursor: "" }
  if (post.pageId !== undefined) {
    if (job.phase === "pageFollowers") {
      const page = await ctx.db.query("pageFollows").withIndex("by_page_createdAt", q => q.eq("pageId", post.pageId!)).paginate(opts)
      return { persons: page.page.map(row => row.personId), done: page.isDone, cursor: page.continueCursor }
    }
    if (job.phase === "pageSignatories") {
      const page = await ctx.db.query("pageSignatories").withIndex("by_page_role", q => q.eq("pageId", post.pageId!)).paginate(opts)
      return { persons: page.page.map(row => row.personId), done: page.isDone, cursor: page.continueCursor }
    }
  } else if (post.authorPersonId !== undefined) {
    const personId = post.authorPersonId
    if (job.phase === "connectionsLow" || job.phase === "connectionsHigh") {
      const low = job.phase === "connectionsLow"
      const page = low
        ? await ctx.db.query("connections").withIndex("by_network_low_status", q => q.eq("networkId", job.networkId).eq("personIdLow", personId).eq("status", "accepted")).paginate(opts)
        : await ctx.db.query("connections").withIndex("by_network_high_status", q => q.eq("networkId", job.networkId).eq("personIdHigh", personId).eq("status", "accepted")).paginate(opts)
      return { persons: page.page.map(row => low ? row.personIdHigh : row.personIdLow), done: page.isDone, cursor: page.continueCursor }
    }
    if (job.phase === "followers") {
      const page = await ctx.db.query("follows").withIndex("by_network_target_createdAt", q => q.eq("networkId", job.networkId).eq("targetPersonId", personId)).paginate(opts)
      return { persons: page.page.map(row => row.followerPersonId), done: page.isDone, cursor: page.continueCursor }
    }
  }
  return { persons: [], done: true, cursor: "" }
}
export const fanout = internalMutation({
  args: { jobId: v.id("feedFanoutJobs"), generation: v.number(), step: v.number() }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== "pending" || job.generation !== args.generation || job.step !== args.step) return null
    const [post, network] = await Promise.all([ctx.db.get(job.postId), ctx.db.get(job.networkId)])
    const source = post?.authorPersonId === undefined ? null : await ctx.db.get(post.authorPersonId)
    if (!post || post.status !== "published" || post.publishedAt < Date.now() - MATERIALIZED_FEED_HISTORY_MS || !network || network.status !== "active" || (post.networkId !== network._id && (network.kind !== "root" || post.visibility !== "root")) || (post.pageId === undefined && post.authorPersonId !== undefined && (!source || source.erasedAt !== undefined || source.deletionRequestedAt !== undefined || !await isActiveMember(ctx, post.networkId, source._id)))) {
      await ctx.db.patch(job._id, { status: "done", phase: "done", updatedAt: Date.now() }); return null
    }
    if (post.publishedAt > Date.now()) {
      await ctx.db.patch(job._id, { updatedAt: Date.now() })
      await ctx.scheduler.runAfter(post.publishedAt - Date.now(), fanoutRef, args)
      return null
    }
    const batch = await fanoutRecipients(ctx, job, post)
    for (const personId of new Set(batch.persons)) await putEntry(ctx, network, personId, post)
    const phase = batch.done ? (FANOUT_PHASES[FANOUT_PHASES.indexOf(job.phase) + 1] ?? "done") : job.phase
    const step = job.step + 1
    await ctx.db.patch(job._id, { phase, step, cursor: batch.done ? null : batch.cursor, status: phase === "done" ? "done" : "pending", updatedAt: Date.now() })
    if (phase !== "done") await ctx.scheduler.runAfter(0, fanoutRef, { jobId: job._id, generation: job.generation, step })
    return null
  },
})

/** Le retrait est fermé immédiatement par la garde ; le nettoyage physique suit en lots de 100. */
export async function purgeMaterializedPost(ctx: Pick<MutationCtx, "scheduler">, postId: Id<"posts">, networkId?: Id<"networks">): Promise<void> {
  await ctx.scheduler.runAfter(0, purgeRef, { postId, ...(networkId === undefined ? {} : { networkId }) })
}
export const purgePost = internalMutation({
  args: { postId: v.id("posts"), networkId: v.optional(v.id("networks")) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Un ancien retrait ne supprime pas une restauration ultérieure.
    const post = await ctx.db.get(args.postId)
    if (post?.status === "published" && (args.networkId === undefined || post.networkId === args.networkId || post.visibility === "root")) return null
    const rows = args.networkId === undefined
      ? await ctx.db.query("feedEntries").withIndex("by_post", q => q.eq("postId", args.postId)).take(100)
      : await ctx.db.query("feedEntries").withIndex("by_post_network", q => q.eq("postId", args.postId).eq("networkId", args.networkId!)).take(100)
    for (const row of rows) await ctx.db.delete(row._id)
    if (rows.length === 100) await ctx.scheduler.runAfter(0, purgeRef, args)
    return null
  },
})

export const retention = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const now = Date.now()
    const entries = await ctx.db.query("feedEntries").withIndex("by_expiresAt", q => q.lte("expiresAt", now)).take(50)
    const jobs = await ctx.db.query("feedFanoutJobs").withIndex("by_expiresAt", q => q.lte("expiresAt", now)).take(50)
    for (const row of entries) await ctx.db.delete(row._id)
    for (const row of jobs) await ctx.db.delete(row._id)
    if (entries.length === 50 || jobs.length === 50) await ctx.scheduler.runAfter(0, retentionRef, {})
    return null
  },
})

/** Filet cron : travaux perdus repris à leur CAS persisté, purge au plus 100 lignes par transaction. */
export const maintain = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const stale = Date.now() - STALE_MS
    const readers = await ctx.db.query("feedCursors").withIndex("by_status_updatedAt", q => q.eq("status", "building").lte("updatedAt", stale)).take(20)
    const jobs = await ctx.db.query("feedFanoutJobs").withIndex("by_status_updatedAt", q => q.eq("status", "pending").lte("updatedAt", stale)).take(20)
    for (const row of readers) {
      // Un lecteur effacé ou suspendu ne peut pas monopoliser les vingt reprises suivantes.
      if (!await liveReader(ctx, row.networkId, row.personId)) { await ctx.db.patch(row._id, { updatedAt: Date.now() }); continue }
      await ctx.db.patch(row._id, { updatedAt: Date.now() })
      await ctx.scheduler.runAfter(0, backfillRef, { cursorId: row._id, generation: row.generation, step: row.step })
    }
    for (const row of jobs) {
      await ctx.db.patch(row._id, { updatedAt: Date.now() })
      await ctx.scheduler.runAfter(0, fanoutRef, { jobId: row._id, generation: row.generation, step: row.step })
    }
    await ctx.scheduler.runAfter(0, retentionRef, {})
    return null
  },
})
