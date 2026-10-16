// Dupliqué de socle/convex/modules/reseauPersonnel/groupes.ts (l. 1025-1362 lectures et projection, l. 1364-1835 écritures : `projectPinnedGroupMessage`, `projectGroupMessages`, `paginateGroupMessages`, `generateAttachmentUploadUrl`, `sendGroupMessage`, `toggleGroupMessageReaction`, `deleteGroupMessageForMe`, `editGroupMessage`, `deleteGroupMessage`, `setGroupPinnedMessage`) @ ad2e7fdc2 — adaptations : garde du fil par réseau ; `listGroupMessages` (curseur par instant, ex æquo perdus) non recopiée, la pagination native seule ; contenu jugé par le contrat partagé (une seule borne pour tous les messages) ; pièces par la garde des fichiers (`verifyDeclaredAttachments`, source `group`) ; UN point d'insertion (`appendGroupMessage`) que partagent l'envoi et le transfert : aperçu en nature, curseur de l'expéditeur, diffusion par lots (non-lus, activité, cloche — D07, D23) ; masquage « pour moi » dans `groupMessageHides` (D22), lus par plage pour une page ; DTO allowlisté (personnes nommées par `counterpartLabel`, jamais d'e-mail) ; réagir, citer et épingler exigent de VOIR le message (plancher d'arrivée, effacement, masquage, blocage) ; un retrait pour tous efface l'aperçu au lieu d'écrire « [Message supprimé] » (D37) ; refus à code ; débit ; l'événement `call_started` rend sa référence d'appel (lot 15).
/**
 * Les messages d'une conversation de groupe : lire, envoyer, réagir, masquer,
 * modifier, retirer, épingler.
 *
 * Trois retraits se cumulent à la lecture, et aucun n'est un style :
 *  - « pour moi » fait disparaître la ligne de MA lecture seulement ;
 *  - le BLOCAGE retire le corps (texte, pièces, extrait cité) de l'expéditeur
 *    bloqué, dans les deux sens — la ligne reste, `masked` le dit ;
 *  - un message cité qui m'est caché rend `deleted` sans son texte.
 */
import { replyExcerpt } from "@antsia/social-contracts/attachments"
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { applyMessageReactionDelta, emptyMessageReactionCounts, type MessageReactionCounts, type MessageReactionKind, nextMessageReactionKind } from "@antsia/social-contracts/messageReactions"
import { assertMessageContent, isWithinEditWindow, MESSAGE_EDIT_WINDOW_MS } from "@antsia/social-contracts/messaging"
import { isGroupThreadManager } from "@antsia/social-domain/groupThreads"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { type Infer, v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { checked, fail, failRule, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { guardUploadUrl } from "../../lib/uploadPolicy"
import { miniProfileCache } from "../people/miniProfile"
import { attachmentFileValidator, type StoredAttachment, verifyDeclaredAttachments } from "../messaging/attachmentStorage"
import { type ForwardedFrom, isForwardedOriginAlive } from "../messaging/forwardedFrom"
import { type AttachmentDto, counterpartOf, deliverAttachments } from "../messaging/participation"
import { previewColumns } from "../messaging/threads"
import { messageReactionCountsValidator, messageReactionKindValidator } from "../messaging/tables"
import { blockedCache, historyFloor, isClearedForMember, isHiddenForPerson, requireLiveMembership } from "./access"
import type { groupSystemEventValidator } from "./tables"
import { markMemberReadThrough, onMessageHidden, scheduleGroupMessageFanout } from "./unread"

type ReadCtx = Pick<QueryCtx, "db" | "storage">
type GroupSystemEvent = Infer<typeof groupSystemEventValidator>

/** MES réactions sur un fil, lues UNE fois par page — jamais une lecture par bulle. */
const MY_REACTIONS_SCAN = 200
/** Messages par page, plafond dur. */
const MESSAGES_MAX = 200
/** Mes masquages relus par plage pour une page ; au-delà, une lecture par message. */
const HIDES_SCAN = 400

// ═══════════════════════════════════════════════════════════════
// Voir un message
// ═══════════════════════════════════════════════════════════════

/**
 * Ce message M'est-il servi ? Ni avant mon arrivée, ni dans ce que j'ai effacé,
 * ni masqué pour moi. (Le blocage, lui, garde la ligne et retire le corps.)
 */
export async function isVisibleToMember(ctx: Pick<QueryCtx, "db">, message: Doc<"groupMessages">, member: Doc<"groupMembers">): Promise<boolean> {
  if (message.threadId !== member.threadId) return false
  if (message.createdAt < historyFloor(member)) return false
  if (isClearedForMember(message, member)) return false
  return !(await isHiddenForPerson(ctx, message._id, member.personId))
}

/** Le message, dans un fil de CE réseau où je suis membre vivant, et qui m'est servi — sinon le refus indistinct. */
async function requireVisibleMessage(ctx: MutationCtx & { networkId: Id<"networks">; person: Doc<"persons"> }, messageId: Id<"groupMessages">) {
  const message = await ctx.db.get(messageId)
  if (!message) return notFound()
  const { thread, member } = await requireLiveMembership(ctx, ctx.networkId, message.threadId, ctx.person._id)
  if (!(await isVisibleToMember(ctx, message, member))) return notFound()
  return { message, thread, member }
}

// ═══════════════════════════════════════════════════════════════
// Projection
// ═══════════════════════════════════════════════════════════════

export type GroupReplyToDto = { messageId: Id<"groupMessages">; senderPersonId: Id<"persons">; excerpt: string; deleted: boolean }

export type GroupMessageDto = {
  messageId: Id<"groupMessages">
  type: "text" | "system"
  /** `null` : pièces seules, corps retiré (blocage), message retiré pour tous. Un événement porte ici un nouveau titre. */
  content: string | null
  event: GroupSystemEvent | null
  attachmentFiles: AttachmentDto[]
  reactions: { counts: MessageReactionCounts; mine: MessageReactionKind | null }
  replyTo: GroupReplyToDto | null
  /** La personne VISÉE par un événement (`member_removed`). */
  target: { personId: Id<"persons">; label: CounterpartLabel } | null
  /** L'appel annoncé par `call_started` — la carte le relit avec sa garde (`calls.listParticipants`). */
  callId: Id<"calls"> | null
  createdAt: number
  isMine: boolean
  /** Le corps a été retiré par le serveur (blocage) : l'écran peut le dire. */
  masked: boolean
  /** Retiré POUR TOUT LE MONDE par son auteur : pierre tombale, jamais un trou. */
  deleted: boolean
  editedAt: number | null
  /** Copie d'un transfert dont l'original est encore servi. */
  forwarded: boolean
  senderPersonId: Id<"persons">
  sender: CounterpartLabel
}

/** MES masquages sur une page : une plage indexée, sinon une lecture par message. */
async function hiddenOnPage(ctx: Pick<QueryCtx, "db">, member: Doc<"groupMembers">, rows: readonly Doc<"groupMessages">[]): Promise<(messageId: Id<"groupMessages">) => Promise<boolean>> {
  if (rows.length === 0) return async () => false
  const times = rows.map((row) => row.createdAt)
  const [from, to] = [Math.min(...times), Math.max(...times)]
  const hides = await ctx.db
    .query("groupMessageHides")
    .withIndex("by_thread_person_messageCreatedAt", (q) => q.eq("threadId", member.threadId).eq("personId", member.personId).gte("messageCreatedAt", from).lte("messageCreatedAt", to))
    .take(HIDES_SCAN)
  if (hides.length < HIDES_SCAN) {
    const hidden = new Set<string>(hides.map((row) => row.messageId))
    return async (messageId) => hidden.has(messageId)
  }
  return async (messageId) => await isHiddenForPerson(ctx, messageId, member.personId)
}

/** Projette une page bornée — la seule projection des messages de groupe. */
export async function projectGroupMessages(ctx: ReadCtx, member: Doc<"groupMembers">, rows: readonly Doc<"groupMessages">[]): Promise<GroupMessageDto[]> {
  const me = member.personId
  const isBlockedWith = blockedCache(ctx, me)
  const isHidden = await hiddenOnPage(ctx, member, rows)
  const profileOf = miniProfileCache(ctx)
  const labels = new Map<string, CounterpartLabel>()
  const labelOf = async (personId: Id<"persons">) => {
    const hit = labels.get(personId)
    if (hit) return hit
    const label = await counterpartOf(ctx, personId, profileOf)
    labels.set(personId, label)
    return label
  }
  const myReactionRows = await ctx.db
    .query("groupMessageReactions")
    .withIndex("by_thread_person", (q) => q.eq("threadId", member.threadId).eq("personId", me))
    .take(MY_REACTIONS_SCAN)
  const mine = new Map<string, MessageReactionKind>(myReactionRows.map((row) => [row.messageId, row.kind]))
  const out: GroupMessageDto[] = []
  for (const row of rows) {
    if (isClearedForMember(row, member) || row.createdAt < historyFloor(member)) continue
    if (await isHidden(row._id)) continue
    const masked = row.type === "text" && (await isBlockedWith(row.senderPersonId))
    const deleted = row.deletedAt !== undefined
    let replyTo: GroupReplyToDto | null = null
    if (row.replyToMessageId !== undefined) {
      const cited = await ctx.db.get(row.replyToMessageId)
      if (cited) {
        // L'extrait subit les MÊMES retraits que le message qu'il cite.
        const unavailable =
          cited.deletedAt !== undefined ||
          !(await isVisibleToMember(ctx, cited, member)) ||
          (cited.type === "text" && (await isBlockedWith(cited.senderPersonId)))
        replyTo = { messageId: cited._id, senderPersonId: cited.senderPersonId, excerpt: unavailable ? "" : replyExcerpt(cited.content), deleted: unavailable }
      }
    }
    out.push({
      messageId: row._id,
      type: row.type,
      content: masked || deleted ? null : (row.content ?? null),
      event: row.event ?? null,
      attachmentFiles: masked || deleted ? [] : await deliverAttachments(ctx, row.attachmentFiles ?? []),
      reactions: { counts: row.reactionCounts ?? emptyMessageReactionCounts(), mine: mine.get(row._id) ?? null },
      replyTo,
      target: row.targetPersonId === undefined ? null : { personId: row.targetPersonId, label: await labelOf(row.targetPersonId) },
      callId: row.callId ?? null,
      createdAt: row.createdAt,
      isMine: row.senderPersonId === me,
      masked,
      deleted,
      editedAt: row.editedAt ?? null,
      forwarded: await isForwardedOriginAlive(ctx, row.forwardedFrom),
      senderPersonId: row.senderPersonId,
      sender: await labelOf(row.senderPersonId),
    })
  }
  return out
}

/**
 * L'historique d'un fil, du plus récent au plus ancien, à curseur NATIF — et
 * jamais en deçà de MON arrivée. Une page peut être plus courte que demandé
 * (masquages, effacement).
 */
export const paginateGroupMessages = networkQuery({
  args: { threadId: v.id("groupThreads"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<GroupMessageDto>> => {
    const { member } = await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    const numItems = Math.min(Math.max(Math.trunc(args.paginationOpts.numItems), 1), MESSAGES_MAX)
    const result = await ctx.db
      .query("groupMessages")
      .withIndex("by_thread_createdAt", (q) => q.eq("threadId", args.threadId).gte("createdAt", historyFloor(member)))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems })
    return { ...result, page: await projectGroupMessages(ctx, member, result.page) }
  },
})

export type GroupPinnedDto = { messageId: Id<"groupMessages">; senderPersonId: Id<"persons">; sender: CounterpartLabel; excerpt: string; hasAttachments: boolean; masked: boolean }

/**
 * L'épingle, RELUE : `null` sans épingle, ou quand le message ne m'est plus
 * servi (retiré, masqué, effacé, d'avant mon arrivée) ; un auteur BLOQUÉ laisse
 * l'épingle mais en masque le corps, comme sa ligne.
 */
export async function projectPinnedGroupMessage(ctx: ReadCtx, thread: Doc<"groupThreads">, member: Doc<"groupMembers">): Promise<GroupPinnedDto | null> {
  if (thread.pinnedMessageId === undefined) return null
  const message = await ctx.db.get(thread.pinnedMessageId)
  if (!message || message.type !== "text" || message.deletedAt !== undefined) return null
  if (!(await isVisibleToMember(ctx, message, member))) return null
  const masked = await blockedCache(ctx, member.personId)(message.senderPersonId)
  return {
    messageId: message._id,
    senderPersonId: message.senderPersonId,
    sender: await counterpartOf(ctx, message.senderPersonId),
    excerpt: masked ? "" : replyExcerpt(message.content),
    hasAttachments: (message.attachmentFiles ?? []).length > 0,
    masked,
  }
}

// ═══════════════════════════════════════════════════════════════
// Écrire
// ═══════════════════════════════════════════════════════════════

/** URL de dépôt d'une pièce de groupe — déposer ne publie rien ; l'envoi juge. */
export const generateAttachmentUploadUrl = networkMutation({
  minStatus: "declaree",
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "upload.url", ctx.person._id)
    return await guardUploadUrl(ctx, "chat_attachment")
  },
})

/** Le message déjà déposé sous cette clé dans ce fil, ou `null`. */
export async function findGroupReplay(ctx: Pick<QueryCtx, "db">, threadId: Id<"groupThreads">, idempotencyKey: string | undefined): Promise<Doc<"groupMessages"> | null> {
  if (idempotencyKey === undefined) return null
  return await ctx.db
    .query("groupMessages")
    .withIndex("by_thread_idempotency", (q) => q.eq("threadId", threadId).eq("idempotencyKey", idempotencyKey))
    .first()
}

export type AppendGroupMessageInput = {
  /** Contenu DÉJÀ jugé par le contrat. */
  content: string
  /** Pièces DÉJÀ vérifiées au stockage. */
  attachmentFiles?: StoredAttachment[]
  replyToMessageId?: Id<"groupMessages">
  idempotencyKey?: string
  forwardedFrom?: ForwardedFrom
}

/**
 * Déposer un message TEXTE dans un fil — le seul point d'insertion, que
 * partagent l'envoi et le transfert : la ligne, l'aperçu en nature, le curseur
 * de l'expéditeur (écrire, c'est avoir vu), puis la diffusion par lots.
 */
export async function appendGroupMessage(ctx: MutationCtx, thread: Doc<"groupThreads">, sender: Doc<"groupMembers">, input: AppendGroupMessageInput): Promise<Id<"groupMessages">> {
  if (thread.closedAt !== undefined) return failRule("GROUP_CLOSED")
  const now = Date.now()
  const messageId = await ctx.db.insert("groupMessages", {
    networkId: thread.networkId,
    threadId: thread._id,
    senderPersonId: sender.personId,
    type: "text",
    ...(input.content.length > 0 ? { content: input.content } : {}),
    ...(input.attachmentFiles ? { attachmentFiles: input.attachmentFiles } : {}),
    ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.forwardedFrom ? { forwardedFrom: input.forwardedFrom } : {}),
    createdAt: now,
  })
  await ctx.db.patch(thread._id, { ...previewColumns(input.content, input.attachmentFiles ?? []), lastMessageAt: now, lastMessageId: messageId, lastMessageByPersonId: sender.personId })
  const message = await ctx.db.get(messageId)
  if (message === null) return notFound()
  await markMemberReadThrough(ctx, sender, message, { activityAt: now })
  await scheduleGroupMessageFanout(ctx, messageId)
  return messageId
}

/**
 * Envoyer un message. Idempotent par (fil, clé). Le texte est facultatif dès
 * qu'une pièce est jointe ; le message cité est du MÊME fil et m'est servi.
 */
export const sendGroupMessage = networkMutation({
  minStatus: "declaree",
  args: {
    threadId: v.id("groupThreads"),
    content: v.string(),
    attachmentFiles: v.optional(v.array(attachmentFileValidator)),
    replyToMessageId: v.optional(v.id("groupMessages")),
    idempotencyKey: v.optional(v.string()),
  },
  returns: v.object({ messageId: v.id("groupMessages"), deduplicated: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.send", ctx.person._id)
    const { thread, member } = await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    if (thread.closedAt !== undefined) return failRule("GROUP_CLOSED")
    const replay = await findGroupReplay(ctx, thread._id, args.idempotencyKey)
    if (replay) return { messageId: replay._id, deduplicated: true }
    const content = checked(() => assertMessageContent(args.content, (args.attachmentFiles?.length ?? 0) > 0))
    if (args.replyToMessageId !== undefined) {
      // Citer l'identifiant d'un message d'ailleurs ferait relire son extrait sous la garde de ce fil.
      const cited = await ctx.db.get(args.replyToMessageId)
      if (!cited || !(await isVisibleToMember(ctx, cited, member))) return notFound()
    }
    const attachmentFiles = await verifyDeclaredAttachments(ctx, args.attachmentFiles, { actorPersonId: ctx.person._id, networkId: ctx.networkId, source: "group" })
    const messageId = await appendGroupMessage(ctx, thread, member, {
      content,
      ...(attachmentFiles ? { attachmentFiles } : {}),
      ...(args.replyToMessageId !== undefined ? { replyToMessageId: args.replyToMessageId } : {}),
      ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
    })
    return { messageId, deduplicated: false }
  },
})

/** Poser, remplacer ou RETIRER ma réaction — sur un message qui m'est servi, non retiré. */
export const toggleGroupMessageReaction = networkMutation({
  minStatus: "declaree",
  args: { messageId: v.id("groupMessages"), kind: messageReactionKindValidator },
  returns: v.object({ kind: v.union(messageReactionKindValidator, v.null()), counts: messageReactionCountsValidator }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.react", ctx.person._id)
    const { message, member } = await requireVisibleMessage(ctx, args.messageId)
    if (message.type !== "text" || message.deletedAt !== undefined) return notFound()
    if (await blockedCache(ctx, member.personId)(message.senderPersonId)) return notFound()
    const existing = await ctx.db
      .query("groupMessageReactions")
      .withIndex("by_message_person", (q) => q.eq("messageId", message._id).eq("personId", ctx.person._id))
      .unique()
    const previous = existing?.kind ?? null
    const next = nextMessageReactionKind(previous, args.kind)
    const counts = applyMessageReactionDelta(message.reactionCounts, previous, next)
    if (next === null) {
      if (existing) await ctx.db.delete(existing._id)
    } else if (existing) {
      await ctx.db.patch(existing._id, { kind: next })
    } else {
      await ctx.db.insert("groupMessageReactions", { threadId: message.threadId, messageId: message._id, personId: ctx.person._id, kind: next, createdAt: Date.now() })
    }
    await ctx.db.patch(message._id, { reactionCounts: counts })
    return { kind: next, counts }
  },
})

/**
 * Retirer un message DE MA VUE — jamais de celle des autres. Ouvert à tout
 * membre, sans fenêtre, même sur une pierre tombale. Idempotent. Un non-lu
 * masqué sort de ma pastille.
 */
export const deleteGroupMessageForMe = networkMutation({
  minStatus: "en_attente",
  args: { messageId: v.id("groupMessages") },
  returns: v.object({ hidden: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.edit", ctx.person._id)
    const message = await ctx.db.get(args.messageId)
    if (!message) return notFound()
    const { member } = await requireLiveMembership(ctx, ctx.networkId, message.threadId, ctx.person._id)
    if (await isHiddenForPerson(ctx, message._id, ctx.person._id)) return { hidden: true as const }
    if (message.createdAt < historyFloor(member) || isClearedForMember(message, member)) return notFound()
    await ctx.db.insert("groupMessageHides", { threadId: message.threadId, messageId: message._id, personId: ctx.person._id, messageCreatedAt: message.createdAt, createdAt: Date.now() })
    await onMessageHidden(ctx, member, message)
    return { hidden: true as const }
  },
})

/** MON message, dans un fil où je suis membre vivant — sinon le refus indistinct. */
async function requireMyTextMessage(ctx: MutationCtx & { networkId: Id<"networks">; person: Doc<"persons"> }, messageId: Id<"groupMessages">) {
  const { message, thread, member } = await requireVisibleMessage(ctx, messageId)
  if (message.senderPersonId !== ctx.person._id) return notFound()
  // Un événement n'est la parole de personne : il ne se réécrit pas.
  if (message.type !== "text") return failRule("MESSAGE_NOT_EDITABLE")
  return { message, thread, member }
}

/** Modifier MON message, dans la fenêtre ; « (modifié) » le dit, l'aperçu suit s'il était le dernier. */
export const editGroupMessage = networkMutation({
  minStatus: "declaree",
  args: { messageId: v.id("groupMessages"), content: v.string() },
  returns: v.object({ editedAt: v.number() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.edit", ctx.person._id)
    const { message, thread } = await requireMyTextMessage(ctx, args.messageId)
    if (message.deletedAt !== undefined) return failRule("MESSAGE_ALREADY_DELETED")
    if (thread.closedAt !== undefined) return failRule("GROUP_CLOSED")
    const now = Date.now()
    if (!isWithinEditWindow(message.createdAt, now)) return failRule("MESSAGE_EDIT_WINDOW_EXPIRED", { minutes: MESSAGE_EDIT_WINDOW_MS / 60_000 })
    const content = checked(() => assertMessageContent(args.content, false))
    // Rouvert puis refermé sans y toucher : rien à marquer « (modifié) ».
    if (content === message.content) return { editedAt: message.editedAt ?? message.createdAt }
    await ctx.db.patch(message._id, { content, editedAt: now })
    if (thread.lastMessageId === message._id) await ctx.db.patch(thread._id, previewColumns(content, message.attachmentFiles ?? []))
    return { editedAt: now }
  },
})

/**
 * Retirer MON message POUR TOUT LE MONDE, dans la fenêtre : pierre tombale (la
 * ligne demeure, le contenu est retiré), l'épingle tombe, l'aperçu s'efface —
 * sans déplacer le fil dans la liste de chacun. Idempotent.
 */
export const deleteGroupMessage = networkMutation({
  minStatus: "en_attente",
  args: { messageId: v.id("groupMessages") },
  returns: v.object({ deleted: v.literal(true), alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.edit", ctx.person._id)
    const { message, thread } = await requireMyTextMessage(ctx, args.messageId)
    if (message.deletedAt !== undefined) return { deleted: true as const, alreadyDeleted: true }
    const now = Date.now()
    if (!isWithinEditWindow(message.createdAt, now)) return failRule("MESSAGE_EDIT_WINDOW_EXPIRED", { minutes: MESSAGE_EDIT_WINDOW_MS / 60_000 })
    await ctx.db.patch(message._id, { deletedAt: now, content: undefined })
    if (thread.pinnedMessageId === message._id) await ctx.db.patch(thread._id, { pinnedMessageId: undefined })
    if (thread.lastMessageId === message._id) await ctx.db.patch(thread._id, { lastMessageText: undefined, lastMessageKind: undefined, lastMessageAttachmentCount: undefined })
    return { deleted: true as const, alreadyDeleted: false }
  },
})

/**
 * Épingler — ou désépingler (`null`) — LE message du groupe : le rôle décide
 * (propriétaire, administrateurs). Un second remplace le premier. Idempotent.
 */
export const setGroupPinnedMessage = networkMutation({
  minStatus: "declaree",
  args: { threadId: v.id("groupThreads"), messageId: v.union(v.id("groupMessages"), v.null()) },
  returns: v.object({ pinnedMessageId: v.union(v.id("groupMessages"), v.null()) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.edit", ctx.person._id)
    const { thread, member } = await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    if (!isGroupThreadManager(member.role)) return fail("groupRoleRequired")
    if (args.messageId === null) {
      if (thread.pinnedMessageId !== undefined) await ctx.db.patch(thread._id, { pinnedMessageId: undefined })
      return { pinnedMessageId: null }
    }
    const message = await ctx.db.get(args.messageId)
    // Un message d'un AUTRE fil et un message inconnu se disent pareil.
    if (!message || !(await isVisibleToMember(ctx, message, member))) return notFound()
    if (message.type !== "text") return failRule("MESSAGE_PIN_NOT_TEXT")
    if (message.deletedAt !== undefined) return failRule("MESSAGE_PIN_DELETED")
    if (thread.pinnedMessageId !== message._id) await ctx.db.patch(thread._id, { pinnedMessageId: message._id })
    return { pinnedMessageId: message._id }
  },
})
