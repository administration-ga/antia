// Dupliqué de socle/convex/modules/reseauPages/graph.ts @ ad2e7fdc2 — adaptations : abonnés en PERSONNES ; « mes pages suivies » lues DEPUIS un réseau (celles du réseau, ou, à la racine, toutes — leurs publications de la racine seules y sont lues) ; ensemble borné rendu AVEC sa lacune (`truncated`, D19) au lieu d'un `Set` muet ; signatures `(réseau, personne)`.
/**
 * Les abonnements aux PAGES — lus au même endroit, jamais recalculés ailleurs.
 * Aucune fonction Convex ici : des lectures partagées par le fil, l'annuaire,
 * le mur d'une page et les rappels.
 */
import { PAGE_FOLLOWS_SCAN } from "@antsia/social-domain/pages"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"

type ReadCtx = Pick<QueryCtx, "db">

/** Un ensemble borné d'identifiants de pages, et s'il a été tronqué. */
export type BoundedPageIds = { ids: ReadonlySet<string>; truncated: boolean }

/**
 * Mes abonnements lisibles DEPUIS ce réseau, les plus récents d'abord : ceux
 * de ses pages ; à la racine, tous (une page d'un réseau fermé n'y montre que
 * ses publications de la racine — la lecture en décide, pas l'abonnement).
 */
export async function myPageFollowRows(ctx: ReadCtx, network: Doc<"networks">, personId: Id<"persons">, limit: number): Promise<Doc<"pageFollows">[]> {
  const take = Math.min(Math.max(limit, 1), PAGE_FOLLOWS_SCAN)
  if (network.kind === "root") {
    return await ctx.db
      .query("pageFollows")
      .withIndex("by_person_createdAt", (q) => q.eq("personId", personId))
      .order("desc")
      .take(take)
  }
  return await ctx.db
    .query("pageFollows")
    .withIndex("by_network_person_createdAt", (q) => q.eq("networkId", network._id).eq("personId", personId))
    .order("desc")
    .take(take)
}

/** Les pages que je suis, d'ici, en UNE lecture bornée — et si l'ensemble a été tronqué. */
export async function followedPageIds(ctx: ReadCtx, network: Doc<"networks">, personId: Id<"persons">): Promise<BoundedPageIds> {
  const rows = await myPageFollowRows(ctx, network, personId, PAGE_FOLLOWS_SCAN)
  return { ids: new Set(rows.map((row) => row.pageId)), truncated: rows.length >= PAGE_FOLLOWS_SCAN }
}

/** La ligne d'abonnement d'une personne à une page, ou `null`. */
export async function pageFollowOf(ctx: ReadCtx, pageId: Id<"pages">, personId: Id<"persons">): Promise<Doc<"pageFollows"> | null> {
  return await ctx.db
    .query("pageFollows")
    .withIndex("by_page_person", (q) => q.eq("pageId", pageId).eq("personId", personId))
    .unique()
}

/** Suis-je cette page ? (une paire, une lecture indexée) */
export async function isFollowingPage(ctx: ReadCtx, pageId: Id<"pages">, personId: Id<"persons">): Promise<boolean> {
  return (await pageFollowOf(ctx, pageId, personId)) !== null
}
