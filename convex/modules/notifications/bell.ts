// Dupliqué de socle/convex/modules/reseauPersonnel/notifications.ts (l. 255-499) @ ad2e7fdc2 — adaptations : personnes et réseaux (la cloche d'un réseau) ; `myNotifications` à curseur temporel (qui LEVAIT à égalité de date, D18) non recopiée, la pagination native `paginateNotifications` la remplace ; `unreadCount` rend sa lacune (`capped`, D19) ; `markAllRead` lit l'index jusqu'à la date du clic au lieu d'un `.filter()` ; sujet rendu en `{ kind, id }` avec l'état VIVANT d'une demande de relation et d'une analyse de fichier ; acteur par le mini-profil publié (badges compris) ; la PAGE d'un `page_post` par sa carte publique relue (nom, badge calculé — lot F2) ; débit sur les marquages.
/**
 * La cloche d'un réseau, côté lecteur : lister, compter, marquer lu.
 *
 * Le DTO ne porte AUCUN corps de contenu : ouvrir le sujet le relit avec sa
 * garde. L'acteur vient du profil PUBLIÉ. Une ligne d'autrui ou inventée rend
 * le même refus : décliner apprendrait qu'un événement a eu lieu entre deux tiers.
 */
import { type ConnectionInviteState, pendingStateOf } from "@antia/social-domain/connectionState"
import type { FileScanStatus } from "@antia/social-domain/filePolicy"
import { NOTIFICATION_UNREAD_CAP, type NotificationKind, type NotificationResolution, type NotificationSubject } from "@antia/social-domain/notifications"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { miniProfileCache, type PersonMiniProfile } from "../people/miniProfile"
import { pageCardCache } from "../pages/access"
import type { PageCard } from "../pages/validators"
import { subjectOf, subjectRefOf } from "./notify"

/** Marquage par lots bornés, poursuivi par continuation interne. */
const MARK_READ_BATCH = 200

export type NotificationDto = {
  notificationId: Id<"notifications">
  kind: NotificationKind
  /** Où aller au clic. Le contenu sera relu AVEC SA GARDE là-bas. */
  subject: NotificationSubject | null
  createdAt: number
  readAt: number | null
  /** Ce que l'invitation est DEVENUE, posé par le serveur ; `null` : rien de tranché. */
  resolution: { kind: NotificationResolution; at: number } | null
  /** `connection_request` : l'état VIVANT de la demande, relu à l'instant. */
  inviteState: ConnectionInviteState | null
  /** `file_withheld` : le statut VIVANT de l'analyse (une libération l'a peut-être levé). */
  fileScanStatus: FileScanStatus | null
  /** `null` pour un avis du système. */
  actor: Pick<PersonMiniProfile, "personId" | "displayName" | "handle" | "avatarUrl" | "badges"> | null
  /**
   * `page_post` : la PAGE qui a publié — sa carte publique (nom, logo, badge CALCULÉ), relue à
   * l'instant ; `null` pour tout autre genre, ou quand la page n'est plus active. Sans elle, la
   * ligne ne dirait pas QUI publie — et c'est là qu'une page usurpant le nom d'une institution
   * tromperait. Rien n'est stocké : la carte est déjà publique.
   */
  page: PageCard | null
}

type DtoCaches = { profileOf: ReturnType<typeof miniProfileCache>; pageOf: ReturnType<typeof pageCardCache> }

/** La page d'une publication annoncée par `page_post` (`null` : publication disparue, ou sans page). */
async function pageOfPost(ctx: Pick<QueryCtx, "db">, postId: Id<"posts">, pageOf: DtoCaches["pageOf"]): Promise<PageCard | null> {
  const post = await ctx.db.get(postId)
  return post?.pageId ? await pageOf(post.pageId) : null
}

async function toDto(ctx: Pick<QueryCtx, "db" | "storage">, me: Id<"persons">, row: Doc<"notifications">, { profileOf, pageOf }: DtoCaches): Promise<NotificationDto> {
  const actor = row.actorPersonId ? await profileOf(row.actorPersonId) : null
  const page = row.kind === "page_post" && row.subjectPostId ? await pageOfPost(ctx, row.subjectPostId, pageOf) : null
  const inviteState = row.kind === "connection_request" && row.subjectConnectionId ? pendingStateOf(await ctx.db.get(row.subjectConnectionId), me) : null
  const scan = row.kind === "file_withheld" && row.subjectFileScanId ? await ctx.db.get(row.subjectFileScanId) : null
  return {
    notificationId: row._id,
    kind: row.kind,
    subject: subjectOf(subjectRefOf(row)),
    createdAt: row.createdAt,
    readAt: row.readAt ?? null,
    resolution: row.resolution !== undefined && row.resolvedAt !== undefined ? { kind: row.resolution, at: row.resolvedAt } : null,
    inviteState,
    fileScanStatus: scan?.status ?? null,
    actor: actor ? { personId: actor.personId, displayName: actor.displayName, handle: actor.handle, avatarUrl: actor.avatarUrl, badges: actor.badges } : null,
    page,
  }
}

/** MES notifications dans le réseau, du plus récent au plus ancien — curseur NATIF (aucune ligne sautée). */
export const paginateNotifications = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<NotificationDto>> => {
    const result = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("recipientPersonId", ctx.person._id))
      .order("desc")
      .paginate(args.paginationOpts)
    const caches: DtoCaches = { profileOf: miniProfileCache(ctx), pageOf: pageCardCache(ctx) }
    const page: NotificationDto[] = []
    for (const row of result.page) page.push(await toDto(ctx, ctx.person._id, row, caches))
    return { ...result, page }
  },
})

/**
 * Combien de non-lues — BORNÉ : la cloche dit « 99+ » au-delà, et `capped` le
 * signale (D19) ; compter l'exact serait payer un balayage pour un chiffre tronqué.
 */
export const unreadCount = networkQuery({
  args: {},
  returns: v.object({ count: v.number(), capped: v.boolean() }),
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_network_recipient_readAt_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("recipientPersonId", ctx.person._id).eq("readAt", undefined))
      .take(NOTIFICATION_UNREAD_CAP + 1)
    return { count: Math.min(unread.length, NOTIFICATION_UNREAD_CAP), capped: unread.length > NOTIFICATION_UNREAD_CAP }
  },
})

/** Marquer UNE notification lue — destinataire seul, refus indistinct ; monotone (déjà lue : rien). */
export const markRead = networkMutation({
  minStatus: "en_attente",
  args: { notificationId: v.id("notifications") },
  returns: v.object({ read: v.literal(true) }),
  handler: async (ctx, { notificationId }) => {
    await enforceRateLimit(ctx, "notification.read", ctx.person._id)
    const row = await ctx.db.get(notificationId)
    if (!row || row.networkId !== ctx.networkId || row.recipientPersonId !== ctx.person._id) return notFound()
    if (row.readAt === undefined) await ctx.db.patch(row._id, { readAt: Date.now() })
    return { read: true as const }
  },
})

async function markAllReadBatch(ctx: MutationCtx, networkId: Id<"networks">, recipientPersonId: Id<"persons">, startedAt: number): Promise<{ marked: number; pending: boolean }> {
  // Instantané du clic : une notification arrivée après ne devient pas lue à l'insu de la personne.
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_network_recipient_readAt_createdAt", (q) =>
      q.eq("networkId", networkId).eq("recipientPersonId", recipientPersonId).eq("readAt", undefined).lte("createdAt", startedAt),
    )
    .take(MARK_READ_BATCH)
  for (const row of unread) await ctx.db.patch(row._id, { readAt: startedAt })
  const pending = unread.length === MARK_READ_BATCH
  if (pending) await ctx.scheduler.runAfter(0, internal.modules.notifications.bell.continueMarkAllRead, { networkId, recipientPersonId, startedAt })
  return { marked: unread.length, pending }
}

/** Continuation interne : idempotente, bornée, liée au destinataire initial. */
export const continueMarkAllRead = internalMutation({
  args: { networkId: v.id("networks"), recipientPersonId: v.id("persons"), startedAt: v.number() },
  returns: v.object({ marked: v.number(), pending: v.boolean() }),
  handler: async (ctx, args) => await markAllReadBatch(ctx, args.networkId, args.recipientPersonId, args.startedAt),
})

/** Tout marquer lu dans le réseau — un clic lance tous les lots nécessaires. Lire n'est pas décider : rien n'est résolu. */
export const markAllRead = networkMutation({
  minStatus: "en_attente",
  args: {},
  returns: v.object({ marked: v.number(), pending: v.boolean() }),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "notification.readAll", ctx.person._id)
    return await markAllReadBatch(ctx, ctx.networkId, ctx.person._id, Date.now())
  },
})
