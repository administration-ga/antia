import { describe, expect, it } from "vitest"

import { contentNeedsReview, isSanctionLive, normalizeBlockedTerm, validSanctionDuration } from "./moderationPolicy"

describe("modération PA5 — règles pures", () => {
  it("normalise sans accents et sans ambiguïté de casse", () => {
    expect(normalizeBlockedTerm("  MENÁCE   Répétée ")).toBe("menace repetee")
  })
  it("borne toutes les sanctions temporaires et réserve l'infini à l'exclusion", () => {
    for (const kind of ["mute", "suspension"] as const) {
      expect(validSanctionDuration(kind, undefined, 10)).toBe(false)
      expect(validSanctionDuration(kind, 9, 10)).toBe(false)
      expect(validSanctionDuration(kind, 100, 10)).toBe(true)
      expect(validSanctionDuration(kind, Infinity, 10)).toBe(false)
    }
    expect(validSanctionDuration("exclusion", undefined, 10)).toBe(true)
    expect(validSanctionDuration("exclusion", 100, 10)).toBe(false)
    expect(validSanctionDuration("warning", undefined, 10)).toBe(true)
    expect(validSanctionDuration("removal", undefined, 10)).toBe(true)
  })
  it("une échéance est interprétée même avant le cron", () => {
    expect(isSanctionLive({ status: "active", until: 20 }, 20)).toBe(false)
    expect(isSanctionLive({ status: "revoked" }, 10)).toBe(false)
    expect(isSanctionLive({ status: "active" }, 10)).toBe(true)
  })
  it("la relecture cumule politique, terme, liens et fréquence", () => {
    const base = { text: "Bonjour", preReview: false, blockedTerms: [], maxLinks: 2, recentWrites: 0, maxWrites: 10 }
    expect(contentNeedsReview(base)).toBe(false)
    expect(contentNeedsReview({ ...base, preReview: true })).toBe(true)
    expect(contentNeedsReview({ ...base, text: "MENÁCE", blockedTerms: ["menace"] })).toBe(true)
    expect(contentNeedsReview({ ...base, text: "www.a www.b www.c" })).toBe(true)
    expect(contentNeedsReview({ ...base, recentWrites: 10 })).toBe(true)
  })
})
