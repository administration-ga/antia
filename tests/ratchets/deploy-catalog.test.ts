import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, REPO_ROOT, workspaceDirectories } from "./lib/source-files"

type Catalog = { applications: Record<string, { path: string; dev_port: number; build_args: string[] }> }

describe("deploy-catalog — chaque application servie est au catalogue (câblages invisibles)", () => {
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, "deploy/catalog.json"), "utf8")) as Catalog
  const root = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { workspaces: { packages: string[] }; scripts: Record<string, string> }

  it("toute application du dépôt a son entrée, et inversement", () => {
    const apps = workspaceDirectories("apps")
    const declared = Object.values(catalog.applications).map((app) => app.path)
    expect(declared.sort()).toEqual(apps.sort())
  })

  it("les applications sont des espaces de travail déclarés (sinon le build Docker échoue en 127)", () => {
    expect(root.workspaces.packages).toContain("apps/*")
  })

  it("les ports de développement sont distincts", () => {
    const ports = Object.values(catalog.applications).map((app) => app.dev_port)
    expect(new Set(ports).size).toBe(ports.length)
  })

  it("toute variable NEXT_PUBLIC_* lue par une application est déclarée au catalogue", () => {
    const problems: string[] = []
    const shared = readFileSync(join(REPO_ROOT, "packages/api/next-config.mjs"), "utf8")
    for (const app of Object.values(catalog.applications)) {
      const files = [join(app.path, "next.config.ts"), ...listFiles([`${app.path}/src`, "packages"], [".ts", ".tsx"]).filter((file) => !isTestFile(file))]
      const sources = [shared, ...files.map((file) => readFileSync(join(REPO_ROOT, file), "utf8"))].join("\n")
      for (const match of sources.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        if (match[1] && !app.build_args.includes(match[1])) problems.push(`${app.path} : ${match[1]}`)
      }
    }
    expect([...new Set(problems)]).toEqual([])
  })
})
