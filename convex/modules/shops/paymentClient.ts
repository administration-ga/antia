/** P12 : transport paiement privé borné, sans cookie ni origine fournie par le navigateur. */
import { COMMERCE_COMMAND_LIMITS, commerceCommandSigningInput } from "@antsia/social-domain/commerce/command"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import {
  COMMERCE_PAYMENT_CONTROL_MAX_BYTES, COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES, COMMERCE_PAYMENT_CONTROL_PATHS,
  commercePaymentControlSigningInput, parseCommercePaymentControlRequest, parseCommercePaymentControlResponse,
  type CommercePaymentControlRequest, type CommercePaymentControlResponse,
} from "@antsia/social-domain/commerce-payment"

import type { CommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, randomLinkToken, readCommerceLinkResponse, sha256Hex } from "./commerceLinkCrypto"

type PaymentCommand = "payment.start" | "request.status"
type Delivery = { status: number; rawResponse: string }
type SigningOperation = { kind: "command"; operation: PaymentCommand } | { kind: "control"; operation: CommercePaymentControlRequest["operation"] }

async function headers(config: CommerceLinkConfig, rawBody: string, signing: SigningOperation): Promise<Record<string, string>> {
  const issuedAtMs = Date.now(), nonce = randomLinkToken()
  const common = { bodySha256: await sha256Hex(rawBody), environment: config.environment, issuedAtMs, keyId: config.keyId, nonce, source: config.source }
  const input = signing.kind === "command"
    ? commerceCommandSigningInput({ ...common, operation: signing.operation })
    : commercePaymentControlSigningInput({ ...common, operation: signing.operation })
  if (!input) throw new Error("PAYMENT_SIGNING_UNAVAILABLE")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
  return { "Content-Type": "application/json", Accept: "application/json", "X-Pro-Key-Id": config.keyId,
    "X-Pro-Timestamp": String(issuedAtMs), "X-Pro-Nonce": nonce, "X-Pro-Signature": signature }
}

async function deliver(config: CommerceLinkConfig, rawBody: string, path: string, signing: SigningOperation, maxBytes: number, fetcher: typeof fetch): Promise<Delivery | null> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetcher(new URL(path, config.proHttpOrigin), { method: "POST", headers: await headers(config, rawBody, signing), body: rawBody,
      redirect: "error", credentials: "omit", signal: controller.signal })
    if (response.redirected || response.status >= 300 && response.status < 400) return null
    const rawResponse = await readCommerceLinkResponse(response, maxBytes)
    return rawResponse === null ? null : { status: response.status, rawResponse }
  } catch { return null } finally { clearTimeout(timer) }
}

/** Les octets persistés ne changent pas lors d'une reprise ; seule la preuve de transport est renouvelée. */
export async function sendPaymentCommand(config: CommerceLinkConfig, rawBody: string, fetcher: typeof fetch = fetch): Promise<Delivery | null> {
  if (new TextEncoder().encode(rawBody).byteLength > COMMERCE_COMMAND_LIMITS.requestMaxBytes) return null
  let command: PaymentCommand
  try {
    const row: unknown = JSON.parse(rawBody)
    if (!row || typeof row !== "object" || !("command" in row) || (row.command !== "payment.start" && row.command !== "request.status")) return null
    command = row.command
  } catch { return null }
  return deliver(config, rawBody, "/commerce/v1/commands", { kind: "command", operation: command }, COMMERCE_COMMAND_LIMITS.responseMaxBytes, fetcher)
}

/** La réponse est acceptée après validation fermée, corrélation des octets et concordance du statut HTTP. */
export async function sendPaymentControl(config: CommerceLinkConfig, request: CommercePaymentControlRequest, fetcher: typeof fetch = fetch): Promise<CommercePaymentControlResponse | null> {
  const rawBody = commerceCanonicalJson(request)
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > COMMERCE_PAYMENT_CONTROL_MAX_BYTES ||
    !parseCommercePaymentControlRequest(rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() }).ok) return null
  const reply = await deliver(config, rawBody, COMMERCE_PAYMENT_CONTROL_PATHS[request.operation], { kind: "control", operation: request.operation }, COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES, fetcher)
  if (!reply) return null
  const parsed = parseCommercePaymentControlResponse(reply.rawResponse, { request, requestSha256: await sha256Hex(rawBody), nowMs: Date.now() })
  if (!parsed.ok || (parsed.value.outcome === "accepted" && reply.status !== 200) ||
    (parsed.value.outcome === "unavailable" && reply.status !== 503 && reply.status !== 429) ||
    (parsed.value.outcome === "refused" && ![400, 403, 404, 409, 422].includes(reply.status))) return null
  return parsed.value
}
