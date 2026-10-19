import type { CatalogOffer, CatalogPage } from "../catalog-model"

export const CATALOG_NOW = 1_792_281_600_000
export const OFFER_REF = "pro.ga:offer:01JA00000000000000000000F1"
export const COLLECTION_REF = "pro.ga:offer_collection:01JA00000000000000000000C1"
export const VARIANT_REF = "pro.ga:offer_variant:01JA00000000000000000000V1"

type CatalogVariant = CatalogOffer["variants"][number]

/** La variante par défaut de l'offre de test, typée entière (pas d'accès indexé `variants[0]`). */
export function catalogVariantFixture(changes: Partial<CatalogVariant> = {}): CatalogVariant {
  return { variantRef: VARIANT_REF, label: "Rouge", options: ["Rouge"], amount: 17500, unit: null, availability: "in_stock", ...changes }
}
export function catalogOfferFixture(changes: Partial<CatalogOffer> = {}): CatalogOffer {
  return {
    offerRef: OFFER_REF, shopHandle: "atelier", kind: "product", title: "Sac artisanal", description: "Un sac confectionné à Libreville.\nDescription complète de l’offre.",
    price: { mode: "fixed", currency: "XAF", amount: 15000 }, revision: 3, changedAt: CATALOG_NOW,
    collections: [{ collectionRef: COLLECTION_REF, label: "Créations locales" }], tags: ["artisanat"], variantAxes: ["Couleur"],
    variants: [catalogVariantFixture()],
    media: [{ url: null, withheld: "fileScanPending", altText: "Sac rouge", width: 800, height: 800 }],
    availability: { state: "in_stock", indicative: true, updatedAt: CATALOG_NOW, stale: false },
    leadTimeDays: 3, zone: "Libreville", actions: { contact: false, quote: false, purchase: false }, ...changes,
  }
}
export function catalogPageFixture(changes: Partial<CatalogPage> = {}): CatalogPage {
  return { page: [catalogOfferFixture()], continueCursor: "", isDone: true, collections: [{ collectionRef: COLLECTION_REF, label: "Créations locales" }], filteredWindow: false, ...changes }
}
