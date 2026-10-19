/**
 * P15 : transport privé ANTSIA → PRO.GA des candidatures, borné et sans cookie
 * ni URL fournie par le navigateur. Les octets d'une demande sont persistés par
 * le flux ; seuls l'horodatage, le nonce et la signature sont renouvelés.
 * À appeler depuis une ACTION seulement (entropie du nonce).
 */
import { COMMERCE_JOBS_CONTROL_MAX_BYTES, COMMERCE_JOBS_CONTROL_PATH, COMMERCE_JOBS_FILES_ATTACHMENT_HEADER, COMMERCE_JOBS_FILES_OPERATION, COMMERCE_JOBS_FILES_PATH, COMMERCE_JOBS_FILES_REQUEST_HEADER, COMMERCE_JOBS_FILES_RESPONSE_MAX_BYTES, COMMERCE_JOBS_CONTROL_OPERATION } from "@antsia/social-domain/commerce-jobs"
import { COMMERCE_COMMAND_LIMITS, commerceCommandSigningInput, type CommerceOperation } from "@antsia/social-domain/commerce/command"

import type { CommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, randomLinkToken, readCommerceLinkResponse } from "./commerceLinkCrypto"

const COMMAND_PATH = "/commerce/v1/commands"
const TIMEOUT_MS = 8_000
export type JobHttpReply = { status: number; rawResponse: string }

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sha256OfBytes(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)))
}

/** Profil `pro-ga-commerce-command-hmac/v1` sur l'empreinte des octets EXACTS envoyés. */
async function signedHeaders(config: CommerceLinkConfig, bodySha256: string, operation: CommerceOperation): Promise<Record<string, string>> {
  const issuedAtMs = Date.now(), nonce = randomLinkToken()
  const input = commerceCommandSigningInput({ bodySha256, environment: config.environment, issuedAtMs, keyId: config.keyId, nonce, operation, source: config.source })
  if (input === null) throw new Error("JOB_SIGNING_UNAVAILABLE")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
  return { Accept: "application/json", "X-Pro-Key-Id": config.keyId, "X-Pro-Timestamp": String(issuedAtMs), "X-Pro-Nonce": nonce, "X-Pro-Signature": signature }
}

async function post(config: CommerceLinkConfig, path: string, body: string | Uint8Array, headers: Record<string, string>, maxBytes: number): Promise<JobHttpReply | null> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(new URL(path, config.proHttpOrigin), { method: "POST", headers, body: body as BodyInit, redirect: "error", signal: controller.signal })
    const rawResponse = await readCommerceLinkResponse(response, maxBytes)
    return rawResponse === null ? null : { status: response.status, rawResponse }
  } catch { return null } finally { clearTimeout(timer) }
}

/** `application.submit` ou `request.status`, octets persistés envoyés tels quels. */
export async function sendJobCommand(config: CommerceLinkConfig, rawBody: string, operation: "application.submit" | "request.status"): Promise<JobHttpReply | null> {
  const bytes = new TextEncoder().encode(rawBody)
  if (bytes.byteLength > COMMERCE_COMMAND_LIMITS.requestMaxBytes) return null
  const headers = { ...(await signedHeaders(config, await sha256OfBytes(bytes), operation)), "Content-Type": "application/json" }
  return await post(config, COMMAND_PATH, rawBody, headers, COMMERCE_COMMAND_LIMITS.responseMaxBytes)
}

/** Retrait ou révocation d'une pièce : contrat privé hors manifeste P06, scope existant. */
export async function sendJobControl(config: CommerceLinkConfig, rawBody: string): Promise<JobHttpReply | null> {
  const bytes = new TextEncoder().encode(rawBody)
  if (bytes.byteLength > COMMERCE_JOBS_CONTROL_MAX_BYTES) return null
  const headers = { ...(await signedHeaders(config, await sha256OfBytes(bytes), COMMERCE_JOBS_CONTROL_OPERATION)), "Content-Type": "application/json" }
  return await post(config, COMMERCE_JOBS_CONTROL_PATH, rawBody, headers, COMMERCE_JOBS_CONTROL_MAX_BYTES)
}

/**
 * Octets d'une pièce déjà DÉCLARÉE par `application.submit` (même empreinte) :
 * jamais d'URL ni d'identifiant de stockage, seulement des références opaques.
 */
export async function sendJobFile(config: CommerceLinkConfig, bytes: Uint8Array, sha256: string, submitRequestId: string, attachmentRef: string): Promise<JobHttpReply | null> {
  if (bytes.byteLength < 1 || bytes.byteLength > COMMERCE_COMMAND_LIMITS.attachmentBytesMax) return null
  const headers = {
    ...(await signedHeaders(config, sha256, COMMERCE_JOBS_FILES_OPERATION)),
    "Content-Type": "application/pdf",
    [COMMERCE_JOBS_FILES_REQUEST_HEADER]: submitRequestId,
    [COMMERCE_JOBS_FILES_ATTACHMENT_HEADER]: attachmentRef,
  }
  return await post(config, COMMERCE_JOBS_FILES_PATH, bytes, headers, COMMERCE_JOBS_FILES_RESPONSE_MAX_BYTES)
}
