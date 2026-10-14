import { describe, expect, it } from "vitest"

import { CONSENT_TEXT_VERSIONS, isConsentInForce, missingConsentsToJoin } from "./consent"

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
})
