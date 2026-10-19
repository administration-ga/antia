/**
 * P18b (A13, WCAG 2.4.11) — le défilement réserve la place des barres fixes,
 * par des JETONS : en haut la barre de membre (jeton du thème ANTSIA, 0 dans
 * la base pour les autres applications), en bas, sous 960 px, la barre des
 * destinations et la zone sûre (jeton de réserve déjà partagé).
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const GLOBALS = read("./globals.css")
const CHARTE = read("../../../../packages/ui/src/styles/charte.css")
const ANTSIA = read("../../../../packages/ui/src/themes/antsia.css")

describe("réserve de défilement sous les barres fixes (P18b, A13)", () => {
  it("le document réserve l'en-tête collant par le jeton, et la barre basse sous 960 px", () => {
    expect(GLOBALS).toMatch(/html\s*\{\s*scroll-padding-top:\s*var\(--esp-sticky-header-inset\);\s*\}/)
    expect(GLOBALS).toMatch(/@media \(max-width: 959px\)\s*\{\s*html\s*\{\s*scroll-padding-bottom:\s*calc\(var\(--esp-reseau-tabbar-inset\) \+ env\(safe-area-inset-bottom, 0px\)\);\s*\}\s*\}/)
  })

  it("la base déclare le jeton à 0 (rien ne change ailleurs) ; le thème ANTSIA porte la hauteur de sa barre", () => {
    expect(CHARTE).toMatch(/--esp-sticky-header-inset:\s*0px;/)
    expect(CHARTE).toMatch(/--esp-reseau-tabbar-inset:\s*4\.5rem;/)
    expect(ANTSIA).toMatch(/--esp-sticky-header-inset:\s*4rem;/)
  })
})
