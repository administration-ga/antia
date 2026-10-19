/**
 * Validateurs des BOUTIQUES (P07). Module sans fonction Convex enregistrée.
 * Littéraux DÉRIVÉS des listes pures (`./rules`, une seule source) ; DTO
 * allowlistés : aucun identifiant de stockage (images par la garde des
 * fichiers), aucun signataire, aucun contact.
 */
import { type Infer, v } from "convex/values"

import { badgeValidator, contentVisibilityValidator, literals, membershipStatusValidator } from "../../lib/validators"
import { withheldCodeValidator } from "../files/storageGuard"
import {
  PUBLICATION_OUTCOMES,
  SHOP_BLOCK_STATES,
  SHOP_BLOCKS,
  SHOP_CHECKOUT_MISSING,
  SHOP_MODELS,
  SHOP_PRESENTATION_GAPS,
  STOREFRONT_POLICIES,
  STOREFRONT_STATES,
} from "./rules"

export const shopModelValidator = literals(SHOP_MODELS)
export const storefrontStateValidator = literals(STOREFRONT_STATES)
export const storefrontPolicyValidator = literals(STOREFRONT_POLICIES)
export const shopBlockValidator = literals(SHOP_BLOCKS)
export const shopBlockStateValidator = literals(SHOP_BLOCK_STATES)
export const publicationOutcomeValidator = literals(PUBLICATION_OUTCOMES)
export const presentationGapValidator = literals(SHOP_PRESENTATION_GAPS)
export const checkoutMissingValidator = literals(SHOP_CHECKOUT_MISSING)

/** À quel titre je gère : préparateur d'un brouillon sans page, ou administrateur VIVANT de sa page. */
export const shopManagerRoleValidator = v.union(v.literal("owner"), v.literal("page_admin"))

/** Décision de l'équipe de la plateforme sur une demande en file. */
export const storefrontDecisionValidator = v.union(v.literal("admit"), v.literal("reject"))

/**
 * Capacités INDICATIVES (P06, `deriveCommerceCapabilities`) : l'écran s'en sert
 * pour expliquer, jamais pour autoriser — chaque geste est rejugé au serveur.
 */
export const shopCapabilitiesValidator = v.object({
  draft: v.boolean(),
  storefront: v.boolean(),
  contact: v.boolean(),
  catalog: v.boolean(),
  quote: v.boolean(),
  booking: v.boolean(),
  jobs: v.boolean(),
  purchase: v.boolean(),
})

/** Une ligne de « Ma boutique » : les boutiques que je gère dans ce réseau. */
export const shopSummaryValidator = v.object({
  shopId: v.id("shops"),
  name: v.union(v.string(), v.null()),
  model: shopModelValidator,
  storefront: storefrontStateValidator,
  pageHandle: v.union(v.string(), v.null()),
  logoUrl: v.union(v.string(), v.null()),
  updatedAt: v.number(),
})
export type ShopSummary = Infer<typeof shopSummaryValidator>

/** Une fenêtre de gestion ne prétend pas être complète quand sa lecture a été bornée. */
export const myShopsValidator = v.object({ items: v.array(shopSummaryValidator), truncated: v.boolean() })
export type MyShops = Infer<typeof myShopsValidator>

/** Une page que j'administre et qui peut porter une boutique (ni institution, ni « Officiel », ni reflet fédéré). */
export const eligibleShopPageValidator = v.object({
  pageId: v.id("pages"),
  handle: v.string(),
  name: v.string(),
  badge: badgeValidator,
})
export const eligibleShopPagesValidator = v.object({ items: v.array(eligibleShopPageValidator), truncated: v.boolean() })
export type EligibleShopPages = Infer<typeof eligibleShopPagesValidator>

/** L'ÉDITEUR d'une boutique, pour ses gérants seulement. */
export const shopEditorValidator = v.object({
  shopId: v.id("shops"),
  role: shopManagerRoleValidator,
  model: shopModelValidator,
  name: v.union(v.string(), v.null()),
  description: v.union(v.string(), v.null()),
  specialty: v.union(v.string(), v.null()),
  serviceArea: v.union(v.string(), v.null()),
  hours: v.union(v.string(), v.null()),
  logo: v.object({ present: v.boolean(), url: v.union(v.string(), v.null()), withheld: v.union(withheldCodeValidator, v.null()) }),
  page: v.union(v.null(), v.object({ handle: v.string(), badge: badgeValidator })),
  storefront: v.object({
    state: storefrontStateValidator,
    decisionReason: v.union(v.string(), v.null()),
    requestedAt: v.union(v.number(), v.null()),
    publishedAt: v.union(v.number(), v.null()),
  }),
  policy: storefrontPolicyValidator,
  publication: v.object({ outcome: publicationOutcomeValidator, gaps: v.array(presentationGapValidator), requestable: v.boolean() }),
  audience: v.object({
    visibility: contentVisibilityValidator,
    rootNetwork: v.boolean(),
    publicListing: v.boolean(),
    consentedAt: v.union(v.number(), v.null()),
    consentTextVersion: v.union(v.string(), v.null()),
    currentTextVersion: v.string(),
    publicNow: v.boolean(),
  }),
  blocks: v.array(v.object({ id: shopBlockValidator, state: shopBlockStateValidator })),
  capabilities: shopCapabilitiesValidator,
  checkout: v.object({ available: v.literal(false), missing: v.array(checkoutMissingValidator) }),
  updatedAt: v.number(),
})
export type ShopEditor = Infer<typeof shopEditorValidator>

/** La VITRINE vue par un membre du réseau : identité de la page, présentation commerciale, blocs non vides. */
export const storefrontValidator = v.object({
  pageId: v.id("pages"),
  handle: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  logoUrl: v.union(v.string(), v.null()),
  bannerUrl: v.union(v.string(), v.null()),
  model: shopModelValidator,
  specialty: v.union(v.string(), v.null()),
  serviceArea: v.union(v.string(), v.null()),
  hours: v.union(v.string(), v.null()),
  badge: badgeValidator,
  blocks: v.array(shopBlockValidator),
  publishedAt: v.number(),
  publicListing: v.boolean(),
  viewer: v.object({ following: v.boolean(), manages: v.boolean() }),
})
export type Storefront = Infer<typeof storefrontValidator>

/** Une carte de l'annuaire des boutiques du réseau. */
export const storefrontCardValidator = v.object({
  handle: v.string(),
  name: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  model: shopModelValidator,
  specialty: v.union(v.string(), v.null()),
  serviceArea: v.union(v.string(), v.null()),
  badge: badgeValidator,
  publishedAt: v.number(),
})
export type StorefrontCard = Infer<typeof storefrontCardValidator>

/**
 * La vitrine PUBLIQUE (lecture sans compte) : DTO fermé, sans identifiant
 * interne, signataire, contact ni état du lecteur. Les publications de la page
 * n'y figurent pas : la lecture anonyme d'une page reste réservée aux pages
 * officielles (`modules/public/access.ts`, inchangé).
 */
export const publicStorefrontValidator = v.object({
  handle: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  logoUrl: v.union(v.string(), v.null()),
  bannerUrl: v.union(v.string(), v.null()),
  model: shopModelValidator,
  specialty: v.union(v.string(), v.null()),
  serviceArea: v.union(v.string(), v.null()),
  hours: v.union(v.string(), v.null()),
  badge: badgeValidator,
  blocks: v.array(shopBlockValidator),
  publishedAt: v.number(),
  origin: v.object({ slug: v.string(), name: v.string() }),
})
export type PublicStorefront = Infer<typeof publicStorefrontValidator>

/** Une demande en FILE D'ADMISSION, pour l'équipe de la plateforme : la présentation à relire et son préparateur. */
export const storefrontReviewItemValidator = v.object({
  shopId: v.id("shops"),
  networkId: v.id("networks"),
  networkSlug: v.string(),
  storefront: storefrontStateValidator,
  model: shopModelValidator,
  name: v.union(v.string(), v.null()),
  description: v.union(v.string(), v.null()),
  specialty: v.union(v.string(), v.null()),
  serviceArea: v.union(v.string(), v.null()),
  hours: v.union(v.string(), v.null()),
  logoUrl: v.union(v.string(), v.null()),
  pageHandle: v.union(v.string(), v.null()),
  requestedAt: v.union(v.number(), v.null()),
  preparer: v.union(
    v.null(),
    v.object({ displayName: v.union(v.string(), v.null()), handle: v.union(v.string(), v.null()), membership: v.union(membershipStatusValidator, v.null()) }),
  ),
})
export type StorefrontReviewItem = Infer<typeof storefrontReviewItemValidator>
