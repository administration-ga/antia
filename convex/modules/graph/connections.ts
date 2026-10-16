// Dupliqué de socle/convex/modules/reseau/connections.ts (avec la façade socle/convex/modules/reseauPersonnel/connections.ts) @ ad2e7fdc2 — adaptations : RÉÉCRIT sur personnes et réseaux, une seule façade (plus de délégation par `runMutation`) ; garde d'adhésion par le constructeur, débit, message borné par le domaine ; adressage par identifiant OU par personne, avec la MÊME exigence de découvrabilité (manque du socle sur l'API brute, EXF-AN-15) ; FUITE DU BLOCAGE CORRIGÉE (D12 : le bloqué reçoit la réponse d'une demande envoyée, sans rien écrire) ; blocage posé et lu sur toute la paire, tous réseaux ; demandes reçues listées par un index (`recipientPersonId`) au lieu d'un `.filter()` ; listes historiques plafonnées (`listMine`, `listPendingForMe`, qui levaient au-delà de 200) non recopiées, la pagination native les remplace (D04) ; fonction et administration (`resolvePostIdentities`) retirées ; poser ou lever le blocage d'une paire déplace la pastille de messagerie à l'écriture (D38) et recompte les conversations de groupe partagées (D23) ; la paire qui se FERME planifie la coupure de ses directs (`live/revocation.revokeConnectionDirects`, les deux expulsions symétriques du helper `revokeConnectionDirects` du socle, une fois au lieu de chaque `block`).
/**
 * Connexions personne ↔ personne dans un réseau : demander, répondre, bloquer.
 *
 * La paire est stockée UNE fois par réseau, en ordre canonique. Une demande est
 * IDEMPOTENTE : la rejouer sur une relation déjà demandée ou acceptée ne change
 * rien. La CLOCHE sonne pour une demande NEUVE (créée, ou rouverte après un
 * refus) et pour une acceptation — jamais au rejeu ; répondre RÉSOUT la ligne
 * du destinataire. Le REFUS n'émet rien et ne se distingue pas d'une absence de
 * réponse.
 * Le BLOCAGE est unilatéral, muet, et vaut pour toute la paire, dans tous les
 * réseaux : seul son auteur le lève.
 */
import type { Badge } from "@antia/social-domain/badges"
import { assertConnectionMessage, normalizeHandle } from "@antia/social-domain/content"
import { canonicalPair, type ConnectionView, viewConnection } from "@antia/social-domain/connectionState"
import { foldDiacritics } from "@antia/social-domain/searchText"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { checked, fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { badgeValidator } from "../../lib/validators"
import { onPairBlockChangedInGroups } from "../groups/unread"
import { onPairBlockChanged } from "../messaging/threads"
import { notifyPerson, resolveNotifications } from "../notifications/notify"
import { findPublishedPersonByHandle, isDiscoverablePerson, isPublishedPerson, miniProfileCache } from "../people/miniProfile"
import { acceptedCounterpartIds, blockerOf, findConnection, isBlockedBetween, pairRows } from "./graph"
import { connectionStatusValidator } from "./tables"

// ═══════════════════════════════════════════════════════════════
// Demander, répondre
// ═══════════════════════════════════════════════════════════════

/**
 * Demander une connexion à une personne du réseau, désignée par son
 * IDENTIFIANT (fiche publique) ou par la PERSONNE (annuaire). Demander NOUE un
 * lien : la cible doit être découvrable et membre active du réseau — sinon le
 * refus d'une personne inconnue, mot pour mot.
 *
 * Réponse INDISTINCTE (D12) : un blocage, dans un sens ou dans l'autre, rend la
 * réponse d'une demande envoyée, sans rien écrire — au socle, le bloqué
 * recevait `blocked` et apprenait le blocage.
 */
export const requestConnection = networkMutation({
  args: { targetPersonId: v.optional(v.id("persons")), handle: v.optional(v.string()), message: v.optional(v.string()) },
  returns: v.object({ status: v.union(v.literal("requested"), v.literal("accepted")) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "connection.request", ctx.person._id)
    const message = checked(() => assertConnectionMessage(args.message))
    const target = await resolveTarget(ctx, args)
    if (target === ctx.person._id) return fail("invalidArgument", { field: "target" })

    if (await isBlockedBetween(ctx, ctx.person._id, target)) return { status: "requested" as const }
    const now = Date.now()
    const existing = await findConnection(ctx, ctx.networkId, ctx.person._id, target)
    if (existing && (existing.status === "requested" || existing.status === "accepted")) {
      return { status: existing.status }
    }
    if (existing) {
      // Refusée : une nouvelle demande est légitime (les gens changent d'avis).
      await ctx.db.patch(existing._id, {
        status: "requested",
        requestedByPersonId: ctx.person._id,
        recipientPersonId: target,
        requestedAt: now,
        respondedAt: undefined,
        message,
        updatedAt: now,
      })
      // Rouverte : une demande NEUVE pour le destinataire, sur la même ligne.
      await notifyPerson(ctx, { networkId: ctx.networkId, recipientPersonId: target, actorPersonId: ctx.person._id, kind: "connection_request", subject: { connection: existing._id } })
      return { status: "requested" as const }
    }
    const { low, high } = canonicalPair(ctx.person._id, target)
    const connectionId = await ctx.db.insert("connections", {
      networkId: ctx.networkId,
      personIdLow: low,
      personIdHigh: high,
      requestedByPersonId: ctx.person._id,
      recipientPersonId: target,
      status: "requested",
      ...(message ? { message } : {}),
      requestedAt: now,
      updatedAt: now,
    })
    await notifyPerson(ctx, { networkId: ctx.networkId, recipientPersonId: target, actorPersonId: ctx.person._id, kind: "connection_request", subject: { connection: connectionId } })
    return { status: "requested" as const }
  },
})

/** La cible d'une demande : découvrable, membre active du réseau, sinon `notFound`. */
async function resolveTarget(
  ctx: MutationCtx & { networkId: Id<"networks"> },
  args: { targetPersonId?: Id<"persons">; handle?: string },
): Promise<Id<"persons">> {
  if (args.handle !== undefined) {
    const person = await findPublishedPersonByHandle(ctx, ctx.networkId, args.handle, { requireDiscoverable: true })
    return person ? person._id : notFound()
  }
  if (args.targetPersonId === undefined) return fail("invalidArgument", { field: "target" })
  const person = await ctx.db.get(args.targetPersonId)
  if (!person || !isDiscoverablePerson(person) || !(await isActiveMember(ctx, ctx.networkId, person._id))) return notFound()
  return person._id
}

/**
 * Répondre à une demande reçue. Seul le DESTINATAIRE répond : un tiers reçoit
 * le refus d'une ligne inexistante ; le demandeur ne s'accepte pas lui-même.
 */
export const respondToConnection = networkMutation({
  args: { connectionId: v.id("connections"), accept: v.boolean() },
  returns: v.object({ status: connectionStatusValidator }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "connection.respond", ctx.person._id)
    const connection = await ctx.db.get(args.connectionId)
    if (!connection || connection.networkId !== ctx.networkId) return notFound()
    if (connection.personIdLow !== ctx.person._id && connection.personIdHigh !== ctx.person._id) return notFound()
    if (connection.requestedByPersonId === ctx.person._id) return fail("invalidArgument", { field: "connectionId" })
    if (connection.status !== "requested") return fail("conflict")
    const status = args.accept ? ("accepted" as const) : ("declined" as const)
    const now = Date.now()
    await ctx.db.patch(connection._id, { status, respondedAt: now, updatedAt: now })
    // MA cloche se résout ici, acceptation ET refus : la demande n'a plus rien à décider.
    await resolveNotifications(ctx, {
      networkId: ctx.networkId,
      recipientPersonId: ctx.person._id,
      kind: "connection_request",
      subject: { connection: connection._id },
      resolution: status,
      at: now,
    })
    if (status === "accepted") {
      await notifyPerson(ctx, {
        networkId: ctx.networkId,
        recipientPersonId: connection.requestedByPersonId,
        actorPersonId: ctx.person._id,
        kind: "connection_accepted",
        subject: { connection: connection._id },
      })
    }
    return { status }
  },
})

// ═══════════════════════════════════════════════════════════════
// Bloquer
// ═══════════════════════════════════════════════════════════════

/**
 * Bloquer une personne : unilatéral, sans notification — une protection, pas une
 * sanction publique. Possible sans relation préalable. Le blocage s'écrit sur
 * TOUTES les lignes de la paire (tous réseaux) : il ferme le réseau personnel
 * partout, dans les deux sens.
 */
export const blockPerson = networkMutation({
  minStatus: "en_attente",
  args: { targetPersonId: v.id("persons") },
  returns: v.null(),
  handler: async (ctx, { targetPersonId }) => {
    await enforceRateLimit(ctx, "connection.block", ctx.person._id)
    if (targetPersonId === ctx.person._id) return fail("invalidArgument", { field: "targetPersonId" })
    if (!(await ctx.db.get(targetPersonId))) return notFound()
    const now = Date.now()
    const rows = await pairRows(ctx, ctx.person._id, targetPersonId)
    const wasBlocked = rows.some((row) => row.status === "blocked")
    for (const row of rows) {
      // Un blocage déjà posé par l'autre reste le sien : la paire est fermée de toute façon.
      if (row.status === "blocked") continue
      await ctx.db.patch(row._id, { status: "blocked", blockedByPersonId: ctx.person._id, updatedAt: now })
    }
    if (!rows.some((row) => row.networkId === ctx.networkId)) {
      const { low, high } = canonicalPair(ctx.person._id, targetPersonId)
      await ctx.db.insert("connections", {
        networkId: ctx.networkId,
        personIdLow: low,
        personIdHigh: high,
        requestedByPersonId: ctx.person._id,
        recipientPersonId: targetPersonId,
        status: "blocked",
        blockedByPersonId: ctx.person._id,
        requestedAt: now,
        updatedAt: now,
      })
    }
    // La paire SE FERME : la pastille de messagerie de chaque côté perd les non-lus du fil (D38).
    if (!wasBlocked) {
      await onPairBlockChanged(ctx, ctx.person._id, targetPersonId, true)
      await onPairBlockChangedInGroups(ctx, ctx.person._id, targetPersonId)
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.revokeConnectionDirects, { firstPersonId: ctx.person._id, secondPersonId: targetPersonId })
    }
    return null
  },
})

/**
 * Lever MES blocages envers une personne (tous réseaux). Débloquer ne rétablit
 * aucune relation : la paire passe à « refusée », ce qui rouvre seulement la
 * possibilité d'en demander une. Sans blocage de ma part : refus indistinct.
 */
export const unblockPerson = networkMutation({
  minStatus: "en_attente",
  args: { targetPersonId: v.id("persons") },
  returns: v.null(),
  handler: async (ctx, { targetPersonId }) => {
    await enforceRateLimit(ctx, "connection.block", ctx.person._id)
    const mine = (await pairRows(ctx, ctx.person._id, targetPersonId)).filter((row) => row.status === "blocked" && row.blockedByPersonId === ctx.person._id)
    if (mine.length === 0) return notFound()
    const now = Date.now()
    for (const row of mine) await ctx.db.patch(row._id, { status: "declined", blockedByPersonId: undefined, updatedAt: now })
    // La paire ne se ROUVRE que si l'autre ne bloque pas de son côté : la pastille retrouve alors ses non-lus.
    if (!(await isBlockedBetween(ctx, ctx.person._id, targetPersonId))) {
      await onPairBlockChanged(ctx, ctx.person._id, targetPersonId, false)
      await onPairBlockChangedInGroups(ctx, ctx.person._id, targetPersonId)
    }
    return null
  },
})

// ═══════════════════════════════════════════════════════════════
// Lectures
// ═══════════════════════════════════════════════════════════════

const connectionViewValidator = v.union(
  v.object({ state: v.literal("none") }),
  v.object({ state: v.literal("requested_by_me"), connectionId: v.id("connections") }),
  v.object({ state: v.literal("requested_by_them"), connectionId: v.id("connections"), message: v.optional(v.string()) }),
  v.object({ state: v.literal("connected"), connectionId: v.id("connections"), since: v.number() }),
  v.object({ state: v.literal("declined"), connectionId: v.id("connections") }),
  v.object({ state: v.literal("blocked_by_me"), connectionId: v.id("connections") }),
)

/**
 * L'état de ma relation avec une personne, dans le réseau. Un blocage posé dans
 * un AUTRE réseau vaut ici aussi : son auteur voit `blocked_by_me`, le bloqué `none`.
 */
export const connectionWith = networkQuery({
  args: { otherPersonId: v.id("persons") },
  returns: connectionViewValidator,
  handler: async (ctx, { otherPersonId }): Promise<ConnectionView<Id<"connections">>> => {
    const rows = await pairRows(ctx, ctx.person._id, otherPersonId)
    const blocker = blockerOf(rows)
    if (blocker !== null) {
      const blocked = rows.find((row) => row.status === "blocked")
      return blocker === ctx.person._id && blocked ? { state: "blocked_by_me", connectionId: blocked._id } : { state: "none" }
    }
    return viewConnection(rows.find((row) => row.networkId === ctx.networkId) ?? null, ctx.person._id)
  },
})

/**
 * L'état COURANT d'une demande, relu avant d'agir dessus (la cloche peut avoir
 * vieilli). `missing` : la ligne n'existe plus. Un TIERS : refus indistinct.
 */
export const pendingState = networkQuery({
  args: { connectionId: v.id("connections") },
  returns: v.object({ status: v.union(connectionStatusValidator, v.literal("missing")), iAmRecipient: v.boolean() }),
  handler: async (ctx, { connectionId }) => {
    const row = await ctx.db.get(connectionId)
    if (!row) return { status: "missing" as const, iAmRecipient: false }
    if (row.networkId !== ctx.networkId || (row.personIdLow !== ctx.person._id && row.personIdHigh !== ctx.person._id)) return notFound()
    // Le bloqué ne voit pas le blocage : pour lui, la demande n'a pas de suite.
    const status = row.status === "blocked" && row.blockedByPersonId !== ctx.person._id ? ("declined" as const) : row.status
    return { status, iAmRecipient: row.recipientPersonId === ctx.person._id }
  },
})

export const connectionPersonDtoValidator = v.object({
  connectionId: v.id("connections"),
  otherPersonId: v.id("persons"),
  displayName: v.union(v.string(), v.null()),
  handle: v.union(v.string(), v.null()),
  headline: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  badges: v.array(badgeValidator),
  at: v.number(),
  message: v.optional(v.string()),
})

export type ConnectionPersonDto = {
  connectionId: Id<"connections">
  otherPersonId: Id<"persons">
  displayName: string | null
  handle: string | null
  headline: string | null
  avatarUrl: string | null
  badges: Badge[]
  at: number
  message?: string
}

/**
 * Une moitié native de la paire canonique : une exécution ne porte qu'une
 * pagination native, `paginateMine` en compose deux.
 */
export const paginateMineSide = networkQuery({
  args: { side: v.union(v.literal("low"), v.literal("high")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<ConnectionPersonDto>> => {
    const me = ctx.person._id
    const result =
      args.side === "low"
        ? await ctx.db
            .query("connections")
            .withIndex("by_network_low_status", (q) => q.eq("networkId", ctx.networkId).eq("personIdLow", me).eq("status", "accepted"))
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("connections")
            .withIndex("by_network_high_status", (q) => q.eq("networkId", ctx.networkId).eq("personIdHigh", me).eq("status", "accepted"))
            .order("desc")
            .paginate(args.paginationOpts)
    const profileOf = miniProfileCache(ctx)
    const page: ConnectionPersonDto[] = []
    for (const row of result.page) {
      const other = row.personIdLow === me ? row.personIdHigh : row.personIdLow
      const person = await profileOf(other)
      page.push({
        connectionId: row._id,
        otherPersonId: other,
        displayName: person.displayName,
        handle: person.handle,
        headline: person.headline,
        avatarUrl: person.avatarUrl,
        badges: person.badges,
        at: row.respondedAt ?? row.requestedAt,
      })
    }
    return { ...result, page }
  },
})

/** Mes connexions, exhaustives : un résultat natif par côté de la paire (D04 : plus de plafond qui lève). */
export const paginateMine = networkQuery({
  args: { lowPaginationOpts: paginationOptsValidator, highPaginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<{ low: PaginationResult<ConnectionPersonDto>; high: PaginationResult<ConnectionPersonDto> }> => {
    const [low, high] = await Promise.all([
      ctx.runQuery(api.modules.graph.connections.paginateMineSide, { networkId: ctx.networkId, side: "low", paginationOpts: args.lowPaginationOpts }),
      ctx.runQuery(api.modules.graph.connections.paginateMineSide, { networkId: ctx.networkId, side: "high", paginationOpts: args.highPaginationOpts }),
    ])
    return { low, high }
  },
})

/** Les demandes qui m'attendent dans le réseau — par un index, sans filtre (une seule pagination). */
export const paginatePendingForMe = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<ConnectionPersonDto>> => {
    const result = await ctx.db
      .query("connections")
      .withIndex("by_network_recipient_status", (q) => q.eq("networkId", ctx.networkId).eq("recipientPersonId", ctx.person._id).eq("status", "requested"))
      .order("desc")
      .paginate(args.paginationOpts)
    const profileOf = miniProfileCache(ctx)
    const page: ConnectionPersonDto[] = []
    for (const row of result.page) {
      const person = await profileOf(row.requestedByPersonId)
      page.push({
        connectionId: row._id,
        otherPersonId: row.requestedByPersonId,
        displayName: person.displayName,
        handle: person.handle,
        headline: person.headline,
        avatarUrl: person.avatarUrl,
        badges: person.badges,
        at: row.requestedAt,
        ...(row.message ? { message: row.message } : {}),
      })
    }
    return { ...result, page }
  },
})

// ═══════════════════════════════════════════════════════════════
// Chercher parmi MES relations
// ═══════════════════════════════════════════════════════════════

const RELATION_SEARCH_LIMIT_DEFAULT = 10
const RELATION_SEARCH_LIMIT_MAX = 25
/** Candidats lus dans l'annuaire avant l'intersection avec mes relations. */
const RELATION_SEARCH_SCAN = 100
/** Relations relues une à une quand l'annuaire ne les a pas remontées. */
const RELATION_DIRECT_SCAN = 200

/** Les mots d'une saisie ou d'un nom, pliés des accents et de la casse. */
function searchWords(value: string): string[] {
  return foldDiacritics(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
}

/**
 * Chercher une personne parmi MES relations acceptées du réseau — et elles
 * seules. Le mode PRIVÉ ne retire rien (on écrit à quelqu'un qu'on connaît
 * déjà) ; seul le RETRAIT du profil ferme la recherche par le nom. Le blocage
 * retire la personne : la paire n'est alors plus `accepted`.
 */
export const searchMine = networkQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(connectionPersonDtoValidator),
  handler: async (ctx, args) => {
    const term = args.query.trim()
    if (term.length === 0) return []
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? RELATION_SEARCH_LIMIT_DEFAULT), 1), RELATION_SEARCH_LIMIT_MAX)
    const me = ctx.person._id
    const accepted = (await acceptedCounterpartIds(ctx, ctx.networkId, me)).ids
    if (accepted.size === 0) return []

    const candidates: Id<"persons">[] = []
    const retain = (personId: Id<"persons">) => {
      if (!candidates.includes(personId)) candidates.push(personId)
    }
    // L'identifiant est une ADRESSE : exact, `@` de tête toléré, en tête.
    const handleTerm = normalizeHandle(term.replace(/^@/, ""))
    if (handleTerm.length > 0) {
      const exact = await ctx.db
        .query("persons")
        .withIndex("by_handle", (q) => q.eq("handle", handleTerm))
        .unique()
      if (exact) retain(exact._id)
    }
    // Le nom, par l'annuaire DU RÉSEAU — listé ou non (le mode privé ne retire rien ici).
    const byName = await ctx.db
      .query("peopleDirectory")
      .withSearchIndex("search_name", (q) => q.search("searchName", foldDiacritics(term)).eq("networkId", ctx.networkId))
      .take(RELATION_SEARCH_SCAN)
    for (const row of byName) retain(row.personId)

    const relations: Doc<"persons">[] = []
    for (const personId of candidates) {
      if (relations.length >= limit) break
      if (!accepted.has(personId)) continue
      const person = await ctx.db.get(personId)
      if (person && isPublishedPerson(person)) relations.push(person)
    }
    // Repli PARMI MES RELATIONS : le nom, plié, commence par chaque mot saisi.
    if (relations.length < limit && accepted.size <= RELATION_DIRECT_SCAN) {
      const tokens = searchWords(term)
      if (tokens.length > 0) {
        const already = new Set<string>(relations.map((person) => person._id))
        const direct: Doc<"persons">[] = []
        for (const otherId of accepted) {
          if (already.has(otherId)) continue
          const person = await ctx.db.get(otherId as Id<"persons">)
          if (!person || !isPublishedPerson(person) || !person.displayName) continue
          const words = searchWords(person.displayName)
          if (tokens.every((token) => words.some((word) => word.startsWith(token)))) direct.push(person)
        }
        direct.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", "fr"))
        for (const person of direct) {
          if (relations.length >= limit) break
          relations.push(person)
        }
      }
    }

    const profileOf = miniProfileCache(ctx)
    const hits: ConnectionPersonDto[] = []
    for (const person of relations) {
      const link = await findConnection(ctx, ctx.networkId, me, person._id)
      if (!link || link.status !== "accepted") continue
      const mini = await profileOf(person._id)
      hits.push({
        connectionId: link._id,
        otherPersonId: person._id,
        displayName: mini.displayName,
        handle: mini.handle,
        headline: mini.headline,
        avatarUrl: mini.avatarUrl,
        badges: mini.badges,
        at: link.respondedAt ?? link.requestedAt,
      })
    }
    return hits
  },
})
