// Dupliqué de socle/convex/modules/icom/notifyFanout.ts @ ad2e7fdc2 — adaptations : PATRON repris (lots de 150, job chaîné qui se replanifie, aucune écriture sur le document parent), code réécrit pour la cloche sociale du moteur : sources de destinataires génériques (liste de personnes, abonnés d'une personne dans le réseau), porte unique `notifyPerson`, dédoublonnage par sa clé.
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
import { type NotificationSubjectRef, notifyPerson } from "./notify"
import { notificationKindValidator, notificationSubjectValidator } from "./tables"

/** Taille d'un lot : quelques transactions chaînées pour un grand groupe. */
export const FANOUT_BATCH_SIZE = 150

/** D'où viennent les destinataires — une liste explicite, ou une source paginée du moteur. */
export const fanoutSourceValidator = v.union(
  v.object({ kind: v.literal("persons"), personIds: v.array(v.id("persons")) }),
  v.object({ kind: v.literal("followers"), targetPersonId: v.id("persons") }),
)

export type FanoutInput = {
  networkId: Id<"networks">
  actorPersonId?: Id<"persons">
  kind: NotificationKind
  subject?: NotificationSubjectRef
  source: Infer<typeof fanoutSourceValidator>
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
    let recipients: Id<"persons">[]
    let next: { offset: number } | { cursor: string } | null = null
    if (args.source.kind === "persons") {
      const offset = args.offset ?? 0
      recipients = args.source.personIds.slice(offset, offset + FANOUT_BATCH_SIZE)
      if (offset + FANOUT_BATCH_SIZE < args.source.personIds.length) next = { offset: offset + FANOUT_BATCH_SIZE }
    } else {
      const targetPersonId = args.source.targetPersonId
      const page = await ctx.db
        .query("follows")
        .withIndex("by_network_target_createdAt", (q) => q.eq("networkId", args.networkId).eq("targetPersonId", targetPersonId))
        .paginate({ cursor: args.cursor ?? null, numItems: FANOUT_BATCH_SIZE })
      recipients = page.page.map((row) => row.followerPersonId)
      if (!page.isDone) next = { cursor: page.continueCursor }
    }
    let notified = 0
    for (const recipientPersonId of new Set(recipients)) {
      const written = await notifyPerson(ctx, {
        networkId: args.networkId,
        recipientPersonId,
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
