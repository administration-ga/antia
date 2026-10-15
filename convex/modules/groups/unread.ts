// Dupliqué de socle/convex/modules/reseauPersonnel/groupes.ts (l. 523-569 `unreadForMember`, l. 863-889 `totalUnread`, l. 1499-1513 cloche des membres) @ ad2e7fdc2 — adaptations : la pastille de groupe est TENUE à l'écriture (D23) au lieu d'être recalculée à chaque lecture (50 fils × 200 messages, souscrite par tous) : chaque appartenance porte son `unreadCount` et la position jusqu'où les messages ont été examinés, la part `groups` de `unreadTotals` en est la somme ; un message est examiné une fois par membre, par une DIFFUSION par lots chaînés hors de la transaction de l'envoi (D07, au lieu d'une boucle de 999 cloches) qui avance aussi l'ordre d'activité ; le blocage recompte les fils partagés ; seuls les messages TEXTE d'autrui comptent (le socle comptait aussi les événements système) ; mêmes exclusions que l'écran : masqué pour moi, effacé, bloqué.
/**
 * Les non-lus des conversations de groupe — un COMPTEUR, jamais un balayage.
 *
 * Trois positions sur un membre, toutes au sens de l'index du fil
 * (`createdAt`, puis `_creationTime`) :
 *  - le CURSEUR de lecture : tout ce qui est en deçà est lu ;
 *  - la position EXAMINÉE (`countedThrough*`) : tout ce qui est en deçà a été
 *    jugé pour ce membre, compté ou non — un message ne se compte qu'une fois,
 *    quel que soit l'ordre où passent les diffusions (chacune RATTRAPE depuis
 *    la position examinée, elle ne compte pas « son » message seul) ;
 *  - `unreadCount` : les messages comptés, après le curseur.
 *
 * Compte un message TEXTE d'autrui que l'écran montrera : ni masqué pour moi,
 * ni effacé de ma vue, ni d'une personne bloquée. Un message retiré pour tous
 * reste compté : sa pierre tombale est une ligne du fil.
 */
import { NOTIFICATION_UNREAD_CAP } from "@antia/social-domain/notifications"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { adjustUnreadPart } from "../messaging/threads"
import { notifyPerson } from "../notifications/notify"
import { blockedCache, isClearedForMember, isHiddenForPerson } from "./access"

type ReadCtx = Pick<QueryCtx, "db">

/** Messages examinés au plus par rattrapage : au-delà, la diffusion suivante poursuit. */
const CATCH_UP_SCAN = 100
/** Messages relus au plus par un recompte (blocage, référence). */
const RECOUNT_SCAN = 200
/** Membres par lot de diffusion — quelques transactions chaînées pour un grand groupe. */
export const GROUP_FANOUT_BATCH = 100
/** Appartenances relues au plus pour retrouver les fils partagés d'une paire. */
const SHARED_SCAN = 500

/** Une position dans le fil : `createdAt`, puis `_creationTime` (`Infinity` : toute la milliseconde). */
type Position = { at: number; ct: number }

function positionOf(message: Pick<Doc<"groupMessages">, "createdAt" | "_creationTime">): Position {
  return { at: message.createdAt, ct: message._creationTime }
}

function isAfter(position: Position, reference: Position): boolean {
  return position.at !== reference.at ? position.at > reference.at : position.ct > reference.ct
}

/** Le curseur de lecture ; sans message de référence (une arrivée), toute la milliseconde est lue. */
function readCursorOf(member: Doc<"groupMembers">): Position {
  return { at: member.lastReadAt, ct: member.lastReadCreationTime ?? Number.POSITIVE_INFINITY }
}

/** Jusqu'où les messages ont été examinés pour ce membre — jamais en deçà du curseur. */
function examinedThrough(member: Doc<"groupMembers">): Position {
  const cursor = readCursorOf(member)
  if (member.countedThroughAt === undefined || member.countedThroughCreationTime === undefined) return cursor
  const counted = { at: member.countedThroughAt, ct: member.countedThroughCreationTime }
  return isAfter(counted, cursor) ? counted : cursor
}

/** Jusqu'à `limit` messages du fil APRÈS `from`, dans l'ordre de l'index. */
async function messagesAfter(ctx: ReadCtx, threadId: Id<"groupThreads">, from: Position, limit: number): Promise<Doc<"groupMessages">[]> {
  const tied =
    from.ct === Number.POSITIVE_INFINITY
      ? []
      : await ctx.db
          .query("groupMessages")
          .withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId).eq("createdAt", from.at).gt("_creationTime", from.ct))
          .take(limit)
  if (tied.length >= limit) return tied
  const later = await ctx.db
    .query("groupMessages")
    .withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId).gt("createdAt", from.at))
    .take(limit - tied.length)
  return [...tied, ...later]
}

/** Ce message compte-t-il pour ce membre, masquage mis à part ? */
async function countsFor(message: Doc<"groupMessages">, member: Doc<"groupMembers">, isBlockedWith: (other: Id<"persons">) => Promise<boolean>): Promise<boolean> {
  if (message.type !== "text") return false
  if (message.senderPersonId === member.personId) return false
  if (isClearedForMember(message, member)) return false
  return !(await isBlockedWith(message.senderPersonId))
}

/** Ce message compte-t-il pour ce membre, masquage compris ? */
async function countsWithHides(
  ctx: ReadCtx,
  message: Doc<"groupMessages">,
  member: Doc<"groupMembers">,
  isBlockedWith: (other: Id<"persons">) => Promise<boolean>,
): Promise<boolean> {
  return (await countsFor(message, member, isBlockedWith)) && !(await isHiddenForPerson(ctx, message._id, member.personId))
}

/** Le patch qui porte un compte et sa position examinée, et le déplacement de la pastille. */
async function writeCount(ctx: MutationCtx, member: Doc<"groupMembers">, unreadCount: number, through: Position | null, extra: Partial<Doc<"groupMembers">> = {}): Promise<void> {
  const delta = unreadCount - member.unreadCount
  await ctx.db.patch(member._id, {
    unreadCount,
    ...(through !== null && Number.isFinite(through.ct) ? { countedThroughAt: through.at, countedThroughCreationTime: through.ct } : {}),
    ...extra,
  })
  if (delta !== 0) await adjustUnreadPart(ctx, member.networkId, member.personId, "groups", delta)
}

/**
 * RATTRAPE un membre : juge les messages après sa position examinée, compte
 * ceux qui comptent, avance la position. Idempotent — une diffusion rejouée ou
 * en retard ne recompte rien.
 */
export async function catchUpMember(ctx: MutationCtx, member: Doc<"groupMembers">, extra: Partial<Doc<"groupMembers">> = {}): Promise<void> {
  const rows = await messagesAfter(ctx, member.threadId, examinedThrough(member), CATCH_UP_SCAN)
  const isBlockedWith = blockedCache(ctx, member.personId)
  let added = 0
  for (const message of rows) if (await countsWithHides(ctx, message, member, isBlockedWith)) added += 1
  const last = rows.at(-1)
  if (last === undefined && Object.keys(extra).length === 0) return
  await writeCount(ctx, member, member.unreadCount + added, last ? positionOf(last) : null, extra)
}

/**
 * Le compte EXACT d'un membre, relu depuis son curseur (borné) — la référence
 * du compteur, et le geste du blocage. Ne lit pas au-delà de `RECOUNT_SCAN` :
 * la position examinée s'arrête là, les diffusions suivantes poursuivent.
 */
async function exactCount(ctx: ReadCtx, member: Doc<"groupMembers">): Promise<{ count: number; through: Position | null; truncated: boolean }> {
  const rows = await messagesAfter(ctx, member.threadId, readCursorOf(member), RECOUNT_SCAN)
  const isBlockedWith = blockedCache(ctx, member.personId)
  let count = 0
  for (const message of rows) if (await countsWithHides(ctx, message, member, isBlockedWith)) count += 1
  const last = rows.at(-1)
  return { count, through: last ? positionOf(last) : null, truncated: rows.length >= RECOUNT_SCAN }
}

/** Recompte un membre et pose le compte exact (le blocage d'une paire). */
export async function recountMember(ctx: MutationCtx, member: Doc<"groupMembers">): Promise<void> {
  const { count, through } = await exactCount(ctx, member)
  // Rien après le curseur : la position examinée retombe sur lui.
  await writeCount(ctx, member, count, through, through === null ? { countedThroughAt: undefined, countedThroughCreationTime: undefined } : {})
}

/**
 * Avance le curseur de lecture jusqu'à `latest` : tout est lu, la pastille perd
 * ce que ce fil y mettait. Rend `false` quand le curseur y était déjà.
 */
export async function markMemberReadThrough(
  ctx: MutationCtx,
  member: Doc<"groupMembers">,
  latest: Doc<"groupMessages">,
  extra: Partial<Doc<"groupMembers">> = {},
): Promise<boolean> {
  if (member.lastReadMessageId === latest._id && member.unreadCount === 0 && Object.keys(extra).length === 0) return false
  await writeCount(ctx, member, 0, positionOf(latest), {
    lastReadAt: latest.createdAt,
    lastReadCreationTime: latest._creationTime,
    lastReadMessageId: latest._id,
    ...extra,
  })
  return true
}

/** Un membre sort (départ, retrait) : la pastille perd ce que ce fil y mettait. */
export async function releaseMemberUnread(ctx: MutationCtx, member: Doc<"groupMembers">, extra: Partial<Doc<"groupMembers">>): Promise<void> {
  await writeCount(ctx, member, 0, null, extra)
}

/**
 * Masquer un message POUR MOI : s'il était compté (déjà examiné, après mon
 * curseur, et comptant), il sort de ma pastille. Pas encore examiné : la
 * diffusion verra le masquage.
 */
export async function onMessageHidden(ctx: MutationCtx, member: Doc<"groupMembers">, message: Doc<"groupMessages">): Promise<void> {
  const position = positionOf(message)
  if (!isAfter(position, readCursorOf(member))) return
  if (isAfter(position, examinedThrough(member))) return
  if (!(await countsFor(message, member, blockedCache(ctx, member.personId)))) return
  await writeCount(ctx, member, Math.max(0, member.unreadCount - 1), null)
}

/** Les non-lus d'un fil pour l'écran : le compte tenu, plafonné et DIT. */
export function unreadBadgeOf(member: Pick<Doc<"groupMembers">, "unreadCount">): { count: number; capped: boolean } {
  return member.unreadCount > NOTIFICATION_UNREAD_CAP ? { count: NOTIFICATION_UNREAD_CAP, capped: true } : { count: member.unreadCount, capped: false }
}

// ═══════════════════════════════════════════════════════════════
// Diffusion d'un message — non-lus, activité, cloche
// ═══════════════════════════════════════════════════════════════

/**
 * Planifie la diffusion d'un message TEXTE aux autres membres : rattrapage des
 * non-lus, ordre d'activité, cloche `group_message` (sauf sourdine). Hors de la
 * transaction de l'envoi : un groupe plein ne fait pas un envoi lourd.
 */
export async function scheduleGroupMessageFanout(ctx: MutationCtx, messageId: Id<"groupMessages">): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.modules.groups.unread.fanoutGroupMessage, { messageId, cursor: null })
}

export const fanoutGroupMessage = internalMutation({
  args: { messageId: v.id("groupMessages"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (!message) return null
    const thread = await ctx.db.get(message.threadId)
    if (!thread || thread.deletingAt !== undefined) return null
    const page = await ctx.db
      .query("groupMembers")
      .withIndex("by_thread_leftAt", (q) => q.eq("threadId", thread._id).eq("leftAt", undefined))
      .paginate({ cursor: args.cursor, numItems: GROUP_FANOUT_BATCH })
    for (const member of page.page) {
      if (member.personId === message.senderPersonId) continue
      await catchUpMember(ctx, member, member.activityAt < message.createdAt ? { activityAt: message.createdAt } : {})
      if (member.mutedAt === undefined && message.type === "text") {
        // La porte de la cloche rejoue le blocage et l'adhésion au réseau.
        await notifyPerson(ctx, { networkId: thread.networkId, recipientPersonId: member.personId, actorPersonId: message.senderPersonId, kind: "group_message", subject: { groupThread: thread._id } })
      }
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.modules.groups.unread.fanoutGroupMessage, { messageId: args.messageId, cursor: page.continueCursor })
    return null
  },
})

// ═══════════════════════════════════════════════════════════════
// Blocage et référence
// ═══════════════════════════════════════════════════════════════

/**
 * Le blocage d'une paire (posé ou levé) RECOMPTE les deux personnes dans les
 * fils qu'elles partagent, tous réseaux : les messages de l'autre cessent (ou
 * recommencent) de compter. Le fil, lui, demeure.
 */
export async function onPairBlockChangedInGroups(ctx: MutationCtx, a: Id<"persons">, b: Id<"persons">): Promise<void> {
  // borné : les appartenances vivantes d'une personne, plafonnées.
  const mine = await ctx.db
    .query("groupMembers")
    .withIndex("by_person_leftAt", (q) => q.eq("personId", a).eq("leftAt", undefined))
    .take(SHARED_SCAN)
  for (const member of mine) {
    const other = await ctx.db
      .query("groupMembers")
      .withIndex("by_thread_person", (q) => q.eq("threadId", member.threadId).eq("personId", b))
      .unique()
    if (!other || other.leftAt !== undefined) continue
    await recountMember(ctx, member)
    await recountMember(ctx, other)
  }
}

/**
 * Le total RECALCULÉ des groupes d'une personne dans un réseau — la référence du
 * compteur (tests, réconciliation). `truncated` le dit plutôt que de mentir.
 */
export async function recomputeGroupUnreadTotal(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">): Promise<{ total: number; truncated: boolean }> {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_network_person_leftAt_activityAt", (q) => q.eq("networkId", networkId).eq("personId", personId).eq("leftAt", undefined))
    .take(SHARED_SCAN)
  let total = 0
  let truncated = memberships.length >= SHARED_SCAN
  for (const member of memberships) {
    const thread = await ctx.db.get(member.threadId)
    if (!thread || thread.deletingAt !== undefined) continue
    const exact = await exactCount(ctx, member)
    total += exact.count
    if (exact.truncated) truncated = true
  }
  return { total, truncated }
}
