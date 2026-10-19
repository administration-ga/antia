/**
 * P14 : transport privé borné vers PRO.GA — octets persistés envoyés tels quels, en-têtes de
 * preuve frais (horodatage, nonce, signature), aucune redirection suivie, aucun cookie, aucune
 * URL fournie par le navigateur. Seules les ACTIONS appellent ce module (entropie, réseau).
 */
import { COMMERCE_COMMAND_LIMITS } from "@antsia/social-domain/commerce/command"
import {
  COMMERCE_SERVICE_CONTROL_MAX_BYTES, COMMERCE_SERVICE_CONTROL_OPERATIONS, COMMERCE_SERVICE_CONTROL_PATHS,
  COMMERCE_SERVICE_CONTROL_RESPONSE_MAX_BYTES, commerceServiceControlSigningInput, type CommerceServiceControlOperation,
} from "@antsia/social-domain/commerce-services"

import type { CommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, commerceLinkHeaders, randomLinkToken, readCommerceLinkResponse, sha256Hex } from "./commerceLinkCrypto"

export type ServiceReply = { status: number; rawResponse: string }
const P06_COMMANDS = ["inquiry.submit", "quote.accept", "booking.request", "request.status"] as const
type P06Command = (typeof P06_COMMANDS)[number]

function bodyField(rawBody: string, field: "command" | "operation"): string | null {
  try {
    const row: unknown = JSON.parse(rawBody)
    if (!row || typeof row !== "object" || !(field in row)) return null
    const value = (row as Record<string, unknown>)[field]
    return typeof value === "string" ? value : null
  } catch { return null }
}

async function post(config: CommerceLinkConfig, path: string, rawBody: string, headers: Record<string, string>, maxBytes: number, fetcher: typeof fetch): Promise<ServiceReply | null> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetcher(new URL(path, config.proHttpOrigin), { method: "POST", headers, body: rawBody, redirect: "error", signal: controller.signal })
    const rawResponse = await readCommerceLinkResponse(response, maxBytes)
    return rawResponse === null ? null : { status: response.status, rawResponse }
  } catch {
    // Aucun corps ni secret journalisé : le résultat reste inconnu et se relit par consultation.
    return null
  } finally { clearTimeout(timer) }
}

/** Commandes P06 de ce lot et leur consultation ; toute autre commande est refusée localement. */
export async function sendServiceCommand(config: CommerceLinkConfig, rawBody: string, fetcher: typeof fetch = fetch): Promise<ServiceReply | null> {
  if (new TextEncoder().encode(rawBody).byteLength > COMMERCE_COMMAND_LIMITS.requestMaxBytes) return null
  const command = bodyField(rawBody, "command")
  if (!command || !(P06_COMMANDS as readonly string[]).includes(command)) return null
  return await post(config, "/commerce/v1/commands", rawBody, await commerceLinkHeaders(config, rawBody, command as P06Command), COMMERCE_COMMAND_LIMITS.responseMaxBytes, fetcher)
}

/** Contrôle jumeau PRO-COMMERCE-SERVICE-CONTROL-V1 : profil de signature propre, chemin fixe par opération. */
export async function sendServiceControl(config: CommerceLinkConfig, rawBody: string, fetcher: typeof fetch = fetch): Promise<ServiceReply | null> {
  if (new TextEncoder().encode(rawBody).byteLength > COMMERCE_SERVICE_CONTROL_MAX_BYTES) return null
  const operation = bodyField(rawBody, "operation")
  if (!operation || !(COMMERCE_SERVICE_CONTROL_OPERATIONS as readonly string[]).includes(operation)) return null
  const issuedAtMs = Date.now(), nonce = randomLinkToken()
  const input = commerceServiceControlSigningInput({
    bodySha256: await sha256Hex(rawBody), environment: config.environment, issuedAtMs, keyId: config.keyId, nonce,
    operation: operation as CommerceServiceControlOperation, source: config.source,
  })
  if (!input) return null
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
  const headers = {
    "Content-Type": "application/json", Accept: "application/json", "X-Pro-Key-Id": config.keyId,
    "X-Pro-Timestamp": String(issuedAtMs), "X-Pro-Nonce": nonce, "X-Pro-Signature": signature,
  }
  return await post(config, COMMERCE_SERVICE_CONTROL_PATHS[operation as CommerceServiceControlOperation], rawBody, headers, COMMERCE_SERVICE_CONTROL_RESPONSE_MAX_BYTES, fetcher)
}
