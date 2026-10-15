import { describe, expect, test } from "bun:test"
import { join } from "node:path"

import { candidateBinDirs, nodeMajor, pickNodeBinDir } from "./convex-dev.mjs"

describe("lanceur convex dev — un Node accepté par le backend local", () => {
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
