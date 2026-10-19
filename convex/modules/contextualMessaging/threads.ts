/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §10.1) — fils contextuels : ouverture par une partie,
 * lectures, listes, lecture marquée et clôture par un côté. Toute fonction passe par les
 * constructeurs du moteur (cliquet `network-scoped-functions`) et relit TOUT à chaque appel
 * (`accessForThread`) : un non-partie reçoit `null` en lecture et `notFound` en écriture, comme
 * pour un identifiant inventé, une autre nature ou un autre réseau.
 */
import {
  CONTEXTUAL_PAGE_BYTES_MAX,
  CONTEXTUAL_REFUSALS,
  CONTEXTUAL_THREADS_PAGE_MAX,
  contextualUnread,
} from "@antsia/social-domain/contextualMessaging"
import { type PaginationResult, paginationOptsValidator, paginationResultValidator } from "convex/server"
import { type Infer, v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { fail, failRule, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { literals } from "../../lib/validators"
import { liveSignatoryRole } from "../pages/access"
import { pageCardValidator } from "../pages/validators"
import { accessForThread, type ContextualAccess, contextualThreadAccess, findThreadForObject, withContextualMemo } from "./access"
import { type ContextualCallSettings, contextualCallView, stopContextualThreadCalls, viewerCallSettings } from "./callAccess"
import { notifyContextualActivity, openForParty } from "./hooks"
import { markPersonRead, personStateOf } from "./personStates"
import { contextualLabels, contextualLabelValidator, contextualPageCards } from "./projection"
import { contextualContextValidator, contextualKindValidator, contextualSideValidator, contextualVoiceValidator } from "./tables"

/** Le fil projeté (§10.1) : aucun aperçu, aucun contenu de l'objet, aucune liste de participants. */
export const contextualThreadValidator = v.object({
  threadId: v.id("contextualThreads"),
  networkId: v.id("networks"),
  kind: contextualKindValidator,
  /** L'objet ouvrant (référence seule, relu avec ses propres gardes sur ses écrans). */
  object: v.union(contextualContextValidator, v.null()),
  viewer: v.object({ side: contextualSideValidator, voice: contextualVoiceValidator }),
  /** L'autre côté : le libellé publié d'une personne, ou la carte d'une page (jamais un signataire). */
  counterpart: v.union(
    v.object({ kind: v.literal("person"), label: contextualLabelValidator }),
    v.object({ kind: v.literal("page"), page: v.union(pageCardValidator, v.null()) }),
  ),
  state: v.union(
    v.object({ kind: v.literal("open") }),
    v.object({ kind: v.literal("read_only"), reason: v.union(v.literal("closed"), v.literal("unavailable")) }),
  ),
  capabilities: v.object({ canSend: v.boolean(), canAttach: v.boolean(), canClose: v.boolean(), canSetCallConsent: v.boolean(), canCall: v.boolean() }),
  /** Le refus explicite d'un envoi, pour l'écran (liste fermée) ; `null` si l'envoi est possible. */
  sendRefusal: v.union(literals(CONTEXTUAL_REFUSALS), v.null()),
  /** Son PROPRE accord d'appel (CC-4) ; jamais celui de l'autre côté. */
  callConsent: v.boolean(),
  /** Signataires consentants, servis au seul côté demandeur quand l'appel est possible (CC-4). */
  callTargets: v.array(v.object({ personId: v.id("persons"), label: contextualLabelValidator })),
  /**
   * CC-4 (D5 amendé) : l'effet de SES PROPRES réglages d'appel sur ce fil — jamais ceux de l'autre
   * côté. « Hors de mes relations : silencieux » ne s'applique pas à un accord donné dans ce fil ;
   * « ne pas déranger », le silence de réunion et « occupé » s'appliquent toujours.
   */
  callSettings: v.object({
    /** Son réglage « hors de mes relations : silencieux » est actif ; il ne s'applique pas à son accord dans CE fil. */
    outsideRelationsSilenceWaived: v.boolean(),
    /** Fin de son « ne pas déranger » posé (toujours appliqué), `null` sans silence ; l'écran compare à son horloge. */
    dndUntil: v.union(v.number(), v.null()),
    /** Son silence automatique de réunion est activé (toujours appliqué). */
    meetingSilence: v.boolean(),
    /** Il a coupé le signal d'appel en attente : déjà en ligne, il est indiqué « occupé ». */
    callWaitingOff: v.boolean(),
    /** Il a coupé la sonnerie poussée hors de l'onglet. */
    incomingPushOff: v.boolean(),
  }),
  unread: v.boolean(),
  revision: v.number(),
  lastMessageAt: v.number(),
  createdAt: v.number(),
})
export type ContextualThreadDto = Infer<typeof contextualThreadValidator>

type ProjectionCtx = Pick<QueryCtx, "db" | "storage">

type ProjectionHelpers = {
  labelOf: ReturnType<typeof contextualLabels>
  cardOf: ReturnType<typeof contextualPageCards>
  /** CC-4 : SES réglages d'appel, lus une fois par requête (le lecteur est le même pour chaque ligne d'une liste). */
  callSettingsOf?: (personId: Id<"persons">) => Promise<ContextualCallSettings>
}

/** Les réglages d'appel du lecteur, lus une seule fois par requête. */
function callSettingsOnce(ctx: Pick<QueryCtx, "db">): (personId: Id<"persons">) => Promise<ContextualCallSettings> {
  const cache = new Map<string, Promise<ContextualCallSettings>>()
  return async (personId) => {
    const hit = cache.get(personId)
    if (hit) return await hit
    const pending = viewerCallSettings(ctx, personId)
    cache.set(personId, pending)
    return await pending
  }
}

export async function projectContextualThread(ctx: ProjectionCtx, access: ContextualAccess, personId: Id<"persons">, helpers: ProjectionHelpers = { labelOf: contextualLabels(ctx), cardOf: contextualPageCards(ctx) }): Promise<ContextualThreadDto> {
  const { thread, snapshot, capabilities } = access
  const state = await personStateOf(ctx, thread._id, personId)
  const counterpart: ContextualThreadDto["counterpart"] = access.side === "responder"
    ? { kind: "person", label: await helpers.labelOf(snapshot.requester.personId) }
    : "personId" in snapshot.responder
      ? { kind: "person", label: await helpers.labelOf(snapshot.responder.personId) }
      : { kind: "page", page: await helpers.cardOf(access.responderPage) }
  // CC-4 : son accord EFFECTIF (lié à son autorité), ses capacités d'appel et, face à une page, les
  // seuls signataires consentants — nommés parce qu'ils ont consenti à l'être (D3).
  const calls = await contextualCallView(ctx, access, personId)
  const callTargets: ContextualThreadDto["callTargets"] = []
  for (const targetPersonId of calls.callTargets) callTargets.push({ personId: targetPersonId, label: await helpers.labelOf(targetPersonId) })
  const callSettings = await (helpers.callSettingsOf ?? callSettingsOnce(ctx))(personId)
  return {
    threadId: thread._id,
    networkId: thread.networkId,
    kind: thread.kind,
    object: access.ref,
    viewer: { side: access.side, voice: access.voice },
    counterpart,
    state: capabilities.viewState === "open" ? { kind: "open" } : { kind: "read_only", reason: capabilities.viewState === "unavailable" ? "unavailable" : "closed" },
    capabilities: {
      canSend: capabilities.canSend,
      canAttach: capabilities.canAttach,
      canClose: capabilities.canClose,
      canSetCallConsent: calls.canSetCallConsent,
      canCall: calls.canCall,
    },
    sendRefusal: capabilities.sendRefusal,
    callConsent: calls.callConsent,
    callTargets,
    callSettings,
    unread: contextualUnread({ lastMessageAt: thread.lastMessageAt, createdAt: thread.createdAt, readAt: state?.readAt }),
    revision: thread.revision,
    lastMessageAt: thread.lastMessageAt,
    createdAt: thread.createdAt,
  }
}

function threadsLimit(value: number | undefined): number {
  return Math.min(CONTEXTUAL_THREADS_PAGE_MAX, Math.max(1, Math.trunc(value ?? CONTEXTUAL_THREADS_PAGE_MAX)))
}

// ═══════════════════════════════════════════════════════════════
// Ouverture et lectures
// ═══════════════════════════════════════════════════════════════

/** Ouverture idempotente par une partie actuelle d'un objet déjà en phase `open` (§4.1, chemin 2). */
export const openForObject = networkMutation({
  writeBucket: "contextual.open",
  args: { context: contextualContextValidator },
  returns: v.object({ threadId: v.id("contextualThreads"), created: v.boolean() }),
  handler: async (ctx, args) => await openForParty(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.context),
})

/** UN fil, relu en entier ; `null` pour tout non-partie. */
export const getThread = networkQuery({
  args: { threadId: v.id("contextualThreads") },
  returns: v.union(contextualThreadValidator, v.null()),
  handler: async (ctx, args): Promise<ContextualThreadDto | null> => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    return access === null ? null : await projectContextualThread(ctx, access, ctx.person._id)
  },
})

/** Le fil d'un objet, pour les écrans de l'objet ; ne crée rien. */
export const findForObject = networkQuery({
  args: { context: contextualContextValidator },
  returns: v.union(contextualThreadValidator, v.null()),
  handler: async (ctx, args): Promise<ContextualThreadDto | null> => {
    const thread = await findThreadForObject(ctx, args.context)
    if (thread === null || thread.networkId !== ctx.networkId) return null
    const access = await accessForThread(ctx, thread, ctx.person._id)
    return access === null ? null : await projectContextualThread(ctx, access, ctx.person._id)
  },
})

// ═══════════════════════════════════════════════════════════════
// Listes
// ═══════════════════════════════════════════════════════════════

/**
 * MES fils (demandeur ou répondant-personne), fusionnés par activité : un curseur PAR CÔTÉ, une
 * frontière par tour (technique de `messaging/inbox.paginateMyThreads`). Chaque ligne est relue ;
 * une ligne écartée fait quand même avancer son côté : une page peut rendre moins que la limite,
 * `isDone` seul conclut.
 */
const sideCursorValidator = v.union(v.null(), v.object({ at: v.number(), ct: v.number() }))
const mineCursorValidator = v.object({ requester: sideCursorValidator, responder: sideCursorValidator })
type SideCursor = Infer<typeof sideCursorValidator>
type MineSide = "requester" | "responder"
type SortKey = { at: number; ct: number; id: string }

/** Tours de fusion au plus par appel : une liste pleine de fils écartés ne coûte pas une lecture non bornée. */
const MINE_ROUNDS_MAX = 4

function sortKeyOf(thread: Doc<"contextualThreads">): SortKey {
  return { at: thread.lastMessageAt, ct: thread._creationTime, id: thread._id }
}

/** Négatif quand `x` vient AVANT `y` en activité décroissante. */
function compareActivityDesc(x: SortKey, y: SortKey): number {
  if (x.at !== y.at) return y.at - x.at
  if (x.ct !== y.ct) return y.ct - x.ct
  return x.id < y.id ? 1 : x.id > y.id ? -1 : 0
}

/** Jusqu'à `n` lignes d'un côté, APRÈS son curseur, par activité décroissante. */
async function readMineSide(ctx: Pick<QueryCtx, "db">, side: MineSide, networkId: Id<"networks">, me: Id<"persons">, cursor: SideCursor, n: number): Promise<Doc<"contextualThreads">[]> {
  const threads = ctx.db.query("contextualThreads")
  if (cursor === null) {
    return side === "requester"
      ? await threads.withIndex("by_network_requester_activity", (q) => q.eq("networkId", networkId).eq("requesterPersonId", me)).order("desc").take(n)
      : await threads.withIndex("by_network_responder_person_activity", (q) => q.eq("networkId", networkId).eq("responderPersonId", me)).order("desc").take(n)
  }
  const tied = side === "requester"
    ? await threads.withIndex("by_network_requester_activity", (q) => q.eq("networkId", networkId).eq("requesterPersonId", me).eq("lastMessageAt", cursor.at).lt("_creationTime", cursor.ct)).order("desc").take(n)
    : await threads.withIndex("by_network_responder_person_activity", (q) => q.eq("networkId", networkId).eq("responderPersonId", me).eq("lastMessageAt", cursor.at).lt("_creationTime", cursor.ct)).order("desc").take(n)
  if (tied.length >= n) return tied
  const older = side === "requester"
    ? await threads.withIndex("by_network_requester_activity", (q) => q.eq("networkId", networkId).eq("requesterPersonId", me).lt("lastMessageAt", cursor.at)).order("desc").take(n - tied.length)
    : await threads.withIndex("by_network_responder_person_activity", (q) => q.eq("networkId", networkId).eq("responderPersonId", me).lt("lastMessageAt", cursor.at)).order("desc").take(n - tied.length)
  return [...tied, ...older]
}

export const paginateMine = networkQuery({
  args: { cursor: v.optional(v.union(mineCursorValidator, v.null())), limit: v.optional(v.number()), kind: v.optional(contextualKindValidator) },
  returns: v.object({ items: v.array(contextualThreadValidator), nextCursor: v.union(mineCursorValidator, v.null()), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const limit = threadsLimit(args.limit)
    const n = limit + 1
    const me = ctx.person._id
    const shared = withContextualMemo(ctx)
    const helpers: ProjectionHelpers = { labelOf: contextualLabels(ctx), cardOf: contextualPageCards(ctx), callSettingsOf: callSettingsOnce(ctx) }
    let requesterCursor: SideCursor = args.cursor?.requester ?? null
    let responderCursor: SideCursor = args.cursor?.responder ?? null
    const items: ContextualThreadDto[] = []
    let done = false
    for (let round = 0; round < MINE_ROUNDS_MAX && items.length < limit && !done; round += 1) {
      const [asRequester, asResponder] = await Promise.all([
        readMineSide(ctx, "requester", ctx.networkId, me, requesterCursor, n),
        readMineSide(ctx, "responder", ctx.networkId, me, responderCursor, n),
      ])
      const moreRequester = asRequester.length === n
      const moreResponder = asResponder.length === n
      const frontiers: SortKey[] = []
      const lastRequester = asRequester[asRequester.length - 1]
      const lastResponder = asResponder[asResponder.length - 1]
      if (moreRequester && lastRequester) frontiers.push(sortKeyOf(lastRequester))
      if (moreResponder && lastResponder) frontiers.push(sortKeyOf(lastResponder))
      frontiers.sort(compareActivityDesc)
      const frontier = frontiers[0] ?? null
      const merged = [
        ...asRequester.map((thread) => ({ thread, side: "requester" as MineSide, key: sortKeyOf(thread) })),
        ...asResponder.map((thread) => ({ thread, side: "responder" as MineSide, key: sortKeyOf(thread) })),
      ].sort((x, y) => compareActivityDesc(x.key, y.key))
      let allExamined = true
      for (const entry of merged) {
        if (items.length >= limit || (frontier !== null && compareActivityDesc(entry.key, frontier) > 0)) {
          allExamined = false
          break
        }
        // Examinée : le côté avance, que la ligne soit rendue ou écartée.
        const sideCursor = { at: entry.thread.lastMessageAt, ct: entry.thread._creationTime }
        if (entry.side === "requester") requesterCursor = sideCursor
        else responderCursor = sideCursor
        if (args.kind !== undefined && entry.thread.kind !== args.kind) continue
        const access = await accessForThread(shared, entry.thread, me)
        if (access === null) continue
        items.push(await projectContextualThread(shared, access, me, helpers))
      }
      if (allExamined && !moreRequester && !moreResponder) done = true
    }
    return { items, nextCursor: done ? null : { requester: requesterCursor, responder: responderCursor }, isDone: done }
  },
})

/** Les fils d'une page, pour ses signataires VIVANTS ; chaque ligne est relue (§10.1). */
export const paginateForPage = networkQuery({
  args: { pageId: v.id("pages"), paginationOpts: paginationOptsValidator, kind: v.optional(contextualKindValidator) },
  returns: paginationResultValidator(contextualThreadValidator),
  handler: async (ctx, args): Promise<PaginationResult<ContextualThreadDto>> => {
    const page = await ctx.db.get(args.pageId)
    if (page === null || (await liveSignatoryRole(ctx, page, ctx.person._id)) === null) return notFound()
    const window = await ctx.db
      .query("contextualThreads")
      .withIndex("by_network_responder_page_activity", (q) => q.eq("networkId", ctx.networkId).eq("responderPageId", page._id))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: threadsLimit(args.paginationOpts.numItems), maximumRowsRead: 2 * CONTEXTUAL_THREADS_PAGE_MAX, maximumBytesRead: CONTEXTUAL_PAGE_BYTES_MAX })
    const shared = withContextualMemo(ctx)
    const helpers: ProjectionHelpers = { labelOf: contextualLabels(ctx), cardOf: contextualPageCards(ctx), callSettingsOf: callSettingsOnce(ctx) }
    const items: ContextualThreadDto[] = []
    for (const row of window.page) {
      if (args.kind !== undefined && row.kind !== args.kind) continue
      const access = await accessForThread(shared, row, ctx.person._id)
      // La liste de la page ne montre que ce que le lecteur lit AU NOM de la page.
      if (access === null || access.side !== "responder") continue
      items.push(await projectContextualThread(shared, access, ctx.person._id, helpers))
    }
    return { ...window, page: items }
  },
})

// ═══════════════════════════════════════════════════════════════
// Gestes de sortie (statut minimal `en_attente`, §5.1)
// ═══════════════════════════════════════════════════════════════

/** Lecture marquée : aucune autre trace, aucun accusé montré à l'autre côté. */
export const markRead = networkMutation({
  minStatus: "en_attente",
  writeBucket: "contextual.manage",
  args: { threadId: v.id("contextualThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    if (access === null) return notFound()
    await markPersonRead(ctx, access.thread, ctx.person._id, Date.now())
    return null
  },
})

/**
 * Clôture par un côté (D12) : irréversible pour cet objet, ouverte à tout signataire vivant côté
 * page ; l'objet reste inchangé ; avis neutre `contextual_closed` à l'autre côté.
 */
export const close = networkMutation({
  minStatus: "en_attente",
  writeBucket: "contextual.manage",
  args: { threadId: v.id("contextualThreads"), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: ctx.person._id, threadId: args.threadId })
    if (access === null) return notFound()
    if (!access.capabilities.canClose) return failRule(access.snapshot.phase === "not_open" ? "CONTEXT_NOT_OPEN" : "CONTEXT_CLOSED")
    if (access.thread.revision !== args.expectedRevision) return fail("conflict")
    const now = Date.now()
    await ctx.db.patch(access.thread._id, { status: "closed", closedAt: now, closedCause: "side", closedBySide: access.side, revision: access.thread.revision + 1, updatedAt: now })
    // CC-4 : le fil clos n'admet plus aucun appel — ceux qui vivent s'arrêtent ici (`finishCall`, salle fermée).
    await stopContextualThreadCalls(ctx, access.thread._id)
    await notifyContextualActivity(ctx, access, { actorPersonId: ctx.person._id, kind: "contextual_closed" })
    return null
  },
})
