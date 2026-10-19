/**
 * P15 : règles d'affichage et de saisie de l'EMPLOI, hors de tout composant
 * (testées en environnement `node`). Aucun frais, aucun panier, aucun
 * classement social : une offre se lit par son contenu publié, une candidature
 * par son état autorisé.
 */
import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import { normalizeCivilName } from "@antsia/social-domain/civilName"
import { COMMERCE_JOBS_LIMITS } from "@antsia/social-domain/commerce-jobs"
import type { JobDto, JobList } from "@convex/modules/shops/jobRead"
import type { MyApplication } from "@convex/modules/shops/jobApplications"
import type { JobFileDto } from "@convex/modules/shops/jobFiles"
import { z } from "zod"

import { catalogAmount } from "@/components/shops/catalog-model"

export type { JobDto, JobFileDto, JobList, MyApplication }
export type JobTranslate = (key: string, options?: Record<string, unknown>) => string

export const JOB_PAGE_SIZE = 12
export const JOB_FILE_ACCEPT = "application/pdf"
export const JOB_FILE_MAX_BYTES = COMMERCE_JOBS_LIMITS.attachmentBytesMax

/** Rémunération DÉCLARÉE : jamais inventée ; sans période connue, la phrase le dit. */
export function jobSalaryText(salary: JobDto["salary"], locale: string, t: JobTranslate): string {
  if (salary === null || (salary.minAmount === null && salary.maxAmount === null)) return t("salary.notSpecified")
  const amount = salary.minAmount !== null && salary.maxAmount !== null
    ? salary.minAmount === salary.maxAmount ? catalogAmount(salary.minAmount, locale) : t("salary.range", { min: catalogAmount(salary.minAmount, locale), max: catalogAmount(salary.maxAmount, locale) })
    : salary.minAmount !== null ? t("salary.from", { min: catalogAmount(salary.minAmount, locale) }) : t("salary.upTo", { max: catalogAmount(salary.maxAmount ?? 0, locale) })
  return `${amount} · ${salary.period === null ? t("salary.periodUnknown") : t(`salary.period.${salary.period}`)}`
}

/** Date civile `AAAA-MM-JJ` d'une offre, rendue sans décalage horaire. */
export function jobDateText(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function jobInstantText(instant: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Libreville" }).format(new Date(instant))
}

/** La phrase de clôture d'une offre qui ne reçoit plus de candidatures, `null` si elle est ouverte. */
export function jobStatusNoticeKey(status: JobDto["status"]): string | null {
  switch (status) {
    case "open":
      return null
    case "deadline_passed":
      return "details.deadlineNotice"
    case "filled":
      return "details.filledNotice"
    case "closed":
      return "details.closedNotice"
  }
}

/** Taille d'une pièce en kilo-octets arrondis (affichage seul). */
export function jobFileSizeKb(byteSize: number): number {
  return Math.max(1, Math.round(byteSize / 1024))
}

/** Le nom transmis, tel que le serveur l'écrira : NOM en capitales, Prénom capitalisé (normaliseur partagé). */
export function jobCivilNamePreview(firstName: string, lastName: string): string | null {
  const name = normalizeCivilName({ firstName, lastName })
  if (name.firstName.length === 0 || name.lastName.length === 0) return null
  return `${name.lastName} ${name.firstName}`
}

const CONTROL = /[\u0000-\u001f\u007f]/u
const MOTIVATION_CONTROL = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/u

/** Formulaire de candidature : mêmes bornes que le moteur, messages traduits fournis par l'écran. */
export function jobApplicationSchema(messages: { nameRequired: string; nameTooLong: string; nameInvalid: string; motivationTooLong: string; filesTooMany: string; consentRequired: string }) {
  const civil = z.string().transform((value) => value.normalize("NFC").trim().replace(/\s+/gu, " "))
    .pipe(z.string().min(1, messages.nameRequired).max(COMMERCE_JOBS_LIMITS.civilNameMax, messages.nameTooLong)
      .refine((value) => !CONTROL.test(value) && /\p{L}/u.test(value), messages.nameInvalid))
  return z.object({
    firstName: civil,
    lastName: civil,
    motivation: z.string().transform((value) => value.normalize("NFC").replace(/\r\n?/gu, "\n").trim())
      .pipe(z.string().max(COMMERCE_JOBS_LIMITS.motivationMax, messages.motivationTooLong).refine((value) => !MOTIVATION_CONTROL.test(value), messages.motivationTooLong)),
    fileIds: z.array(z.string()).max(COMMERCE_JOBS_LIMITS.attachmentsMax, messages.filesTooMany),
    consent: z.boolean().refine((value) => value, messages.consentRequired),
  })
}
export type JobApplicationInput = z.input<ReturnType<typeof jobApplicationSchema>>
export type JobApplicationValues = z.output<ReturnType<typeof jobApplicationSchema>>

/** Clé d'idempotence d'un geste de candidature (une par formulaire monté). */
export function jobIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 32).padEnd(16, "0")
}

const JOB_ERROR_CODES = new Set(["notFound", "conflict", "policyRefused", "consentRequired", "fileScanPending", "fileQuarantined", "rateLimited"])

/** Le texte d'un refus du moteur : jamais le texte brut du serveur. */
export function jobErrorText(error: unknown, t: JobTranslate): string {
  const rule = engineErrorRule(error)
  if (rule) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(error)
  if (code && JOB_ERROR_CODES.has(code)) return t(`errors.${code}`)
  return code ? t(`errors:${code}`) : t("errors.generic")
}

/** Une pièce choisie doit être prête (analyse complète saine). */
export function selectableJobFiles(files: readonly JobFileDto[]): JobFileDto[] {
  return files.filter((file) => file.scan === "clean")
}
