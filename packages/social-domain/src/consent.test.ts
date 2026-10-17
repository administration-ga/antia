import { describe, expect, it } from "vitest"

import { CONSENT_PURPOSES, CONSENT_TEXT_VERSIONS, isConsentInForce, missingConsentsToJoin } from "./consent"

const current = CONSENT_TEXT_VERSIONS.social_profile

describe("consentements", () => {
  it("en vigueur : accordé, non révoqué, sur le texte courant", () => {
    expect(isConsentInForce([{ purpose: "social_profile", textVersion: current }], "social_profile")).toBe(true)
    expect(isConsentInForce([{ purpose: "social_profile", textVersion: current, revokedAt: 1 }], "social_profile")).toBe(false)
    expect(isConsentInForce([{ purpose: "social_profile", textVersion: "2000-01-01" }], "social_profile")).toBe(false)
    expect(isConsentInForce([{ purpose: "directory", textVersion: CONSENT_TEXT_VERSIONS.directory }], "social_profile")).toBe(false)
  })

  it("entrer dans un réseau exige le consentement au profil social", () => {
    expect(missingConsentsToJoin([])).toEqual(["social_profile"])
    expect(missingConsentsToJoin([{ purpose: "social_profile", textVersion: current }])).toEqual([])
  })

  it("les statistiques d’usage ont leur version propre et restent facultatives", () => {
    expect(CONSENT_PURPOSES).toContain("usage_analytics")
    expect(CONSENT_TEXT_VERSIONS.usage_analytics).toBe("2026-10-17")
    expect(missingConsentsToJoin([{ purpose: "social_profile", textVersion: current }])).toEqual([])
    expect(missingConsentsToJoin([{ purpose: "usage_analytics", textVersion: "2026-10-17" }])).toEqual(["social_profile"])
  })

  it("une version ancienne ou révoquée n’autorise pas les statistiques d’usage", () => {
    expect(isConsentInForce([{ purpose: "usage_analytics", textVersion: "2026-10-17" }], "usage_analytics")).toBe(true)
    expect(isConsentInForce([{ purpose: "usage_analytics", textVersion: "2026-10-14" }], "usage_analytics")).toBe(false)
    expect(isConsentInForce([{ purpose: "usage_analytics", textVersion: "2026-10-17", revokedAt: 1 }], "usage_analytics")).toBe(false)
  })
})
