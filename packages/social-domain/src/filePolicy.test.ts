// Dupliqué de socle/convex/modules/fileGuard/policy.test.ts @ ad2e7fdc2 — adaptations : cas fail-open INVERSÉS (aucune ligne = retenu) ; libellés retirés ; interrupteurs d'environnement testés côté backend.
import { describe, expect, it } from "vitest"

import { isReleasableStatus, isServableStatus, serviceStateOf } from "./filePolicy"

describe("filePolicy — servabilité (fail-closed)", () => {
  it("un fichier sans ligne d'analyse est RETENU, comme une analyse en cours", () => {
    expect(isServableStatus(null)).toBe(false)
    expect(isServableStatus(undefined)).toBe(false)
    expect(serviceStateOf(null)).toBe("pending")
    expect(serviceStateOf(undefined)).toBe("pending")
  })

  it("une analyse en cours bloque l'URL sans condamner le fichier", () => {
    for (const status of ["pending", "running"] as const) {
      expect(isServableStatus(status)).toBe(false)
      expect(serviceStateOf(status)).toBe("pending")
    }
  })

  it("sain et sauté sont servables ; suspect, infecté et en échec sont bloqués", () => {
    expect(isServableStatus("clean")).toBe(true)
    expect(isServableStatus("skipped")).toBe(true)
    for (const status of ["suspicious", "infected", "error"] as const) {
      expect(isServableStatus(status)).toBe(false)
      expect(serviceStateOf(status)).toBe("blocked")
    }
  })

  it("seuls suspect et en échec se libèrent à la main — jamais infecté", () => {
    expect(isReleasableStatus("suspicious")).toBe(true)
    expect(isReleasableStatus("error")).toBe(true)
    expect(isReleasableStatus("infected")).toBe(false)
    expect(isReleasableStatus("clean")).toBe(false)
    expect(isReleasableStatus("pending")).toBe(false)
  })
})
