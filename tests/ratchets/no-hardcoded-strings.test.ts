import { describe, expect, it } from "vitest"

import { detectHardcodedStrings } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile, workspaceDirectories } from "./lib/source-files"

describe("no-hardcoded-strings — toute chaîne d'interface passe par l'i18n", () => {
  it("aucun texte ni attribut lisible en dur dans les écrans", () => {
    const findings: Finding[] = []
    const directories = [...workspaceDirectories("apps"), ...workspaceDirectories("packages")].map((dir) => `${dir}/src`)
    for (const file of listFiles(directories, [".tsx", ".jsx"])) {
      if (isTestFile(file)) continue
      findings.push(...detectHardcodedStrings(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : texte, attribut lisible et littéral entre accolades", () => {
    const source = [
      "export function A() {",
      "  return (",
      '    <div data-charte="antia" aria-label="Fermer">',
      "      Bonjour",
      '      {"Publier"}',
      '      <img alt={"Photo"} src={url} />',
      "      {t(\"ok\")} · 42",
      "    </div>",
      "  )",
      "}",
    ].join("\n")
    expect(detectHardcodedStrings("apps/x/src/a.tsx", source).map((finding) => finding.line)).toEqual([3, 4, 5, 6])
  })
})
