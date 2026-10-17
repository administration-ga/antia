import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { candidateBinDirs, codegenPlan, convexArgs, nodeMajor, pickNodeBinDir } from "./convex-dev.mjs"

describe("lanceur de la CLI Convex — un Node accepté par le backend local", () => {
  test("lit la version majeure de `node --version`", () => {
    expect(nodeMajor("v22.22.3\n")).toBe(22)
    expect(nodeMajor("v25.9.0")).toBe(25)
    expect(nodeMajor("pas une version")).toBeNull()
  })

  test("garde le Node du PATH s'il est supporté ; sinon prend le premier candidat supporté", () => {
    const versions = { "/a/bin/node": "v25.1.0", "/b/bin/node": "v22.22.3" }
    const versionAt = (path) => versions[path] ?? null
    expect(pickNodeBinDir({ currentVersion: "v24.1.0", candidates: ["/b/bin"], versionAt })).toBeNull()
    expect(pickNodeBinDir({ currentVersion: "v25.9.0", candidates: ["/a/bin", "/b/bin"], versionAt })).toBe("/b/bin")
    expect(pickNodeBinDir({ currentVersion: "v25.9.0", candidates: ["/a/bin"], versionAt })).toBeNull()
  })

  test("cherche Homebrew puis nvm, du plus récent au plus ancien, et seulement ce qui existe", () => {
    const present = new Set(["/opt/homebrew/opt/node@22/bin/node", "/home/x/.nvm/versions/node", join("/home/x/.nvm/versions/node", "v20.19.0", "bin", "node")])
    const exists = (path) => present.has(path)
    const list = () => ["v20.19.0", "v25.0.0"]
    expect(candidateBinDirs("/home/x", exists, list)).toEqual(["/opt/homebrew/opt/node@22/bin", join("/home/x/.nvm/versions/node", "v20.19.0", "bin")])
  })
})

describe("codegen : typage natif obligatoire, génération et autres commandes conservées", () => {
  test("la génération passe une fois, puis le typage natif doit réussir", () => {
    const args = ["codegen"]
    expect(codegenPlan(args)).toEqual({ cliArgs: ["codegen", "--typecheck", "disable"], nativeTypecheck: true })
    expect(args).toEqual(["codegen"])
  })
  test("une option explicite conserve également le contrôle natif", () => {
    expect(codegenPlan(["codegen", "--typecheck", "enable"])).toEqual({ cliArgs: ["codegen", "--typecheck", "enable"], nativeTypecheck: true })
    expect(codegenPlan(["codegen", "--typecheck=disable"]).nativeTypecheck).toBe(true)
  })
  test("ne change ni dev, ni run, ni publication", () => {
    for (const args of [["dev", "--once"], ["run", "fixture"], ["deploy"]]) expect(codegenPlan(args)).toEqual({ cliArgs: args, nativeTypecheck: false })
  })
})

describe("lanceur de la CLI Convex — la sous-commande", () => {
  test("sans argument, ou avec une option en tête : `convex dev`, comme avant", () => {
    expect(convexArgs([])).toEqual(["dev"])
    expect(convexArgs(["--once"])).toEqual(["dev", "--once"])
    expect(convexArgs(["--tail-logs", "disable"])).toEqual(["dev", "--tail-logs", "disable"])
  })

  test("le premier argument est la sous-commande, suivie de ses propres arguments", () => {
    expect(convexArgs(["codegen"])).toEqual(["codegen"])
    expect(convexArgs(["codegen", "--typecheck", "disable"])).toEqual(["codegen", "--typecheck", "disable"])
    expect(convexArgs(["dev", "--once"])).toEqual(["dev", "--once"])
  })

  test("`codegen` (donc `verify`) et `dev:convex` du package.json racine passent par le lanceur", () => {
    const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(scripts.codegen).toBe("node scripts/convex-dev.mjs codegen")
    expect(scripts["dev:convex"]).toBe("node scripts/convex-dev.mjs")
    expect(scripts.verify.split("&&").map((step) => step.trim())).toContain("bun run codegen")
  })
})
