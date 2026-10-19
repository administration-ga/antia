/** P09 : requêtes serveur vers une origine configurée ; aucune URL reçue d'une offre. */
import {
  COMMERCE_CATALOG_MEDIA_MAX_BYTES, COMMERCE_CATALOG_PATHS,
  commerceCatalogSigningInput, parseCommerceCatalogReconcileResponse,
  type CommerceCatalogReadRequest, type CommerceCatalogReconcileResponse,
} from "@antsia/social-domain/commerce-catalogue"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import type { CommerceMedia } from "@antsia/social-domain/commerce/projection"

import type { CommerceLinkConfig } from "../shops/commerceLinkConfig"
import { base64url, randomLinkToken, readCommerceLinkResponse, sha256Hex } from "../shops/commerceLinkCrypto"

export async function catalogReadHeaders(config: CommerceLinkConfig, request: CommerceCatalogReadRequest, rawBody: string): Promise<Record<string, string>> {
  const now = Date.now()
  const nonce = randomLinkToken()
  const text = commerceCatalogSigningInput({
    bodySha256: await sha256Hex(rawBody), environment: config.environment, issuedAtMs: now,
    keyId: config.keyId, nonce, operation: request.operation, source: config.source,
  })
  if (!text) throw new Error("COMMERCE_CATALOG_CONFIGURATION")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return {
    "Content-Type": "application/json", Accept: request.operation === "media.read" ? "image/jpeg,image/png,image/webp" : "application/json",
    "Accept-Encoding": "identity", "X-Pro-Key-Id": config.keyId, "X-Pro-Timestamp": String(now),
    "X-Pro-Nonce": nonce, "X-Pro-Signature": base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)))),
  }
}

/** Refuse HTML, SVG et les types ambigus, même avec une extension ou un header image. */
export function catalogMediaSignatureMatches(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  if (mimeType === "image/webp") return bytes.length >= 12 && [82, 73, 70, 70].every((value, index) => bytes[index] === value) &&
    [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)
  return false
}

async function limitedMedia(response: Response, descriptor: CommerceMedia): Promise<Blob | null> {
  const encoding = response.headers.get("content-encoding")
  if (response.status !== 200 || !response.body ||
    !Number.isSafeInteger(descriptor.byteSize) || descriptor.byteSize < 1 || descriptor.byteSize > COMMERCE_CATALOG_MEDIA_MAX_BYTES ||
    response.headers.get("content-type")?.trim().toLowerCase() !== descriptor.mimeType ||
    (encoding !== null && encoding.toLowerCase() !== "identity") ||
    response.headers.get("x-content-sha256") !== descriptor.sha256) {
    await response.body?.cancel().catch(() => undefined)
    return null
  }
  const declared = response.headers.get("content-length")
  if (declared === null || !/^[1-9][0-9]*$/u.test(declared) || Number(declared) !== descriptor.byteSize) {
    await response.body.cancel().catch(() => undefined)
    return null
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > descriptor.byteSize || length > COMMERCE_CATALOG_MEDIA_MAX_BYTES) { await reader.cancel(); return null }
      chunks.push(part.value)
    }
    if (length !== descriptor.byteSize) return null
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    if (!catalogMediaSignatureMatches(bytes, descriptor.mimeType)) return null
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    const sha = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
    return sha === descriptor.sha256 ? new Blob([bytes], { type: descriptor.mimeType }) : null
  } finally { reader.releaseLock() }
}

/** Même délai pour connexion, en-têtes et corps ; refus de toute redirection. */
export async function fetchCatalogMedia(config: CommerceLinkConfig, request: Extract<CommerceCatalogReadRequest, { operation: "media.read" }>, descriptor: CommerceMedia, fetcher: typeof fetch = fetch): Promise<Blob | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    if (request.payload.sha256 !== descriptor.sha256) return null
    const rawBody = commerceCanonicalJson(request)
    if (!rawBody) return null
    const response = await fetcher(new URL(COMMERCE_CATALOG_PATHS[request.operation], config.proHttpOrigin), {
      method: "POST", headers: await catalogReadHeaders(config, request, rawBody), body: rawBody,
      redirect: "error", signal: controller.signal,
    })
    return await limitedMedia(response, descriptor)
  } catch { return null } finally { clearTimeout(timeout) }
}

/** La réponse n'applique rien : seuls les événements signés de l'inbox changent les offres. */
export async function requestCatalogReconciliation(config: CommerceLinkConfig, request: Extract<CommerceCatalogReadRequest, { operation: "reconcile" }>, fetcher: typeof fetch = fetch): Promise<CommerceCatalogReconcileResponse | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const rawBody = commerceCanonicalJson(request)
    if (!rawBody) return null
    const response = await fetcher(new URL(COMMERCE_CATALOG_PATHS.reconcile, config.proHttpOrigin), {
      method: "POST", headers: await catalogReadHeaders(config, request, rawBody), body: rawBody,
      redirect: "error", signal: controller.signal,
    })
    if (response.status !== 200) { await response.body?.cancel().catch(() => undefined); return null }
    const body = await readCommerceLinkResponse(response, 8192)
    if (!body) return null
    const parsed = parseCommerceCatalogReconcileResponse(body, { requestId: request.requestId, requestSha256: await sha256Hex(rawBody) })
    return parsed.ok ? parsed.value : null
  } catch { return null } finally { clearTimeout(timeout) }
}
