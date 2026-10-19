/**
 * P18b (F03) — l'îlot client de la carte publique importe le lecteur de
 * médias par son point d'entrée étroit, jamais par le barillet
 * `reseau-personnel` (page réseau, profils, groupes, composeur…). Le gain de
 * JS reste à mesurer au build ; ce test garde seulement l'import.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const ISLAND = readFileSync(new URL("./public-post-media.tsx", import.meta.url), "utf8")
const ENTRY = readFileSync(new URL("../../../../../packages/social-features/src/features/reseau-personnel/post-media-entry.ts", import.meta.url), "utf8")

describe("îlot public du lecteur de médias (P18b, F03)", () => {
  it("importe le point d'entrée étroit, pas le barillet", () => {
    expect(ISLAND).toContain('from "@antsia/social-features/features/reseau-personnel/post-media-entry"')
    expect(ISLAND).not.toMatch(/from "@antsia\/social-features\/reseau-personnel"/)
  })

  it("le point d'entrée ne relaie que le lecteur", () => {
    const exports = ENTRY.replace(/\/\*[\s\S]*?\*\//g, "").trim()
    expect(exports).toBe('export { PostMedia } from "./PostMedia"')
  })
})
