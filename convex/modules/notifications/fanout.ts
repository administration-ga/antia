// Dupliqué de socle/convex/modules/icom/notifyFanout.ts @ ad2e7fdc2 — adaptations : PATRON repris (lots de 150, job chaîné qui se replanifie, aucune écriture sur le document parent), code réécrit pour la cloche sociale du moteur : sources de destinataires génériques (liste de personnes, abonnés d'une personne dans le réseau, abonnés aux commentaires d'une publication, abonnés d'une PAGE à sa publication (lot 13), abonnés du propriétaire d'un ALBUM publié (lot 14), AUDIENCE d'une conférence en direct (lot 16, `notifyDirectAudience` de socle/convex/modules/direct/sessions.ts l. 474-616 : abonnés et signataires de la page pour `followers`, relations puis abonnés de l'hôte, invités vivants à la publication de l'enregistrement — phases enchaînées dans le curseur, la porte de la session ou de la rediffusion rejugée par destinataire) — chacun re-gardé au moment de sonner, D08), porte unique `notifyPerson`, dédoublonnage par sa clé.
/**
 * Diffusion de la cloche PAR LOTS CHAÎNÉS, hors de la transaction de l'émetteur.
 *
 * Une mutation qui notifierait 999 membres en boucle frôlerait les limites d'une
 * transaction et entrerait en conflit avec toute écriture voisine (D07, D08).
 * Ici : UN job planifié par l'émetteur, qui traite 150 destinataires par la
 * porte unique, puis se replanifie tant que la source n'est pas épuisée. Le job
 * ne touche JAMAIS le document du sujet : zéro conflit avec ses écritures.
 */
import type { DirectAudience } from "@antsia/social-domain/live/domain"
import type { NotificationKind } from "@antsia/social-domain/notifications"
import { type Infer, v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { canSeeAlbum } from "../albums/access"
import { isConnectedTo } from "../graph/graph"
import { directReplayAccessDecision, directSessionAccessDecision, liveInviteeRow } from "../live/access"
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
  /**
   * Les ABONNÉS du propriétaire d'un album publié, dans le réseau de l'album,
   * et SEULEMENT s'ils voient l'album au moment de sonner (un album réservé aux
   * connexions ne sonne pas chez un simple abonné).
   */
  v.object({ kind: v.literal("albumFollowers"), albumId: v.id("albums") }),
  /**
   * L'AUDIENCE d'une conférence en direct, dans le réseau de la session : au
   * DÉMARRAGE (porte `session`, `live_started`) ou à la PUBLICATION de son
   * enregistrement (porte `replay`, `live_replay_published`). Parcourue par
   * phases (`liveSessionAudiencePhases`), et SEULEMENT vers qui passe encore la
   * porte au moment de sonner.
   */
  v.object({ kind: v.literal("liveSessionAudience"), sessionId: v.id("liveSessions"), gate: v.union(v.literal("session"), v.literal("replay")) }),
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
  if (source.kind === "albumFollowers") {
    const album = await ctx.db.get(source.albumId)
    if (!album) return { deliveries: [], next: null }
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_network_target_createdAt", (q) => q.eq("networkId", album.networkId).eq("targetPersonId", album.ownerPersonId))
      .paginate({ cursor: args.cursor ?? null, numItems: FANOUT_BATCH_SIZE })
    const deliveries: Delivery[] = []
    for (const row of followers.page) {
      if (await canSeeAlbum(ctx, album, { personId: row.followerPersonId, networkId: album.networkId })) deliveries.push({ networkId: album.networkId, recipientPersonId: row.followerPersonId })
    }
    return { deliveries, next: followers.isDone ? null : { cursor: followers.continueCursor } }
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
  if (source.kind === "liveSessionAudience") return await readLiveSessionAudienceBatch(ctx, source, args.cursor ?? null)
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

// ═══════════════════════════════════════════════════════════════
// L'audience d'une conférence en direct (lot 16)
// ═══════════════════════════════════════════════════════════════

/** La porte rejugée par destinataire : la page du direct, ou sa rediffusion. */
export type LiveSessionBellGate = "session" | "replay"

/**
 * Les PHASES de l'audience d'une conférence, dans l'ordre où elles sonnent.
 * Chacune parcourt UN index, par curseur natif ; le curseur de la diffusion
 * porte la phase (`<rang>:<curseur>`).
 */
const LIVE_AUDIENCE_PHASES = ["invitees", "connectionsLow", "connectionsHigh", "personFollowers", "pageFollowers", "pageSignatories"] as const
export type LiveAudiencePhase = (typeof LIVE_AUDIENCE_PHASES)[number]

/**
 * L'audience à sonner, selon l'audience de la conférence et la porte :
 *  · `public`      — les relations de l'hôte, puis ses abonnés ;
 *  · `connections` — les relations de l'hôte ;
 *  · `followers`   — les abonnés de la page, puis ses signataires ;
 *  · `invitees`    — personne par ici : au démarrage, les invités ont
 *    `live_invite` (posé par l'ouverture de la conférence aux invités).
 * À la PUBLICATION de l'enregistrement, les invités VIVANTS sonnent d'abord,
 * quelle que soit l'audience : la rediffusion leur reste ouverte (ADR-0150, D),
 * et un invité n'est ni forcément une relation ni un abonné.
 */
export function liveSessionAudiencePhases(audience: DirectAudience, gate: LiveSessionBellGate): LiveAudiencePhase[] {
  const own: LiveAudiencePhase[] =
    audience === "public"
      ? ["connectionsLow", "connectionsHigh", "personFollowers"]
      : audience === "connections"
        ? ["connectionsLow", "connectionsHigh"]
        : audience === "followers"
          ? ["pageFollowers", "pageSignatories"]
          : []
  return gate === "replay" ? ["invitees", ...own] : own
}

/** `<rang de phase>:<curseur natif>` — un curseur vide ouvre la phase. */
function parseLiveAudienceCursor(cursor: string | null): { phaseIndex: number; inner: string | null } {
  if (cursor === null) return { phaseIndex: 0, inner: null }
  const separator = cursor.indexOf(":")
  const phaseIndex = Number(cursor.slice(0, separator))
  if (separator < 0 || !Number.isInteger(phaseIndex) || phaseIndex < 0) return { phaseIndex: LIVE_AUDIENCE_PHASES.length, inner: null }
  const inner = cursor.slice(separator + 1)
  return { phaseIndex, inner: inner.length > 0 ? inner : null }
}

type AudiencePage = { personIds: Id<"persons">[]; isDone: boolean; continueCursor: string }

/** UNE page d'une phase, sur l'index qui la porte. Une phase sans objet (page absente) est vide. */
async function liveAudiencePage(ctx: MutationCtx, session: Doc<"liveSessions">, phase: LiveAudiencePhase, cursor: string | null): Promise<AudiencePage> {
  const options = { cursor, numItems: FANOUT_BATCH_SIZE }
  const host = session.hostPersonId
  switch (phase) {
    case "invitees": {
      const page = await ctx.db
        .query("liveInvitees")
        .withIndex("by_session_revokedAt", (q) => q.eq("sessionId", session._id).eq("revokedAt", undefined))
        .paginate(options)
      return { personIds: page.page.map((row) => row.personId), isDone: page.isDone, continueCursor: page.continueCursor }
    }
    case "connectionsLow": {
      const page = await ctx.db
        .query("connections")
        .withIndex("by_network_low_status", (q) => q.eq("networkId", session.networkId).eq("personIdLow", host).eq("status", "accepted"))
        .paginate(options)
      return { personIds: page.page.map((row) => row.personIdHigh), isDone: page.isDone, continueCursor: page.continueCursor }
    }
    case "connectionsHigh": {
      const page = await ctx.db
        .query("connections")
        .withIndex("by_network_high_status", (q) => q.eq("networkId", session.networkId).eq("personIdHigh", host).eq("status", "accepted"))
        .paginate(options)
      return { personIds: page.page.map((row) => row.personIdLow), isDone: page.isDone, continueCursor: page.continueCursor }
    }
    case "personFollowers": {
      // Les abonnés les plus récents d'abord, comme au socle.
      const page = await ctx.db
        .query("follows")
        .withIndex("by_network_target_createdAt", (q) => q.eq("networkId", session.networkId).eq("targetPersonId", host))
        .order("desc")
        .paginate(options)
      return { personIds: page.page.map((row) => row.followerPersonId), isDone: page.isDone, continueCursor: page.continueCursor }
    }
    case "pageFollowers": {
      const pageId = session.pageId
      if (pageId === undefined) return { personIds: [], isDone: true, continueCursor: "" }
      const page = await ctx.db
        .query("pageFollows")
        .withIndex("by_page_createdAt", (q) => q.eq("pageId", pageId))
        .paginate(options)
      return { personIds: page.page.map((row) => row.personId), isDone: page.isDone, continueCursor: page.continueCursor }
    }
    case "pageSignatories": {
      const pageId = session.pageId
      if (pageId === undefined) return { personIds: [], isDone: true, continueCursor: "" }
      const page = await ctx.db
        .query("pageSignatories")
        .withIndex("by_page_person", (q) => q.eq("pageId", pageId))
        .paginate(options)
      return { personIds: page.page.map((row) => row.personId), isDone: page.isDone, continueCursor: page.continueCursor }
    }
  }
}

/**
 * Ce destinataire passe-t-il ENCORE la porte, au moment de sonner ?
 *
 *  · jamais l'hôte (la porte unique écarte aussi l'acteur) ;
 *  · un invité VIVANT n'est sonné que par sa phase (`invitees`, à la
 *    publication) — au démarrage, il a déjà `live_invite` : une personne, une
 *    cloche ;
 *  · un abonné qui est aussi une relation a déjà sonné comme relation ;
 *  · porte `session` : la conférence est ENCORE en direct, et la décision
 *    d'accès (adhésion, audience, cercle de la page, blocage, exclusion) admet
 *    le destinataire — la même que la page, la liste et le jeton ;
 *  · porte `replay` : l'enregistrement n'a pas été retiré, et la décision de
 *    la REDIFFUSION (publication, visibilité restreinte compris) l'admet.
 */
async function liveAudienceAdmits(ctx: MutationCtx, session: Doc<"liveSessions">, gate: LiveSessionBellGate, phase: LiveAudiencePhase, personId: Id<"persons">): Promise<boolean> {
  if (personId === session.hostPersonId) return false
  if (phase !== "invitees" && (await liveInviteeRow(ctx, session._id, personId)) !== null) return false
  if (phase === "personFollowers" && (await isConnectedTo(ctx, session.networkId, personId, session.hostPersonId))) return false
  if (gate === "session") return session.status === "live" && (await directSessionAccessDecision(ctx, personId, session)) === "allowed"
  if (session.replayStatus === undefined || session.replayStatus === "expired") return false
  return (await directReplayAccessDecision(ctx, personId, session)) === "allowed"
}

/** Un lot de l'audience d'une conférence : la phase courante, puis la suivante quand elle est épuisée. */
async function readLiveSessionAudienceBatch(ctx: MutationCtx, source: { sessionId: Id<"liveSessions">; gate: LiveSessionBellGate }, cursor: string | null): Promise<Batch> {
  const session = await ctx.db.get(source.sessionId)
  if (!session) return { deliveries: [], next: null }
  const phases = liveSessionAudiencePhases(session.audience, source.gate)
  const { phaseIndex, inner } = parseLiveAudienceCursor(cursor)
  const phase = phases[phaseIndex]
  if (phase === undefined) return { deliveries: [], next: null }
  const page = await liveAudiencePage(ctx, session, phase, inner)
  const deliveries: Delivery[] = []
  for (const personId of new Set(page.personIds)) {
    if (await liveAudienceAdmits(ctx, session, source.gate, phase, personId)) deliveries.push({ networkId: session.networkId, recipientPersonId: personId })
  }
  if (!page.isDone) return { deliveries, next: { cursor: `${phaseIndex}:${page.continueCursor}` } }
  return { deliveries, next: phaseIndex + 1 < phases.length ? { cursor: `${phaseIndex + 1}:` } : null }
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
