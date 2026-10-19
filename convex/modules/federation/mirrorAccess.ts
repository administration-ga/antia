/** Les objets reflétés restent sous l'autorité de leur source, même si leur badge change. */
import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { RESEAU_PUBLIC_CONTRACT, federationEnvironment } from "@antsia/social-domain/federationProtocol"
import { reseauPublicNetwork } from "./reseauPublicAccess"

export async function isFederatedPage(ctx: Pick<QueryCtx, "db">, pageId: Id<"pages">): Promise<boolean> {
  const mirrors = await ctx.db
    .query("mirrors")
    .withIndex("by_local", (q) => q.eq("localTable", "pages").eq("localId", pageId))
    .take(1)
  return mirrors.length > 0
}

export async function assertNativePageManagement(ctx: Pick<QueryCtx, "db">, pageId: Id<"pages">): Promise<void> {
  if (await isFederatedPage(ctx, pageId)) notFound()
}

/** Un retrait source ou une désactivation d’émetteur prime sur toute restauration locale. */
export async function isFederatedContentAvailable(ctx: Pick<QueryCtx, "db">, table: "pages" | "posts", id: string): Promise<boolean> {
  const matches = await ctx.db.query("mirrors").withIndex("by_local", (q) => q.eq("localTable", table).eq("localId", id)).take(2)
  if (matches.length === 0) {
    if (table === "posts") {
      const postId = ctx.db.normalizeId("posts", id)
      const post = postId ? await ctx.db.get(postId) : null
      // Publication native : sans source fédérée, avec un auteur personnel — ou, seule exception,
      // une publication de galerie d'évènement de page (DG-023), déposée sous la page sans auteur ;
      // ses gardes de page et de galerie restent appliquées en aval.
      return post !== null && post.federationSource === undefined && (post.authorPersonId !== undefined || post.pageEventGalleryId !== undefined)
    }
    const pageId = ctx.db.normalizeId("pages", id)
    const page = pageId ? await ctx.db.get(pageId) : null
    return page !== null && !page.importRef?.startsWith(`${RESEAU_PUBLIC_CONTRACT}:`)
  }
  const mirror = matches[0]
  if (matches.length !== 1 || !mirror || mirror.contract !== RESEAU_PUBLIC_CONTRACT || mirror.sourceState !== "active") return false
  const emitter = await ctx.db.get(mirror.emitterId)
  if (!emitter || emitter.environment !== mirror.environment || emitter.networkId !== mirror.networkId
    || federationEnvironment(process.env.FEDERATION_ENVIRONMENT) !== mirror.environment || !(await reseauPublicNetwork(ctx, emitter))) return false
  if (table === "posts") {
    const postId = ctx.db.normalizeId("posts", id)
    const post = postId ? await ctx.db.get(postId) : null
    if (!post?.pageId || post.networkId !== mirror.networkId || post.federationSource?.emitterId !== emitter._id || post.federationSource.objectRef !== mirror.objectRef) return false
    const page = await ctx.db.get(post.pageId)
    if (!page || page.status !== "active" || page.trust !== "official" || !page.onRoot) return false
    return await isFederatedContentAvailable(ctx, "pages", page._id)
  }
  const pageId = ctx.db.normalizeId("pages", id)
  const page = pageId ? await ctx.db.get(pageId) : null
  return page !== null && page.networkId === mirror.networkId && page.importRef === `${RESEAU_PUBLIC_CONTRACT}:${emitter.slug}:${mirror.environment}:${mirror.objectRef}`
}
