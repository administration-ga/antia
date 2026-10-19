/**
 * P14 : règles d'écran des services, hors de tout composant (testées en `node`). Les instants
 * restent des millisecondes UTC ; un fuseau IANA est toujours nommé à l'affichage. Les noms
 * de personne passent par le normaliseur partagé (Prénom, NOM). Aucun succès n'est déduit.
 */
import { normalizeFamilyName, normalizeGivenNames } from "@antsia/social-domain/civilName"
import { COMMERCE_SERVICE_LIMITS, COMMERCE_SERVICE_TIME_ZONE } from "@antsia/social-domain/commerce-services"
import { isValidTimeZone, sameWallClock } from "@antsia/social-domain/serviceTime"
import type { ServiceBookingSnapshot, ServiceRequestDto } from "@convex/modules/shops/serviceRules"
import type { TFunction } from "i18next"
import { z } from "zod"

export const SERVICE_AGENDA_TIME_ZONE = COMMERCE_SERVICE_TIME_ZONE
export const SERVICE_REQUESTS_PAGE_SIZE = 10
export const SERVICE_SLOT_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60_000

/** Une clé d'intention par geste : même clé + même intention = même demande, jamais un doublon. */
export function newClientRequestId(): string {
  return crypto.randomUUID()
}

/** Le fuseau de l'appareil, s'il est un identifiant IANA reconnu ; sinon celui de l'agenda. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isValidTimeZone(zone) ? zone : SERVICE_AGENDA_TIME_ZONE
  } catch {
    return SERVICE_AGENDA_TIME_ZONE
  }
}

/** Les fuseaux proposés à l'affichage : celui de l'agenda, puis celui de l'appareil s'il diffère. */
export function displayTimeZones(device: string, at: number): string[] {
  return device === SERVICE_AGENDA_TIME_ZONE || sameWallClock(at, device, SERVICE_AGENDA_TIME_ZONE) ? [SERVICE_AGENDA_TIME_ZONE] : [SERVICE_AGENDA_TIME_ZONE, device]
}

export function serviceDateTime(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone }).format(ms)
}
export function serviceDay(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone }).format(ms)
}
export function serviceTime(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(ms)
}
/** Le nom long du fuseau à cet instant (« heure normale d’Afrique de l’Ouest »), jamais une abréviation seule. */
export function serviceZoneName(ms: number, timeZone: string, locale: string): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" }).formatToParts(ms).find((item) => item.type === "timeZoneName")
  return part ? `${part.value} (${timeZone})` : timeZone
}
export function serviceAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "XAF", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}
export function serviceDurationMinutes(minutes: number, t: TFunction): string {
  return minutes % 60 === 0 && minutes >= 60 ? t("duration.hours", { count: minutes / 60 }) : t("duration.minutes", { count: minutes })
}

/** Les créneaux d'une fenêtre, groupés par jour MURAL du fuseau d'affichage. */
export function slotsByDay<T extends { startAt: number }>(slots: readonly T[], timeZone: string, locale: string): Array<{ day: string; slots: T[] }> {
  const groups: Array<{ day: string; slots: T[] }> = []
  for (const slot of slots) {
    const day = serviceDay(slot.startAt, timeZone, locale)
    const last = groups.at(-1)
    if (last && last.day === day) last.slots.push(slot)
    else groups.push({ day, slots: [slot] })
  }
  return groups
}
export function slotWindow(fromAt: number): { fromAt: number; toAt: number } {
  return { fromAt, toAt: fromAt + SERVICE_SLOT_WINDOW_DAYS * DAY_MS }
}

const KNOWN_REASONS = new Set([
  "access_denied", "capability_disabled", "change_pending", "consent_invalid", "not_cancellable", "not_changeable", "not_orderable", "offer_unavailable",
  "quota_exceeded", "quote_not_acceptable", "request_expired", "slot_unavailable", "stale_revision", "too_late", "rate_limited", "temporarily_unavailable",
  "provider_unavailable", "in_progress", "change_expired", "change_declined", "abandoned", "inactive", "erasure_requested",
])
/** Motif servi → clé de traduction ; un motif inconnu reste générique (jamais affiché brut). */
export function serviceReasonKey(reason: string | null): string {
  return reason !== null && KNOWN_REASONS.has(reason) ? `reasons.${reason}` : "reasons.other"
}

/** Ce que la personne voit d'abord : l'état de la demande, puis celui de la dernière commande. */
export function serviceRequestStatus(request: Pick<ServiceRequestDto, "state" | "lastCommand">): "unknown" | "reconfirm" | "rejected" | "pending" | "active" | "closed" | "failed" {
  const last = request.lastCommand
  if (last?.state === "unknown") return "unknown"
  if (last?.state === "reconfirm") return "reconfirm"
  if (last?.state === "rejected" && request.state === "active") return "rejected"
  return request.state
}

/** Conséquences d'un geste sur un rendez-vous, telles que PRO.GA les a servies (jamais calculées ici). */
export function bookingConsequences(booking: ServiceBookingSnapshot): { changeUntil: number | null; cancelUntil: number | null; changeRequiresConfirmation: boolean | null; observed: boolean } {
  return booking.policy
    ? { changeUntil: booking.policy.changeUntil, cancelUntil: booking.policy.cancelUntil, changeRequiresConfirmation: booking.policy.changeRequiresConfirmation, observed: true }
    : { changeUntil: null, cancelUntil: null, changeRequiresConfirmation: null, observed: false }
}

// ─── Formulaires (React Hook Form + Zod) ─────────────────────────────────────

const noControl = (value: string, multiline: boolean) => !Array.from(value).some((character) => {
  const code = character.charCodeAt(0)
  return code === 127 || (code < 32 && !(multiline && (code === 10 || code === 13)))
})
const text = (max: number, t: TFunction, multiline = false) => z.string()
  .refine((value) => noControl(value, multiline), t("validation.text"))
  .transform((value) => value.normalize("NFC").replace(/\r\n?/gu, "\n").trim())
  .refine((value) => value.length <= max, t("validation.max", { max }))
const consent = (t: TFunction) => z.boolean().refine((value) => value, t("validation.consent"))

/** Date civile du jour ou à venir, jugée dans le fuseau de l'agenda ; vide = aucune. */
export function serviceToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SERVICE_AGENDA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}
const desiredDate = (t: TFunction) => z.string().refine((value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/u.test(value) && value >= serviceToday()), t("validation.date"))

/** Prénom(s) et NOM facultatifs, ensemble ou pas du tout ; mis en forme par le normaliseur partagé. */
export function contactNameFields(t: TFunction) {
  return { firstName: text(80, t), lastName: text(80, t) }
}
export function contactNameOf(values: { firstName: string; lastName: string }): { firstName: string; lastName: string } | undefined {
  const firstName = normalizeGivenNames(values.firstName), lastName = normalizeFamilyName(values.lastName)
  return firstName && lastName ? { firstName, lastName } : undefined
}
function contactNameComplete(value: { firstName: string; lastName: string }, context: z.RefinementCtx, t: TFunction) {
  if ((value.firstName === "") !== (value.lastName === "")) context.addIssue({ code: "custom", path: [value.firstName === "" ? "firstName" : "lastName"], message: t("validation.contactName") })
  if (value.firstName.length + value.lastName.length + 1 > COMMERCE_SERVICE_LIMITS.displayNameMax) context.addIssue({ code: "custom", path: ["lastName"], message: t("validation.max", { max: COMMERCE_SERVICE_LIMITS.displayNameMax }) })
}

export function quoteRequestSchema(t: TFunction) {
  return z.object({
    need: text(COMMERCE_SERVICE_LIMITS.quoteNeedMax, t, true).refine((value) => value.length > 0, t("validation.required")),
    constraints: text(COMMERCE_SERVICE_LIMITS.quoteConstraintsMax, t, true),
    desiredDate: desiredDate(t),
    quantity: z.string().regex(/^(?:|[1-9]\d{0,2})$/u, t("validation.quantity")),
    attachmentMessageIds: z.array(z.string()).max(COMMERCE_SERVICE_LIMITS.quoteAttachmentsMax, t("validation.attachments")),
    consent: consent(t),
  })
}
export type QuoteRequestValues = z.input<ReturnType<typeof quoteRequestSchema>>
export const EMPTY_QUOTE_REQUEST: QuoteRequestValues = { need: "", constraints: "", desiredDate: "", quantity: "", attachmentMessageIds: [], consent: false }

export function bookingSchema(t: TFunction) {
  return z.object({ note: text(COMMERCE_SERVICE_LIMITS.noteMax, t, true), ...contactNameFields(t), consent: consent(t) }).superRefine((value, context) => contactNameComplete(value, context, t))
}
export type BookingValues = z.input<ReturnType<typeof bookingSchema>>
export const EMPTY_BOOKING: BookingValues = { note: "", firstName: "", lastName: "", consent: false }

export function orderSchema(t: TFunction, quantityMax: number) {
  return z.object({
    quantity: z.string().regex(/^[1-9]\d{0,1}$/u, t("validation.quantity")).refine((value) => Number(value) <= quantityMax, t("validation.quantity")),
    desiredDate: desiredDate(t), note: text(COMMERCE_SERVICE_LIMITS.noteMax, t, true), ...contactNameFields(t), consent: consent(t),
  }).superRefine((value, context) => contactNameComplete(value, context, t))
}
export type OrderValues = z.input<ReturnType<typeof orderSchema>>
export const EMPTY_ORDER: OrderValues = { quantity: "1", desiredDate: "", note: "", firstName: "", lastName: "", consent: false }

/** Un accord explicite (acceptation, changement, annulation, nouveau tarif). */
export function decisionSchema(t: TFunction) {
  return z.object({ consent: consent(t) })
}
export type DecisionValues = z.input<ReturnType<typeof decisionSchema>>

/** Une heure murale saisie dans un fuseau d'affichage, pour aller à une date précise. */
export function jumpSchema(t: TFunction) {
  return z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, t("validation.date")), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, t("validation.time")) })
}
export type JumpValues = z.input<ReturnType<typeof jumpSchema>>
