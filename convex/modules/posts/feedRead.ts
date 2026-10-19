/** PA10 : fenêtres de références triées selon le post d'origine, jamais l'heure du backfill. */
import { MATERIALIZED_FEED_HISTORY_MS, MATERIALIZED_FEED_SCAN, type PersonalFeedCursor } from "@antsia/social-domain/feedScale"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import type { ReaderContext } from "./access"

type ReadCtx = Pick<QueryCtx, "db">
export async function feedState(ctx: ReadCtx, reader: ReaderContext): Promise<Doc<"feedCursors"> | null> {
  return await ctx.db.query("feedCursors").withIndex("by_reader", q => q.eq("networkId", reader.network._id).eq("personId", reader.personId).eq("scope", "pour_vous")).unique()
}
export type MaterializedWindow = { rows: Doc<"posts">[]; wasFull: boolean; tail: PersonalFeedCursor<Id<"posts">> | null; historyStart: number }
export function materializedPostCursor(post: Pick<Doc<"posts">, "_id" | "publishedAt" | "_creationTime">, state: Doc<"feedCursors">): PersonalFeedCursor<Id<"posts">> {
  return { publishedAt: post.publishedAt, postId: post._id, postCreationTime: post._creationTime, strategy: "materialized", generation: state.generation, windowStart: state.windowStart }
}

export async function materializedWindow(ctx: ReadCtx, reader: ReaderContext, state: Doc<"feedCursors">, cursor?: PersonalFeedCursor<Id<"posts">>): Promise<MaterializedWindow> {
  const historyStart = Math.max(state.windowStart, Date.now() - MATERIALIZED_FEED_HISTORY_MS)
  const base = () => ctx.db.query("feedEntries")
  let entries: Doc<"feedEntries">[]
  if (cursor === undefined) entries = await base().withIndex("by_reader_order", q => q.eq("networkId", reader.network._id).eq("personId", reader.personId).eq("scope", "pour_vous").gte("publishedAt", historyStart)).order("desc").take(MATERIALIZED_FEED_SCAN)
  else if (cursor.publishedAt < historyStart || cursor.postCreationTime === undefined) entries = []
  else {
    const creationTime = cursor.postCreationTime
    // Trois plages disjointes : même heure de post ET création, autre création, puis dates anciennes.
    const same = await base().withIndex("by_reader_order", q => q.eq("networkId", reader.network._id).eq("personId", reader.personId).eq("scope", "pour_vous").eq("publishedAt", cursor.publishedAt).eq("postCreationTime", creationTime).lt("postId", cursor.postId)).order("desc").take(MATERIALIZED_FEED_SCAN)
    const tied = same.length === MATERIALIZED_FEED_SCAN ? [] : await base().withIndex("by_reader_order", q => q.eq("networkId", reader.network._id).eq("personId", reader.personId).eq("scope", "pour_vous").eq("publishedAt", cursor.publishedAt).lt("postCreationTime", creationTime)).order("desc").take(MATERIALIZED_FEED_SCAN - same.length)
    const remaining = MATERIALIZED_FEED_SCAN - same.length - tied.length
    const older = remaining === 0 ? [] : await base().withIndex("by_reader_order", q => q.eq("networkId", reader.network._id).eq("personId", reader.personId).eq("scope", "pour_vous").gte("publishedAt", historyStart).lt("publishedAt", cursor.publishedAt)).order("desc").take(remaining)
    entries = [...same, ...tied, ...older]
  }
  const posts = await Promise.all(entries.map(entry => ctx.db.get(entry.postId)))
  const rows = posts.filter((post): post is Doc<"posts"> => post !== null)
  const last = entries.at(-1)
  return {
    rows, wasFull: entries.length === MATERIALIZED_FEED_SCAN, historyStart,
    tail: last ? { publishedAt: last.publishedAt, postId: last.postId, postCreationTime: last.postCreationTime, strategy: "materialized", generation: state.generation, windowStart: state.windowStart } : null,
  }
}
