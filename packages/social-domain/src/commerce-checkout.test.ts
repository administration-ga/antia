import { describe, expect, it } from "vitest"
import { commerceCanonicalJson } from "./commerce/primitives"
import {
  COMMERCE_CHECKOUT_CONTROL_CONTRACT, commerceCheckoutControlSigningInput,
  parseCommerceCheckoutControlRequest, parseCommerceCheckoutControlResponse,
  type CommerceCheckoutControlRequest,
} from "./commerce-checkout"

const nowMs = 1_800_000_000_000
const context = { source: "antsia", environment: "sandbox" as const, nowMs }
const request: CommerceCheckoutControlRequest = {
  contract: COMMERCE_CHECKOUT_CONTROL_CONTRACT, version: 1, operation: "options", source: "antsia", environment: "sandbox",
  requestId: "checkout-00000001", shopRef: "pro.ga:structure:01JA00000000000000000000F1",
  subject: { kind: "buyer", ref: "antsia:sub:0123456789abcdef0123456789abcdef", authVerifiedAt: nowMs },
  issuedAt: nowMs, expiresAt: nowMs + 60_000, payload: {},
}
const body = (input: unknown) => commerceCanonicalJson(input)!
const digest = "a".repeat(64)
const checkoutRef = "pro.ga:checkout:01JA00000000000000000000F2"

describe("P11 private checkout control", () => {
  it("accepts options and buyer-bound release, refuses foreign authority and expired proof", () => {
    expect(parseCommerceCheckoutControlRequest(body(request), context).ok).toBe(true)
    expect(parseCommerceCheckoutControlRequest(body({ ...request, operation: "release", payload: { checkoutRef } }), context).ok).toBe(true)
    for (const value of [
      { ...request, tenantId: "foreign" }, { ...request, source: "foreign" }, { ...request, environment: "production" },
      { ...request, expiresAt: nowMs }, { ...request, expiresAt: nowMs + 60_001 },
      { ...request, subject: { ...request.subject, authVerifiedAt: nowMs - 300_001 } },
      { ...request, payload: { url: "https://example.invalid" } },
    ]) expect(parseCommerceCheckoutControlRequest(body(value), context).ok).toBe(false)
    const raw = body(request)
    expect(parseCommerceCheckoutControlRequest(`{"source":"other",${raw.slice(1)}`, context).ok).toBe(false)
  })
  it("does not accept an uncorrelated price/options response or invalid XAF", () => {
    const response = { contract: request.contract, version: 1, requestId: request.requestId, requestSha256: digest, outcome: "accepted",
      result: { shopRef: request.shopRef, policyVersion: 1, pickup: [{ establishmentRef: "pro.ga:establishment:01JA00000000000000000000F3", label: "Centre" }],
        fees: [{ kind: "service", label: "Service", amount: { amount: 100, currency: "XAF" } }], sellerDelivery: null } }
    const correlation = { request, requestSha256: digest }
    expect(parseCommerceCheckoutControlResponse(body(response), correlation).ok).toBe(true)
    for (const changed of [
      { ...response, requestSha256: "b".repeat(64) },
      { ...response, result: { ...response.result, shopRef: "pro.ga:structure:01JA00000000000000000000F4" } },
      { ...response, result: { ...response.result, fees: [{ kind: "service", label: "Service", amount: { amount: 0.5, currency: "XAF" } }] } },
      { ...response, result: { ...response.result, tenantId: "private" } },
    ]) expect(parseCommerceCheckoutControlResponse(body(changed), correlation).ok).toBe(false)
  })
  it("requires a terminal release and the exact checkout reference", () => {
    const release: CommerceCheckoutControlRequest = { ...request, operation: "release", payload: { checkoutRef } }
    const response = { contract: request.contract, version: 1, requestId: request.requestId, requestSha256: digest, outcome: "accepted",
      result: { checkoutRef, state: "released", revision: 2, expiresAt: nowMs + 900_000, confirmationRequired: false } }
    const correlation = { request: release, requestSha256: digest }
    expect(parseCommerceCheckoutControlResponse(body(response), correlation).ok).toBe(true)
    expect(parseCommerceCheckoutControlResponse(body({ ...response, result: { ...response.result, state: "held" } }), correlation).ok).toBe(false)
    expect(parseCommerceCheckoutControlResponse(body({ ...response, result: { ...response.result, checkoutRef: "pro.ga:checkout:01JA00000000000000000000F4" } }), correlation).ok).toBe(false)
  })
  it("separates release signatures from options, environment and command profiles", () => {
    const input = { source: "antsia", environment: "sandbox" as const, issuedAtMs: nowMs, bodySha256: digest,
      keyId: "antsia-key-01", nonce: "n".repeat(43), operation: "options" as const }
    const signature = commerceCheckoutControlSigningInput(input)
    expect(signature).toContain("pro-ga-commerce-checkout-control-hmac/v1")
    expect(signature).not.toBe(commerceCheckoutControlSigningInput({ ...input, operation: "release" }))
    expect(signature).not.toBe(commerceCheckoutControlSigningInput({ ...input, environment: "production" }))
    expect(commerceCheckoutControlSigningInput({ ...input, nonce: "short" })).toBeNull()
  })
})
