/**
 * Catalogue FICTIF des seules boutiques de démonstration, sans fédération ni mandat PRO.GA.
 * Les illustrations sont des assets générés du build ; aucun dépôt client ni stockage n'est
 * exposé ici. Toute lecture rejuge l'environnement, l'identité et la vitrine consentie.
 */
import type { PaginationOptions } from "convex/server"
import { effectiveActivityConfiguration } from "@antsia/social-domain/activityConfiguration"

import { components } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { fail } from "../../lib/errors"
import { demoContentAllowed } from "../../seeds/demoContentConfig"
import { canReadModeratedContent, contentState } from "../moderation/policy"
import { findPageByHandle, liveSignatoryRole } from "../pages/access"
import { publicStorefrontPage, shopOfPage } from "./access"
import { readableCatalogMapping } from "./catalogAccess"
import type { CatalogList, CatalogOffer } from "./catalogValidators"

type ReadCtx = Pick<QueryCtx, "db"> & Partial<Pick<QueryCtx, "runQuery">>
export type DemoCatalogContext = { root: Doc<"networks">; readerPersonId?: Id<"persons">; network?: Doc<"networks"> }
type DemoOffer = { slug: string; title: string; description: string; image: string; amount: number | null; tags: string[] }
type DemoShop = { handle: string; model: Doc<"shops">["model"]; ownerHandle: string; ownerEmail: string; collection: string; offers: DemoOffer[] }

const DEMO_SHOPS: readonly DemoShop[] = [
  {
    handle: "epicerie-moussavou-demo", model: "products", ownerHandle: "commercant.demo", ownerEmail: "commercant@demo.antsia.test", collection: "Produits de démonstration",
    offers: [
      { slug: "epicerie-produits", title: "Panier du marché — Démo", description: "Assortiment fictif de produits du quotidien pour découvrir le catalogue. Aucune vente réelle.", image: "epicerie-produits", amount: 1500, tags: ["démo", "épicerie", "marché"] },
      { slug: "panier-raphia", title: "Panier en raphia — Démo", description: "Panier artisanal fictif présenté pour la démonstration. Aucune commande réelle.", image: "panier-raphia", amount: 8500, tags: ["démo", "artisanat", "raphia"] },
      { slug: "savon-artisanal", title: "Savon artisanal — Démo", description: "Produit fictif illustrant une fiche de catalogue. Cette présentation ne propose aucune vente réelle.", image: "savon-artisanal", amount: 2500, tags: ["démo", "artisanat", "savon"] },
      { slug: "sac-wax", title: "Sac en wax — Démo", description: "Accessoire fictif en tissu wax pour explorer les produits. Aucune transaction réelle.", image: "sac-wax", amount: 12000, tags: ["démo", "mode", "wax"] },
    ],
  },
  {
    handle: "studio-objectif-demo", model: "quote_services", ownerHandle: "verifie.demo", ownerEmail: "verifie@demo.antsia.test", collection: "Photographie de démonstration",
    offers: [
      { slug: "photo-portrait", title: "Portrait photo — Démo", description: "Séance photo fictive pour découvrir une prestation à tarif fixe. Aucune réservation réelle.", image: "service-photo", amount: 15000, tags: ["démo", "photo", "portrait"] },
      { slug: "reportage-photo", title: "Reportage photo — Démo", description: "Prestation fictive de reportage présentée sur devis pour la démonstration. Aucun devis ne sera envoyé.", image: "service-photo", amount: null, tags: ["démo", "photo", "reportage"] },
    ],
  },
  {
    handle: "atelier-tech-demo", model: "quote_services", ownerHandle: "membre.demo", ownerEmail: "membre@demo.antsia.test", collection: "Informatique de démonstration",
    offers: [
      { slug: "diagnostic-informatique", title: "Diagnostic informatique — Démo", description: "Diagnostic fictif pour explorer une offre de service. Aucune intervention réelle.", image: "service-informatique", amount: 5000, tags: ["démo", "informatique", "diagnostic"] },
      { slug: "maintenance-informatique", title: "Maintenance informatique — Démo", description: "Prestation fictive de maintenance destinée à la démonstration. Aucun rendez-vous ni paiement réel.", image: "service-informatique", amount: 10000, tags: ["démo", "informatique", "maintenance"] },
    ],
  },
]

const normalized = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
export const isDemoOfferRef = (value: string): boolean => value.startsWith("demo:offer:")
export const isDemoCollectionRef = (value: string): boolean => value.startsWith("demo:collection:")

/** Une vraie projection commerciale gagne toujours sur les illustrations de démonstration. */
export async function demoCatalogForShop(ctx: ReadCtx, context: DemoCatalogContext, shopId: Id<"shops">): Promise<{ offers: CatalogOffer[]; collections: CatalogList["collections"] } | null> {
  if (!demoContentAllowed() || !ctx.runQuery) return null
  const root = await ctx.db.get(context.root._id)
  if (!root || root.kind !== "root" || root.slug !== "antsia" || root.status !== "active") return null
  if (context.network && (context.network._id !== root._id || context.network.kind !== "root")) return null
  const shop = await ctx.db.get(shopId)
  if (!shop || shop.networkId !== root._id || !shop.pageId || !shop.preparedByPersonId) return null
  const page = await ctx.db.get(shop.pageId)
  const spec = page ? DEMO_SHOPS.find((candidate) => candidate.handle === page.handle && candidate.model === shop.model) : undefined
  if (!page || !spec || page.createdByPersonId !== shop.preparedByPersonId || shop.publicConsentByPersonId !== shop.preparedByPersonId) return null
  if (spec.model === "quote_services" && !effectiveActivityConfiguration(shop.activityConfiguration, shop.model).capabilities.includes("services")) return null
  const owner = await ctx.db.get(shop.preparedByPersonId)
  if (!owner || owner.handle !== spec.ownerHandle || owner.publishedAt === undefined || owner.withdrawnAt !== undefined || owner.erasedAt !== undefined || owner.deletionRequestedAt !== undefined) return null
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user", where: [{ field: "_id", value: owner.authUserId }], select: ["_id", "email", "emailVerified"],
  }) as { _id: string; email: string; emailVerified?: boolean } | null
  if (!user || user._id !== owner.authUserId || user.emailVerified !== true || user.email.trim().toLowerCase() !== spec.ownerEmail) return null
  if (await liveSignatoryRole(ctx, page, owner._id) !== "admin") return null
  if ((await contentState(ctx, "person", owner._id))?.status !== "published" || !await canReadModeratedContent(ctx, "person", owner._id, context.readerPersonId)) return null
  if ((await contentState(ctx, "page", page._id))?.status !== "published" || !await publicStorefrontPage(ctx, root, shop, context.readerPersonId)) return null
  if (await readableCatalogMapping(ctx, root, shop._id, context.readerPersonId)) return null
  const collectionRef = `demo:collection:${spec.handle}`
  const collections = [{ collectionRef, label: spec.collection }]
  const offers: CatalogOffer[] = spec.offers.map((offer): CatalogOffer => ({
    offerRef: `demo:offer:${offer.slug}`, shopHandle: spec.handle, kind: spec.model === "products" ? "product" : "service",
    title: offer.title, description: offer.description,
    price: offer.amount === null ? { mode: "quote", currency: "XAF" } : { mode: "fixed", currency: "XAF", amount: offer.amount },
    revision: 1, changedAt: shop.publishedAt ?? shop.createdAt, collections,
    tags: [...offer.tags], variantAxes: [], variants: [],
    media: [{ url: `/demo-media/animation-20261020/${offer.image}.png`, altText: `Illustration générée pour la démonstration : ${offer.title}`, width: null, height: null, withheld: null }],
    availability: { state: "unknown", indicative: true, updatedAt: null, stale: false },
    leadTimeDays: null, zone: shop.serviceArea ?? null, actions: { contact: false, quote: false, purchase: false },
  }))
  return { offers, collections }
}

export async function resolveDemoCatalogOffer(ctx: ReadCtx, context: DemoCatalogContext, shopId: Id<"shops">, offerRef: string): Promise<CatalogOffer | null> {
  if (!isDemoOfferRef(offerRef)) return null
  return (await demoCatalogForShop(ctx, context, shopId))?.offers.find((offer) => offer.offerRef === offerRef) ?? null
}

/** Sélection explicite des trois activités fictives déjà déclarées ; jamais un index global. */
export async function demoMarketplaceOffers(ctx: ReadCtx, context: DemoCatalogContext): Promise<CatalogOffer[]> {
  if (!demoContentAllowed() || !ctx.runQuery || context.network && context.network._id !== context.root._id) return []
  const offers: CatalogOffer[] = []
  // borné : trois handles fixes du registre démo, huit offres au total. Chaque activité rejuge toutes ses gardes.
  for (const spec of DEMO_SHOPS.slice(0, 3)) {
    const page = await findPageByHandle(ctx, spec.handle)
    const shop = page ? await shopOfPage(ctx, page._id) : null
    if (!shop) continue
    const catalog = await demoCatalogForShop(ctx, context, shop._id)
    for (const offer of catalog?.offers ?? []) if (offers.length < 8) offers.push(offer)
  }
  return offers
}

/** Curseur borné lié au filtre : il ne peut pas devenir un curseur Convex de production. */
export function paginateDemoCatalog(catalog: { offers: CatalogOffer[]; collections: CatalogList["collections"] }, args: { handle: string; kind?: "product" | "service"; collectionRef?: string; query?: string; paginationOpts: PaginationOptions }): CatalogList {
  const query = args.query?.normalize("NFC").trim() ?? ""
  if (query.length > 120) return fail("invalidArgument", { field: "query" })
  const filtered = catalog.offers.filter((offer) => (!args.kind || offer.kind === args.kind) && (!args.collectionRef || offer.collections.some((collection) => collection.collectionRef === args.collectionRef)) && (!query || normalized([offer.title, offer.description, ...offer.tags].join(" ")).includes(normalized(query))))
  const signature = JSON.stringify([args.handle, args.kind ?? null, args.collectionRef ?? null, query])
  let offset = 0
  if (args.paginationOpts.cursor) {
    if (args.paginationOpts.cursor.length > 2048) return fail("invalidArgument", { field: "cursor" })
    let cursor: unknown
    try { cursor = JSON.parse(args.paginationOpts.cursor) } catch { return fail("invalidArgument", { field: "cursor" }) }
    if (!Array.isArray(cursor) || cursor.length !== 3 || cursor[0] !== "demo-catalog-v1" || cursor[1] !== signature || !Number.isInteger(cursor[2]) || cursor[2] < 0 || cursor[2] > filtered.length) return fail("invalidArgument", { field: "cursor" })
    offset = cursor[2] as number
  }
  const requested = args.paginationOpts.numItems
  const size = Number.isFinite(requested) ? Math.min(8, Math.max(1, Math.trunc(requested))) : 8
  const page = filtered.slice(offset, offset + size), next = offset + page.length, isDone = next >= filtered.length
  return { page, isDone, continueCursor: isDone ? "" : JSON.stringify(["demo-catalog-v1", signature, next]), collections: catalog.collections, filteredWindow: false }
}
