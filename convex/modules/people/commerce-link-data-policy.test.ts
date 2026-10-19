import { describe, expect, it } from "vitest"

import { directlyOwned, exportableRecord, type DataRecord } from "./dataInventory"

const proof: DataRecord = {
  _id: "challenge_1", _creationTime: 1, networkId: "network_1", shopId: "shop_1", personId: "person_1",
  status: "pending", phase: "confirming", permissions: ["publish_catalog"], consentTextVersion: "2026-10-18", consentedAt: 1, expiresAt: 300_001,
  sessionDigest: "session-proof", stateDigest: "state-proof", codeDigest: "code-proof", configFingerprint: "config-proof",
  codeVerifier: "private-verifier", preparationBody: "private-preparation", authorizationUrl: "private-authorization", attemptToken: "private-incarnation", rawBody: "private-command", updatedAt: 2,
}

describe("P08 — export et propriété des preuves de liaison", () => {
  it("exporte les seuls consentement et état du défi, jamais ses preuves de possession", () => {
    const exported = exportableRecord("shopCommerceLinkChallenges", proof, "person_1")
    expect(exported).toMatchObject({ personId: "person_1", shopId: "shop_1", status: "pending", phase: "confirming", permissions: ["publish_catalog"], consentTextVersion: "2026-10-18" })
    for (const key of ["sessionDigest", "stateDigest", "codeDigest", "configFingerprint", "codeVerifier", "preparationBody", "authorizationUrl", "attemptToken", "rawBody"]) expect(exported).not.toHaveProperty(key)
    expect(exportableRecord("shopCommerceLinkChallenges", proof, "person_other")).toBeNull()
  })
  it("les commandes privées et sujets opaques ne sortent pas dans un export personnel", () => {
    for (const table of ["shopCommerceLinkCommands", "shopCommerceSubjects", "shopCommerceShopRefs"]) expect(exportableRecord(table, proof, "person_1")).toBeNull()
  })
  it("la preuve et la liaison sont effacées avec leur consentant, pas avec un tiers", () => {
    for (const table of ["shopCommerceLinks", "shopCommerceLinkChallenges", "shopCommerceLinkCommands", "shopCommerceSubjects"]) {
      expect(directlyOwned(table, proof, "person_1")).toBe(true)
      expect(directlyOwned(table, proof, "person_other")).toBe(false)
    }
  })
  it("la référence stable de boutique ne devient pas propriété du dernier consentant", () => {
    expect(directlyOwned("shopCommerceShopRefs", { _id: "ref_1", _creationTime: 1, networkId: "network_1", shopId: "shop_1" }, "person_1")).toBe(false)
  })
  it("le consentant retrouve son lien et ses scopes, sans l'identifiant de session ni le sujet machine", () => {
    const row = { ...proof, state: "active", subjectRef: "antsia:sub:opaque", antsiaShopRef: "antsia:shop:opaque", shopRef: "pro.ga:structure:opaque", linkRef: "pro.ga:commerce_link:opaque", source: "antsia", environment: "sandbox" }
    const exported = exportableRecord("shopCommerceLinks", row, "person_1")
    expect(exported).toMatchObject({ state: "active", shopRef: row.shopRef, linkRef: row.linkRef, permissions: ["publish_catalog"] })
    expect(exported).not.toHaveProperty("subjectRef")
    expect(exported).not.toHaveProperty("sessionDigest")
    expect(exportableRecord("shopCommerceLinks", row, "person_other")).toBeNull()
  })
})
