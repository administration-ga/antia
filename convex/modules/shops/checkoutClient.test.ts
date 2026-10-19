import { describe, expect, it } from "vitest"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_CHECKOUT_CONTROL_CONTRACT, type CommerceCheckoutControlRequest } from "@antsia/social-domain/commerce-checkout"
import { sendCheckoutCommand, sendCheckoutControl } from "./checkoutClient"
import { sha256Hex } from "./commerceLinkCrypto"
import type { CommerceLinkConfig } from "./commerceLinkConfig"

const config: CommerceLinkConfig = {
  source: "antsia", environment: "sandbox", proHttpOrigin: "https://pro.invalid", proAppOrigin: "https://app.invalid",
  antsiaOrigin: "https://antsia.invalid", redirectUri: "https://antsia.invalid/retour", keyId: "fixture-key-0001",
  signingKey: "fixture-only-private-key-for-checkout-not-a-credential", fingerprint: "fixture-fingerprint",
}

describe("P11 private checkout client (mock transport only)", () => {
  it("resends the exact persisted command bytes with fresh proof and a fixed configured origin", async () => {
    const bodies: string[] = [], headers: Headers[] = []
    const raw = commerceCanonicalJson({ command: "checkout.prepare", requestId: "intent-0000001", payload: { note: "Texte privé" } })!
    const fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toBe("https://pro.invalid/commerce/v1/commands")
      expect(init?.redirect).toBe("error")
      expect(init?.credentials).toBeUndefined()
      bodies.push(String(init?.body)); headers.push(new Headers(init?.headers))
      return new Response("{}", { status: 503 })
    }
    await sendCheckoutCommand(config, raw, fetcher)
    await sendCheckoutCommand(config, raw, fetcher)
    expect(bodies).toEqual([raw, raw])
    expect(headers[0]?.get("X-Pro-Nonce")).not.toBe(headers[1]?.get("X-Pro-Nonce"))
    expect(headers[0]?.get("X-Pro-Signature")).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(headers[0]?.get("Cookie")).toBeNull()
  })
  it("does not send oversized bodies or reserved payment commands", async () => {
    let called = false
    const fetcher: typeof fetch = async () => { called = true; return new Response("{}") }
    expect(await sendCheckoutCommand(config, "x".repeat(65537), fetcher)).toBeNull()
    expect(await sendCheckoutCommand(config, '{"command":"payment.start"}', fetcher)).toBeNull()
    expect(called).toBe(false)
  })
  it("accepts a correlated release only on matching status and discards forged responses", async () => {
    const now = Date.now()
    const request: CommerceCheckoutControlRequest = { contract: COMMERCE_CHECKOUT_CONTROL_CONTRACT, version: 1, operation: "release",
      source: "antsia", environment: "sandbox", requestId: "control-00000001", issuedAt: now, expiresAt: now + 60_000,
      shopRef: "pro.ga:structure:01JA00000000000000000000F1", subject: { kind: "buyer", ref: "antsia:sub:0123456789abcdef0123456789abcdef", authVerifiedAt: now },
      payload: { checkoutRef: "pro.ga:checkout:01JA00000000000000000000F2" } }
    const digest = await sha256Hex(commerceCanonicalJson(request)!)
    const response = { contract: request.contract, version: 1, requestId: request.requestId, requestSha256: digest, outcome: "accepted",
      result: { checkoutRef: request.payload.checkoutRef, state: "released", revision: 2, expiresAt: now + 900_000, confirmationRequired: false } }
    expect((await sendCheckoutControl(config, request, async () => new Response(commerceCanonicalJson(response)!, { status: 200 })))?.outcome).toBe("accepted")
    expect(await sendCheckoutControl(config, request, async () => new Response(commerceCanonicalJson(response)!, { status: 503 }))).toBeNull()
    expect(await sendCheckoutControl(config, request, async () => new Response(commerceCanonicalJson({ ...response, requestSha256: "b".repeat(64) })!, { status: 200 }))).toBeNull()
  })
})
