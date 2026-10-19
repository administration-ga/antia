/** P09 : un DTO allowlist identique pour membre, SSR public et slot de publication. */
import { type Infer, v } from "convex/values"

import { withheldCodeValidator } from "../files/storageGuard"

export const catalogKindValidator = v.union(v.literal("product"), v.literal("service"))
export const catalogAvailabilityValidator = v.union(v.literal("in_stock"), v.literal("out_of_stock"), v.literal("unknown"))
export const catalogPriceValidator = v.union(
  v.object({ mode: v.literal("fixed"), currency: v.literal("XAF"), amount: v.number() }),
  v.object({ mode: v.literal("unit"), currency: v.literal("XAF"), amount: v.number(), unit: v.string() }),
  v.object({ mode: v.literal("range"), currency: v.literal("XAF"), minAmount: v.number(), maxAmount: v.number(), unit: v.optional(v.string()) }),
  v.object({ mode: v.literal("quote"), currency: v.literal("XAF") }),
)
export const catalogCollectionValidator = v.object({ collectionRef: v.string(), label: v.string() })
export const catalogOfferValidator = v.object({
  offerRef: v.string(), shopHandle: v.string(), kind: catalogKindValidator, title: v.string(), description: v.string(),
  price: catalogPriceValidator, revision: v.number(), changedAt: v.number(), collections: v.array(catalogCollectionValidator),
  tags: v.array(v.string()), variantAxes: v.array(v.string()),
  variants: v.array(v.object({ variantRef: v.string(), label: v.string(), options: v.array(v.string()), amount: v.number(), unit: v.union(v.string(), v.null()), availability: v.union(catalogAvailabilityValidator, v.null()) })),
  media: v.array(v.object({ url: v.union(v.string(), v.null()), altText: v.union(v.string(), v.null()), width: v.union(v.number(), v.null()), height: v.union(v.number(), v.null()), withheld: v.union(withheldCodeValidator, v.null()) })),
  availability: v.object({ state: v.union(catalogAvailabilityValidator, v.null()), indicative: v.literal(true), updatedAt: v.union(v.number(), v.null()), stale: v.boolean() }),
  leadTimeDays: v.union(v.number(), v.null()), zone: v.union(v.string(), v.null()),
  actions: v.object({ contact: v.boolean(), quote: v.literal(false), purchase: v.literal(false) }),
})
export type CatalogOffer = Infer<typeof catalogOfferValidator>
export const catalogListValidator = v.object({ page: v.array(catalogOfferValidator), isDone: v.boolean(), continueCursor: v.string(), collections: v.array(catalogCollectionValidator), filteredWindow: v.boolean() })
export type CatalogList = Infer<typeof catalogListValidator>

/** Référence durable, jamais un snapshot de prix ou une URL. */
export const catalogPostReferenceValidator = v.object({ shopId: v.id("shops"), offerRef: v.string() })
export type CatalogPostReference = Infer<typeof catalogPostReferenceValidator>
