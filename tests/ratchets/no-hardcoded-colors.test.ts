import { describe, expect, it } from "vitest"

import { detectHardcodedColors } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile, workspaceDirectories } from "./lib/source-files"

/** Seuls fichiers où une couleur littérale a le droit d'exister. */
const TOKEN_FILES = /^packages\/ui\/src\/(styles|themes)\//

describe("no-hardcoded-colors — aucune couleur hors des fichiers de jetons", () => {
  it("applications et paquets ne portent aucune couleur littérale", () => {
    const findings: Finding[] = []
    const directories = [...workspaceDirectories("apps"), ...workspaceDirectories("packages")].map((dir) => `${dir}/src`)
    for (const file of listFiles(directories, [".ts", ".tsx", ".css", ".mjs"])) {
      if (TOKEN_FILES.test(file) || isTestFile(file)) continue
      findings.push(...detectHardcodedColors(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : hexadécimal, fonctions de couleur, palette Tailwind et couleur arbitraire", () => {
    const source = [
      'const a = "#0b4f9c"',
      "const b = 'rgb(0 0 0 / 0.4)'",
      '<div className="bg-blue-500 hover:text-white" />',
      '<div className="bg-[#fff]" />',
      '<a href="#contenu" className="bg-card text-primary" />',
    ].join("\n")
    const lines = [...new Set(detectHardcodedColors("apps/x/src/a.tsx", source).map((finding) => finding.line))]
    expect(lines).toEqual([1, 2, 3, 4])
  })
})
