import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { readEnvFile } from "./next-config.mjs"

describe("readEnvFile", () => {
  it("lit le format écrit par le CLI Convex (commentaires, lignes vides)", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"))
    const file = join(dir, ".env.local")
    writeFileSync(file, "# Deployment used by `npx convex dev`\nCONVEX_DEPLOYMENT=anonymous:exemple # commentaire\n\nCONVEX_URL=http://127.0.0.1:3210\nCONVEX_SITE_URL=\"http://127.0.0.1:3211\"\n")
    expect(readEnvFile(file)).toEqual({
      CONVEX_DEPLOYMENT: "anonymous:exemple",
      CONVEX_URL: "http://127.0.0.1:3210",
      CONVEX_SITE_URL: "http://127.0.0.1:3211",
    })
  })

  it("rend un objet vide quand le fichier n'existe pas", () => {
    expect(readEnvFile(join(tmpdir(), "absent-antia", ".env.local"))).toEqual({})
  })
})
