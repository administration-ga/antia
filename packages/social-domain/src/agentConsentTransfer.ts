/**
 * ANTSIA-AGENT-CONSENT-V1 : transfert privé d'un accord local, sans effet réseau.
 * Le serveur contrôle encore signature, fraîcheur, sujet IDN, jeton court à
 * usage unique et correspondance SHA-256 entre agentRef et consentRef.
 */
import { CONSENT_TEXT_VERSIONS } from "./consent"
import { FEDERATION_MAX_SKEW_MS, type FederationEnvironment } from "./federationProtocol"

export const AGENT_CONSENT_TRANSFER_CONTRACT = "ANTSIA-AGENT-CONSENT-V1" as const
export const AGENT_CONSENT_TRANSFER_PATH = "/federation/agent-consent" as const
export const AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES = 4096

export type AgentConsentTransferRequest = { token: string; idnSub: string }
export type AgentConsentTransferGrant = {
  agentRef: string
  consentRef: string
  textVersion: string
  grantedAt: number
}
export type AgentConsentTransferResponse =
  | { outcome: "granted"; grant: AgentConsentTransferGrant }
  | { outcome: "unavailable" | "unauthorized" | "invalid_request" }
export type AgentConsentTransferRequestParseResult =
  | { ok: true; request: AgentConsentTransferRequest }
  | { ok: false; reason: "invalid_request" }
export type AgentConsentTransferResponseParseResult =
  | { ok: true; response: AgentConsentTransferResponse }
  | { ok: false; reason: "invalid_response" }

const HEX_64 = /^[a-f0-9]{64}$/u
const AGENT_REF = /^agent:[a-f0-9]{64}$/u
const REQUEST_FIELDS = ["token", "idnSub"] as const
const GRANTED_FIELDS = ["outcome", "grant"] as const
const GRANT_FIELDS = ["agentRef", "consentRef", "textVersion", "grantedAt"] as const
const REFUSAL_FIELDS = ["outcome"] as const

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function exactFields(row: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((key) => Object.prototype.hasOwnProperty.call(row, key)) && Object.keys(row).every((key) => fields.includes(key))
}

function boundedJson(rawBody: string): Record<string, unknown> | null {
  if (typeof rawBody !== "string" || new TextEncoder().encode(rawBody).byteLength > AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES) return null
  try { return recordOf(JSON.parse(rawBody) as unknown) } catch { return null }
}

function opaqueIdnSubject(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || value !== value.trim()) return false
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return false
  }
  return true
}

/** Aucun détail de parse n'accompagne un refus : ni jeton, ni sujet privé. */
export function parseAgentConsentTransferRequest(rawBody: string): AgentConsentTransferRequestParseResult {
  const row = boundedJson(rawBody)
  if (!row || !exactFields(row, REQUEST_FIELDS) || typeof row.token !== "string" || !HEX_64.test(row.token) || !opaqueIdnSubject(row.idnSub)) return { ok: false, reason: "invalid_request" }
  return { ok: true, request: { token: row.token, idnSub: row.idnSub } }
}

/** La syntaxe d'un accord ne dispense jamais de vérifier la signature liée à la requête. */
export function parseAgentConsentTransferResponse(rawBody: string, nowMs: number): AgentConsentTransferResponseParseResult {
  const row = boundedJson(rawBody)
  if (!row || !Number.isFinite(nowMs)) return { ok: false, reason: "invalid_response" }
  if (row.outcome === "unavailable" || row.outcome === "unauthorized" || row.outcome === "invalid_request") {
    return exactFields(row, REFUSAL_FIELDS) ? { ok: true, response: { outcome: row.outcome } } : { ok: false, reason: "invalid_response" }
  }
  if (row.outcome !== "granted" || !exactFields(row, GRANTED_FIELDS)) return { ok: false, reason: "invalid_response" }
  const grant = recordOf(row.grant)
  if (!grant || !exactFields(grant, GRANT_FIELDS)
    || typeof grant.agentRef !== "string" || !AGENT_REF.test(grant.agentRef)
    || typeof grant.consentRef !== "string" || !HEX_64.test(grant.consentRef)
    || grant.textVersion !== CONSENT_TEXT_VERSIONS.administration_reflection
    || typeof grant.grantedAt !== "number" || !Number.isSafeInteger(grant.grantedAt) || grant.grantedAt <= 0 || grant.grantedAt > nowMs + FEDERATION_MAX_SKEW_MS) return { ok: false, reason: "invalid_response" }
  return { ok: true, response: { outcome: "granted", grant: {
    agentRef: grant.agentRef, consentRef: grant.consentRef, textVersion: grant.textVersion, grantedAt: grant.grantedAt,
  } } }
}

/** Les octets exacts sont séparés par protocole et sens ; une réponse lie aussi sa requête. */
export function agentConsentTransferSigningText(environment: FederationEnvironment, timestamp: string, rawBody: string, requestSha256?: string): string {
  if (requestSha256 === undefined) return `${environment}\n${timestamp}\n${AGENT_CONSENT_TRANSFER_CONTRACT}/request\n${rawBody}`
  if (!HEX_64.test(requestSha256)) throw new TypeError("Invalid request digest")
  return `${environment}\n${timestamp}\n${AGENT_CONSENT_TRANSFER_CONTRACT}/response\n${requestSha256}\n${rawBody}`
}
