/**
 * P14 : lectures membres. « Mes demandes » ne montre que les demandes de la personne dans CE
 * réseau, avec les états servis par PRO.GA tels qu'observés (datés, jamais inventés) ; le
 * contexte d'une demande de devis n'expose que la conversation commerciale ACCEPTÉE de la
 * personne et ses propres pièces admises ; la rubrique Services de Découvrir ne liste que des
 * offres de service publiées et consenties (projection P09), quand la politique est ouverte.
 */
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { networkQuery } from "../../lib/functions"
import { demoContentAllowed } from "../../seeds/demoContentConfig"
import { commercialThreadAccess } from "../commercialMessaging/access"
import { isServableStorage } from "../files/storageGuard"
import { canReadModeratedContent } from "../moderation/policy"
import { findPageByHandle } from "../pages/access"
import { isStorefrontInReadingContext, shopOfPage, storefrontPolicyOf } from "./access"
import { resolveCatalogOffer } from "./catalogRead"
import { catalogOfferValidator, type CatalogOffer } from "./catalogValidators"
import { demoCatalogForShop } from "./demoCatalog"
import { storefrontsOpen } from "./rules"
import { servicePolicyOpen, validServiceId } from "./serviceAccess"
import { projectServiceRequest, SERVICE_PAGE_MAX, serviceRequestValidator, type ServiceRequestDto } from "./serviceRules"

const DISCOVER_SHOPS_MAX = 8
const DISCOVER_AVAILABILITY_SHOPS = 40
const DISCOVER_OFFERS_PER_SHOP = 3
const THREAD_MESSAGES_SCANNED = 50
const ATTACHMENT_MESSAGES_MAX = 10

type RequestRow = Doc<"commerceServiceRequests">
type PolicyCache = Map<Id<"networks">, boolean>

async function policyOpen(ctx: QueryCtx, cache: PolicyCache, networkId: Id<"networks">): Promise<boolean> {
  const known = cache.get(networkId)
  if (known !== undefined) return known
  const open = await servicePolicyOpen(ctx, networkId)
  cache.set(networkId, open)
  return open
}

async function project(ctx: QueryCtx, row: RequestRow, cache: PolicyCache, now: number): Promise<ServiceRequestDto> {
  const last = await ctx.db.query("commerceServiceCommands").withIndex("by_request_row", (q) => q.eq("requestRowId", row.requestRowId)).order("desc").first()
  const shop = await ctx.db.get(row.shopId)
  // Un changement est un nouvel engagement (politique ouverte) ; l'annulation reste toujours ouverte.
  const change = !!shop && await policyOpen(ctx, cache, row.networkId) && (shop.networkId === row.networkId || await policyOpen(ctx, cache, shop.networkId))
  return projectServiceRequest(row, last, now, { change, cancel: true })
}

function erasing(person: Doc<"persons">): boolean {
  return person.deletionRequestedAt !== undefined || person.erasedAt !== undefined
}

export const myRequests = networkQuery({
  minStatus: "declaree", args: { paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(serviceRequestValidator),
  handler: async (ctx, args): Promise<PaginationResult<ServiceRequestDto>> => {
    if (erasing(ctx.person)) return { page: [], continueCursor: "", isDone: true }
    const requested = args.paginationOpts.numItems
    const numItems = Number.isFinite(requested) ? Math.max(1, Math.min(SERVICE_PAGE_MAX, Math.trunc(requested))) : SERVICE_PAGE_MAX
    const window = await ctx.db.query("commerceServiceRequests").withIndex("by_person_network_updated", (q) => q.eq("personId", ctx.person._id).eq("networkId", ctx.networkId))
      .order("desc").paginate({ ...args.paginationOpts, numItems, maximumRowsRead: SERVICE_PAGE_MAX * 2, maximumBytesRead: 512 * 1024 })
    const cache: PolicyCache = new Map(), now = Date.now(), page: ServiceRequestDto[] = []
    for (const row of window.page) if (row.cancelledAt === undefined) page.push(await project(ctx, row, cache, now))
    return { ...window, page }
  },
})

export const myRequest = networkQuery({
  minStatus: "declaree", args: { requestRowId: v.string() }, returns: v.union(serviceRequestValidator, v.null()),
  handler: async (ctx, args): Promise<ServiceRequestDto | null> => {
    if (erasing(ctx.person) || !validServiceId(args.requestRowId)) return null
    const row = await ctx.db.query("commerceServiceRequests").withIndex("by_request", (q) => q.eq("requestRowId", args.requestRowId)).unique()
    // Refus indistinct : absente, d'autrui, d'un autre réseau ou retirée.
    if (!row || row.personId !== ctx.person._id || row.networkId !== ctx.networkId || row.cancelledAt !== undefined) return null
    return await project(ctx, row, new Map(), Date.now())
  },
})

const attachmentFileValidator = v.object({ filename: v.string(), mimeType: v.string(), sizeBytes: v.number() })
const quoteContextValidator = v.object({
  threadId: v.union(v.id("commercialThreads"), v.null()),
  threadState: v.union(v.literal("requested"), v.literal("accepted"), v.literal("declined"), v.literal("blocked"), v.literal("closed"), v.null()),
  attachments: v.array(v.object({ messageId: v.id("commercialMessages"), createdAt: v.number(), files: v.array(attachmentFileValidator) })),
  attachmentsTruncated: v.boolean(),
})

/**
 * La conversation commerciale de la personne avec cette boutique (offre précise d'abord, puis
 * conversation générale) et SES pièces admises, lisibles et servables, à choisir pour un devis.
 */
export const quoteRequestContext = networkQuery({
  minStatus: "declaree", args: { handle: v.string(), offerRef: v.string() }, returns: v.union(quoteContextValidator, v.null()),
  handler: async (ctx, args) => {
    if (erasing(ctx.person) || args.handle.length > 100 || args.offerRef.length > 200) return null
    const page = await findPageByHandle(ctx, args.handle)
    const shop = page ? await shopOfPage(ctx, page._id) : null
    if (!shop) return null
    const empty = { threadId: null, threadState: null, attachments: [], attachmentsTruncated: false }
    let thread: Doc<"commercialThreads"> | null = null
    for (const offerRef of [args.offerRef, undefined]) {
      const row = await ctx.db.query("commercialThreads").withIndex("by_requester_shop_offer", (q) => q.eq("networkId", ctx.networkId).eq("requesterPersonId", ctx.person._id).eq("shopId", shop._id).eq("offerRef", offerRef)).order("desc").first()
      if (row && row.state !== "closed" && row.state !== "declined") { thread = row; break }
    }
    const access = thread ? await commercialThreadAccess(ctx, ctx.networkId, ctx.person._id, thread._id, true) : null
    if (!thread || !access || access.viewerKind !== "requester") return empty
    const threadId = thread._id
    if (thread.state !== "accepted" || access.blocked) return { ...empty, threadId, threadState: access.blocked ? "blocked" as const : thread.state }
    // borné : les cinquante derniers messages de la conversation.
    const messages = await ctx.db.query("commercialMessages").withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId)).order("desc").take(THREAD_MESSAGES_SCANNED)
    const attachments: Array<{ messageId: Id<"commercialMessages">; createdAt: number; files: Array<{ filename: string; mimeType: string; sizeBytes: number }> }> = []
    let truncated = messages.length === THREAD_MESSAGES_SCANNED
    for (const message of messages) {
      if (message.senderPersonId !== ctx.person._id || message.deletedAt !== undefined || !message.attachmentFiles?.length) continue
      if (!await canReadModeratedContent(ctx, "commercialMessage", message._id, ctx.person._id)) continue
      let servable = true
      for (const file of message.attachmentFiles) if (!await isServableStorage(ctx, file.storageId)) servable = false
      if (!servable) continue
      if (attachments.length === ATTACHMENT_MESSAGES_MAX) { truncated = true; break }
      attachments.push({ messageId: message._id, createdAt: message.createdAt, files: message.attachmentFiles.map((file) => ({ filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes })) })
    }
    return { threadId, threadState: "accepted" as const, attachments, attachmentsTruncated: truncated }
  },
})

async function readingWindowShops(ctx: QueryCtx & { network: Doc<"networks">; networkId: Id<"networks"> }, take: number): Promise<Doc<"shops">[]> {
  return ctx.network.kind === "root"
    ? await ctx.db.query("shops").withIndex("by_storefront_publishedAt", (q) => q.eq("storefront", "published")).order("desc").take(take)
    : await ctx.db.query("shops").withIndex("by_network_storefront_publishedAt", (q) => q.eq("networkId", ctx.networkId).eq("storefront", "published")).order("desc").take(take)
}

/**
 * L'onglet Services exige une offre publiée et consentie parmi quarante vitrines au plus.
 * Le catalogue fictif est réservé à l'environnement démo et garde ses actions fermées.
 */
export const discoverAvailability = networkQuery({
  minStatus: "declaree", args: {}, returns: v.object({ available: v.boolean() }),
  handler: async (ctx) => {
    if (erasing(ctx.person) || !storefrontsOpen(await storefrontPolicyOf(ctx, ctx.networkId))) return { available: false }
    const servicesOpen = await servicePolicyOpen(ctx, ctx.networkId)
    if (!servicesOpen && !demoContentAllowed()) return { available: false }
    const cache: PolicyCache = new Map([[ctx.networkId, servicesOpen]])
    const context = { root: ctx.rootNetwork, readerPersonId: ctx.person._id, network: ctx.network }
    for (const shop of await readingWindowShops(ctx, DISCOVER_AVAILABILITY_SHOPS)) {
      if (!await isStorefrontInReadingContext(ctx, shop, ctx.network)) continue
      const demo = await demoCatalogForShop(ctx, context, shop._id)
      if (demo?.offers.some((offer) => offer.kind === "service")) return { available: true }
      if (!servicesOpen || !await policyOpen(ctx, cache, shop.networkId)) continue
      // borné : douze dernières offres actives de la vitrine.
      const heads = await ctx.db.query("commerceCatalogHeads").withIndex("by_network_shop_kind_state_changedAt", (q) => q.eq("networkId", shop.networkId).eq("shopId", shop._id).eq("objectKind", "offer").eq("sequence", "catalog").eq("state", "active")).order("desc").take(12)
      for (const head of heads) {
        if (head.kind === "service" && (await resolveCatalogOffer(ctx, context, shop._id, head.objectRef))?.kind === "service") return { available: true }
      }
    }
    return { available: false }
  },
})

/**
 * Rubrique Services de Découvrir : vitrines publiées du contexte de lecture (fenêtre bornée),
 * puis au plus trois offres de SERVICE publiées et consenties par vitrine (projection P09).
 * La politique commerciale reste exigée pour les vraies offres ; seules les illustrations
 * explicitement gardées de la démonstration sont visibles sans ouvrir les commandes P14.
 */
export const discoverServices = networkQuery({
  minStatus: "declaree", args: { paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(catalogOfferValidator),
  handler: async (ctx, args): Promise<PaginationResult<CatalogOffer>> => {
    const empty = { page: [], isDone: true, continueCursor: "" }
    if (erasing(ctx.person) || !storefrontsOpen(await storefrontPolicyOf(ctx, ctx.networkId))) return empty
    const servicesOpen = await servicePolicyOpen(ctx, ctx.networkId)
    if (!servicesOpen && !demoContentAllowed()) return empty
    const requested = args.paginationOpts.numItems
    const opts = {
      ...args.paginationOpts,
      numItems: Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), DISCOVER_SHOPS_MAX) : DISCOVER_SHOPS_MAX,
      maximumRowsRead: DISCOVER_SHOPS_MAX, maximumBytesRead: 1_048_576,
    }
    const window = ctx.network.kind === "root"
      ? await ctx.db.query("shops").withIndex("by_storefront_publishedAt", (q) => q.eq("storefront", "published")).order("desc").paginate(opts)
      : await ctx.db.query("shops").withIndex("by_network_storefront_publishedAt", (q) => q.eq("networkId", ctx.networkId).eq("storefront", "published")).order("desc").paginate(opts)
    const cache: PolicyCache = new Map([[ctx.networkId, servicesOpen]])
    const context = { root: ctx.rootNetwork, readerPersonId: ctx.person._id, network: ctx.network }
    const page: CatalogOffer[] = []
    for (const shop of window.page) {
      if (!await isStorefrontInReadingContext(ctx, shop, ctx.network)) continue
      const demo = await demoCatalogForShop(ctx, context, shop._id)
      if (demo) {
        page.push(...demo.offers.filter((offer) => offer.kind === "service").slice(0, DISCOVER_OFFERS_PER_SHOP))
        continue
      }
      if (!servicesOpen || !await policyOpen(ctx, cache, shop.networkId)) continue
      // borné : douze dernières offres actives de la vitrine, filtrées sur le type « service ».
      const heads = await ctx.db.query("commerceCatalogHeads").withIndex("by_network_shop_kind_state_changedAt", (q) => q.eq("networkId", shop.networkId).eq("shopId", shop._id).eq("objectKind", "offer").eq("sequence", "catalog").eq("state", "active")).order("desc").take(12)
      let shown = 0
      for (const head of heads) {
        if (shown === DISCOVER_OFFERS_PER_SHOP) break
        if (head.kind !== "service") continue
        const offer = await resolveCatalogOffer(ctx, context, shop._id, head.objectRef)
        if (offer?.kind === "service") { page.push(offer); shown += 1 }
      }
    }
    return { ...window, page }
  },
})
