/** P09 : projection publique commune ; aucun privilège de gestion ne traverse le DTO. */
import { parseCommerceRef } from "@antsia/social-domain/commerce/primitives"
import { commerceOfferPublicView, type CommerceAvailabilityEvent, parseCommercePublicBody } from "@antsia/social-domain/commerce/projection"
import type { PaginationOptions } from "convex/server"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { contactEnabledForShop } from "../commercialMessaging/access"
import { catalogMediaDto } from "../federation/commerceCatalogMedia"
import { canReadModeratedContent, contentState } from "../moderation/policy"
import { findPageByHandle } from "../pages/access"
import { isStorefrontInReadingContext, shopOfPage } from "./access"
import { headBelongsToCurrentCatalog, readableCatalogMapping } from "./catalogAccess"
import type { CatalogList, CatalogOffer } from "./catalogValidators"

export type CatalogReadContext = { root: Doc<"networks">; readerPersonId?: Id<"persons">; network?: Doc<"networks"> }
type ReadCtx = Pick<QueryCtx, "db">
export type CatalogListArgs = { handle: string; kind?: "product" | "service"; collectionRef?: string; query?: string; paginationOpts: PaginationOptions }
const STALE_MS = 15 * 60 * 1000
const normalized = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()

async function contextFor(ctx: ReadCtx, context: CatalogReadContext, shopId: Id<"shops">) {
  const live = await readableCatalogMapping(ctx, context.root, shopId, context.readerPersonId)
  return live && (!context.network || await isStorefrontInReadingContext(ctx, live.shop, context.network)) ? live : null
}

async function project(ctx: ReadCtx, context: CatalogReadContext, head: Doc<"commerceCatalogHeads">, live: NonNullable<Awaited<ReturnType<typeof contextFor>>>): Promise<CatalogOffer | null> {
  if (head.state !== "active" || head.sequence !== "catalog" || head.objectKind !== "offer" || !headBelongsToCurrentCatalog(head, live)) return null
  // Même son administrateur ne transforme pas une prélecture en projection publique.
  if ((await contentState(ctx, "commerceOffer", head._id))?.status !== "published" || !await canReadModeratedContent(ctx, "commerceOffer", head._id, context.readerPersonId)) return null
  const parsed = parseCommercePublicBody(head.body, Date.now())
  if (!parsed.ok || (parsed.value.payload.type !== "offer.published" && parsed.value.payload.type !== "offer.updated")) return null
  const offer = parsed.value.payload
  const available = await ctx.db.query("commerceCatalogHeads").withIndex("by_emitter_object_sequence", (q) => q.eq("emitterId", head.emitterId).eq("objectRef", head.objectRef).eq("sequence", "availability")).unique()
  let availability: CommerceAvailabilityEvent | null = null
  if (available?.state === "active" && headBelongsToCurrentCatalog(available, live)) {
    const snapshot = parseCommercePublicBody(available.body, Date.now())
    if (snapshot.ok && snapshot.value.payload.type === "offer.availabilityChanged") availability = snapshot.value.payload
  }
  // Une réception/signature de transport récente ne rajeunit jamais un ancien fait métier.
  const stale = availability === null || availability.changedAt < offer.changedAt || Date.now() - availability.changedAt > STALE_MS
  const view = commerceOfferPublicView(offer, stale ? null : availability, { nowMs: Date.now(), purchase: false, quote: false })
  const collections = live.parent.collections.filter((collection) => offer.collectionRefs.includes(collection.collectionRef)).sort((a, b) => a.position - b.position || a.collectionRef.localeCompare(b.collectionRef)).map(({ collectionRef, label }) => ({ collectionRef, label }))
  return {
    offerRef: view.offerRef, shopHandle: live.page.handle, kind: view.kind, title: view.title, description: view.description,
    price: view.price, revision: view.revision, changedAt: offer.changedAt, collections,
    tags: [...view.tags], variantAxes: [...view.variantAxes],
    variants: view.variants.map((variant) => ({ variantRef: variant.variantRef, label: variant.label, options: [...variant.options], amount: variant.amount, unit: variant.unit ?? null, availability: variant.availability })),
    media: await catalogMediaDto(ctx, head, offer.media),
    availability: { state: view.availability, indicative: true, updatedAt: offer.showsAvailability ? availability?.changedAt ?? null : null, stale: offer.showsAvailability ? stale : false },
    leadTimeDays: view.leadTimeDays ?? null, zone: view.zone ?? null,
    actions: { contact: await contactEnabledForShop(ctx, live.shop._id, context.network?._id ?? context.root._id), quote: false, purchase: false },
  }
}

export async function resolveCatalogOffer(ctx: ReadCtx, context: CatalogReadContext, shopId: Id<"shops">, offerRef: string): Promise<CatalogOffer | null> {
  if (parseCommerceRef(offerRef)?.kind !== "offer") return null
  const live = await contextFor(ctx, context, shopId)
  if (!live) return null
  const head = await ctx.db.query("commerceCatalogHeads").withIndex("by_emitter_object_sequence", (q) => q.eq("emitterId", live.mapping.emitterId).eq("objectRef", offerRef).eq("sequence", "catalog")).unique()
  return head ? await project(ctx, context, head, live) : null
}

export async function resolvePostOffer(ctx: ReadCtx, post: Doc<"posts">, context: CatalogReadContext): Promise<CatalogOffer | null> {
  const reference = post.commerceOffer
  return post.status === "published" && reference ? await resolveCatalogOffer(ctx, context, reference.shopId, reference.offerRef) : null
}

export async function catalogOfferByHandle(ctx: ReadCtx, context: CatalogReadContext, handle: string, offerRef: string): Promise<CatalogOffer | null> {
  const page = await findPageByHandle(ctx, handle)
  const shop = page ? await shopOfPage(ctx, page._id) : null
  return shop ? await resolveCatalogOffer(ctx, context, shop._id, offerRef) : null
}

export async function listCatalog(ctx: ReadCtx, context: CatalogReadContext, args: CatalogListArgs): Promise<CatalogList> {
  const query = args.query?.normalize("NFC").trim() ?? ""
  if (query.length > 120) return fail("invalidArgument", { field: "query" })
  if (args.collectionRef && parseCommerceRef(args.collectionRef)?.kind !== "offer_collection") return fail("invalidArgument", { field: "collectionRef" })
  const empty: CatalogList = { page: [], isDone: true, continueCursor: "", collections: [], filteredWindow: false }
  const page = await findPageByHandle(ctx, args.handle)
  const shop = page ? await shopOfPage(ctx, page._id) : null
  const live = shop ? await contextFor(ctx, context, shop._id) : null
  if (!live) return empty
  const numItems = Number.isFinite(args.paginationOpts.numItems) ? Math.min(12, Math.max(1, Math.floor(args.paginationOpts.numItems))) : 12
  const window = await ctx.db.query("commerceCatalogHeads").withIndex("by_network_shop_kind_state_changedAt", (q) => q.eq("networkId", live.shop.networkId).eq("shopId", live.shop._id).eq("objectKind", "offer").eq("sequence", "catalog").eq("state", "active")).order("desc").paginate({ ...args.paginationOpts, numItems, maximumRowsRead: 24, maximumBytesRead: 1024 * 1024 })
  const result: CatalogOffer[] = []
  for (const head of window.page) {
    if (args.kind && head.kind !== args.kind) continue
    const offer = await project(ctx, context, head, live)
    if (!offer || args.collectionRef && !offer.collections.some((collection) => collection.collectionRef === args.collectionRef) || query && !normalized([offer.title, offer.description, ...offer.tags].join(" ")).includes(normalized(query))) continue
    result.push(offer)
  }
  return { page: result, isDone: window.isDone, continueCursor: window.continueCursor, collections: [...live.parent.collections].sort((a, b) => a.position - b.position || a.collectionRef.localeCompare(b.collectionRef)).map(({ collectionRef, label }) => ({ collectionRef, label })), filteredWindow: result.length !== window.page.length }
}

/** Prévisualisation P07 : fenêtre explicite de douze, jamais prétendue exhaustive. */
export async function catalogStorefrontBlocks(ctx: ReadCtx, root: Doc<"networks">, shop: Doc<"shops">, readerPersonId?: Id<"persons">): Promise<Array<"catalog" | "services">> {
  const context = { root, readerPersonId }, live = await contextFor(ctx, context, shop._id)
  if (!live) return []
  const heads = await ctx.db.query("commerceCatalogHeads").withIndex("by_network_shop_kind_state_changedAt", (q) => q.eq("networkId", shop.networkId).eq("shopId", shop._id).eq("objectKind", "offer").eq("sequence", "catalog").eq("state", "active")).order("desc").take(12)
  for (const head of heads) if (await project(ctx, context, head, live)) return [shop.model === "quote_services" ? "services" : "catalog"]
  return []
}
