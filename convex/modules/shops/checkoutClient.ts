/** P11 : transport privé borné, sans cookie ni URL fournie par le navigateur. */
import { COMMERCE_COMMAND_LIMITS, commerceCommandSigningInput, type CommerceOperation } from "@antsia/social-domain/commerce/command"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import {
  COMMERCE_CHECKOUT_CONTROL_MAX_BYTES, COMMERCE_CHECKOUT_CONTROL_PATHS, commerceCheckoutControlSigningInput,
  parseCommerceCheckoutControlResponse, type CommerceCheckoutControlRequest, type CommerceCheckoutControlResponse,
} from "@antsia/social-domain/commerce-checkout"

import type { CommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, randomLinkToken, readCommerceLinkResponse, sha256Hex } from "./commerceLinkCrypto"

async function headers(config: CommerceLinkConfig, rawBody: string, operation: CommerceOperation | CommerceCheckoutControlRequest["operation"], control: boolean): Promise<Record<string, string>> {
  const issuedAtMs = Date.now(), nonce = randomLinkToken()
  const common = { bodySha256: await sha256Hex(rawBody), environment: config.environment, issuedAtMs, keyId: config.keyId, nonce, source: config.source }
  const input = control
    ? commerceCheckoutControlSigningInput({ ...common, operation: operation as CommerceCheckoutControlRequest["operation"] })
    : commerceCommandSigningInput({ ...common, operation: operation as CommerceOperation })
  if (!input) throw new Error("CHECKOUT_SIGNING_UNAVAILABLE")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
  return { "Content-Type": "application/json", Accept: "application/json", "X-Pro-Key-Id": config.keyId,
    "X-Pro-Timestamp": String(issuedAtMs), "X-Pro-Nonce": nonce, "X-Pro-Signature": signature }
}

async function deliver(config: CommerceLinkConfig, rawBody: string, path: string, operation: CommerceOperation | CommerceCheckoutControlRequest["operation"], control: boolean, maxBytes: number, fetcher: typeof fetch): Promise<{ status: number; rawResponse: string } | null> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetcher(new URL(path, config.proHttpOrigin), { method: "POST", headers: await headers(config, rawBody, operation, control), body: rawBody, redirect: "error", signal: controller.signal })
    const rawResponse = await readCommerceLinkResponse(response, maxBytes)
    return rawResponse === null ? null : { status: response.status, rawResponse }
  } catch { return null } finally { clearTimeout(timer) }
}

/** Les octets d'une tentative sont persistés par le workflow ; seuls les en-têtes sont renouvelés. */
export async function sendCheckoutCommand(config: CommerceLinkConfig, rawBody: string, fetcher: typeof fetch = fetch): Promise<{ status: number; rawResponse: string } | null> {
  if (new TextEncoder().encode(rawBody).byteLength > COMMERCE_COMMAND_LIMITS.requestMaxBytes) return null
  let command: "checkout.prepare" | "request.status"
  try {
    const row: unknown = JSON.parse(rawBody)
    if (!row || typeof row !== "object" || !("command" in row) || (row.command !== "checkout.prepare" && row.command !== "request.status")) return null
    command = row.command
  } catch { return null }
  return await deliver(config, rawBody, "/commerce/v1/commands", command, false, COMMERCE_COMMAND_LIMITS.responseMaxBytes, fetcher)
}

/** Aucun résultat n'est accepté avant corrélation requête/empreinte et validation fermée. */
export async function sendCheckoutControl(config: CommerceLinkConfig, request: CommerceCheckoutControlRequest, fetcher: typeof fetch = fetch): Promise<CommerceCheckoutControlResponse | null> {
  const rawBody = commerceCanonicalJson(request)
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > COMMERCE_CHECKOUT_CONTROL_MAX_BYTES) return null
  const reply = await deliver(config, rawBody, COMMERCE_CHECKOUT_CONTROL_PATHS[request.operation], request.operation, true, COMMERCE_CHECKOUT_CONTROL_MAX_BYTES, fetcher)
  if (!reply) return null
  const parsed = parseCommerceCheckoutControlResponse(reply.rawResponse, { request, requestSha256: await sha256Hex(rawBody) })
  if (!parsed.ok || (parsed.value.outcome === "accepted" && reply.status !== 200) ||
    (parsed.value.outcome === "unavailable" && reply.status !== 503 && reply.status !== 429) ||
    (parsed.value.outcome === "refused" && ![400, 403, 404, 409, 422].includes(reply.status))) return null
  return parsed.value
}
