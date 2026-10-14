import { describe, expect, it } from "vitest"

import { detectHardcodedUrls } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile, workspaceDirectories } from "./lib/source-files"

/** Les SEULS fichiers où une route s'écrit : la table des routes de chaque application. */
const ROUTE_TABLES = /^apps\/[^/]+\/src\/lib\/routes\.ts$/

describe("no-hardcoded-urls — aucune URL ni route codée en dur", () => {
  it("applications et paquets passent par la table des routes et l'environnement", () => {
    const findings: Finding[] = []
    const directories = [...workspaceDirectories("apps"), ...workspaceDirectories("packages")].map((dir) => `${dir}/src`)
    for (const file of listFiles(directories, [".ts", ".tsx"])) {
      if (ROUTE_TABLES.test(file) || isTestFile(file)) continue
      findings.push(...detectHardcodedUrls(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("le backend ne porte aucune URL absolue (origines et fournisseurs par variables)", () => {
    const findings: Finding[] = []
    for (const file of listFiles(["convex"], [".ts"])) {
      if (isTestFile(file) || file.endsWith(".setup.ts") || file.endsWith(".config.ts")) continue
      findings.push(...detectHardcodedUrls(file, readRepoFile(file)).filter((finding) => finding.message.startsWith("URL absolue")))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : href, navigation, propriété de lien et URL absolue", () => {
    const source = [
      'import x from "/abs/module"',
      '<Link href="/fil" />',
      'router.push("/parametres")',
      'const link = { href: "/pages/a" }',
      'const parts = path.split("/")',
      'const api = "https://exemple.org/api"',
      '<Link href={routes.feed()} />',
    ].join("\n")
    expect(detectHardcodedUrls("apps/x/src/a.tsx", source).map((finding) => finding.line)).toEqual([2, 3, 4, 6])
  })
})
