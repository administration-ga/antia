import { describe, expect, it } from "vitest"
import { commerceCanonicalJson } from "./commerce/primitives"
import {
  COMMERCE_CATALOG_READ_CONTRACT, commerceCatalogSigningInput,
  parseCommerceCatalogReadRequest, parseCommerceCatalogReconcileResponse,
} from "./commerce-catalogue"

const nowMs = 1_800_000_000_000
const context = { source: "antsia", environment: "sandbox" as const, nowMs }
const request = {
  contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, operation: "reconcile", source: "antsia", environment: "sandbox",
  requestId: "catalog-00000001", subjectRef: "antsia:sub:0123456789abcdef0123456789abcdef",
  shopRef: "pro.ga:structure:01JA00000000000000000000F1", linkRef: "pro.ga:commerce_link:01JA00000000000000000000F2",
  issuedAt: nowMs, expiresAt: nowMs + 60_000, payload: { cursor: null },
}
const body = (input: unknown) => commerceCanonicalJson(input)!

describe("P09 private catalogue protocol (source scenarios, not an execution receipt)", () => {
  it("accepts a closed, canonical bounded reconciliation and media request", () => {
    expect(parseCommerceCatalogReadRequest(body(request), context).ok).toBe(true)
    expect(parseCommerceCatalogReadRequest(body({ ...request, operation: "media.read", payload: {
      offerRef: "pro.ga:offer:01JA00000000000000000000F3", revision: 2, sha256: "a".repeat(64),
    } }), context).ok).toBe(true)
  })
  it("refuses a tenant, an arbitrary URL, unknown fields and duplicate JSON keys", () => {
    for (const altered of [{ ...request, tenantId: "foreign" }, { ...request, payload: { cursor: null, url: "https://example.invalid" } }]) {
      expect(parseCommerceCatalogReadRequest(body(altered), context).ok).toBe(false)
    }
    const raw = body(request)
    expect(parseCommerceCatalogReadRequest(`{"source":"other",${raw.slice(1)}`, context).ok).toBe(false)
  })
  it("does not cross a source, environment, expired window or extended TTL", () => {
    for (const altered of [{ ...request, source: "other" }, { ...request, environment: "production" },
      { ...request, expiresAt: nowMs }, { ...request, expiresAt: nowMs + 60_001 }]) {
      expect(parseCommerceCatalogReadRequest(body(altered), context).ok).toBe(false)
    }
  })
  it("correlates a response and caps the replay batch independently of applied", () => {
    const response = { contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, requestId: request.requestId,
      requestSha256: "a".repeat(64), outcome: "accepted", cursor: null, done: true, queued: 20 }
    const correlation = { requestId: request.requestId, requestSha256: "a".repeat(64) }
    expect(parseCommerceCatalogReconcileResponse(body(response), correlation).ok).toBe(true)
    for (const changed of [{ ...response, queued: 21 }, { ...response, requestSha256: "b".repeat(64) },
      { ...response, cursor: "next" }, { ...response, applied: true }]) {
      expect(parseCommerceCatalogReconcileResponse(body(changed), correlation).ok).toBe(false)
    }
  })
  it("binds signature to operation, body, source and environment using a separate profile", () => {
    const signing = { bodySha256: "a".repeat(64), environment: "sandbox" as const, issuedAtMs: nowMs,
      keyId: "antsia-key-01", nonce: "a".repeat(43), source: "antsia", operation: "reconcile" as const }
    const signature = commerceCatalogSigningInput(signing)
    expect(signature).toContain("pro-ga-commerce-catalog-read-hmac/v1")
    expect(signature).not.toBe(commerceCatalogSigningInput({ ...signing, operation: "media.read" }))
    expect(signature).not.toBe(commerceCatalogSigningInput({ ...signing, environment: "production" }))
    expect(signature).not.toBe(commerceCatalogSigningInput({ ...signing, bodySha256: "b".repeat(64) }))
    expect(commerceCatalogSigningInput({ ...signing, nonce: "short" })).toBeNull()
  })
})
