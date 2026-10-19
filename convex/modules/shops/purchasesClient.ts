/** P13 : transport signé fermé, dupliqué du transport privé P12 de ce moteur. */
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_ORDER_CONTROL_MAX_BYTES, COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES, COMMERCE_ORDER_CONTROL_PATHS, commerceOrderControlSigningInput, parseCommerceOrderControlRequest, parseCommerceOrderControlResponse, type CommerceOrderControlResponse } from "@antsia/social-domain/commerce-orders"
import type { CommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, randomLinkToken, readCommerceLinkResponse, sha256Hex } from "./commerceLinkCrypto"

export async function sendPurchaseControl(config: CommerceLinkConfig, rawBody: string, fetcher: typeof fetch = fetch): Promise<CommerceOrderControlResponse | null> {
  if (new TextEncoder().encode(rawBody).byteLength > COMMERCE_ORDER_CONTROL_MAX_BYTES) return null
  const parsed = parseCommerceOrderControlRequest(rawBody, { source: config.source, environment: config.environment, nowMs: Date.now() })
  if (!parsed.ok || commerceCanonicalJson(parsed.value) !== rawBody) return null
  const request = parsed.value, issuedAtMs = Date.now(), nonce = randomLinkToken(), bodySha256 = await sha256Hex(rawBody)
  const signing = commerceOrderControlSigningInput({ bodySha256, environment: config.environment, issuedAtMs, keyId: config.keyId, nonce, operation: request.operation, source: config.source })
  if (!signing) return null
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signature = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signing))))
    const response = await fetcher(new URL(COMMERCE_ORDER_CONTROL_PATHS[request.operation], config.proHttpOrigin), { method: "POST", redirect: "error", credentials: "omit", signal: controller.signal, body: rawBody, headers: { "Content-Type": "application/json", Accept: "application/json", "X-Pro-Key-Id": config.keyId, "X-Pro-Timestamp": String(issuedAtMs), "X-Pro-Nonce": nonce, "X-Pro-Signature": signature } })
    if (response.redirected || response.status >= 300 && response.status < 400) return null
    const rawResponse = await readCommerceLinkResponse(response, COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES)
    const reply = rawResponse ? parseCommerceOrderControlResponse(rawResponse, { request, requestSha256: bodySha256, nowMs: Date.now() }) : null
    if (!reply?.ok || reply.value.outcome === "accepted" && response.status !== 200 || reply.value.outcome === "unavailable" && ![429, 503].includes(response.status) || reply.value.outcome === "refused" && ![400, 403, 404, 409, 422].includes(response.status)) return null
    return reply.value
  } catch { return null } finally { clearTimeout(timer) }
}
