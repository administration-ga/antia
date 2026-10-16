// Dupliqué de socle/convex/modules/reseauPages/pages.ts @ ad2e7fdc2 — adaptations : réécrit (owner map §6.15) — pages GÉNÉRIQUES par réseau, CRÉÉES par un membre vérifié (association, entreprise, média, communauté ; l'institution naît d'une décision tracée, `admin.ts`) au lieu d'être activées pour une organisation ; identité lue sur la page ; lues dans leur réseau, ou depuis la racine si elles y sont ; publier et retirer exigent un SIGNATAIRE VIVANT (au lieu de `communication.publish`) ; audiences `public` (communiqué) et `followers` (note aux abonnés, au lieu de la note de service `organisation`) ; visibilité par la RÈGLE de la page, pays et portée des publications locales tirés de la page (EXF-DG-23) ; abonnés prévenus par la DIFFUSION PAR LOTS, re-gardés au moment de sonner ; abonnés et publications comptés par l'agrégat (D02) ; annuaire par confiance puis récence (au lieu des plus suivies), filtré par pays, cherché sans accents, borné (`discover`) ou paginé (`paginateDiscover`) ; « mes pages suivies » paginées ; mur par fenêtres bornées et curseur composite (le patron du mur d'une personne), chaque ligne re-gardée ; débit sur chaque écriture (D14) ; refus indistinct à code. Désabonnement : coupure des directs réservés aux abonnés de la page (`live.revocation.kickUserFromPageDirects`, lot 16).
/**
 * Les PAGES d'un réseau — créer, lire, suivre, publier en leur nom, lire leur
 * mur, les découvrir.
 *
 * Trois invariants, tenus ici et pas ailleurs :
 *  · une publication de page vit dans `posts` (champ `pageId`), écrite par le
 *    point d'écriture unique `writePost` : réactions, commentaires, partages,
 *    signets et gardes du fil, une seule fois écrits ;
 *  · le droit de parler au nom d'une page est ACTUEL : signataire vivant, relu
 *    à chaque acte — publier hier ne donne rien aujourd'hui ;
 *  · la confiance (« Officiel », « Vérifié ») ne se déclare pas : une page
 *    créée ici est `community`, et seule une décision tracée la change.
 */
import { pageTrustRank, assertMemberCreatableOwnerKind, assertPageHandle, assertPageName, normalizePageDescription, normalizePageShortName, PAGE_SIGNATORIES_MAX } from "@antia/social-domain/pages"
import { assertCountryCode, assertPostContent, assertPostMedia, assertPostReach, REACH_REQUIRING_COUNTRY } from "@antia/social-domain/content"
import { cursorForFeedPost } from "@antia/social-domain/feedScale"
import { effectiveVisibility } from "@antia/social-domain/network"
import { foldSearchQuery } from "@antia/social-domain/searchText"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { type Infer, v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { checked, fail, failRule, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { contentVisibilityValidator, pageOwnerKindValidator } from "../../lib/validators"
import { servableUrl } from "../files/storageGuard"
import { declaredMediaValidator, verifyDeclaredMedia } from "../media/media"
import { enqueueFanout } from "../notifications/fanout"
import { canSeePostDoc, type ReaderContext } from "../posts/access"
import { markPostRemoved } from "../posts/contentRemoval"
import { countPageFollowers, countPagePosts, recordPageFollower, unrecordPageFollower } from "../posts/counters"
import { writePost } from "../posts/postWrite"
import {
  clampLimit,
  cursorCreationTimeOf,
  cursorValidator,
  enrichment,
  FEED_AUTHOR_SCAN,
  type FeedItem,
  feedItemValidator,
  feedWindow,
  pageReader,
  pageViewingReason,
  toFeedItem,
  WALL_WINDOWS_MAX,
} from "../posts/posts"
import {
  assertPageHandleFree,
  isPageOnRoot,
  liveSignatoryRole,
  pageCardOf,
  pageSearchText,
  readablePageByHandle,
  readablePageOrNull,
  requireManagedPage,
  requireReadablePageByHandle,
} from "./access"
import { followedPageIds, isFollowingPage, pageFollowOf } from "./follows"
import { pageCardValidator, pagePostAudienceValidator, pageRoleValidator } from "./validators"

type ReadCtx = Pick<QueryCtx, "db" | "storage">

/** Annuaire sans curseur (le rail « Pages à suivre ») : ce qu'il montre sans qu'on ait rien cherché. */
const DISCOVER_LIMIT_DEFAULT = 20
const DISCOVER_LIMIT_MAX = 25
/** En deçà, une recherche n'en est pas une : l'annuaire retombe sur son ordre (confiance, récence). */
export const DISCOVER_QUERY_MIN_LENGTH = 2
/** Pages des listes paginées, plafond dur. */
const LIST_PAGE_MAX = 50

const clampPage = (opts: { numItems: number; cursor: string | null }) => ({ ...opts, numItems: Math.min(Math.max(Math.trunc(opts.numItems), 1), LIST_PAGE_MAX) })

// ═══════════════════════════════════════════════════════════════
// DTO
// ═══════════════════════════════════════════════════════════════

/** La fiche d'une page, pour un lecteur donné. */
const pageDtoValidator = v.object({
  ...pageCardValidator.fields,
  description: v.union(v.string(), v.null()),
  bannerUrl: v.union(v.string(), v.null()),
  /** La règle de la page : `root`, ses communiqués sont lus aussi depuis la racine. */
  visibility: contentVisibilityValidator,
  followerCount: v.number(),
  postCount: v.number(),
  createdAt: v.number(),
  viewer: v.object({
    following: v.boolean(),
    /** MON rôle VIVANT sur la page (le composeur, la gestion) — `null` : simple lecteur. */
    role: v.union(pageRoleValidator, v.null()),
  }),
})

/** Une ligne d'ANNUAIRE — la découverte, « mes pages suivies » : une seule projection. */
const pageSummaryValidator = v.object({
  ...pageCardValidator.fields,
  description: v.union(v.string(), v.null()),
  followerCount: v.number(),
  following: v.boolean(),
})

type PageSummary = Infer<typeof pageSummaryValidator>

async function toPageSummary(ctx: ReadCtx & Pick<QueryCtx, "runQuery">, page: Doc<"pages">, following: boolean): Promise<PageSummary> {
  return { ...(await pageCardOf(ctx, page)), description: page.description ?? null, followerCount: await countPageFollowers(ctx, page._id), following }
}

const readerOf = (ctx: { person: Doc<"persons">; network: Doc<"networks"> }): ReaderContext => ({ personId: ctx.person._id, network: ctx.network })

// ═══════════════════════════════════════════════════════════════
// Créer
// ═══════════════════════════════════════════════════════════════

/**
 * Créer une page — un membre VÉRIFIÉ du réseau, pour une association, une
 * entreprise, un média ou une communauté. Elle naît `community` (la confiance
 * se décide ailleurs, tracée), son créateur en est le premier administrateur.
 * L'adresse dérive du nom, sauf si une adresse est proposée ; prise, elle est
 * refusée (`handleUnavailable`). La règle `root` (ses communiqués lus aussi
 * depuis la racine) est un geste explicite, sans objet dans la racine.
 */
export const createPage = networkMutation({
  minStatus: "verifiee",
  args: {
    name: v.string(),
    ownerKind: pageOwnerKindValidator,
    handle: v.optional(v.string()),
    shortName: v.optional(v.string()),
    description: v.optional(v.string()),
    country: v.optional(v.string()),
    visibility: v.optional(contentVisibilityValidator),
  },
  returns: v.object({ pageId: v.id("pages"), handle: v.string() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "page.create", ctx.person._id)
    checked(() => assertMemberCreatableOwnerKind(args.ownerKind))
    const name = checked(() => assertPageName(args.name))
    const handle = checked(() => assertPageHandle(args.handle ?? name))
    const shortName = checked(() => normalizePageShortName(args.shortName))
    const description = checked(() => normalizePageDescription(args.description))
    const country = args.country === undefined ? undefined : checked(() => assertCountryCode(args.country ?? ""))
    await assertPageHandleFree(ctx, handle)
    const visibility = ctx.network.kind === "root" ? "network" : (args.visibility ?? "network")
    const now = Date.now()
    const pageId = await ctx.db.insert("pages", {
      networkId: ctx.networkId,
      handle,
      name,
      ...(shortName !== undefined ? { shortName } : {}),
      ...(description !== undefined ? { description } : {}),
      ownerKind: args.ownerKind,
      trust: "community",
      trustRank: pageTrustRank("community"),
      ...(country !== undefined ? { country } : {}),
      visibility,
      onRoot: isPageOnRoot(ctx.network, visibility),
      status: "active",
      createdByPersonId: ctx.person._id,
      searchText: pageSearchText({ name, ...(shortName !== undefined ? { shortName } : {}), handle }),
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("pageSignatories", { networkId: ctx.networkId, pageId, personId: ctx.person._id, role: "admin", acceptedAt: now, createdAt: now, updatedAt: now })
    return { pageId, handle }
  },
})

// ═══════════════════════════════════════════════════════════════
// Lire et suivre
// ═══════════════════════════════════════════════════════════════

/** La fiche d'une page lisible d'ici ; inconnue, retirée ou d'ailleurs : le même `null`. */
export const getPage = networkQuery({
  args: { handle: v.string() },
  returns: v.union(pageDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const page = await readablePageByHandle(ctx, ctx.network, args.handle)
    if (!page) return null
    const [card, bannerUrl, followerCount, postCount, following, role] = await Promise.all([
      pageCardOf(ctx, page),
      page.bannerStorageId ? servableUrl(ctx, page.bannerStorageId) : Promise.resolve(null),
      countPageFollowers(ctx, page._id),
      countPagePosts(ctx, page._id),
      isFollowingPage(ctx, page._id, ctx.person._id),
      liveSignatoryRole(ctx, page, ctx.person._id),
    ])
    return { ...card, description: page.description ?? null, bannerUrl, visibility: page.visibility, followerCount, postCount, createdAt: page.createdAt, viewer: { following, role } }
  },
})

/**
 * Suivre une page lisible d'ici — idempotent (suivre deux fois n'empile ni ne
 * recompte). Aucune cloche : la page n'a personne à prévenir, et l'abonné n'a
 * rien demandé d'autre que ses publications.
 */
export const follow = networkMutation({
  args: { handle: v.string() },
  returns: v.object({ pageId: v.id("pages"), following: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "page.follow", ctx.person._id)
    const page = await requireReadablePageByHandle(ctx, ctx.network, args.handle)
    if (!(await pageFollowOf(ctx, page._id, ctx.person._id))) {
      const now = Date.now()
      const followId = await ctx.db.insert("pageFollows", { networkId: page.networkId, pageId: page._id, personId: ctx.person._id, createdAt: now })
      await recordPageFollower(ctx, { _id: followId, pageId: page._id, createdAt: now })
    }
    return { pageId: page._id, following: true as const }
  },
})

/** Ne plus suivre — idempotent ; possible même d'une page retirée depuis (son compte resterait faux sinon). */
export const unfollow = networkMutation({
  minStatus: "en_attente",
  args: { pageId: v.id("pages") },
  returns: v.object({ following: v.literal(false) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "page.follow", ctx.person._id)
    const existing = await pageFollowOf(ctx, args.pageId, ctx.person._id)
    if (existing) {
      await ctx.db.delete(existing._id)
      await unrecordPageFollower(ctx, existing)
      // Sortir du cercle d'une page coupe aussi une connexion DÉJÀ ouverte à ses directs
      // réservés aux abonnés (la lecture et les jetons neufs sont refusés tout de suite ;
      // sans cette coupure, la salle tiendrait jusqu'à l'expiration du jeton).
      await ctx.scheduler.runAfter(0, internal.modules.live.revocation.kickUserFromPageDirects, { personId: ctx.person._id, pageId: args.pageId, cursor: null })
    }
    return { following: false as const }
  },
})

/** Les pages que je suis, lisibles d'ici, les plus récemment suivies d'abord — paginées. */
export const paginateMyPageFollows = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<PageSummary>> => {
    const result =
      ctx.network.kind === "root"
        ? await ctx.db
            .query("pageFollows")
            .withIndex("by_person_createdAt", (q) => q.eq("personId", ctx.person._id))
            .order("desc")
            .paginate(clampPage(args.paginationOpts))
        : await ctx.db
            .query("pageFollows")
            .withIndex("by_network_person_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("personId", ctx.person._id))
            .order("desc")
            .paginate(clampPage(args.paginationOpts))
    const page: PageSummary[] = []
    for (const row of result.page) {
      // Retirée ou illisible d'ici : elle sort de la liste sans que l'abonnement soit détruit.
      const target = await readablePageOrNull(ctx, ctx.network, row.pageId)
      if (target) page.push(await toPageSummary(ctx, target, true))
    }
    return { ...result, page }
  },
})

/** Les pages au nom desquelles JE parle dans ce réseau (le composeur « publier en tant que »). */
export const myPages = networkQuery({
  args: {},
  returns: v.array(v.object({ ...pageCardValidator.fields, role: pageRoleValidator })),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("pageSignatories")
      .withIndex("by_network_person", (q) => q.eq("networkId", ctx.networkId).eq("personId", ctx.person._id))
      .take(PAGE_SIGNATORIES_MAX)
    const out: (Infer<typeof pageCardValidator> & { role: Doc<"pageSignatories">["role"] })[] = []
    for (const row of rows) {
      // Une invitation en attente ne donne aucune page au nom de laquelle parler.
      if (row.acceptedAt === undefined) continue
      const page = await ctx.db.get(row.pageId)
      if (!page || page.networkId !== ctx.networkId) continue
      const role = await liveSignatoryRole(ctx, page, ctx.person._id)
      if (role !== null) out.push({ ...(await pageCardOf(ctx, page)), role })
    }
    return out
  },
})

// ═══════════════════════════════════════════════════════════════
// Découvrir
// ═══════════════════════════════════════════════════════════════

type DiscoveryFilter = { term: string | null; country: string | undefined }

function discoveryFilterOf(args: { query?: string; country?: string }): DiscoveryFilter {
  const term = (args.query ?? "").trim()
  return {
    term: term.length >= DISCOVER_QUERY_MIN_LENGTH ? foldSearchQuery(term) : null,
    country: args.country === undefined ? undefined : checked(() => assertCountryCode(args.country ?? "")),
  }
}

/**
 * La requête de l'annuaire lu d'ici : la recherche (repliée sans accents) OU
 * l'ordre de l'annuaire — confiance, puis récence —, pages actives seulement,
 * d'un pays si demandé. À la racine : ses pages et celles qui y sont.
 */
function discoveryQuery(ctx: Pick<QueryCtx, "db">, network: Doc<"networks">, filter: DiscoveryFilter) {
  const { term, country } = filter
  const isRoot = network.kind === "root"
  if (term !== null) {
    return ctx.db.query("pages").withSearchIndex("search_name_v1", (q) => {
      const base = q.search("searchText", term).eq("status", "active")
      const scoped = isRoot ? base.eq("onRoot", true) : base.eq("networkId", network._id)
      return country === undefined ? scoped : scoped.eq("country", country)
    })
  }
  if (isRoot) {
    return country === undefined
      ? ctx.db
          .query("pages")
          .withIndex("by_root_status_trustRank_createdAt", (q) => q.eq("onRoot", true).eq("status", "active"))
          .order("desc")
      : ctx.db
          .query("pages")
          .withIndex("by_root_status_country_trustRank_createdAt", (q) => q.eq("onRoot", true).eq("status", "active").eq("country", country))
          .order("desc")
  }
  return country === undefined
    ? ctx.db
        .query("pages")
        .withIndex("by_network_status_trustRank_createdAt", (q) => q.eq("networkId", network._id).eq("status", "active"))
        .order("desc")
    : ctx.db
        .query("pages")
        .withIndex("by_network_status_country_trustRank_createdAt", (q) => q.eq("networkId", network._id).eq("status", "active").eq("country", country))
        .order("desc")
}

/** Marque les pages que je suis — l'ensemble lu une fois, relu par paire s'il est tronqué. */
async function followingFlags(ctx: Pick<QueryCtx, "db">, reader: ReaderContext) {
  const followed = await followedPageIds(ctx, reader.network, reader.personId)
  return async (pageId: Id<"pages">) => followed.ids.has(pageId) || (followed.truncated && (await isFollowingPage(ctx, pageId, reader.personId)))
}

/** L'annuaire BORNÉ (le rail « Pages à suivre ») : au plus 25, sans curseur. */
export const discover = networkQuery({
  args: { query: v.optional(v.string()), country: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(pageSummaryValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? DISCOVER_LIMIT_DEFAULT), 1), DISCOVER_LIMIT_MAX)
    const rows = await discoveryQuery(ctx, ctx.network, discoveryFilterOf(args)).take(limit)
    const isFollowed = await followingFlags(ctx, readerOf(ctx))
    const out: PageSummary[] = []
    for (const page of rows) out.push(await toPageSummary(ctx, page, await isFollowed(page._id)))
    return out
  },
})

/**
 * L'annuaire PAGINÉ — une page hors du rail se retrouve (R-07 du socle). UNE
 * seule branche par appel (recherche OU index), donc une seule pagination
 * native ; `isDone` dit la fin, pas une page vide.
 */
export const paginateDiscover = networkQuery({
  args: { query: v.optional(v.string()), country: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<PageSummary>> => {
    const result = await discoveryQuery(ctx, ctx.network, discoveryFilterOf(args)).paginate(clampPage(args.paginationOpts))
    const isFollowed = await followingFlags(ctx, readerOf(ctx))
    const page: PageSummary[] = []
    for (const row of result.page) page.push(await toPageSummary(ctx, row, await isFollowed(row._id)))
    return { ...result, page }
  },
})

// ═══════════════════════════════════════════════════════════════
// Publier au nom d'une page
// ═══════════════════════════════════════════════════════════════

/**
 * La portée et le pays d'une publication de page (EXF-DG-23) : le pays est
 * celui de la PAGE, jamais saisi — une publication locale exige que la page en
 * déclare un ; une autre portée (`diaspora`) n'en porte pas.
 */
function placePagePost(page: Doc<"pages">, reach: string | undefined, reachValues: readonly string[]): { reach?: string; country?: string } {
  if (reach === REACH_REQUIRING_COUNTRY && page.country === undefined) return failRule("PAGE_COUNTRY_REQUIRED")
  const country = reach === undefined || reach === REACH_REQUIRING_COUNTRY ? page.country : undefined
  return checked(() => assertPostReach({ ...(reach !== undefined ? { reach } : {}), ...(country !== undefined ? { country } : {}), reachValues }))
}

/**
 * Publier au nom d'une page — un SIGNATAIRE VIVANT, depuis le réseau de la page.
 * Gardes, dans cet ordre : débit ; rejeu (la clé rend la publication EXISTANTE,
 * de cette page seulement) ; autorité actuelle ; vérité du stockage pour les
 * médias ; le domaine juge le contenu et la forme (`public` ou `followers`,
 * jamais de groupe ni de partage). La visibilité suit la RÈGLE de la page ; les
 * abonnés sont prévenus par la diffusion par lots, chacun re-gardé.
 */
export const publishAsPage = networkMutation({
  minStatus: "declaree",
  args: {
    pageId: v.id("pages"),
    body: v.string(),
    media: v.optional(v.array(declaredMediaValidator)),
    audience: v.optional(pagePostAudienceValidator),
    reach: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  returns: v.object({ postId: v.id("posts"), created: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "page.publish", ctx.person._id)
    if (args.idempotencyKey !== undefined) {
      const replay = await ctx.db
        .query("posts")
        .withIndex("by_author_and_idempotencyKey", (q) => q.eq("authorPersonId", ctx.person._id).eq("idempotencyKey", args.idempotencyKey))
        .unique()
      // Une clé rejouée pour une AUTRE page (ou ailleurs) ne publie pas ici : la clé appartient à son composeur.
      if (replay) return replay.pageId === args.pageId && replay.networkId === ctx.networkId ? { postId: replay._id, created: false } : fail("conflict")
    }
    const { page } = await requireManagedPage(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, args.pageId, "signatory")
    const audience = args.audience ?? "public"
    // L'acteur est le SIGNATAIRE qui dépose : c'est lui qui a déposé les fichiers.
    const media = await verifyDeclaredMedia(ctx, { actorPersonId: ctx.person._id, networkId: ctx.networkId, usage: "media_social", source: "post_media", declared: args.media ?? [] })
    checked(() =>
      assertPostMedia(media.map((item) => ({ kind: item.kind, mimeType: item.mimeType, sizeBytes: item.sizeBytes, ...(item.altText ? { altText: item.altText } : {}) }))),
    )
    const body = checked(() => assertPostContent({ body: args.body, mediaCount: media.length, isShare: false }))
    const placed = placePagePost(page, args.reach, ctx.network.reachValues)
    const visibility = effectiveVisibility({ networkKind: ctx.network.kind, audienceIsPublic: audience === "public", authorRequestedRoot: false, ruleVisibility: page.visibility })
    const { postId } = await writePost(ctx, {
      network: ctx.network,
      authorPersonId: ctx.person._id,
      body,
      audience,
      visibility,
      ...(media.length > 0 ? { media } : {}),
      ...placed,
      ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
      pageId: page._id,
    })
    // Sans acteur : c'est la page qui parle (la cloche dit « nouvelle publication de… », relue à l'ouverture).
    await enqueueFanout(ctx, { networkId: page.networkId, kind: "page_post", subject: { post: postId }, source: { kind: "pageFollowers", postId } })
    return { postId, created: true }
  },
})

/**
 * Retirer une publication de page — TOUT signataire vivant (pas seulement celui
 * qui l'a signée : le propos est celui de la page). Idempotent, mais pour une
 * autorité encore légitime seulement : le rejeu n'est pas un droit acquis.
 */
export const removePagePost = networkMutation({
  minStatus: "en_attente",
  args: { postId: v.id("posts") },
  returns: v.object({ removed: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "post.remove", ctx.person._id)
    const post = await ctx.db.get(args.postId)
    if (!post || post.pageId === undefined) return notFound()
    await requireManagedPage(ctx, { networkId: ctx.networkId, personId: ctx.person._id }, post.pageId, "signatory")
    await markPostRemoved(ctx, post, Date.now())
    return { removed: true as const }
  },
})

// ═══════════════════════════════════════════════════════════════
// Le mur d'une page
// ═══════════════════════════════════════════════════════════════

/**
 * Le MUR d'une page — ses publications lisibles d'ici, telles que JE peux les
 * voir (la note aux abonnés comme le reste : chaque ligne repasse LA garde).
 * Même découpe que le mur d'une personne : fenêtres bornées, au plus
 * `WALL_WINDOWS_MAX` par appel, curseur sur la dernière ligne EXAMINÉE. Page
 * inconnue, retirée ou d'ailleurs : le même mur vide, sans curseur.
 */
export const pagePosts = networkQuery({
  args: { handle: v.string(), cursor: v.optional(cursorValidator), limit: v.optional(v.number()) },
  returns: v.object({ items: v.array(feedItemValidator), nextCursor: v.union(cursorValidator, v.null()) }),
  handler: async (ctx, args) => {
    const reader = readerOf(ctx)
    const page = await readablePageByHandle(ctx, ctx.network, args.handle)
    if (!page) return { items: [], nextCursor: null }
    const limit = clampLimit(args.limit)
    const [reason, cursorCreationTime] = await Promise.all([pageViewingReason(ctx, reader, page._id), cursorCreationTimeOf(ctx, args.cursor)])

    const visible: Doc<"posts">[] = []
    let lastExamined: Doc<"posts"> | null = null
    let exhausted = false
    let windowCursor = args.cursor
    let windowCursorCreationTime = cursorCreationTime
    for (let pass = 0; pass < WALL_WINDOWS_MAX; pass += 1) {
      const window = await feedWindow(pageReader(ctx, ctx.network, page._id), FEED_AUTHOR_SCAN, windowCursor, windowCursorCreationTime)
      for (const post of window.rows) {
        lastExamined = post
        if (!(await canSeePostDoc(ctx, reader, post))) continue
        visible.push(post)
        if (visible.length >= limit) break
      }
      if (visible.length >= limit) break
      if (!window.wasFull) {
        exhausted = true
        break
      }
      const frontier = window.rows[window.rows.length - 1]
      if (frontier === undefined) {
        exhausted = true
        break
      }
      windowCursor = cursorForFeedPost(frontier)
      windowCursorCreationTime = frontier._creationTime
    }

    const enrich = enrichment(ctx)
    const items: FeedItem[] = []
    for (const post of visible) items.push(await toFeedItem(ctx, post, reader, reason, enrich))
    return { items, nextCursor: exhausted || lastExamined === null ? null : cursorForFeedPost(lastExamined) }
  },
})
