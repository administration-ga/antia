// Dupliqué de socle/convex/modules/iappel/voicemail.ts @ ad2e7fdc2 — adaptations : messagerie vocale PAR RÉSEAU ; portée et organisation retirées (V28) ; un message n'est laissé que par l'APPELANT d'un tête-à-tête TERMINÉ sans avoir été décroché, jamais sur un refus « hors de mes relations » (décision 6d du socle, désormais tenue par le serveur), à un destinataire toujours membre et sans blocage ; dépôt de l'enregistrement par une URL de dépôt à usage nommé (`voice`), puis fraîcheur (le blob d'autrui n'est jamais adopté) ET admission à la garde des fichiers (type et poids relus au stockage, source `voice`) ; cloche `voicemail_left` par la porte unique (aucun titre ni corps stocké, ni adresse en dur) ; expéditeur nommé par le contrat `counterpartLabel` (jamais d'état civil ni d'e-mail, D21) ; écoute servie par la GARDE de délivrance (retenue dite tant que l'analyse n'a pas parlé, D05) ; effacement : blob ET ligne d'analyse purgés, avis de la cloche retiré ; refus à code ; débit.
/**
 * Appels — la MESSAGERIE VOCALE d'un tête-à-tête qui n'a pas abouti.
 *
 * C'est l'APPELANT qui s'enregistre lui-même, depuis son navigateur, et dépose
 * le fichier — aucun pipeline serveur. Un appel n'accepte qu'UN message : un
 * second dépôt (réseau qui rejoue, double clic) rend celui qui existe.
 */
import { MAX_VOICEMAIL_DURATION_MS } from "@antsia/social-contracts/calls"
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { failRule, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { guardUploadUrl } from "../../lib/uploadPolicy"
import { admitStoredUpload, assertFreshUpload } from "../files/admission"
import { purgeStoredFile } from "../files/purge"
import { resolveFileDelivery, type WithheldCode, withheldCodeOf, withheldCodeValidator } from "../files/storageGuard"
import { isBlockedBetween } from "../graph/graph"
import { counterpartOf } from "../messaging/participation"
import { dropNotificationsAbout, notifyPerson } from "../notifications/notify"
import { miniProfileCache } from "../people/miniProfile"
import { requireCallInNetwork } from "./access"

const DEFAULT_LIST_LIMIT = 20
const MAX_LIST_LIMIT = 50

/** L'URL de dépôt d'un enregistrement vocal — usage NOMMÉ (`voice`), confronté au fichier à l'admission. */
export const generateUploadUrl = networkMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "upload.url", ctx.person._id)
    return await guardUploadUrl(ctx, "voice")
  },
})

/**
 * Laisser un message à qui n'a pas décroché. Réservé à l'APPELANT d'un
 * tête-à-tête TERMINÉ sans décrochage. Idempotent par appel — AVANT tout autre
 * contrôle métier : rejouer un dépôt accepté retrouve ce qui existe, sans
 * re-juger des réglages qui ont pu changer entre-temps.
 */
export const leave = networkMutation({
  args: { callId: v.id("calls"), storageId: v.id("_storage"), durationMs: v.number(), mimeType: v.optional(v.string()) },
  returns: v.object({ voicemailId: v.id("voicemails"), alreadyLeft: v.boolean() }),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "voicemail.leave", me)
    const call = await requireCallInNetwork(ctx, ctx.networkId, args.callId)
    // Seul celui qui a COMPOSÉ le numéro laisse un message : c'est son silence qu'on enregistre.
    if (call.createdByPersonId !== me) return notFound()
    const recipientId = call.calleePersonId
    if (call.kind !== "direct" || recipientId === undefined || call.status !== "ended" || call.answeredAt !== undefined) return failRule("VOICEMAIL_DIRECT_ONLY")
    if (!(args.durationMs > 0 && args.durationMs <= MAX_VOICEMAIL_DURATION_MS)) return failRule("VOICEMAIL_DURATION", { maxSeconds: Math.floor(MAX_VOICEMAIL_DURATION_MS / 1000) })

    const existing = await ctx.db
      .query("voicemails")
      .withIndex("by_call", (q) => q.eq("callId", call._id))
      .unique()
    if (existing) return { voicemailId: existing._id, alreadyLeft: true }

    // « Hors de mes relations » n'offre aucune messagerie vocale : ce serait le contournement du réglage.
    if (call.endReason === "outside_relations") return failRule("VOICEMAIL_DISABLED")
    const prefs = await ctx.db
      .query("callPreferences")
      .withIndex("by_person", (q) => q.eq("personId", recipientId))
      .unique()
    if (prefs?.voicemailEnabled === false) return failRule("VOICEMAIL_DISABLED")
    if (!(await isActiveMember(ctx, ctx.networkId, recipientId)) || (await isBlockedBetween(ctx, me, recipientId))) return notFound()

    // Un dépôt n'adopte jamais le fichier d'autrui : seul un blob NEUF de l'appelant devient la pièce du message.
    await assertFreshUpload(ctx, me, args.storageId)
    await admitStoredUpload(ctx, { storageId: args.storageId, usage: "voice", ...(args.mimeType ? { mimeType: args.mimeType } : {}) }, { source: "voice", networkId: ctx.networkId, uploadedByPersonId: me })

    const voicemailId = await ctx.db.insert("voicemails", {
      networkId: ctx.networkId,
      recipientPersonId: recipientId,
      fromPersonId: me,
      callId: call._id,
      audioStorageId: args.storageId,
      durationMs: Math.round(args.durationMs),
      isRead: false,
      createdAt: Date.now(),
    })
    await notifyPerson(ctx, { networkId: ctx.networkId, recipientPersonId: recipientId, actorPersonId: me, kind: "voicemail_left", subject: { voicemail: voicemailId } })
    return { voicemailId, alreadyLeft: false }
  },
})

export type VoicemailItemDto = {
  voicemailId: Id<"voicemails">
  from: { personId: Id<"persons">; label: CounterpartLabel }
  durationMs: number
  isRead: boolean
  readAt: number | null
  createdAt: number
}

/**
 * MA messagerie vocale dans ce réseau, la plus récente d'abord. `unreadCount`
 * compte les non-lus de la PAGE rendue. Aucune URL d'écoute ici : `playbackUrl`
 * la délivre à la demande, sous la garde des fichiers.
 */
export const listMine = networkQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ items: VoicemailItemDto[]; unreadCount: number }> => {
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT)
    const rows = await ctx.db
      .query("voicemails")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("recipientPersonId", ctx.person._id))
      .order("desc")
      .take(limit)
    const profileOf = miniProfileCache(ctx)
    const items: VoicemailItemDto[] = []
    let unreadCount = 0
    for (const row of rows) {
      if (!row.isRead) unreadCount += 1
      items.push({
        voicemailId: row._id,
        from: { personId: row.fromPersonId, label: await counterpartOf(ctx, row.fromPersonId, profileOf) },
        durationMs: row.durationMs,
        isRead: row.isRead,
        readAt: row.readAt ?? null,
        createdAt: row.createdAt,
      })
    }
    return { items, unreadCount }
  },
})

/** Le message, s'il est de CE réseau et que j'en suis le destinataire — sinon le refus indistinct. */
async function requireReceivedVoicemail(ctx: Pick<QueryCtx, "db">, networkId: Id<"networks">, voicemailId: Id<"voicemails">, me: Id<"persons">): Promise<Doc<"voicemails">> {
  const voicemail = await ctx.db.get(voicemailId)
  if (!voicemail || voicemail.networkId !== networkId || voicemail.recipientPersonId !== me) return notFound()
  return voicemail
}

/** Marquer un message comme lu. Idempotent : `readAt` n'est jamais réécrit (la première écoute est un fait). */
export const markRead = networkMutation({
  args: { voicemailId: v.id("voicemails") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "voicemail.read", ctx.person._id)
    const voicemail = await requireReceivedVoicemail(ctx, ctx.networkId, args.voicemailId, ctx.person._id)
    if (!voicemail.isRead) await ctx.db.patch(voicemail._id, { isRead: true, readAt: Date.now() })
    return null
  },
})

/**
 * L'URL d'écoute — MUTATION, pas query : une URL signée a une durée de vie, la
 * fabriquer dans une query en émettrait une nouvelle à chaque rafraîchissement.
 * Le destinataire écoute ce qu'on lui a laissé ; l'expéditeur peut se réécouter.
 * Servie par la GARDE : tant que l'analyse n'a pas parlé, la retenue est DITE.
 */
export const playbackUrl = networkMutation({
  args: { voicemailId: v.id("voicemails") },
  returns: v.object({ url: v.union(v.string(), v.null()), withheld: v.union(withheldCodeValidator, v.null()) }),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "voicemail.read", me)
    const voicemail = await ctx.db.get(args.voicemailId)
    if (!voicemail || voicemail.networkId !== ctx.networkId || (voicemail.recipientPersonId !== me && voicemail.fromPersonId !== me)) return notFound()
    const delivery = await resolveFileDelivery(ctx, voicemail.audioStorageId)
    const withheld: WithheldCode | null = delivery.url === null ? (withheldCodeOf(delivery.scan) ?? "fileScanPending") : null
    return { url: delivery.url, withheld }
  },
})

/**
 * Supprimer un message reçu — la ligne ET l'enregistrement (blob et ligne
 * d'analyse) : un message privé écouté et supprimé ne doit RIEN laisser. L'avis
 * de la cloche qui le désignait part avec lui.
 */
export const deleteMine = networkMutation({
  args: { voicemailId: v.id("voicemails") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "voicemail.read", ctx.person._id)
    const voicemail = await requireReceivedVoicemail(ctx, ctx.networkId, args.voicemailId, ctx.person._id)
    await purgeStoredFile(ctx, voicemail.audioStorageId)
    await ctx.db.delete(voicemail._id)
    await dropNotificationsAbout(ctx, { networkId: ctx.networkId, recipientPersonId: ctx.person._id, kind: "voicemail_left", subject: { voicemail: voicemail._id }, limit: 5 })
    return null
  },
})
