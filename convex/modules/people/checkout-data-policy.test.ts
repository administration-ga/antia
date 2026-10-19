import { describe, expect, it } from "vitest"
import { directlyOwned, exportableRecord, type DataRecord } from "./dataInventory"

const row: DataRecord = {
  _id: "attempt_1", _creationTime: 1, networkId: "network_1", personId: "buyer_1", shopId: "shop_1",
  attemptId: "attempt-00000001", state: "unknown", expectedLines: [], expectedFees: [], expectedPolicyVersion: 1,
  consentedAt: 1, consentTextVersion: "2026-10-18", rawBody: '{"address":"private"}', sessionDigest: "proof",
  subjectRef: "opaque-buyer", bodySha256: "digest", leaseToken: "private-lease", configFingerprint: "config",
}

describe("P11 personal checkout data", () => {
  it("exports only the buyer summary and consent, never signed bodies or binding proofs", () => {
    const output = exportableRecord("checkoutAttempts", row, "buyer_1")
    expect(output).toMatchObject({ attemptId: row.attemptId, state: "unknown", expectedFees: [], consentTextVersion: row.consentTextVersion })
    for (const key of ["rawBody", "sessionDigest", "subjectRef", "bodySha256", "leaseToken", "configFingerprint"])
      expect(output).not.toHaveProperty(key)
    expect(exportableRecord("checkoutAttempts", row, "other")).toBeNull()
    expect(exportableRecord("checkoutRequests", row, "buyer_1")).toBeNull()
  })
  it("erases attempts and private requests with their buyer, without owning network policy", () => {
    for (const table of ["checkoutAttempts", "checkoutRequests"]) {
      expect(directlyOwned(table, row, "buyer_1")).toBe(true)
      expect(directlyOwned(table, row, "other")).toBe(false)
    }
    expect(directlyOwned("shopCheckoutPolicies", row, "buyer_1")).toBe(false)
  })
})
