import { COMMERCE_COMMAND_LIMITS, type CommerceCheckoutLineInput, type CommerceCheckoutResult } from "@antsia/social-domain/commerce/command"
import type { CatalogOffer } from "@convex/modules/shops/catalogValidators"
import type { TFunction } from "i18next"
import { z } from "zod"

export const CHECKOUT_PAGE_SIZE = 10
export const CHECKOUT_QUANTITY_MAX = COMMERCE_COMMAND_LIMITS.quantityMax

/** Prix et quantités attendus ne deviennent jamais l'autorité commerciale. */
export function checkoutAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "XAF", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

/**
 * Le prix unitaire EXACT d'une ligne, ou `undefined` : celui de la variante
 * désignée ; sans variante, le prix fixe ou unitaire d'une offre qui n'en
 * propose aucune. Un devis, une variante retirée ou une variante à choisir
 * n'ont pas de prix à préparer : aucun montant n'est choisi à la place de la
 * personne (mêmes règles que la garde d'envoi du formulaire).
 */
export function checkoutUnitAmount(offer: Pick<CatalogOffer, "price" | "variants">, variantRef?: string): number | undefined {
  if (variantRef) return offer.variants.find((variant) => variant.variantRef === variantRef)?.amount
  if (offer.variants.length) return undefined
  return offer.price.mode === "fixed" || offer.price.mode === "unit" ? offer.price.amount : undefined
}

/** Les lignes d'un panier à leur prix exact, variante comprise ; `null` dès qu'une ligne n'en a pas. */
export function checkoutCartLines(lines: readonly { offer: CatalogOffer; variantRef?: string; quantity: number }[]): CommerceCheckoutLineInput[] | null {
  const prepared: CommerceCheckoutLineInput[] = []
  for (const line of lines) {
    const amount = checkoutUnitAmount(line.offer, line.variantRef)
    if (amount === undefined) return null
    prepared.push({ offerRef: line.offer.offerRef, ...(line.variantRef ? { variantRef: line.variantRef } : {}), quantity: line.quantity, expectedCatalogRevision: line.offer.revision, expectedUnitAmount: { amount, currency: "XAF" } })
  }
  return prepared
}

export function checkoutDate(value: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Libreville" }).format(value)
}

export function checkoutExpired(expiresAt: number | null | undefined, nowMs = Date.now()): boolean {
  return expiresAt !== null && expiresAt !== undefined && expiresAt <= nowMs
}

/**
 * P18b (A17, WCAG 2.2.1) : une réserve ou une autorisation de paiement
 * s'annonce AVANT son échéance — deux minutes, quand le critère demande au
 * moins vingt secondes pour réagir. Aucune prolongation n'est simulée : le
 * moteur n'en offre pas pour la réserve.
 */
export const CHECKOUT_EXPIRY_WARNING_MS = 120_000

/** L'échéance approche-t-elle (encore future, à moins de `windowMs`) ? */
export function checkoutExpiringSoon(expiresAt: number | null | undefined, nowMs = Date.now(), windowMs = CHECKOUT_EXPIRY_WARNING_MS): boolean {
  if (expiresAt === null || expiresAt === undefined || !Number.isFinite(expiresAt)) return false
  const remaining = expiresAt - nowMs
  return remaining > 0 && remaining <= windowMs
}

const line = (max: number, t: TFunction) => z.string().max(max, t("validation.max", { max })).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), t("validation.text")).transform((value) => value.normalize("NFC").trim())
export function checkoutFormSchema(t: TFunction) {
  return z.object({
    variantRef: z.string(),
    quantity: z.string().regex(/^[1-9]\d{0,2}$/, t("validation.quantity")).refine((value) => Number(value) <= CHECKOUT_QUANTITY_MAX, t("validation.quantity")),
    fulfillmentMode: z.enum(["", "pickup", "seller_delivery"]),
    establishmentRef: z.string(),
    country: line(2, t), locality: line(COMMERCE_COMMAND_LIMITS.localityMax, t), line1: line(COMMERCE_COMMAND_LIMITS.addressLineMax, t), line2: line(COMMERCE_COMMAND_LIMITS.addressLineMax, t),
    instructions: line(COMMERCE_COMMAND_LIMITS.instructionsMax, t),
    consent: z.boolean().refine((value) => value, t("validation.consent")),
  }).superRefine((value, context) => {
    const required = (path: string) => context.addIssue({ code: "custom", path: [path], message: t("validation.required") })
    if (!value.fulfillmentMode) required("fulfillmentMode")
    if (value.fulfillmentMode === "pickup" && !value.establishmentRef) required("establishmentRef")
    if (value.fulfillmentMode === "seller_delivery") {
      if (value.country !== "GA") context.addIssue({ code: "custom", path: ["country"], message: t("validation.country") })
      if (!value.locality) required("locality")
      if (!value.line1) required("line1")
    }
  })
}
export type CheckoutFormValues = z.input<ReturnType<typeof checkoutFormSchema>>
export const EMPTY_CHECKOUT_FORM: CheckoutFormValues = { variantRef: "", quantity: "1", fulfillmentMode: "", establishmentRef: "", country: "", locality: "", line1: "", line2: "", instructions: "", consent: false }
export function checkoutConsentSchema(t: TFunction) { return z.object({ accepted: z.boolean().refine((value) => value, t("validation.consent")) }) }

export function checkoutComparison(expected: readonly CommerceCheckoutLineInput[], current: CommerceCheckoutResult["lines"]) {
  return current.map((after) => {
    const before = expected.find((candidate) => candidate.offerRef === after.offerRef && candidate.variantRef === after.variantRef)
    return { before, after, changed: !before || before.expectedCatalogRevision !== after.catalogRevision || before.expectedUnitAmount.amount !== after.unitAmount.amount || before.quantity !== after.quantity }
  })
}
