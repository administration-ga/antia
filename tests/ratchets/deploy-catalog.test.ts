import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, posix } from "node:path"

import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, REPO_ROOT } from "./lib/source-files"

type Catalog = { applications: Record<string, { path: string; dev_port: number; build_args: string[] }> }

/**
 * Dossiers d'applications des espaces de travail déclarés : celles du moteur
 * (`apps/*`) et les applications EXTERNES installées avec lui
 * (`../DIASPORALE/apps/*`) — un dossier sans `package.json` n'en est pas une.
 */
function declaredApplicationDirectories(globs: readonly string[]): string[] {
  const out: string[] = []
  for (const glob of globs.filter((entry) => entry.endsWith("apps/*"))) {
    const base = join(REPO_ROOT, glob.slice(0, -2))
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base)) {
      if (!entry.startsWith(".") && existsSync(join(base, entry, "package.json"))) out.push(`${glob.slice(0, -1)}${entry}`)
    }
  }
  return out.sort()
}

/** Paquets lus par une application : ceux du moteur, plus ceux de son dépôt si elle est externe. */
function packageDirectoriesOf(appPath: string): string[] {
  return appPath.startsWith("../") ? ["packages", posix.join(posix.dirname(posix.dirname(appPath)), "packages")] : ["packages"]
}

describe("deploy-catalog — chaque application servie est au catalogue (câblages invisibles)", () => {
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, "deploy/catalog.json"), "utf8")) as Catalog
  const root = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { workspaces: { packages: string[] }; scripts: Record<string, string> }

  it("toute application des espaces de travail (moteur et externes) a son entrée, et inversement", () => {
    const declared = Object.values(catalog.applications).map((app) => app.path)
    expect(declared.sort()).toEqual(declaredApplicationDirectories(root.workspaces.packages))
  })

  it("les applications sont des espaces de travail déclarés (sinon le build Docker échoue en 127)", () => {
    expect(root.workspaces.packages).toContain("apps/*")
    const uncovered = Object.values(catalog.applications)
      .map((app) => app.path)
      .filter((path) => !root.workspaces.packages.includes(`${posix.dirname(path)}/*`))
    expect(uncovered).toEqual([])
  })

  it("les ports de développement sont distincts", () => {
    const ports = Object.values(catalog.applications).map((app) => app.dev_port)
    expect(new Set(ports).size).toBe(ports.length)
  })

  it("toute variable NEXT_PUBLIC_* lue par une application est déclarée au catalogue", () => {
    const problems: string[] = []
    const shared = readFileSync(join(REPO_ROOT, "packages/api/next-config.mjs"), "utf8")
    for (const app of Object.values(catalog.applications)) {
      const files = [
        join(app.path, "next.config.ts"),
        ...listFiles([`${app.path}/src`, ...packageDirectoriesOf(app.path)], [".ts", ".tsx"]).filter((file) => !isTestFile(file)),
      ]
      const sources = [shared, ...files.map((file) => readFileSync(join(REPO_ROOT, file), "utf8"))].join("\n")
      for (const match of sources.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        if (match[1] && !app.build_args.includes(match[1])) problems.push(`${app.path} : ${match[1]}`)
      }
    }
    expect([...new Set(problems)]).toEqual([])
  })

  it("test du test : une application externe lit aussi les paquets de son dépôt", () => {
    expect(packageDirectoriesOf("apps/antia_ga")).toEqual(["packages"])
    expect(packageDirectoriesOf("../DIASPORALE/apps/diasporale_com")).toEqual(["packages", "../DIASPORALE/packages"])
  })
})
