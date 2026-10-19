/**
 * Mesure du pilote DIASPORALE (G11 · DG-027 du plan global) — agrégats
 * MATÉRIALISÉS par un passage nocturne, jamais calculés à la lecture.
 * PROPRIÉTAIRE : chantier « mesure du pilote » de la session DIASPORALE.
 *
 * Le passage (`refreshPilotMetrics`, cron quotidien inscrit par ANTSIA) recompte
 * les COHORTES des 90 jours UTC complets qui précèdent son jour, par blocs de
 * dix jours, en lots bornés chaînés par curseur :
 *   1. les offres actives des pages lisibles (relevé du passage) ;
 *   puis, pour chaque bloc,
 *   2. les demandes créées dans le bloc (envoyées, répondues, confirmées,
 *      réalisées, annulées, expirées ; classe du délai de première réponse) ;
 *   3. les premières demandes d'adhésion associative et leur acceptation ;
 *   4. les avis créés dans le bloc et publiés à ce jour ;
 *   5. les évènements de page commencés dans le bloc, puis leurs places
 *      confirmées et présences pointées, évènement par évènement ;
 *   6. l'écriture : UNE ligne par jour et par portée (tout le réseau, et chaque
 *      pays mesuré ou déjà présent ce jour-là), une seule fois par passage.
 * Les demandes, adhésions et avis se lisent par l'index de création du moteur
 * (`_creationTime`), à un jour près de leur date métier `createdAt`, qui seule
 * range la ligne dans son jour. Le passage ne lit que des états, des dates et
 * des références : aucun texte libre (besoin, détails, motif, avis, message)
 * n'est recopié ni agrégé, aucun identifiant de personne n'entre dans une ligne.
 *
 * Les lectures rendent des PRÉSENTATIONS (`@diasporale/domain`, pilot-metrics) :
 * un compte sous le seuil s'y dit « moins de 5 », un taux garde sa base, une
 * part trop proche de sa base est masquée. `pilotMetrics` est réservée aux
 * responsables du réseau (administrateurs, modérateurs) — refus indistinct
 * sinon ; les opérateurs lisent la même projection par `consolePilotMetrics`.
 */
import {
  canReadPilotMetrics,
  DAY_MS,
  DIASPORALE_NETWORK_SLUG,
  emptyPilotCounts,
  emptyPilotDay,
  isResidenceCountry,
  normalizePilotHistogram,
  parsePilotScope,
  parsePilotWindowDays,
  PILOT_DISPLAY_THRESHOLD,
  PILOT_METRIC_GROUPS,
  PILOT_METRIC_IDS,
  PILOT_PASS_RANGE_DAYS,
  type PilotDailyCounter,
  pilotMembershipCounters,
  pilotPassRange,
  pilotRegistrationCounters,
  pilotRequestTally,
  pilotReviewCounters,
  pilotUtcDayStart,
  pilotWindow,
  presentPilotIndicators,
  tallyPilotDay,
} from "@diasporale/domain"
import { type Infer, type ObjectType, v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { failAppRule, notFound } from "../../lib/errors"
import { networkQuery, operatorQuery } from "../../lib/functions"
import { literals } from "../../lib/validators"
import { contentState } from "../moderation/policy"
import { readablePageOrNull } from "../pages/access"
import { assertDiasporaNetwork, isDiasporaNetwork } from "./facts"
import { pilotDailyCountsValidator } from "./pilotMetricsTables"

/** Une page du passage : au plus trois lectures par ligne source, loin des limites d'une transaction. */
export const PILOT_PASS_PAGE_SIZE = 100

/** Un bloc du passage : dix jours UTC, comptés puis écrits avant le bloc suivant. */
export const PILOT_BLOCK_DAYS = 10

/** Les évènements d'une page du passage : chacun ouvre ensuite le décompte de ses places. */
const EVENTS_PAGE_SIZE = 25

/** Écart toléré entre l'instant d'insertion (`_creationTime`) et la date métier `createdAt`. */
const CREATION_SLACK_MS = DAY_MS

/** Les lignes écrites par étape d'écriture (au moins un jour entier à chaque étape). */
const WRITE_ROWS_PER_STEP = 300

/** Borne des portées d'un jour (ISO 3166-1 : 249 codes), comme les hubs. */
const COUNTRIES_MAX = 250

/** La clé de portée « tout le réseau » dans les comptes du passage (un pays s'écrit en majuscules). */
const NETWORK_SCOPE = "network"

const PASS_STAGES = ["offers", "requests", "memberships", "reviews", "events", "participants", "write"] as const

const cellValidator = v.object({
  dayStartAt: v.number(),
  country: v.union(v.string(), v.null()),
  counts: pilotDailyCountsValidator,
  firstResponse: v.array(v.number()),
})

const queuedEventValidator = v.object({
  eventId: v.id("events"),
  dayStartAt: v.number(),
  country: v.union(v.string(), v.null()),
})

/** L'état d'une étape du passage : tout ce que la suivante doit savoir, et rien d'une personne. */
const passFields = {
  networkId: v.id("networks"),
  /** L'instant du passage : inscrit sur chaque ligne (`computedAt`), il fixe aussi la plage. */
  startedAt: v.number(),
  /** Le bloc en cours : [blockStartAt, blockStartAt + 10 j), borné par la fin de la plage. */
  blockStartAt: v.number(),
  stage: literals(PASS_STAGES),
  cursor: v.union(v.string(), v.null()),
  pageSize: v.number(),
  /** Offres actives par portée (`network` ou pays), relevées en tête de passage. */
  offersActive: v.record(v.string(), v.number()),
  /** Les comptes du bloc en cours, par jour et portée. */
  cells: v.array(cellValidator),
  /** Les évènements du bloc dont les places restent à compter. */
  eventQueue: v.array(queuedEventValidator),
  /** La reprise de la lecture des évènements après le décompte des places. */
  eventsCursor: v.union(v.string(), v.null()),
  eventsDone: v.boolean(),
  /** Le prochain jour du bloc à écrire. */
  writeDayStartAt: v.number(),
}

type PassArgs = ObjectType<typeof passFields>
type Cell = Infer<typeof cellValidator>
type CountryCache = Map<string, string | null>

/** Une page de passage, jamais plus large que `PILOT_PASS_PAGE_SIZE`. */
function passPageSize(pageSize: number): number {
  const size = Number.isFinite(pageSize) ? Math.trunc(pageSize) : PILOT_PASS_PAGE_SIZE
  return Math.min(Math.max(1, size), PILOT_PASS_PAGE_SIZE)
}

/** La fin (exclue) du bloc en cours. */
function blockEndOf(args: PassArgs): number {
  return Math.min(args.blockStartAt + PILOT_BLOCK_DAYS * DAY_MS, pilotPassRange(args.startedAt).endAt)
}

function scopeKey(country: string | null): string {
  return country ?? NETWORK_SCOPE
}

/** Les comptes du bloc : chaque ligne source compte pour tout le réseau, et pour son pays s'il est connu. */
class BlockTally {
  private readonly cells = new Map<string, Cell>()

  constructor(cells: readonly Cell[]) {
    for (const cell of cells) this.cells.set(`${cell.dayStartAt}|${scopeKey(cell.country)}`, cell)
  }

  add(dayStartAt: number, country: string | null, counters: readonly PilotDailyCounter[], firstResponseBucket: number | null = null): void {
    if (counters.length === 0) return
    for (const scope of country === null ? [null] : [null, country]) {
      const key = `${dayStartAt}|${scopeKey(scope)}`
      const next = tallyPilotDay(this.cells.get(key) ?? emptyPilotDay(), counters, firstResponseBucket)
      this.cells.set(key, { dayStartAt, country: scope, counts: next.counts, firstResponse: next.firstResponse })
    }
  }

  list(): Cell[] {
    return [...this.cells.values()]
  }
}

/** Le pays d'une offre (zone de service), lu une fois par étape ; `null` hors diaspora ou introuvable. */
async function offerCountry(ctx: MutationCtx, cache: CountryCache, offerId: Id<"serviceOffers">): Promise<string | null> {
  const cached = cache.get(offerId)
  if (cached !== undefined) return cached
  const offer = await ctx.db.get(offerId)
  const country = offer !== null && isResidenceCountry(offer.country) ? offer.country : null
  cache.set(offerId, country)
  return country
}

/** Le pays d'une page (celui de ses publications locales), lu une fois par étape. */
async function pageCountry(ctx: MutationCtx, cache: CountryCache, pageId: Id<"pages">): Promise<string | null> {
  const cached = cache.get(pageId)
  if (cached !== undefined) return cached
  const page = await ctx.db.get(pageId)
  const country = page?.country !== undefined && isResidenceCountry(page.country) ? page.country : null
  cache.set(pageId, country)
  return country
}

/** Les bornes de lecture par l'index de création d'un bloc, à un jour près. */
function creationRange(args: PassArgs): { readonly from: number; readonly to: number } {
  return { from: args.blockStartAt - CREATION_SLACK_MS, to: blockEndOf(args) + CREATION_SLACK_MS }
}

/** La date métier tombe-t-elle dans le bloc en cours ? */
function inBlock(args: PassArgs, at: number): boolean {
  return at >= args.blockStartAt && at < blockEndOf(args)
}

// ═══════════════════════════════════════════════════════════════
// Étapes du passage
// ═══════════════════════════════════════════════════════════════

/** 1. Les offres actives des pages lisibles, par pays de service. */
async function offersStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const page = await ctx.db
    .query("serviceOffers")
    .withIndex("by_network_and_status", (q) => q.eq("networkId", network._id).eq("status", "active"))
    .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
  const offersActive = { ...args.offersActive }
  const readable = new Map<string, boolean>()
  for (const offer of page.page) {
    let open = readable.get(offer.pageId)
    if (open === undefined) {
      open = (await readablePageOrNull(ctx, network, offer.pageId)) !== null
      readable.set(offer.pageId, open)
    }
    if (!open) continue
    offersActive[NETWORK_SCOPE] = (offersActive[NETWORK_SCOPE] ?? 0) + 1
    if (isResidenceCountry(offer.country)) offersActive[offer.country] = (offersActive[offer.country] ?? 0) + 1
  }
  if (!page.isDone) return { ...args, cursor: page.continueCursor, offersActive }
  return { ...args, stage: "requests", cursor: null, offersActive }
}

/** 2. Les demandes créées dans le bloc ; seuls états, dates et versions sont lus. */
async function requestsStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const range = creationRange(args)
  const page = await ctx.db
    .query("serviceRequests")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", range.from).lt("_creationTime", range.to))
    .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
  const tally = new BlockTally(args.cells)
  const countries: CountryCache = new Map()
  for (const request of page.page) {
    if (request.networkId !== network._id || !inBlock(args, request.createdAt)) continue
    const firstProposal = request.proposalVersion >= 1
      ? await ctx.db
          .query("serviceProposals")
          .withIndex("by_request_and_version", (q) => q.eq("requestId", request._id).eq("version", 1))
          .first()
      : null
    const counted = pilotRequestTally(
      {
        status: request.status,
        deadlineAt: request.deadlineAt ?? null,
        createdAt: request.createdAt,
        proposalVersion: request.proposalVersion,
        firstProposalAt: firstProposal?.createdAt ?? null,
        closedAt: request.closedAt ?? null,
        hasBooking: request.bookingId !== undefined,
      },
      args.startedAt,
    )
    tally.add(pilotUtcDayStart(request.createdAt), await offerCountry(ctx, countries, request.offerId), counted.counters, counted.firstResponseBucket)
  }
  if (!page.isDone) return { ...args, cursor: page.continueCursor, cells: tally.list() }
  return { ...args, stage: "memberships", cursor: null, cells: tally.list() }
}

/** 3. Les premières demandes d'adhésion du bloc (une ligne par personne et association), et leur acceptation. */
async function membershipsStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const range = creationRange(args)
  const page = await ctx.db
    .query("associationMemberships")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", range.from).lt("_creationTime", range.to))
    .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
  const tally = new BlockTally(args.cells)
  const countries: CountryCache = new Map()
  for (const membership of page.page) {
    if (membership.networkId !== network._id || !inBlock(args, membership.createdAt)) continue
    tally.add(pilotUtcDayStart(membership.createdAt), await pageCountry(ctx, countries, membership.pageId), pilotMembershipCounters(membership.status))
  }
  if (!page.isDone) return { ...args, cursor: page.continueCursor, cells: tally.list() }
  return { ...args, stage: "reviews", cursor: null, cells: tally.list() }
}

/** 4. Les avis créés dans le bloc, actifs et publiés par la modération à ce jour. */
async function reviewsStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const range = creationRange(args)
  const page = await ctx.db
    .query("serviceReviews")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", range.from).lt("_creationTime", range.to))
    .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
  const tally = new BlockTally(args.cells)
  const countries: CountryCache = new Map()
  for (const review of page.page) {
    if (review.networkId !== network._id || !inBlock(args, review.createdAt)) continue
    // Même lecture que la projection des avis : sans état de modération du réseau, l'avis n'est pas publié.
    const state = await contentState(ctx, "serviceReview", review._id)
    const published = state !== null && state.networkId === network._id && state.status === "published"
    const counters = pilotReviewCounters({ active: review.status === "active", published })
    if (counters.length === 0) continue
    tally.add(pilotUtcDayStart(review.createdAt), await offerCountry(ctx, countries, review.offerId), counters)
  }
  if (!page.isDone) return { ...args, cursor: page.continueCursor, cells: tally.list() }
  return { ...args, stage: "events", cursor: null, cells: tally.list(), eventsCursor: null, eventsDone: false, eventQueue: [] }
}

/** 5a. Les évènements de page (sans organisateur personnel) commencés dans le bloc, non annulés. */
async function eventsStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const page = await ctx.db
    .query("events")
    .withIndex("by_network_organizer_startAt", (q) =>
      q.eq("networkId", network._id).eq("organizerPersonId", undefined).gte("startAt", args.blockStartAt).lt("startAt", blockEndOf(args)),
    )
    .paginate({ cursor: args.cursor, numItems: Math.min(passPageSize(args.pageSize), EVENTS_PAGE_SIZE) })
  const countries: CountryCache = new Map()
  const eventQueue = [...args.eventQueue]
  for (const event of page.page) {
    if (event.organizerPageId === undefined || event.status === "cancelled") continue
    eventQueue.push({ eventId: event._id, dayStartAt: pilotUtcDayStart(event.startAt), country: await pageCountry(ctx, countries, event.organizerPageId) })
  }
  const resume = { eventsCursor: page.isDone ? null : page.continueCursor, eventsDone: page.isDone }
  if (eventQueue.length > 0) return { ...args, ...resume, stage: "participants", cursor: null, eventQueue }
  if (!page.isDone) return { ...args, ...resume, cursor: page.continueCursor, eventQueue }
  return { ...args, ...resume, stage: "write", cursor: null, eventQueue: [], writeDayStartAt: args.blockStartAt }
}

/** 5b. Les places confirmées d'un évènement, et leurs présences pointées, par pages. */
async function participantsStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs> {
  const [head, ...rest] = args.eventQueue
  if (head === undefined) {
    // File vide (rejeu) : on reprend les évènements, ou on écrit le bloc.
    return args.eventsDone
      ? { ...args, stage: "write", cursor: null, writeDayStartAt: args.blockStartAt }
      : { ...args, stage: "events", cursor: args.eventsCursor }
  }
  const page = await ctx.db
    .query("eventParticipants")
    .withIndex("by_event_status", (q) => q.eq("eventId", head.eventId).eq("status", "accepted"))
    .paginate({ cursor: args.cursor, numItems: passPageSize(args.pageSize) })
  const tally = new BlockTally(args.cells)
  for (const row of page.page) {
    if (row.networkId !== network._id) continue
    tally.add(head.dayStartAt, head.country, pilotRegistrationCounters(row.pageAttendanceCheckedInAt !== undefined))
  }
  const cells = tally.list()
  if (!page.isDone) return { ...args, cursor: page.continueCursor, cells }
  if (rest.length > 0) return { ...args, cursor: null, cells, eventQueue: rest }
  return args.eventsDone
    ? { ...args, stage: "write", cursor: null, cells, eventQueue: [], writeDayStartAt: args.blockStartAt }
    : { ...args, stage: "events", cursor: args.eventsCursor, cells, eventQueue: [] }
}

/**
 * Écrit UN jour : une ligne par portée — tout le réseau toujours, chaque pays
 * compté ce jour-là, chaque pays déjà présent ce jour-là (remis à zéro s'il n'a
 * plus rien), et, le dernier jour complet, chaque portée qui a des offres
 * actives. Rend le nombre de lignes écrites.
 */
async function writeDay(ctx: MutationCtx, networkId: Id<"networks">, dayStartAt: number, args: PassArgs, isLastDay: boolean): Promise<number> {
  const existing = await ctx.db
    .query("pilotMetricsDaily")
    .withIndex("by_network_and_dayStartAt", (q) => q.eq("networkId", networkId).eq("dayStartAt", dayStartAt))
    .take(COUNTRIES_MAX + 2)
  const rows = new Map(existing.map((row) => [scopeKey(row.country), row]))
  const cells = new Map(args.cells.filter((cell) => cell.dayStartAt === dayStartAt).map((cell) => [scopeKey(cell.country), cell]))
  const scopes = new Set<string>([NETWORK_SCOPE, ...rows.keys(), ...cells.keys(), ...(isLastDay ? Object.keys(args.offersActive) : [])])
  for (const scope of scopes) {
    const cell = cells.get(scope)
    const fields = {
      counts: cell?.counts ?? emptyPilotCounts(),
      firstResponse: normalizePilotHistogram(cell?.firstResponse ?? []),
      computedAt: args.startedAt,
      ...(isLastDay ? { offersActive: args.offersActive[scope] ?? 0 } : {}),
    }
    const row = rows.get(scope)
    if (row) await ctx.db.patch(row._id, fields)
    else await ctx.db.insert("pilotMetricsDaily", { networkId, country: scope === NETWORK_SCOPE ? null : scope, dayStartAt, ...fields })
  }
  return scopes.size
}

/** 6. L'écriture du bloc, jour par jour ; puis le bloc suivant, ou la fin du passage (`null`). */
async function writeStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs | null> {
  const range = pilotPassRange(args.startedAt)
  const end = blockEndOf(args)
  let day = args.writeDayStartAt
  let written = 0
  while (day < end && written < WRITE_ROWS_PER_STEP) {
    written += await writeDay(ctx, network._id, day, args, day === range.endAt - DAY_MS)
    day += DAY_MS
  }
  if (day < end) return { ...args, writeDayStartAt: day }
  if (end >= range.endAt) return null
  return {
    ...args,
    stage: "requests",
    cursor: null,
    blockStartAt: end,
    cells: [],
    eventQueue: [],
    eventsCursor: null,
    eventsDone: false,
    writeDayStartAt: end,
  }
}

async function runStage(ctx: MutationCtx, network: Doc<"networks">, args: PassArgs): Promise<PassArgs | null> {
  switch (args.stage) {
    case "offers":
      return await offersStage(ctx, network, args)
    case "requests":
      return await requestsStage(ctx, network, args)
    case "memberships":
      return await membershipsStage(ctx, network, args)
    case "reviews":
      return await reviewsStage(ctx, network, args)
    case "events":
      return await eventsStage(ctx, network, args)
    case "participants":
      return await participantsStage(ctx, network, args)
    case "write":
      return await writeStage(ctx, network, args)
  }
}

/** Passage nocturne (cron quotidien) : lance le recomptage chaîné des 90 derniers jours UTC complets. */
export const refreshPilotMetrics = internalMutation({
  args: { pageSize: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { pageSize }): Promise<null> => {
    const network = await ctx.db
      .query("networks")
      .withIndex("by_slug", (q) => q.eq("slug", DIASPORALE_NETWORK_SLUG))
      .unique()
    if (!isDiasporaNetwork(network)) return null
    const startedAt = Date.now()
    const range = pilotPassRange(startedAt)
    await ctx.scheduler.runAfter(0, internal.modules.diaspora.pilotMetrics.refreshPilotMetricsPage, {
      networkId: network._id,
      startedAt,
      blockStartAt: range.startAt,
      stage: "offers",
      cursor: null,
      pageSize: pageSize ?? PILOT_PASS_PAGE_SIZE,
      offersActive: {},
      cells: [],
      eventQueue: [],
      eventsCursor: null,
      eventsDone: false,
      writeDayStartAt: range.startAt,
    })
    return null
  },
})

/** Une étape du passage : un lot borné d'une seule table, puis passe la main à l'étape suivante. */
export const refreshPilotMetricsPage = internalMutation({
  args: passFields,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const network = await ctx.db.get(args.networkId)
    if (!isDiasporaNetwork(network)) return null
    const next = await runStage(ctx, network, args)
    if (next !== null) await ctx.scheduler.runAfter(0, internal.modules.diaspora.pilotMetrics.refreshPilotMetricsPage, next)
    return null
  },
})

// ═══════════════════════════════════════════════════════════════
// Lectures : des présentations, jamais un compte brut sous le seuil
// ═══════════════════════════════════════════════════════════════

const countValidator = v.union(
  v.object({ kind: v.literal("value"), value: v.number() }),
  v.object({ kind: v.literal("below_threshold"), threshold: v.number() }),
)
const partValidator = v.union(
  v.object({ kind: v.literal("value"), value: v.number() }),
  v.object({ kind: v.literal("below_threshold"), threshold: v.number() }),
  v.object({ kind: v.literal("complement_below_threshold"), threshold: v.number() }),
)
const rateValidator = v.union(v.object({ kind: v.literal("value"), percent: v.number() }), v.object({ kind: v.literal("withheld") }))
const hoursValidator = v.union(
  v.object({ kind: v.literal("at_most"), hours: v.number() }),
  v.object({ kind: v.literal("above"), hours: v.number() }),
  v.object({ kind: v.literal("withheld") }),
)
const metricIdValidator = literals(PILOT_METRIC_IDS)
const metricGroupValidator = literals(PILOT_METRIC_GROUPS)

const indicatorValidator = v.union(
  v.object({ id: metricIdValidator, group: metricGroupValidator, kind: v.literal("snapshot"), value: countValidator }),
  v.object({ id: metricIdValidator, group: metricGroupValidator, kind: v.literal("count"), value: countValidator }),
  v.object({
    id: metricIdValidator,
    group: metricGroupValidator,
    kind: v.literal("ratio"),
    value: partValidator,
    denominatorId: metricIdValidator,
    denominator: countValidator,
    rate: rateValidator,
  }),
  v.object({ id: metricIdValidator, group: metricGroupValidator, kind: v.literal("duration"), sample: countValidator, median: hoursValidator, p75: hoursValidator }),
)

/** La mesure d'une portée sur une période ; `measured: false` tant qu'aucun passage n'a écrit. */
export const pilotMetricsViewValidator = v.union(
  v.object({ measured: v.literal(false), country: v.union(v.string(), v.null()), days: v.number(), threshold: v.number() }),
  v.object({
    measured: v.literal(true),
    country: v.union(v.string(), v.null()),
    days: v.number(),
    threshold: v.number(),
    /** Jours UTC de la période : début inclus, fin exclue. */
    windowStartAt: v.number(),
    windowEndAt: v.number(),
    /** Le plus ancien passage parmi les jours lus (tous égaux hors passage en cours ou interrompu). */
    computedAt: v.number(),
    /** Jours du réseau effectivement écrits dans la période. */
    daysMeasured: v.number(),
    indicators: v.array(indicatorValidator),
  }),
)
type PilotMetricsView = Infer<typeof pilotMetricsViewValidator>

const readArgs = { country: v.optional(v.union(v.string(), v.null())), days: v.number() }

/** Les lignes d'une portée sur une période, au plus une par jour. */
async function windowRows(ctx: QueryCtx, networkId: Id<"networks">, country: string | null, window: { readonly startAt: number; readonly endAt: number }) {
  return await ctx.db
    .query("pilotMetricsDaily")
    .withIndex("by_network_and_country_and_dayStartAt", (q) =>
      q.eq("networkId", networkId).eq("country", country).gte("dayStartAt", window.startAt).lt("dayStartAt", window.endAt),
    )
    .take(PILOT_PASS_RANGE_DAYS + 1)
}

/** La lecture commune : arguments jugés par le domaine, période ancrée au dernier jour mesuré. */
async function readPilotMetrics(ctx: QueryCtx, network: Doc<"networks">, args: { readonly country?: string | null | undefined; readonly days: number }): Promise<PilotMetricsView> {
  const days = parsePilotWindowDays(args.days)
  if (!days.ok) return failAppRule(days.code, {}, "invalidArgument")
  const scope = parsePilotScope(args.country)
  if (!scope.ok) return failAppRule(scope.code, {}, "invalidArgument")
  const latest = await ctx.db
    .query("pilotMetricsDaily")
    .withIndex("by_network_and_country_and_dayStartAt", (q) => q.eq("networkId", network._id).eq("country", null))
    .order("desc")
    .first()
  if (latest === null) return { measured: false, country: scope.value, days: days.value, threshold: PILOT_DISPLAY_THRESHOLD }
  const window = pilotWindow(latest.dayStartAt, days.value)
  const networkRows = await windowRows(ctx, network._id, null, window)
  const rows = scope.value === null ? networkRows : await windowRows(ctx, network._id, scope.value, window)
  const lastDay = rows.find((row) => row.dayStartAt === latest.dayStartAt)
  return {
    measured: true,
    country: scope.value,
    days: days.value,
    threshold: PILOT_DISPLAY_THRESHOLD,
    windowStartAt: window.startAt,
    windowEndAt: window.endAt,
    computedAt: networkRows.reduce((oldest, row) => Math.min(oldest, row.computedAt), latest.computedAt),
    daysMeasured: networkRows.length,
    indicators: presentPilotIndicators({ days: rows, offersActive: lastDay?.offersActive ?? 0 }),
  }
}

/**
 * La mesure du pilote, pour les responsables du réseau (administrateurs et
 * modérateurs) ; tout autre membre reçoit le refus indistinct, avant tout
 * jugement de ses arguments. `country` absent ou `null` : tout le réseau.
 */
export const pilotMetrics = networkQuery({
  args: readArgs,
  returns: pilotMetricsViewValidator,
  handler: async (ctx, args): Promise<PilotMetricsView> => {
    assertDiasporaNetwork(ctx.network)
    if (!canReadPilotMetrics(ctx.membership.role)) return notFound()
    return await readPilotMetrics(ctx, ctx.network, args)
  },
})

/** Le lecteur peut-il ouvrir la mesure ? Il ne lit que son propre rôle (entrée du menu, écran). */
export const pilotMetricsAccess = networkQuery({
  args: {},
  returns: v.object({ allowed: v.boolean() }),
  handler: async (ctx): Promise<{ allowed: boolean }> => {
    assertDiasporaNetwork(ctx.network)
    return { allowed: canReadPilotMetrics(ctx.membership.role) }
  },
})

/** La même projection pour la console du moteur : opérateur de plateforme vivant, réseau gouverné par la tranche. */
export const consolePilotMetrics = operatorQuery({
  args: { networkId: v.id("networks"), ...readArgs },
  returns: pilotMetricsViewValidator,
  handler: async (ctx, args): Promise<PilotMetricsView> => {
    const network = await ctx.db.get(args.networkId)
    if (!isDiasporaNetwork(network)) return notFound()
    return await readPilotMetrics(ctx, network, args)
  },
})
