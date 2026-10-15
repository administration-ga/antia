// Dupliqué de socle/convex/modules/fileGuard/policy.test.ts @ ad2e7fdc2 — adaptations : interrupteurs d'exploitation seulement (la servabilité est testée dans `@antia/social-domain`) ; le coupe-circuit SUSPEND au lieu d'ouvrir ; triage IA retiré.
import { describe, expect, it } from "vitest"

import { FILE_GUARD_QUARANTINE_RETENTION_DAYS_DEFAULT, isKillSwitched, quarantineRetentionDays } from "./policy"

describe("files/policy — interrupteurs d'exploitation", () => {
  it("FILE_GUARD est actif par défaut et ne se suspend que par `off`", () => {
    expect(isKillSwitched({})).toBe(false)
    expect(isKillSwitched({ FILE_GUARD: "on" })).toBe(false)
    expect(isKillSwitched({ FILE_GUARD: "false" })).toBe(false)
    expect(isKillSwitched({ FILE_GUARD: "off" })).toBe(true)
    expect(isKillSwitched({ FILE_GUARD: " OFF " })).toBe(true)
  })

  it("la rétention de quarantaine a un défaut et refuse l'absurde", () => {
    expect(quarantineRetentionDays({})).toBe(FILE_GUARD_QUARANTINE_RETENTION_DAYS_DEFAULT)
    expect(quarantineRetentionDays({ FILE_GUARD_QUARANTINE_RETENTION_DAYS: "30" })).toBe(30)
    expect(quarantineRetentionDays({ FILE_GUARD_QUARANTINE_RETENTION_DAYS: "0" })).toBe(FILE_GUARD_QUARANTINE_RETENTION_DAYS_DEFAULT)
    expect(quarantineRetentionDays({ FILE_GUARD_QUARANTINE_RETENTION_DAYS: "abc" })).toBe(FILE_GUARD_QUARANTINE_RETENTION_DAYS_DEFAULT)
  })
})
