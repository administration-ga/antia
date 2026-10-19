/** PA10 : les droits sur un fil volumineux ne balayent pas le fil de toute la population. */
import type { PaginationResult } from "convex/server"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"

type FeedTable = "feedEntries" | "feedCursors" | "feedFanoutJobs"
type FeedRow = Doc<"feedEntries"> | Doc<"feedCursors"> | Doc<"feedFanoutJobs">
type Progress = { stage: "owned" | "parents" | "references"; rowCursor: string | null; lastParent: string | null }
const empty = (): PaginationResult<FeedRow> => ({ page: [], isDone: true, continueCursor: "" })
const encode = (state: Progress) => JSON.stringify(state)

function decode(cursor: string | null, table: FeedTable): Progress {
  if (cursor === null) return { stage: table === "feedFanoutJobs" ? "parents" : "owned", rowCursor: null, lastParent: null }
  try {
    const state: unknown = JSON.parse(cursor)
    if (typeof state !== "object" || state === null || Array.isArray(state)) return fail("policyRefused")
    const fields = state as Record<string, unknown>
    if (!["owned", "parents", "references"].includes(String(fields.stage))
      || (fields.rowCursor !== null && typeof fields.rowCursor !== "string")
      || (fields.lastParent !== null && typeof fields.lastParent !== "string")) return fail("policyRefused")
    return { stage: fields.stage as Progress["stage"], rowCursor: fields.rowCursor as string | null, lastParent: fields.lastParent as string | null }
  } catch { return fail("policyRefused") }
}

export function isFeedDataTable(table: string): table is FeedTable {
  return table === "feedEntries" || table === "feedCursors" || table === "feedFanoutJobs"
}

/**
 * Une page native au plus par transaction. Les parents sont parcourus par
 * index de targetId, un post à la fois, sans liste de tous les contenus de la
 * personne ni balayage des destinataires étrangers.
 */
export async function feedErasurePage(ctx: Pick<MutationCtx, "db">, input: {
  table: FeedTable; personId: Id<"persons">; jobId: Id<"dataErasureJobs">; cursor: string | null;
  numItems: number; maximumBytesRead: number;
}): Promise<PaginationResult<FeedRow>> {
  const state = decode(input.cursor, input.table)
  const options = { numItems: input.numItems, maximumRowsRead: input.numItems, maximumBytesRead: input.maximumBytesRead, cursor: state.rowCursor }
  if (state.stage === "owned") {
    const page = input.table === "feedEntries"
      ? await ctx.db.query("feedEntries").withIndex("by_person", q => q.eq("personId", input.personId)).paginate(options)
      : input.table === "feedCursors"
        ? await ctx.db.query("feedCursors").withIndex("by_person", q => q.eq("personId", input.personId)).paginate(options)
        : empty()
    const next: Progress = page.isDone
      ? { stage: input.table === "feedCursors" ? "references" : "parents", rowCursor: null, lastParent: null }
      : { ...state, rowCursor: page.continueCursor }
    return { ...page, isDone: false, continueCursor: encode(next) }
  }
  if (state.stage === "references") {
    if (input.table !== "feedCursors") return fail("policyRefused")
    // Le curseur de rattrapage d'autrui n'est pas possédé par l'auteur effacé ;
    // la boucle générique anonymise seulement sa référence facultative.
    const page = await ctx.db.query("feedCursors").withIndex("by_active_person", q => q.eq("activePersonId", input.personId)).paginate(options)
    return { ...page, continueCursor: page.isDone ? "" : encode({ ...state, rowCursor: page.continueCursor }) }
  }
  if (input.table === "feedCursors") return fail("policyRefused")
  const next = await ctx.db.query("dataErasureTargets")
    .withIndex("by_job_table_target", q => {
      const prefix = q.eq("jobId", input.jobId).eq("table", "posts")
      return state.lastParent === null ? prefix : prefix.gt("targetId", state.lastParent)
    }).take(1)
  const target = next[0]
  if (!target) return empty()
  const postId = ctx.db.normalizeId("posts", target.targetId)
  if (!postId) return fail("policyRefused")
  const page = input.table === "feedEntries"
    ? await ctx.db.query("feedEntries").withIndex("by_post", q => q.eq("postId", postId)).paginate(options)
    : await ctx.db.query("feedFanoutJobs").withIndex("by_post", q => q.eq("postId", postId)).paginate(options)
  // Un parent terminé avance par identifiant ; la page suivante commence au
  // premier parent strictement supérieur. Un parent en cours est relu.
  return { ...page, isDone: false, continueCursor: encode({
    stage: "parents", lastParent: page.isDone ? target.targetId : state.lastParent,
    rowCursor: page.isDone ? null : page.continueCursor,
  }) }
}
