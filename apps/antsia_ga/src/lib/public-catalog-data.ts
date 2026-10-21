import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import { api } from "@convex/_generated/api"
import { COMMERCE_PUBLIC_LIMITS as L } from "@antsia/social-domain/commerce/projection"
import { COMMERCE_MAX_AMOUNT_XAF } from "@antsia/social-domain/commerce/primitives"
import { cache } from "react"
import { z } from "zod"

import type { CatalogPage } from "@/components/shops/catalog-model"
import { CATALOG_PAGE_SIZE, type CatalogFilters } from "./catalog-search"
import { projected } from "./public-data"

const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000)
const amount = z.number().int().nonnegative().max(COMMERCE_MAX_AMOUNT_XAF)
const unit = z.string().min(1).max(L.unitMax)
const ref = (kind: string) => z.string().regex(new RegExp(`^pro\\.ga:${kind}:[0-9A-HJKMNP-TV-Z]{10,32}$`))
const collection = z.object({ collectionRef: ref("offer_collection"), label: z.string().min(1).max(L.collectionLabelMax) }).strict()
const availabilityState = z.enum(["in_stock", "out_of_stock", "unknown"]).nullable()
const assetUrl = z.string().url().max(8192).refine((value) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password } catch { return false }
})
const price = z.union([
  z.object({ mode: z.literal("fixed"), amount, currency: z.literal("XAF") }).strict(),
  z.object({ mode: z.literal("unit"), amount, currency: z.literal("XAF"), unit }).strict(),
  z.object({ mode: z.literal("range"), minAmount: amount, maxAmount: amount, currency: z.literal("XAF"), unit: unit.optional() }).strict().refine((value) => value.minAmount <= value.maxAmount),
  z.object({ mode: z.literal("quote"), currency: z.literal("XAF") }).strict(),
])

/** Objet fermé : pas de liaison, stock chiffré, origine machine ou URL de gestion. */
export const catalogOfferSchema: z.ZodType<CatalogOffer> = z.object({
  offerRef: ref("offer"), shopHandle: z.string().min(1).max(200), kind: z.enum(["product", "service"]),
  title: z.string().min(L.offerTitleMin).max(L.offerTitleMax), description: z.string().max(L.offerDescriptionMax),
  price, revision: z.number().int().positive(), changedAt: timestamp,
  collections: z.array(collection).max(L.offerCollectionsMax), tags: z.array(z.string().max(L.tagMax)).max(L.tagsMax),
  variantAxes: z.array(z.string().max(L.variantAxisMax)).max(L.variantAxesMax),
  variants: z.array(z.object({ variantRef: ref("offer_variant"), label: z.string().min(1).max(L.variantLabelMax), options: z.array(z.string().max(L.variantOptionMax)).max(L.variantAxesMax), amount, unit: unit.nullable(), availability: availabilityState }).strict()).max(L.variantsMax),
  media: z.array(z.object({ url: assetUrl.nullable(), altText: z.string().max(L.mediaAltMax).nullable(), width: z.number().int().positive().max(L.mediaDimensionMax).nullable(), height: z.number().int().positive().max(L.mediaDimensionMax).nullable(), withheld: z.enum(["fileScanPending", "fileQuarantined"]).nullable() }).strict()).max(L.mediaMax),
  availability: z.object({ state: availabilityState, indicative: z.literal(true), updatedAt: timestamp.nullable(), stale: z.boolean() }).strict(),
  leadTimeDays: z.number().int().nonnegative().max(L.leadTimeDaysMax).nullable(), zone: z.string().max(L.zoneMax).nullable(),
  actions: z.object({ contact: z.boolean(), quote: z.literal(false), purchase: z.literal(false) }).strict(),
}).strict()
export const catalogPageSchema: z.ZodType<CatalogPage> = z.object({ page: z.array(catalogOfferSchema).max(CATALOG_PAGE_SIZE), continueCursor: z.string().max(8192), isDone: z.boolean(), collections: z.array(collection).max(L.shopCollectionsMax), filteredWindow: z.boolean() }).strict()

/** Les métadonnées et le rendu partagent une lecture même si leurs objets de filtres diffèrent. */
const loadRequestCatalog = cache((handle: string, kind: CatalogFilters["kind"], collectionRef: CatalogFilters["collectionRef"], query: CatalogFilters["query"], cursor: string | null, handoff: boolean) =>
  projected(api.modules.public.catalog.list, { handle, ...(kind !== undefined ? { kind } : {}), ...(collectionRef !== undefined ? { collectionRef } : {}), ...(query !== undefined ? { query } : {}), paginationOpts: { cursor, numItems: CATALOG_PAGE_SIZE } }, catalogPageSchema, handoff),
)

/** Porte SSR commune : aucun repli anonyme d'une session refusée ou d'un OTT. */
export function loadPublicCatalog(handle: string, filters: CatalogFilters = {}, cursor: string | null = null, handoff = false) {
  return loadRequestCatalog(handle, filters.kind, filters.collectionRef, filters.query, cursor, handoff)
}

export const loadPublicOffer = cache((handle: string, offerRef: string, handoff = false) =>
  projected(api.modules.public.catalog.offer, { handle, offerRef }, catalogOfferSchema.nullable(), handoff),
)
export const loadPublicPostOffer = cache((postId: string, handoff = false) =>
  projected(api.modules.public.catalog.postOffer, { postId }, catalogOfferSchema.nullable(), handoff),
)
