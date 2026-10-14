import { describe, expect, it } from "vitest"

import { detectAnyValidators } from "./lib/detectors"
import { type Finding, formatFindings, listFiles, readRepoFile } from "./lib/source-files"

describe("no-any-validators — validateurs précis, jamais le validateur permissif", () => {
  it("aucun v.any dans le backend", () => {
    const findings: Finding[] = []
    for (const file of listFiles(["convex"], [".ts"])) findings.push(...detectAnyValidators(file, readRepoFile(file)))
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : le détecteur voit l'appel, pas le commentaire", () => {
    const source = ['// on n\'écrit jamais v.any() ici', "const a = v.any()", 'const b = v["any"]()', "const c = v.string()"].join("\n")
    expect(detectAnyValidators("convex/x.ts", source).map((finding) => finding.line)).toEqual([2, 3])
  })
})
