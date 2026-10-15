// Dupliqué de socle/convex/modules/icom/notifyFanout.ts @ ad2e7fdc2 — adaptations : PATRON repris (lots de 150, job chaîné qui se replanifie, aucune écriture sur le document parent), code réécrit pour la cloche sociale du moteur : sources de destinataires génériques (liste de personnes, abonnés d'une personne dans le réseau, abonnés aux commentaires d'une publication, abonnés d'une PAGE à sa publication (lot 13) — chacun re-gardé au moment de sonner, D08), porte unique `notifyPerson`, dédoublonnage par sa clé.
/**
 * Diffusion de la cloche PAR LOTS CHAÎNÉS, hors de la transaction de l'émetteur.
 *
 * Une mutation qui notifierait 999 membres en boucle frôlerait les limites d'une
 * transaction et entrerait en conflit avec toute écriture voisine (D07, D08).
 * Ici : UN job planifié par l'émetteur, qui traite 150 destinataires par la
 * porte unique, puis se replanifie tant que la source n'est pas épuisée. Le job
 * ne touche JAMAIS le document du sujet : zéro conflit avec ses écritures.
 */
import type { NotificationKind } from "@antia/social-domain/notifications"
import { type Infer, v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { canSeePostDoc } from "../posts/access"
import { openingNetworkFor } from "../posts/postNotify"
import { type NotificationSubjectRef, notifyPerson } from "./notify"
import { notificationKindValidator, notificationSubjectValidator } from "./tables"

/** Taille d'un lot : quelques transactions chaînées pour un grand groupe. */
export const FANOUT_BATCH_SIZE = 150

/** D'où viennent les destinataires — une liste explicite, ou une source paginée du moteur. */
export const fanoutSourceValidator = v.union(
  v.object({ kind: v.literal("persons"), personIds: v.array(v.id("persons")) }),
  v.object({ kind: v.literal("followers"), targetPersonId: v.id("persons") }),
  /**
   * Les abonnés aux commentaires d'une publication (marque `notify`), chacun
   * sonné dans le réseau où il s'est abonné, et SEULEMENT s'il voit encore la
   * publication : un abonnement est vivant, ce n'est pas une copie d'audience.
   */
  v.object({ kind: v.literal("postSubscribers"), postId: v.id("posts") }),
  /**
   * Les ABONNÉS de la page d'une publication de page, chacun sonné dans le
   * réseau d'où il peut l'ouvrir (celui de la page s'il en est membre, sinon la
   * racine pour une publication de la racine), et SEULEMENT s'il la voit
   * encore — la note aux abonnés comprise.
   */
  v.object({ kind: v.literal("pageFollowers"), postId: v.id("posts") }),
)

export type FanoutInput = {
  networkId: Id<"networks">
  actorPersonId?: Id<"persons">
  kind: NotificationKind
  subject?: NotificationSubjectRef
  source: Infer<typeof fanoutSourceValidator>
}

type Delivery = { networkId: Id<"networks">; recipientPersonId: Id<"persons"> }
type Batch = { deliveries: Delivery[]; next: { offset: number } | { cursor: string } | null }

async function readBatch(ctx: MutationCtx, args: { networkId: Id<"networks">; source: FanoutInput["source"]; offset?: number; cursor?: string | null }): Promise<Batch> {
  const source = args.source
  if (source.kind === "persons") {
    const offset = args.offset ?? 0
    const ids = source.personIds.slice(offset, offset + FANOUT_BATCH_SIZE)
    return {
      deliveries: [...new Set(ids)].map((recipientPersonId) => ({ networkId: args.networkId, recipientPersonId })),
      next: offset + FANOUT_BATCH_SIZE < source.personIds.length ? { offset: offset + FANOUT_BATCH_SIZE } : null,
    }
  }
  if (source.kind === "followers") {
    const page = await ctx.db
      .query("follows")
      .withIndex("by_network_target_createdAt", (q) => q.eq("networkId", args.networkId).eq("targetPersonId", source.targetPersonId))
      .paginate({ cursor: args.cursor ?? null, numItems: FANOUT_BATCH_SIZE })
    return {
      deliveries: page.page.map((row) => ({ networkId: args.networkId, recipientPersonId: row.followerPersonId })),
      next: page.isDone ? null : { cursor: page.continueCursor },
    }
  }
  if (source.kind === "pageFollowers") {
    const post = await ctx.db.get(source.postId)
    if (!post || post.pageId === undefined) return { deliveries: [], next: null }
    const pageId = post.pageId
    const followers = await ctx.db
      .query("pageFollows")
      .withIndex("by_page_createdAt", (q) => q.eq("pageId", pageId))
      .paginate({ cursor: args.cursor ?? null, numItems: FANOUT_BATCH_SIZE })
    const deliveries: Delivery[] = []
    for (const follow of followers.page) {
      const network = await openingNetworkFor(ctx, post, follow.personId)
      if (network && (await canSeePostDoc(ctx, { personId: follow.personId, network }, post))) deliveries.push({ networkId: network._id, recipientPersonId: follow.personId })
    }
    return { deliveries, next: followers.isDone ? null : { cursor: followers.continueCursor } }
  }
  const page = await ctx.db
    .query("postMarks")
    .withIndex("by_post_and_kind", (q) => q.eq("postId", source.postId).eq("kind", "notify"))
    .paginate({ cursor: args.cursor ?? null, numItems: FANOUT_BATCH_SIZE })
  const post = await ctx.db.get(source.postId)
  const deliveries: Delivery[] = []
  if (post) {
    for (const mark of page.page) {
      const network = await ctx.db.get(mark.networkId)
      if (network && (await canSeePostDoc(ctx, { personId: mark.personId, network }, post))) deliveries.push({ networkId: mark.networkId, recipientPersonId: mark.personId })
    }
  }
  return { deliveries, next: page.isDone ? null : { cursor: page.continueCursor } }
}

export const fanoutNotifications = internalMutation({
  args: {
    networkId: v.id("networks"),
    actorPersonId: v.optional(v.id("persons")),
    kind: notificationKindValidator,
    subject: v.optional(notificationSubjectValidator),
    source: fanoutSourceValidator,
    /** Position dans une liste explicite, ou curseur natif d'une source paginée. */
    offset: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ notified: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const { deliveries, next } = await readBatch(ctx, args)
    let notified = 0
    for (const delivery of deliveries) {
      const written = await notifyPerson(ctx, {
        networkId: delivery.networkId,
        recipientPersonId: delivery.recipientPersonId,
        ...(args.actorPersonId !== undefined ? { actorPersonId: args.actorPersonId } : {}),
        kind: args.kind,
        ...(args.subject ? { subject: args.subject } : {}),
      })
      if (written !== null) notified += 1
    }
    if (next) await ctx.scheduler.runAfter(0, internal.modules.notifications.fanout.fanoutNotifications, { ...args, ...next })
    return { notified, done: next === null }
  },
})

/** Planifie une diffusion (premier lot) depuis la transaction de l'émetteur. */
export async function enqueueFanout(ctx: Pick<MutationCtx, "scheduler">, input: FanoutInput): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.modules.notifications.fanout.fanoutNotifications, input)
}
