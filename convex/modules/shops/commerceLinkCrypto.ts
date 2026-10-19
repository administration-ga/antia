/** P08 : entropie dans les actions uniquement ; SHA/HMAC déterministes côté mutations. */
import { commerceCommandSigningInput, type CommerceOperation } from "@antsia/social-domain/commerce/command"

import type { CommerceLinkConfig } from "./commerceLinkConfig"

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

export function base64url(bytes: Uint8Array): string {
  let result = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const word = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    result += BASE64URL[(word >>> 18) & 63]! + BASE64URL[(word >>> 12) & 63]!
    if (i + 1 < bytes.length) result += BASE64URL[(word >>> 6) & 63]!
    if (i + 2 < bytes.length) result += BASE64URL[word & 63]!
  }
  return result
}

/** Appelé dans une ACTION, jamais dans une mutation Convex. */
export function randomLinkToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

/** Références opaques indépendantes des identifiants/contacts privés. ACTION uniquement. */
export function randomLinkId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function s256Challenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))
}

export function validLinkToken(value: string): boolean {
  return value.length >= 32 && value.length <= 128 && !/[^A-Za-z0-9_-]/u.test(value)
}

/** Les octets persistés sont inchangés ; seuls nonce et horodatage de transport sont frais. */
export async function commerceLinkHeaders(config: CommerceLinkConfig, rawBody: string, operation: CommerceOperation = "link.confirm"): Promise<Record<string, string>> {
  const issuedAtMs = Date.now()
  const nonce = randomLinkToken()
  const input = commerceCommandSigningInput({
    bodySha256: await sha256Hex(rawBody), environment: config.environment,
    issuedAtMs, keyId: config.keyId, nonce, operation, source: config.source,
  })
  if (input === null) throw new Error("Invalid commerce signing configuration")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
  return {
    "Content-Type": "application/json", Accept: "application/json",
    "X-Pro-Key-Id": config.keyId, "X-Pro-Timestamp": String(issuedAtMs),
    "X-Pro-Nonce": nonce, "X-Pro-Signature": signature,
  }
}

/** Limite les octets réellement lus, y compris sans Content-Length. */
export async function readCommerceLinkResponse(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  let size = 0, result = ""
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) { await reader.cancel(); return null }
      result += decoder.decode(chunk.value, { stream: true })
    }
    return result + decoder.decode()
  } catch {
    await reader.cancel().catch(() => undefined)
    return null
  } finally {
    reader.releaseLock()
  }
}
