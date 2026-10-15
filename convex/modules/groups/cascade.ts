// Dupliqué de socle/convex/modules/reseauPersonnel/groupes.ts (l. 2885-3112 : `isExclusiveGroupAttachment`, `deleteGroupCascadeBatch`, `continueDeleteGroup`, `deleteGroup`) @ ad2e7fdc2 — adaptations : garde du fil par réseau ; mécanique d'appel retirée (lot 15) ; purge = blob ET ligne d'analyse (D10) ; une pièce n'est purgée que si son message n'est pas une copie, que le registre la dit déposée par son auteur, et qu'AUCUNE copie vivante (1:1 ou groupe) ne la sert encore ; masquages (D22) et réactions par lots ; appartenances décomptées de l'agrégat (D02) et de la pastille (D23) ; cloches du fil retirées (`group_message` des membres, `group_added` des conviés) ; la photo du groupe, admise pour lui seul, est purgée ; refus à code.
/**
 * SUPPRIMER un groupe pour tout le monde — le propriétaire seul, par arbitrage
 * explicite (dans un groupe, les autres n'ont pas à perdre leur conversation :
 * l'écran fait confirmer en nommant combien la perdront).
 *
 * Le fil devient introuvable À L'INSTANT (`deletingAt`), puis une cascade
 * BORNÉE retire messages, réactions, masquages, pièces, appartenances,
 * saisies, invitations, liens, cloches, photo et le fil — en une transaction
 * pour un petit groupe, par continuations chaînées pour un historique lourd.
 */
import { canDeleteGroupThread } from "@antia/social-domain/groupThreads"
import { type Infer, v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { findScanByStorageId } from "../files/admission"
import { purgeStoredFile } from "../files/purge"
import { dropNotificationsAbout } from "../notifications/notify"
import { requireLiveMembership, unrecordThreadMember } from "./access"
import { purgeGroupAvatar } from "./threads"
import { releaseMemberUnread } from "./unread"

/** Lignes par transaction : assez bas pour les limites, assez haut pour vider un petit groupe d'un coup. */
const DELETE_BATCH = 50
/** Membres par transaction : chacun emporte ses cloches du fil. */
const MEMBERS_BATCH = 25
/** Cloches d'un destinataire retirées par passage (une par expéditeur distinct). */
const BELLS_BATCH = 40

const stageValidator = v.union(v.literal("messages"), v.literal("members"), v.literal("typing"), v.literal("invites"), v.literal("links"), v.literal("final"))
type Stage = Infer<typeof stageValidator>

/**
 * Le blob d'une pièce n'est PURGÉ avec son message que s'il n'appartient qu'à
 * lui : pas une copie (le blob est celui de l'original), déposé par l'auteur du
 * message selon le registre, et servi par AUCUNE copie vivante. Dans le doute,
 * orphelin plutôt que détruit.
 */
async function isExclusiveAttachment(ctx: MutationCtx, message: Doc<"groupMessages">, storageId: Id<"_storage">): Promise<boolean> {
  if (message.forwardedFrom !== undefined) return false
  const scan = await findScanByStorageId(ctx, storageId)
  if (!scan || scan.uploadedByPersonId !== message.senderPersonId) return false
  const [personalCopy, groupCopy] = await Promise.all([
    ctx.db
      .query("personalMessages")
      .withIndex("by_forwarded_message", (q) => q.eq("forwardedFrom.messageId", message._id))
      .first(),
    ctx.db
      .query("groupMessages")
      .withIndex("by_forwarded_message", (q) => q.eq("forwardedFrom.messageId", message._id))
      .first(),
  ])
  return personalCopy === null && groupCopy === null
}

async function continueLater(ctx: MutationCtx, threadId: Id<"groupThreads">, stage: Stage): Promise<{ done: false }> {
  await ctx.scheduler.runAfter(0, internal.modules.groups.cascade.continueDeleteGroup, { threadId, stage })
  return { done: false }
}

/**
 * UNE transaction bornée de la cascade : tant qu'une étape remplit son lot,
 * elle se replanifie au même endroit ; sinon elle poursuit aussitôt la suivante.
 */
async function cascadeBatch(ctx: MutationCtx, thread: Doc<"groupThreads">, initial: Stage): Promise<{ done: boolean }> {
  const threadId = thread._id
  const subject = { groupThread: threadId }
  let stage = initial
  for (;;) {
    if (stage === "messages") {
      const messages = await ctx.db
        .query("groupMessages")
        .withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId))
        .take(DELETE_BATCH)
      for (const message of messages) {
        const [reactions, hides] = await Promise.all([
          ctx.db
            .query("groupMessageReactions")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .take(DELETE_BATCH),
          ctx.db
            .query("groupMessageHides")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .take(DELETE_BATCH),
        ])
        for (const row of reactions) await ctx.db.delete(row._id)
        for (const row of hides) await ctx.db.delete(row._id)
        // Un lot entier : le message reste jusqu'à la transaction suivante, aucune référence pendante.
        if (reactions.length === DELETE_BATCH || hides.length === DELETE_BATCH) return await continueLater(ctx, threadId, stage)
        for (const file of message.attachmentFiles ?? []) {
          if (await isExclusiveAttachment(ctx, message, file.storageId)) await purgeStoredFile(ctx, file.storageId)
        }
        await ctx.db.delete(message._id)
      }
      if (messages.length === DELETE_BATCH) return await continueLater(ctx, threadId, stage)
      stage = "members"
      continue
    }
    if (stage === "members") {
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_thread_person", (q) => q.eq("threadId", threadId))
        .take(MEMBERS_BATCH)
      for (const member of members) {
        const bells = await dropNotificationsAbout(ctx, { networkId: thread.networkId, recipientPersonId: member.personId, kind: "group_message", subject, limit: BELLS_BATCH })
        if (bells.more) return await continueLater(ctx, threadId, stage)
        if (member.leftAt === undefined) {
          await releaseMemberUnread(ctx, member, {})
          await unrecordThreadMember(ctx, member)
        }
        await ctx.db.delete(member._id)
      }
      if (members.length === MEMBERS_BATCH) return await continueLater(ctx, threadId, stage)
      stage = "typing"
      continue
    }
    if (stage === "typing") {
      const rows = await ctx.db
        .query("groupTyping")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .take(DELETE_BATCH)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === DELETE_BATCH) return await continueLater(ctx, threadId, stage)
      stage = "invites"
      continue
    }
    if (stage === "invites") {
      const rows = await ctx.db
        .query("groupInvites")
        .withIndex("by_thread_invitee", (q) => q.eq("threadId", threadId))
        .take(DELETE_BATCH)
      for (const row of rows) {
        const bells = await dropNotificationsAbout(ctx, { networkId: thread.networkId, recipientPersonId: row.inviteePersonId, kind: "group_added", subject, limit: BELLS_BATCH })
        if (bells.more) return await continueLater(ctx, threadId, stage)
        await ctx.db.delete(row._id)
      }
      if (rows.length === DELETE_BATCH) return await continueLater(ctx, threadId, stage)
      stage = "links"
      continue
    }
    if (stage === "links") {
      const rows = await ctx.db
        .query("groupInviteLinks")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .take(DELETE_BATCH)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === DELETE_BATCH) return await continueLater(ctx, threadId, stage)
      stage = "final"
      continue
    }
    // La photo n'appartient qu'à ce fil (dépôt neuf, admis pour lui) : purgée avec lui.
    if (thread.avatarStorageId !== undefined) await purgeGroupAvatar(ctx, thread.avatarStorageId)
    await ctx.db.delete(threadId)
    return { done: true }
  }
}

/** Continuation interne d'une suppression volumineuse — jamais une API de suppression implicite. */
export const continueDeleteGroup = internalMutation({
  args: { threadId: v.id("groupThreads"), stage: stageValidator },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) return { done: true }
    if (thread.deletingAt === undefined) return { done: false }
    return await cascadeBatch(ctx, thread, args.stage)
  },
})

/** SUPPRIMER le groupe — le propriétaire seul ; introuvable aussitôt, purgé par lots. */
export const deleteGroup = networkMutation({
  minStatus: "en_attente",
  args: { threadId: v.id("groupThreads") },
  returns: v.object({ deleted: v.literal(true), pending: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "groupThread.manage", ctx.person._id)
    const { thread, member } = await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    if (!canDeleteGroupThread(member.role)) return fail("groupRoleRequired")
    const now = Date.now()
    await ctx.db.patch(thread._id, { deletingAt: now, closedAt: now })
    const result = await cascadeBatch(ctx, { ...thread, deletingAt: now, closedAt: now }, "messages")
    return { deleted: true as const, pending: !result.done }
  },
})
