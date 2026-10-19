import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_CATALOG_READ_CONTRACT, type CommerceCatalogReadRequest } from "@antsia/social-domain/commerce-catalogue"
import { describe, expect, it } from "vitest"

import type { CommerceLinkConfig } from "../shops/commerceLinkConfig"
import { sha256Hex } from "../shops/commerceLinkCrypto"
import { catalogMediaSignatureMatches, fetchCatalogMedia, requestCatalogReconciliation } from "./commerceCatalogClient"

const config: CommerceLinkConfig = {
  source: "antsia", environment: "sandbox", proHttpOrigin: "http://127.0.0.1:3221", proAppOrigin: "http://127.0.0.1:3033",
  antsiaOrigin: "http://127.0.0.1:3030", redirectUri: "http://127.0.0.1:3030/mes-boutiques/liaison/retour",
  keyId: "catalogue-test-key", signingKey: Array.from({ length: 40 }, () => "x").join(""), fingerprint: "fixture",
}
const base = (): Omit<CommerceCatalogReadRequest, "operation" | "payload"> => ({
  contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1 as const, source: "antsia", environment: "sandbox" as const,
  requestId: "catalogue-fixture-0001", subjectRef: "antsia:sub:0123456789abcdef0123456789abcdef",
  shopRef: "pro.ga:structure:01JA00000000000000000000F1", linkRef: "pro.ga:commerce_link:01JA00000000000000000000F2",
  issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
})
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
async function fixture() {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", png))
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
  const request: Extract<CommerceCatalogReadRequest, { operation: "media.read" }> = { ...base(), operation: "media.read",
    payload: { offerRef: "pro.ga:offer:01JA00000000000000000000F3", revision: 1, sha256 } }
  return { request, descriptor: { byteSize: png.length, mimeType: "image/png" as const, sha256 }, headers: {
    "Content-Type": "image/png", "Content-Length": String(png.length), "X-Content-SHA256": sha256,
  } }
}

describe("P09 catalogue fixed-origin client", () => {
  it("accepts only expected image signatures", () => {
    expect(catalogMediaSignatureMatches(png, "image/png")).toBe(true)
    expect(catalogMediaSignatureMatches(new TextEncoder().encode("<svg/>"), "image/png")).toBe(false)
    expect(catalogMediaSignatureMatches(png, "image/jpeg")).toBe(false)
  })
  it("downloads admitted bytes from the fixed configured endpoint without following redirects", async () => {
    const item = await fixture()
    let asked: string | null = null
    let redirect: RequestRedirect | undefined
    const fetcher: typeof fetch = async (input, init) => {
      asked = String(input); redirect = init?.redirect
      expect(new Headers(init?.headers).get("X-Pro-Signature")).toMatch(/^[A-Za-z0-9_-]{43}$/)
      return new Response(png, { headers: item.headers })
    }
    const blob = await fetchCatalogMedia(config, item.request, item.descriptor, fetcher)
    expect(blob?.size).toBe(png.length)
    expect(asked).toBe(`${config.proHttpOrigin}/commerce/v1/catalogue/media`)
    expect(redirect).toBe("error")
  })
  it("withholds bad MIME, missing length, a changed body and retired media", async () => {
    const item = await fixture()
    const responses = [
      new Response(png, { headers: { ...item.headers, "Content-Type": "image/svg+xml" } }),
      new Response(png, { headers: { "Content-Type": "image/png", "X-Content-SHA256": item.descriptor.sha256 } }),
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 11]), { headers: item.headers }),
      new Response(null, { status: 404 }),
      new Response(png, { headers: { ...item.headers, "Content-Encoding": "gzip" } }),
    ]
    for (const response of responses) expect(await fetchCatalogMedia(config, item.request, item.descriptor, async () => response)).toBeNull()
  })
  it("never counts an inbox application from a reconciliation response", async () => {
    const request: Extract<CommerceCatalogReadRequest, { operation: "reconcile" }> = { ...base(), operation: "reconcile", payload: { cursor: null } }
    const reply = { contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, requestId: request.requestId,
      requestSha256: await sha256Hex(commerceCanonicalJson(request)!), outcome: "accepted", cursor: null, done: true, queued: 2 }
    const response = await requestCatalogReconciliation(config, request, async () => new Response(commerceCanonicalJson(reply)))
    expect(response?.queued).toBe(2)
    expect(response).not.toHaveProperty("applied")
    expect(await requestCatalogReconciliation(config, request, async () => new Response(commerceCanonicalJson({ ...reply, requestSha256: "0".repeat(64) })))).toBeNull()
  })
})
