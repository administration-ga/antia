import { describe, expect, it } from "vitest"

import { canDecideReport, isTerminalReportStatus } from "./moderation"

describe("dossiers de signalement — transitions", () => {
  it("un dossier ouvert passe en examen, se classe ou se suit d'effet ; un dossier en examen ne repasse pas en examen", () => {
    expect(canDecideReport("open", "reviewing")).toBe(true)
    expect(canDecideReport("open", "dismissed")).toBe(true)
    expect(canDecideReport("reviewing", "actioned")).toBe(true)
    expect(canDecideReport("reviewing", "reviewing")).toBe(false)
  })

  it("une décision terminale ne se refait pas", () => {
    for (const from of ["dismissed", "actioned"] as const) {
      expect(isTerminalReportStatus(from)).toBe(true)
      for (const to of ["reviewing", "dismissed", "actioned"] as const) expect(canDecideReport(from, to)).toBe(false)
    }
  })
})
