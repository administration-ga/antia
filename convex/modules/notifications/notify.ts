// Dupliqué de socle/convex/lib/notify.ts (avec socle/convex/modules/reseauPersonnel/notifications.ts, l. 128-253) @ ad2e7fdc2 — adaptations : la porte UNIQUE d'écriture de la cloche sociale du moteur (`notifyPerson`, `resolveNotifications`) ; personnes et réseaux ; aucun titre ni corps ni lien stocké (l'écran traduit le genre et route le sujet) ; deux gardes ajoutées à la porte : jamais un non-membre du réseau, jamais à travers un blocage ; acteur facultatif pour les avis du système.
/**
 * LA porte d'écriture de la cloche sociale.
 *
 *  1. Jamais soi-même : quand l'acteur est le destinataire, rien n'est écrit.
 *  2. Jamais à travers un BLOCAGE, jamais à un NON-MEMBRE du réseau : la cloche
 *     ne fait pas sonner ce que la personne ne pourrait pas lire.
 *  3. Dédoublonnage par `genre|sujet|acteur` : la ligne existante est
 *     RAFRAÎCHIE (date, non-lu rouvert, résolution effacée), jamais empilée.
 *  4. Dans la transaction de l'appelant : un geste annulé n'a pas de notification
 *     orpheline. Les diffusions larges passent par `fanout.ts` (lots chaînés).
 */
import {
  type NotificationKind,
  notificationDedupKey,
  type NotificationResolution,
  notificationResolutionPrefix,
  type NotificationSubject,
} from "@antia/social-domain/notifications"
import type { Infer } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { isBlockedBetween } from "../graph/graph"
import type { notificationSubjectValidator } from "./tables"

export type NotificationSubjectRef = Infer<typeof notificationSubjectValidator>

/** La forme générique (`{ kind, id }`) d'une référence typée. */
export function subjectOf(ref: NotificationSubjectRef | undefined): NotificationSubject | null {
  if (!ref) return null
  if ("post" in ref) return { kind: "post", id: ref.post }
  if ("connection" in ref) return { kind: "connection", id: ref.connection }
  if ("thematicGroup" in ref) return { kind: "thematicGroup", id: ref.thematicGroup }
  if ("groupThread" in ref) return { kind: "groupThread", id: ref.groupThread }
  if ("event" in ref) return { kind: "event", id: ref.event }
  if ("album" in ref) return { kind: "album", id: ref.album }
  return { kind: "fileScan", id: ref.fileScan }
}

/** Les colonnes de sujet d'une ligne, depuis une référence typée. */
function subjectColumns(ref: NotificationSubjectRef | undefined): Partial<Doc<"notifications">> {
  if (!ref) return {}
  if ("post" in ref) return { subjectPostId: ref.post }
  if ("connection" in ref) return { subjectConnectionId: ref.connection }
  if ("thematicGroup" in ref) return { subjectThematicGroupId: ref.thematicGroup }
  if ("groupThread" in ref) return { subjectGroupThreadId: ref.groupThread }
  if ("event" in ref) return { subjectEventId: ref.event }
  if ("album" in ref) return { subjectAlbumId: ref.album }
  return { subjectFileScanId: ref.fileScan }
}

/** La référence typée d'une ligne, ou `undefined`. */
export function subjectRefOf(row: Doc<"notifications">): NotificationSubjectRef | undefined {
  if (row.subjectPostId) return { post: row.subjectPostId }
  if (row.subjectConnectionId) return { connection: row.subjectConnectionId }
  if (row.subjectFileScanId) return { fileScan: row.subjectFileScanId }
  if (row.subjectThematicGroupId) return { thematicGroup: row.subjectThematicGroupId }
  if (row.subjectGroupThreadId) return { groupThread: row.subjectGroupThreadId }
  if (row.subjectEventId) return { event: row.subjectEventId }
  if (row.subjectAlbumId) return { album: row.subjectAlbumId }
  return undefined
}

export type NotifyInput = {
  networkId: Id<"networks">
  recipientPersonId: Id<"persons">
  /** L'auteur du geste ; absent pour un avis du système. */
  actorPersonId?: Id<"persons">
  kind: NotificationKind
  subject?: NotificationSubjectRef
}

/**
 * Émet (ou rafraîchit) une notification pour UNE personne. Rend l'identifiant de
 * la ligne écrite, `null` quand rien n'a été écrit (soi-même, blocage, non-membre).
 */
export async function notifyPerson(ctx: Pick<MutationCtx, "db">, input: NotifyInput): Promise<Id<"notifications"> | null> {
  if (input.actorPersonId !== undefined) {
    if (input.actorPersonId === input.recipientPersonId) return null
    if (await isBlockedBetween(ctx, input.actorPersonId, input.recipientPersonId)) return null
  }
  if (!(await isActiveMember(ctx, input.networkId, input.recipientPersonId))) return null
  const dedupKey = notificationDedupKey(input.kind, subjectOf(input.subject), input.actorPersonId ?? null)
  const now = Date.now()
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_network_recipient_dedupKey", (q) => q.eq("networkId", input.networkId).eq("recipientPersonId", input.recipientPersonId).eq("dedupKey", dedupKey))
    .unique()
  if (existing) {
    // REMPLACE : date rafraîchie, non-lu rouvert, résolution EFFACÉE — une invitation rouverte est neuve.
    await ctx.db.patch(existing._id, { createdAt: now, readAt: undefined, resolvedAt: undefined, resolution: undefined })
    return existing._id
  }
  return await ctx.db.insert("notifications", {
    networkId: input.networkId,
    recipientPersonId: input.recipientPersonId,
    ...(input.actorPersonId !== undefined ? { actorPersonId: input.actorPersonId } : {}),
    kind: input.kind,
    ...subjectColumns(input.subject),
    dedupKey,
    createdAt: now,
  })
}

/** Lignes relues pour une résolution : deux invitants successifs font deux lignes, rarement plus. */
const RESOLVE_SCAN = 25

/**
 * RÉSOUT les notifications d'un destinataire pour un genre et un sujet, quel que
 * soit l'acteur — dans la transaction qui tranche (accepter, décliner, annuler,
 * expirer). Idempotent ; `readAt` n'est jamais écrasé (la première lecture est
 * un fait). N'émet rien : résoudre MA cloche n'est pas une nouvelle pour l'autre.
 */
export async function resolveNotifications(
  ctx: Pick<MutationCtx, "db">,
  input: { networkId: Id<"networks">; recipientPersonId: Id<"persons">; kind: NotificationKind; subject: NotificationSubjectRef; resolution: NotificationResolution; at?: number },
): Promise<{ resolved: number }> {
  const subject = subjectOf(input.subject)
  if (!subject) return { resolved: 0 }
  const prefix = notificationResolutionPrefix(input.kind, subject)
  // Plage de préfixe sur l'index : les clés sont ASCII, la borne `￿` est sûre.
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_network_recipient_dedupKey", (q) =>
      q.eq("networkId", input.networkId).eq("recipientPersonId", input.recipientPersonId).gte("dedupKey", prefix).lt("dedupKey", `${prefix}￿`),
    )
    .take(RESOLVE_SCAN)
  const at = input.at ?? Date.now()
  let resolved = 0
  for (const row of rows) {
    if (row.resolution === input.resolution) continue
    await ctx.db.patch(row._id, { resolution: input.resolution, resolvedAt: at, readAt: row.readAt ?? at })
    resolved += 1
  }
  return { resolved }
}

/**
 * RETIRE les notifications d'un destinataire pour un genre et un sujet qui
 * n'existe plus (un fil supprimé), quel que soit l'acteur. Bornée par `limit` :
 * `more` dit qu'il en reste, l'appelant poursuit dans sa transaction suivante.
 */
export async function dropNotificationsAbout(
  ctx: Pick<MutationCtx, "db">,
  input: { networkId: Id<"networks">; recipientPersonId: Id<"persons">; kind: NotificationKind; subject: NotificationSubjectRef; limit: number },
): Promise<{ dropped: number; more: boolean }> {
  const subject = subjectOf(input.subject)
  if (!subject) return { dropped: 0, more: false }
  const prefix = notificationResolutionPrefix(input.kind, subject)
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_network_recipient_dedupKey", (q) =>
      q.eq("networkId", input.networkId).eq("recipientPersonId", input.recipientPersonId).gte("dedupKey", prefix).lt("dedupKey", `${prefix}￿`),
    )
    .take(input.limit)
  for (const row of rows) await ctx.db.delete(row._id)
  return { dropped: rows.length, more: rows.length >= input.limit }
}
