/** PA8 : extrait d'une cible assignée, jamais une porte sur son contexte privé. */
import type { PostMediaDto } from "@antsia/social-contracts/media"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { networkQuery } from "../../lib/functions"
import { postMediaDtoValidator, resolvePostMediaDtos } from "../media/media"
import { isPublishedPerson } from "../people/miniProfile"
import { requireReportCapacity, teamCapacity } from "./cases"
import { contentState } from "./policy"
import { moderationSurfaceValidator, moderationTargetValidator } from "./tables"
import type { ModerationTarget } from "./targets"

type Preview = { kind: ModerationTarget["kind"]; available: boolean; title: string | null; body: string | null; media: PostMediaDto[] }
const excerpt = (value: string | undefined, maximum = 4_000) => value ? value.slice(0, maximum) : null

/** Aucun stockage brut, auteur, contact, participant ou contenu voisin ne sort. */
async function targetPreview(ctx: QueryCtx, networkId: Id<"networks">, target: ModerationTarget): Promise<Preview> {
  const empty: Preview = { kind: target.kind, available: false, title: null, body: null, media: [] }
  switch (target.kind) {
    case "post": {
      const row = await ctx.db.get(target.id)
      if (!row || row.networkId !== networkId) return empty
      return { ...empty, available: true, body: excerpt(row.body), media: await resolvePostMediaDtos(ctx, row.media?.slice(0, 4)) }
    }
    case "comment": {
      const row = await ctx.db.get(target.id)
      const post = row ? await ctx.db.get(row.postId) : null
      return row && post?.networkId === networkId && row.networkId === networkId ? { ...empty, available: true, body: excerpt(row.body) } : empty
    }
    case "groupMessage": {
      const row = await ctx.db.get(target.id)
      if (!row || row.networkId !== networkId || row.type !== "text" || row.deletedAt !== undefined) return empty
      // Seulement le message signalé : aucune pièce jointe, aucun participant ni fil.
      return { ...empty, available: true, body: excerpt(row.content) }
    }
    case "event": {
      const row = await ctx.db.get(target.id)
      return row?.networkId === networkId ? { ...empty, available: true, title: excerpt(row.title, 200), body: excerpt(row.description) } : empty
    }
    case "page": {
      const row = await ctx.db.get(target.id)
      return row?.networkId === networkId ? { ...empty, available: true, title: excerpt(row.name, 200), body: excerpt(row.description) } : empty
    }
    case "person": {
      const row = await ctx.db.get(target.id)
      const membership = row ? await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", row._id)).unique() : null
      if (!row || !membership || !isPublishedPerson(row) || row.deletionRequestedAt !== undefined) return empty
      return { ...empty, available: true, title: excerpt(row.displayName, 200), body: excerpt(row.headline) }
    }
    case "live": {
      const row = await ctx.db.get(target.id)
      return row?.networkId === networkId ? { ...empty, available: true, title: excerpt(row.title, 200) } : empty
    }
    case "story": {
      const row = await ctx.db.get(target.id)
      if (!row || row.networkId !== networkId || row.expiresAt <= Date.now() || row.removedAt !== undefined) return empty
      return { ...empty, available: true, body: excerpt(row.caption), media: await resolvePostMediaDtos(ctx, [row.media]) }
    }
    case "album": {
      const row = await ctx.db.get(target.id)
      return row?.networkId === networkId && row.deletingAt === undefined && row.status === "published" ? { ...empty, available: true, title: excerpt(row.title, 200), body: excerpt(row.description) } : empty
    }
  }
}

export const preview = networkQuery({
  args: { reportId: v.optional(v.id("reports")), target: v.optional(moderationTargetValidator) },
  returns: v.object({ kind: moderationSurfaceValidator, available: v.boolean(), title: v.union(v.string(), v.null()), body: v.union(v.string(), v.null()), media: v.array(postMediaDtoValidator) }),
  handler: async (ctx, args): Promise<Preview> => {
    if ((args.reportId === undefined) === (args.target === undefined)) return notFound()
    if (args.reportId !== undefined) {
      const report = await ctx.db.get(args.reportId)
      if (!report || report.networkId !== ctx.networkId || (report.status !== "open" && report.status !== "reviewing") || !await requireReportCapacity(ctx, ctx, report)) return notFound()
      return await targetPreview(ctx, ctx.networkId, report.target)
    }
    const target = args.target
    if (!target) return notFound()
    const state = await contentState(ctx, target.kind, target.id)
    if (!state || state.networkId !== ctx.networkId || state.status !== "pending_review") return notFound()
    const teams = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(101)
    if (teams.length > 100) return notFound()
    const team = teams.find((row) => row.scope === target.kind) ?? teams.find((row) => row.scope === undefined)
    if (!await teamCapacity(ctx, ctx, target.kind, team?._id)) return notFound()
    return await targetPreview(ctx, ctx.networkId, target)
  },
})
