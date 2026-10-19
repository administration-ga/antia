/**
 * P15 : emploi public PRO-COMMERCE-JOBS-V1, contrôles privés de candidature et
 * transfert des pièces. FICHIER JUMEAU ANTSIA/PRO.GA, octet pour octet, HORS du
 * manifeste P06 gelé : `commerce/**` n'est ni modifié ni réexporté.
 *
 * JOBS-V1 complète PUBLIC-V1 §5.6, dont le schéma fermé n'a ni compétences ni
 * période de rémunération : même inbox signée (FEDERATION-INBOX-V1), même
 * émetteur, mêmes bornes, mêmes règles de révision et de tombe. Le récepteur
 * ANTSIA lit aussi les `job.*` de PUBLIC-V1 en les normalisant (aucune
 * compétence, période inconnue) ; PRO.GA ne produit que JOBS-V1.
 *
 * TypeScript pur : aucune I/O, aucune horloge implicite, aucun aléa, aucun secret.
 */
import {
  COMMERCE_BODY_MAX_BYTES, COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAmount, commerceAntsiaRef, commerceArray,
  commerceCapture, commerceCurrency, commerceHas, commerceInstant, commerceInteger, commerceIsMachineIdentity, commerceIsOpaqueId,
  commerceIsSha256, commerceIsoDate, commerceLiteral, commerceParseCanonicalBody, commerceRecord, commerceRef, commerceReject,
  commerceScanJson, commerceSha256, commerceText, commerceTimeMs, commerceUnique,
  type CommerceEnvironment, type CommerceResult,
} from "./commerce/primitives"
import {
  COMMERCE_JOB_CLOSURE_REASONS, COMMERCE_JOB_CONTRACT_TYPES, COMMERCE_PUBLIC_FORBIDDEN_FIELDS, COMMERCE_PUBLIC_LIMITS,
  type CommerceJobClosedEvent, type CommerceJobEvent, type CommercePublicEffectKind, type CommercePublicReason,
} from "./commerce/projection"
import { COMMERCE_APPLICATION_STATES, type CommerceApplicationState } from "./commerce/lifecycle"

// ─── Projection publique d'emploi (JOBS-V1) ──────────────────────────────────

export const COMMERCE_JOBS_CONTRACT = "PRO-COMMERCE-JOBS-V1"
export const COMMERCE_JOBS_EVENT_TYPES = ["job.published", "job.closed"] as const
export type CommerceJobsEventType = (typeof COMMERCE_JOBS_EVENT_TYPES)[number]
/** Période d'une rémunération DÉCLARÉE ; absente, l'affichage dit « non précisée ». */
export const COMMERCE_JOBS_SALARY_PERIODS = ["day", "hour", "month", "week", "year"] as const
export type CommerceJobsSalaryPeriod = (typeof COMMERCE_JOBS_SALARY_PERIODS)[number]
export type CommerceJobsContractType = (typeof COMMERCE_JOB_CONTRACT_TYPES)[number]
export type CommerceJobsClosureReason = (typeof COMMERCE_JOB_CLOSURE_REASONS)[number]
/** Pièces admises par COMMAND §6.9 ; PDF seul, 5 Mio au plus chacune. */
export const COMMERCE_JOBS_ATTACHMENT_KINDS = ["certificate", "cover_letter", "cv"] as const
export type CommerceJobsAttachmentKind = (typeof COMMERCE_JOBS_ATTACHMENT_KINDS)[number]

export const COMMERCE_JOBS_LIMITS = {
  skillsMax: 20,
  skillMin: 1,
  skillMax: 60,
  locationMax: COMMERCE_PUBLIC_LIMITS.jobLocationMax,
  titleMin: COMMERCE_PUBLIC_LIMITS.jobTitleMin,
  titleMax: COMMERCE_PUBLIC_LIMITS.jobTitleMax,
  descriptionMax: COMMERCE_PUBLIC_LIMITS.jobDescriptionMax,
  headcountMax: COMMERCE_PUBLIC_LIMITS.headcountMax,
  attachmentsMax: 3,
  attachmentBytesMax: 5 * 1024 * 1024,
  motivationMax: 4000,
  civilNameMax: 80,
} as const

export type CommerceJobsSalary = {
  readonly currency: "XAF"
  readonly maxAmount?: number
  readonly minAmount?: number
  readonly period?: CommerceJobsSalaryPeriod
}

export type CommerceJobsPublished = {
  readonly changedAt: number
  readonly closesOn?: string
  readonly contractType: CommerceJobsContractType
  readonly declaredSalary?: CommerceJobsSalary
  readonly description: string
  readonly headcount: number
  readonly jobRef: string
  readonly location?: string
  readonly openedOn: string
  readonly revision: number
  readonly shopRef: string
  readonly skills: readonly string[]
  readonly title: string
  readonly type: "job.published"
}

export type CommerceJobsClosed = {
  readonly changedAt: number
  readonly jobRef: string
  readonly reason: CommerceJobsClosureReason
  readonly revision: number
  readonly shopRef: string
  readonly type: "job.closed"
}

export type CommerceJobsEvent = CommerceJobsPublished | CommerceJobsClosed

export type CommerceJobsEnvelope = {
  readonly contract: typeof COMMERCE_JOBS_CONTRACT
  readonly eventId: string
  readonly objectRef: string
  readonly payload: CommerceJobsEvent
  readonly version: 1
}

const P = "$.payload"
const L = COMMERCE_JOBS_LIMITS
const PUBLIC_FORBIDDEN: ReadonlySet<string> = new Set(COMMERCE_PUBLIC_FORBIDDEN_FIELDS)

function readRevision(value: unknown, path: string): number {
  return commerceInteger(value, path, 1, Number.MAX_SAFE_INTEGER, "invalid_revision")
}

/** Référence de l'objet : grammaire `job_opening`, puis égalité exacte avec `objectRef`. */
function readJobRef(value: unknown, path: string, objectRef: string): string {
  const ref = commerceRef(value, path, ["job_opening"])
  if (ref !== objectRef) commerceReject("reference_mismatch", path)
  return ref
}

/** Fourchette DÉCLARÉE : au moins une borne, ordonnée ; période facultative et fermée. */
function readSalary(value: unknown, path: string): CommerceJobsSalary {
  const row = commerceRecord(value, path, ["currency"], ["maxAmount", "minAmount", "period"])
  const currency = commerceCurrency(row.currency, `${path}.currency`)
  const maxAmount = commerceHas(row, "maxAmount") ? commerceAmount(row.maxAmount, `${path}.maxAmount`) : undefined
  const minAmount = commerceHas(row, "minAmount") ? commerceAmount(row.minAmount, `${path}.minAmount`) : undefined
  const period = commerceHas(row, "period") ? commerceLiteral(row.period, `${path}.period`, COMMERCE_JOBS_SALARY_PERIODS) : undefined
  if (maxAmount === undefined && minAmount === undefined) commerceReject("amount_incoherent", path)
  if (maxAmount !== undefined && minAmount !== undefined && minAmount > maxAmount) commerceReject("amount_incoherent", path)
  return {
    currency,
    ...(maxAmount === undefined ? {} : { maxAmount }),
    ...(minAmount === undefined ? {} : { minAmount }),
    ...(period === undefined ? {} : { period }),
  }
}

/** Compétences publiques, déjà normalisées par le producteur ; doublon insensible à la casse refusé. */
function readSkills(value: unknown, path: string): readonly string[] {
  const skills = commerceArray(value, path, 0, L.skillsMax).map((item, index) => commerceText(item, `${path}[${index}]`, L.skillMin, L.skillMax))
  commerceUnique(skills.map((skill) => skill.toLocaleLowerCase("fr")), path)
  return skills
}

function readPublished(payload: unknown, objectRef: string, nowMs: number): CommerceJobsPublished {
  const row = commerceRecord(
    payload,
    P,
    ["changedAt", "contractType", "description", "headcount", "jobRef", "openedOn", "revision", "shopRef", "skills", "title", "type"],
    ["closesOn", "declaredSalary", "location"],
  )
  const jobRef = readJobRef(row.jobRef, `${P}.jobRef`, objectRef)
  const revision = readRevision(row.revision, `${P}.revision`)
  const changedAt = commerceTimeMs(row.changedAt, `${P}.changedAt`, nowMs)
  const closesOn = commerceHas(row, "closesOn") ? commerceIsoDate(row.closesOn, `${P}.closesOn`) : undefined
  const contractType = commerceLiteral(row.contractType, `${P}.contractType`, COMMERCE_JOB_CONTRACT_TYPES)
  const declaredSalary = commerceHas(row, "declaredSalary") ? readSalary(row.declaredSalary, `${P}.declaredSalary`) : undefined
  const description = commerceText(row.description, `${P}.description`, 0, L.descriptionMax, true)
  const headcount = commerceInteger(row.headcount, `${P}.headcount`, 1, L.headcountMax)
  const location = commerceHas(row, "location") ? commerceText(row.location, `${P}.location`, 1, L.locationMax) : undefined
  const openedOn = commerceIsoDate(row.openedOn, `${P}.openedOn`)
  const shopRef = commerceRef(row.shopRef, `${P}.shopRef`, ["structure"])
  const skills = readSkills(row.skills, `${P}.skills`)
  const title = commerceText(row.title, `${P}.title`, L.titleMin, L.titleMax)
  if (closesOn !== undefined && closesOn < openedOn) commerceReject("invalid_time", `${P}.closesOn`)
  return {
    changedAt,
    ...(closesOn === undefined ? {} : { closesOn }),
    contractType,
    ...(declaredSalary === undefined ? {} : { declaredSalary }),
    description,
    headcount,
    jobRef,
    ...(location === undefined ? {} : { location }),
    openedOn,
    revision,
    shopRef,
    skills,
    title,
    type: "job.published",
  }
}

function readClosed(payload: unknown, objectRef: string, nowMs: number): CommerceJobsClosed {
  const row = commerceRecord(payload, P, ["changedAt", "jobRef", "reason", "revision", "shopRef", "type"])
  const jobRef = readJobRef(row.jobRef, `${P}.jobRef`, objectRef)
  const revision = readRevision(row.revision, `${P}.revision`)
  const changedAt = commerceTimeMs(row.changedAt, `${P}.changedAt`, nowMs)
  const reason = commerceLiteral(row.reason, `${P}.reason`, COMMERCE_JOB_CLOSURE_REASONS)
  const shopRef = commerceRef(row.shopRef, `${P}.shopRef`, ["structure"])
  return { changedAt, jobRef, reason, revision, shopRef, type: "job.closed" }
}

function readJobsPayload(payload: unknown, objectRef: string, nowMs: number): CommerceJobsEvent {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) commerceReject("invalid_payload", P)
  commerceScanJson(payload, PUBLIC_FORBIDDEN, P)
  const type = (payload as Record<string, unknown>).type
  if (typeof type !== "string") commerceReject("invalid_payload", `${P}.type`)
  switch (type) {
    case "job.published":
      return readPublished(payload, objectRef, nowMs)
    case "job.closed":
      return readClosed(payload, objectRef, nowMs)
    default:
      return commerceReject("unknown_event", `${P}.type`)
  }
}

/** Charge seule ; le réseau ne vient JAMAIS de la charge (registre de l'émetteur). */
export function parseCommerceJobsPayload(payload: unknown, objectRef: string, nowMs: number): CommerceResult<CommerceJobsEvent, CommercePublicReason> {
  return commerceCapture(() => readJobsPayload(payload, objectRef, nowMs))
}

/** Corps exact reçu : forme canonique exigée, enveloppe à cinq clés, puis charge fermée. */
export function parseCommerceJobsBody(rawBody: string, nowMs: number): CommerceResult<CommerceJobsEnvelope, CommercePublicReason> {
  return commerceCapture(() => {
    const parsed = commerceParseCanonicalBody(rawBody, COMMERCE_BODY_MAX_BYTES)
    const row = commerceRecord(parsed, "$", ["contract", "eventId", "objectRef", "payload", "version"], [], "invalid_envelope")
    if (row.contract !== COMMERCE_JOBS_CONTRACT) commerceReject("invalid_envelope", "$.contract")
    if (row.version !== 1) commerceReject("invalid_envelope", "$.version")
    const eventId = row.eventId
    if (!commerceIsOpaqueId(eventId)) commerceReject("invalid_envelope", "$.eventId")
    const objectRef = commerceRef(row.objectRef, "$.objectRef", ["job_opening"])
    const payload = readJobsPayload(row.payload, objectRef, nowMs)
    return { contract: COMMERCE_JOBS_CONTRACT, eventId, objectRef, payload, version: 1 }
  })
}

export type CommerceJobsEffect = {
  readonly effect: CommercePublicEffectKind
  readonly objectRef: string
  readonly revision: number
}

/** `closed`/`filled` ferment définitivement ; `withdrawn` retire, une révision supérieure republie. */
export function commerceJobsEffect(event: CommerceJobsEvent): CommerceJobsEffect {
  if (event.type === "job.published") return { effect: "upsert", objectRef: event.jobRef, revision: event.revision }
  return { effect: event.reason === "withdrawn" ? "withdraw" : "close", objectRef: event.jobRef, revision: event.revision }
}

/** PUBLIC-V1 §5.6 dans le modèle JOBS : aucune compétence, période inconnue ; rien n'est inventé. */
export function commerceJobsFromPublic(event: CommerceJobEvent | CommerceJobClosedEvent): CommerceJobsEvent {
  if (event.type === "job.closed") {
    return { changedAt: event.changedAt, jobRef: event.jobRef, reason: event.reason, revision: event.revision, shopRef: event.shopRef, type: "job.closed" }
  }
  const salary = event.declaredSalary
  return {
    changedAt: event.changedAt,
    ...(event.closesOn === undefined ? {} : { closesOn: event.closesOn }),
    contractType: event.contractType,
    ...(salary === undefined ? {} : {
      declaredSalary: {
        currency: salary.currency,
        ...(salary.maxAmount === undefined ? {} : { maxAmount: salary.maxAmount }),
        ...(salary.minAmount === undefined ? {} : { minAmount: salary.minAmount }),
      },
    }),
    description: event.description,
    headcount: event.headcount,
    jobRef: event.jobRef,
    ...(event.location === undefined ? {} : { location: event.location }),
    openedOn: event.openedOn,
    revision: event.revision,
    shopRef: event.shopRef,
    skills: [],
    title: event.title,
    type: "job.published",
  }
}

/** Date civile à Libreville (UTC+1, sans heure d'été) : échéance des offres. */
export function commerceJobsLibrevilleDate(nowMs: number): string {
  return new Date(nowMs + 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Une offre reçoit des candidatures si elle est active, publiée et que son échéance n'est pas passée. */
export function commerceJobsOpenForApplications(event: CommerceJobsEvent, state: "active" | "closed" | "withdrawn", today: string): boolean {
  return state === "active" && event.type === "job.published" && (event.closesOn === undefined || event.closesOn >= today)
}

export type CommerceJobsPublicStatus = "closed" | "deadline_passed" | "filled" | "open"

export type CommerceJobsPublicView = {
  readonly closesOn: string | null
  readonly contractType: CommerceJobsContractType
  readonly description: string
  readonly headcount: number
  readonly jobRef: string
  readonly location: string | null
  readonly openedOn: string
  readonly revision: number
  readonly salary: {
    readonly currency: "XAF"
    readonly maxAmount: number | null
    readonly minAmount: number | null
    readonly period: CommerceJobsSalaryPeriod | null
  } | null
  readonly shopRef: string
  readonly skills: readonly string[]
  readonly status: CommerceJobsPublicStatus
  readonly title: string
}

/**
 * Projection ANONYME d'une offre : allowlist explicite. Une offre close garde son
 * contenu pour un lien connu, avec sa clôture ; une offre retirée ne passe jamais ici.
 */
export function commerceJobsPublicView(
  job: CommerceJobsPublished,
  options: { readonly closure: "closed" | "filled" | null; readonly today: string },
): CommerceJobsPublicView {
  const status: CommerceJobsPublicStatus = options.closure ?? (job.closesOn !== undefined && job.closesOn < options.today ? "deadline_passed" : "open")
  const salary = job.declaredSalary
  return {
    closesOn: job.closesOn ?? null,
    contractType: job.contractType,
    description: job.description,
    headcount: job.headcount,
    jobRef: job.jobRef,
    location: job.location ?? null,
    openedOn: job.openedOn,
    revision: job.revision,
    salary: salary === undefined ? null : { currency: salary.currency, maxAmount: salary.maxAmount ?? null, minAmount: salary.minAmount ?? null, period: salary.period ?? null },
    shopRef: job.shopRef,
    skills: [...job.skills],
    status,
    title: job.title,
  }
}

// ─── Suivi candidat : états autorisés, jamais les notes ─────────────────────

/** États rendus au candidat : l'état de SA candidature, sans motif, note ni entretien détaillé. */
export const COMMERCE_JOBS_CANDIDATE_STATES = ["hired", "in_review", "interview", "not_retained", "offer", "received", "withdrawn"] as const
export type CommerceJobsCandidateState = (typeof COMMERCE_JOBS_CANDIDATE_STATES)[number]

export function commerceJobsApplicationState(value: unknown): CommerceApplicationState | null {
  return typeof value === "string" && (COMMERCE_APPLICATION_STATES as readonly string[]).includes(value) ? value as CommerceApplicationState : null
}

export function commerceJobsCandidateState(state: CommerceApplicationState): CommerceJobsCandidateState {
  switch (state) {
    case "received":
      return "received"
    case "screening":
      return "in_review"
    case "interview":
      return "interview"
    case "offer":
      return "offer"
    case "hired":
      return "hired"
    case "rejected":
      return "not_retained"
    case "withdrawn":
      return "withdrawn"
  }
}

// ─── Consentements versionnés ────────────────────────────────────────────────

export const COMMERCE_JOBS_APPLICATION_CONSENT_VERSION = "2026-10-18-p15-v1"
/** Définition multilingue ; les écrans la rendent par leurs clés FR/EN. */
export const COMMERCE_JOBS_APPLICATION_CONSENT_TEXT = {
  fr: "J’autorise l’envoi à PRO.GA, pour cette offre d’emploi, de mon nom, de ma motivation et des pièces que j’ai choisies. L’employeur et ses recruteurs habilités traitent ma candidature dans PRO.GA. Je peux retirer ma candidature depuis Mes candidatures.",
  en: "I authorise sending my name, my motivation and the documents I chose to PRO.GA for this job opening. The employer and its authorised recruiters process my application in PRO.GA. I can withdraw my application from My applications.",
} as const

export const COMMERCE_JOBS_PUBLICATION_CONSENT_VERSION = "2026-10-18-p15-pub-v1"
export const COMMERCE_JOBS_PUBLICATION_CONSENT_TEXT = {
  fr: "J’autorise la publication sur ANTSIA de cette offre d’emploi : intitulé, contrat, lieu, compétences, échéance, effectif et rémunération déclarée. Aucun candidat, coordonnée ni note interne n’est publié. Je peux retirer cette publication à tout moment.",
  en: "I authorise publishing this job opening on ANTSIA: title, contract, location, skills, deadline, headcount and declared pay. No candidate, contact detail or internal note is published. I can withdraw this publication at any time.",
} as const

/**
 * Conservation : AUCUNE durée n'est fixée par ce lot (décision propriétaire et
 * conseil compétent). Tant qu'elles restent `null`, aucune purge temporelle ne
 * s'exécute ; le retrait et l'effacement suppriment immédiatement les copies.
 */
export const COMMERCE_JOBS_RETENTION = {
  applicationFilesAfterDecisionDays: null,
  withdrawnApplicationsDays: null,
} as const

// ─── Contrôle privé ANTSIA → PRO.GA : retrait et révocation d'une pièce ─────

export const COMMERCE_JOBS_CONTROL_CONTRACT = "PRO-COMMERCE-APPLICATION-CONTROL-V1"
export const COMMERCE_JOBS_CONTROL_PATH = "/commerce/v1/application-control"
export const COMMERCE_JOBS_CONTROL_MAX_BYTES = 8192
export const COMMERCE_JOBS_CONTROL_TTL_MS = 60_000
/** Transport P08 existant ; le nom réservé P06 `application.withdraw` n'est pas rendu exécutable. */
export const COMMERCE_JOBS_CONTROL_OPERATION = "application.submit" as const
export const COMMERCE_JOBS_CONTROL_ACTIONS = ["attachment.revoke", "withdraw"] as const
export type CommerceJobsControlAction = (typeof COMMERCE_JOBS_CONTROL_ACTIONS)[number]
export const COMMERCE_JOBS_CONTROL_REASONS = ["candidate_request", "erasure", "file_blocked"] as const
export type CommerceJobsControlReason = (typeof COMMERCE_JOBS_CONTROL_REASONS)[number]

export type CommerceJobsControlRequest = {
  readonly action: CommerceJobsControlAction
  readonly at: number
  readonly attachmentRef?: string
  readonly contract: typeof COMMERCE_JOBS_CONTROL_CONTRACT
  readonly environment: CommerceEnvironment
  readonly expiresAt: number
  readonly issuedAt: number
  readonly reason: CommerceJobsControlReason
  readonly requestId: string
  readonly source: string
  readonly subjectRef: string
  readonly submitRequestId: string
  readonly submitRequestSha256: string
  readonly version: 1
}

export type CommerceJobsControlResponse = {
  readonly contract: typeof COMMERCE_JOBS_CONTROL_CONTRACT
  readonly outcome: "applied" | "rejected"
  readonly requestId: string
  readonly requestSha256: string
  readonly respondedAt: number
  readonly version: 1
}

export type CommerceJobsControlReasonCode = "body_too_large" | "correlation_mismatch" | "environment_mismatch" | "invalid_body"
  | "invalid_payload" | "invalid_reference" | "invalid_request" | "invalid_time" | "not_canonical" | "source_mismatch" | "too_complex"

const CONTROL_KEYS = ["action", "at", "contract", "environment", "expiresAt", "issuedAt", "reason", "requestId", "source", "subjectRef", "submitRequestId", "submitRequestSha256", "version"] as const

export function parseCommerceJobsControlRequest(rawBody: string, context: {
  readonly source: string; readonly environment: CommerceEnvironment; readonly nowMs: number
}): CommerceResult<CommerceJobsControlRequest, CommerceJobsControlReasonCode> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_JOBS_CONTROL_MAX_BYTES), "$", CONTROL_KEYS, ["attachmentRef"], "invalid_request")
    if (row.contract !== COMMERCE_JOBS_CONTROL_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$.contract")
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source")
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS, "invalid_request")
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment")
    const requestId = row.requestId, submitRequestId = row.submitRequestId
    if (!commerceIsOpaqueId(requestId) || !commerceIsOpaqueId(submitRequestId) || !commerceIsSha256(row.submitRequestSha256)) commerceReject("invalid_payload", "$.requestId")
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt"), expiresAt = commerceInstant(row.expiresAt, "$.expiresAt")
    const at = commerceInstant(row.at, "$.at")
    if (!Number.isSafeInteger(context.nowMs) || issuedAt > context.nowMs + COMMERCE_MAX_SKEW_MS || issuedAt < context.nowMs - COMMERCE_MAX_SKEW_MS
      || expiresAt <= context.nowMs || expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_JOBS_CONTROL_TTL_MS || at > issuedAt) commerceReject("invalid_time", "$.expiresAt")
    const action = commerceLiteral(row.action, "$.action", COMMERCE_JOBS_CONTROL_ACTIONS, "invalid_payload")
    const reason = commerceLiteral(row.reason, "$.reason", COMMERCE_JOBS_CONTROL_REASONS, "invalid_payload")
    const attachmentRef = commerceHas(row, "attachmentRef") ? commerceAntsiaRef(row.attachmentRef, "$.attachmentRef", "file") : undefined
    // Un retrait vise la candidature entière ; une révocation, exactement une pièce.
    if ((action === "withdraw") === (attachmentRef !== undefined) || (action === "withdraw" && reason === "file_blocked")) commerceReject("invalid_payload", "$.action")
    return {
      action, at, ...(attachmentRef === undefined ? {} : { attachmentRef }), contract: COMMERCE_JOBS_CONTROL_CONTRACT, environment,
      expiresAt, issuedAt, reason, requestId, source: row.source, subjectRef: commerceAntsiaRef(row.subjectRef, "$.subjectRef", "sub"),
      submitRequestId, submitRequestSha256: row.submitRequestSha256, version: 1,
    }
  })
}

export function parseCommerceJobsControlResponse(rawBody: string, expected: {
  readonly requestId: string; readonly requestSha256: string
}): CommerceResult<CommerceJobsControlResponse, CommerceJobsControlReasonCode> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_JOBS_CONTROL_MAX_BYTES), "$", ["contract", "outcome", "requestId", "requestSha256", "respondedAt", "version"], [], "invalid_request")
    if (row.contract !== COMMERCE_JOBS_CONTROL_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$.contract")
    if (row.requestId !== expected.requestId || !commerceIsSha256(row.requestSha256) || row.requestSha256 !== expected.requestSha256) commerceReject("correlation_mismatch", "$.requestId")
    return {
      contract: COMMERCE_JOBS_CONTROL_CONTRACT, outcome: commerceLiteral(row.outcome, "$.outcome", ["applied", "rejected"] as const),
      requestId: expected.requestId, requestSha256: expected.requestSha256, respondedAt: commerceInstant(row.respondedAt, "$.respondedAt"), version: 1,
    }
  })
}

// ─── Transfert privé des pièces (octets admis par la garde ANTSIA) ──────────

export const COMMERCE_JOBS_FILES_CONTRACT = "PRO-COMMERCE-APPLICATION-FILES-V1"
export const COMMERCE_JOBS_FILES_PATH = "/commerce/v1/application-files"
/** Signés par le profil COMMAND (empreinte des octets exacts), jamais une URL ni un identifiant de stockage. */
export const COMMERCE_JOBS_FILES_OPERATION = "application.submit" as const
export const COMMERCE_JOBS_FILES_REQUEST_HEADER = "X-Pro-Application-Request"
export const COMMERCE_JOBS_FILES_ATTACHMENT_HEADER = "X-Pro-Attachment-Ref"
export const COMMERCE_JOBS_FILES_RESPONSE_MAX_BYTES = 2048

export type CommerceJobsFileResponse = {
  readonly attachmentRef: string
  readonly contract: typeof COMMERCE_JOBS_FILES_CONTRACT
  readonly outcome: "already_stored" | "rejected" | "stored"
  readonly sha256: string
  readonly submitRequestId: string
  readonly version: 1
}

/** En-têtes de corrélation : liés à une pièce déjà DÉCLARÉE par `application.submit`. */
export function commerceJobsFileHeadersValid(submitRequestId: string, attachmentRef: string): boolean {
  return commerceIsOpaqueId(submitRequestId) && /^antsia:file:[0-9a-z]{26,64}$/.test(attachmentRef)
}

/** Signature binaire PDF (`%PDF-`) : le type déclaré ne suffit jamais. */
export function commerceJobsIsPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

export function parseCommerceJobsFileResponse(rawBody: string, expected: {
  readonly submitRequestId: string; readonly attachmentRef: string; readonly sha256: string
}): CommerceResult<CommerceJobsFileResponse, CommerceJobsControlReasonCode> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_JOBS_FILES_RESPONSE_MAX_BYTES), "$", ["attachmentRef", "contract", "outcome", "sha256", "submitRequestId", "version"], [], "invalid_request")
    if (row.contract !== COMMERCE_JOBS_FILES_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$.contract")
    if (row.submitRequestId !== expected.submitRequestId || row.attachmentRef !== expected.attachmentRef || commerceSha256(row.sha256, "$.sha256") !== expected.sha256) commerceReject("correlation_mismatch", "$.submitRequestId")
    return {
      attachmentRef: expected.attachmentRef, contract: COMMERCE_JOBS_FILES_CONTRACT,
      outcome: commerceLiteral(row.outcome, "$.outcome", ["already_stored", "rejected", "stored"] as const),
      sha256: expected.sha256, submitRequestId: expected.submitRequestId, version: 1,
    }
  })
}
