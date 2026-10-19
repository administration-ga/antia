import { COMMERCE_COMMAND_LIMITS, COMMERCE_TIME_ZONES } from "@antsia/social-domain/commerce/command"
import { COMMERCE_CHECKOUT_STATES, COMMERCE_ORDER_STATES, COMMERCE_PAYMENT_STATES, type CommerceRefundState } from "@antsia/social-domain/commerce/lifecycle"
import { COMMERCE_MAX_AMOUNT_XAF } from "@antsia/social-domain/commerce/primitives"
import type { TFunction } from "i18next"
import { z } from "zod"

/** États techniques de la tentative privée P12, distincts des quatre domaines ci-dessous. */
export const PAYMENT_ATTEMPT_STATES = ["prepared", "submitting", "pending", "requires_action", "processing", "succeeded", "failed", "cancelled", "unavailable", "unknown", "refused"] as const
export type PaymentAttemptState = typeof PAYMENT_ATTEMPT_STATES[number]
export const PAYMENT_PAYMENT_STATES = COMMERCE_PAYMENT_STATES
export const PAYMENT_ORDER_STATES = COMMERCE_ORDER_STATES
export const PAYMENT_STOCK_STATES = COMMERCE_CHECKOUT_STATES
/** Le DTO privé expose `confirmed`, tandis que la machine P06 appelle son terminal `succeeded`.
 * Aucun état n'est converti ici : le serveur reste seul auteur de la confirmation. */
export const PAYMENT_REFUND_STATES = ["none", "requested", "processing", "confirmed", "failed", "rejected"] as const satisfies readonly (Exclude<CommerceRefundState, "succeeded"> | "none" | "confirmed")[]
export const PAYMENT_REFUND_REASONS = ["changed_mind", "duplicate_payment", "late_payment", "other"] as const
export type PaymentState = typeof PAYMENT_PAYMENT_STATES[number]
export type PaymentOrderState = typeof PAYMENT_ORDER_STATES[number]
export type PaymentStockState = typeof PAYMENT_STOCK_STATES[number]
export type PaymentRefundState = typeof PAYMENT_REFUND_STATES[number]
export type PaymentRefundReason = typeof PAYMENT_REFUND_REASONS[number]
export const PAYMENT_CONSENT_DEFAULTS = { accepted: false }

/** Un montant absent/invalide n'est jamais arrondi ni remplacé par zéro. */
export function paymentAmount(amount: number, locale: string): string | null {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > COMMERCE_MAX_AMOUNT_XAF) return null
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "XAF", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount === 0 ? 0 : amount)
  } catch { return null }
}

/** Aucun instant inventé pour `observedAt: null`, aucun appel à l'horloge locale. */
export function paymentDate(value: number | null, locale: string): string | null {
  if (value === null || !Number.isSafeInteger(value) || value <= 0 || value > 8_640_000_000_000_000) return null
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: COMMERCE_TIME_ZONES[0] }).format(value)
  } catch { return null }
}

const PROVIDER_REDIRECT = /^https:\/\/[A-Za-z0-9.-]{1,253}(?::[0-9]{1,5})?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/
/** Garde syntaxique P06 uniquement, sur `action.url` du DTO serveur autorisé.
 * Ne jamais lui donner searchParams/location/un champ libre : l'origine PSP doit déjà
 * avoir été admise par le backend. Cette fonction ne prouve ni confiance ni règlement.
 * Les octets autorisés sont conservés, y compris la requête signée du prestataire. */
export function safeProviderRedirect(value: unknown): string | null {
  if (typeof value !== "string" || value.length > COMMERCE_COMMAND_LIMITS.redirectUrlMax || /[\u0000-\u0020\u007f\\]/u.test(value) || !PROVIDER_REDIRECT.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash || value.includes("#")) return null
    if (url.hostname.split(".").some((label) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return null
    return value
  } catch { return null }
}

export function paymentConsentSchema(t: TFunction) {
  return z.object({ accepted: z.boolean().refine((value) => value, t("validationConsent")) }).strict()
}
export function paymentRefundSchema(t: TFunction) {
  return z.object({
    accepted: z.boolean().refine((value) => value, t("validationConsent")),
    reason: z.enum(PAYMENT_REFUND_REASONS, { errorMap: () => ({ message: t("validationRefundReason") }) }),
  }).strict()
}
export type PaymentConsentValues = z.input<ReturnType<typeof paymentConsentSchema>>
export type PaymentRefundValues = z.input<ReturnType<typeof paymentRefundSchema>>
