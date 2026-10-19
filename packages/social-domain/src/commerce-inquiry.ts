/** P10 : retrait privé du consentement CRM ; jumeau ANTSIA/PRO.GA hors manifeste P06. */
import {
  COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAntsiaRef, commerceCapture,
  commerceInstant, commerceIsMachineIdentity, commerceIsOpaqueId, commerceIsSha256,
  commerceLiteral, commerceParseCanonicalBody, commerceRecord, commerceReject,
  type CommerceEnvironment, type CommerceResult,
} from "./commerce/primitives"

export const COMMERCE_INQUIRY_CONSENT_VERSION = "2026-10-18-p10-v1"
/** Définition de version multilingue ; l'UI la rend via ses clés FR/EN. */
export const COMMERCE_INQUIRY_CONSENT_TEXT = {
  fr: "J’autorise l’envoi à PRO.GA du texte et du nom d’affichage que j’ai choisis pour créer une demande commerciale auprès de cette boutique. Les réponses passent par ANTSIA. Je peux retirer cet accord depuis cette conversation.",
  en: "I authorise sending my chosen text and display name to PRO.GA to create a commercial enquiry for this shop. Replies use ANTSIA. I can withdraw this consent from this conversation.",
} as const
export const COMMERCE_INQUIRY_WITHDRAW_CONTRACT = "PRO-COMMERCE-INQUIRY-CONSENT-V1"
export const COMMERCE_INQUIRY_WITHDRAW_PATH = "/commerce/v1/inquiry-consents"
export const COMMERCE_INQUIRY_WITHDRAW_MAX_BYTES = 8192
export const COMMERCE_INQUIRY_WITHDRAW_TTL_MS = 60_000
/** Transport P08 existant, opération liée aux octets ; aucune commande P06 réservée admise. */
export const COMMERCE_INQUIRY_WITHDRAW_OPERATION = "inquiry.submit" as const

export type CommerceInquiryWithdrawal = {
  contract: typeof COMMERCE_INQUIRY_WITHDRAW_CONTRACT
  version: 1
  source: string
  environment: CommerceEnvironment
  requestId: string
  issuedAt: number
  expiresAt: number
  subjectRef: string
  submitRequestId: string
  submitRequestSha256: string
  conversationRef: string
  revokedAt: number
}
export type CommerceInquiryWithdrawalResponse = {
  contract: typeof COMMERCE_INQUIRY_WITHDRAW_CONTRACT
  version: 1
  requestId: string
  requestSha256: string
  outcome: "withdrawn" | "rejected"
  respondedAt: number
}
export type CommerceInquiryConsentReason = "invalid_request" | "source_mismatch" | "environment_mismatch"
  | "invalid_time" | "invalid_payload" | "invalid_reference" | "invalid_body" | "body_too_large"
  | "not_canonical" | "too_complex" | "correlation_mismatch"

export function parseCommerceInquiryWithdrawal(rawBody: string, context: {
  source: string; environment: CommerceEnvironment; nowMs: number
}): CommerceResult<CommerceInquiryWithdrawal, CommerceInquiryConsentReason> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_INQUIRY_WITHDRAW_MAX_BYTES), "$", [
      "contract", "version", "source", "environment", "requestId", "issuedAt", "expiresAt", "subjectRef",
      "submitRequestId", "submitRequestSha256", "conversationRef", "revokedAt",
    ])
    if (row.contract !== COMMERCE_INQUIRY_WITHDRAW_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$")
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source")
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS)
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment")
    if (!commerceIsOpaqueId(row.requestId) || !commerceIsOpaqueId(row.submitRequestId) || !commerceIsSha256(row.submitRequestSha256)) commerceReject("invalid_payload", "$.requestId")
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt"), expiresAt = commerceInstant(row.expiresAt, "$.expiresAt")
    const revokedAt = commerceInstant(row.revokedAt, "$.revokedAt")
    if (!Number.isSafeInteger(context.nowMs) || issuedAt > context.nowMs + COMMERCE_MAX_SKEW_MS || issuedAt < context.nowMs - COMMERCE_MAX_SKEW_MS
      || expiresAt <= context.nowMs || expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_INQUIRY_WITHDRAW_TTL_MS
      || revokedAt > issuedAt || revokedAt < 0) commerceReject("invalid_time", "$.expiresAt")
    return {
      contract: COMMERCE_INQUIRY_WITHDRAW_CONTRACT, version: 1, source: row.source, environment,
      requestId: row.requestId, issuedAt, expiresAt, revokedAt, submitRequestId: row.submitRequestId,
      submitRequestSha256: row.submitRequestSha256,
      subjectRef: commerceAntsiaRef(row.subjectRef, "$.subjectRef", "sub"),
      conversationRef: commerceAntsiaRef(row.conversationRef, "$.conversationRef", "conv"),
    }
  })
}

export function parseCommerceInquiryWithdrawalResponse(rawBody: string, context: {
  requestId: string; requestSha256: string
}): CommerceResult<CommerceInquiryWithdrawalResponse, CommerceInquiryConsentReason> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_INQUIRY_WITHDRAW_MAX_BYTES), "$", [
      "contract", "version", "requestId", "requestSha256", "outcome", "respondedAt",
    ])
    if (row.contract !== COMMERCE_INQUIRY_WITHDRAW_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$")
    if (row.requestId !== context.requestId || !commerceIsSha256(row.requestSha256) || row.requestSha256 !== context.requestSha256) commerceReject("correlation_mismatch", "$.requestId")
    return {
      contract: COMMERCE_INQUIRY_WITHDRAW_CONTRACT, version: 1, requestId: context.requestId,
      requestSha256: context.requestSha256, outcome: commerceLiteral(row.outcome, "$.outcome", ["withdrawn", "rejected"] as const),
      respondedAt: commerceInstant(row.respondedAt, "$.respondedAt"),
    }
  })
}
