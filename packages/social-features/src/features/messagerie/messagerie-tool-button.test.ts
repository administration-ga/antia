/**
 * P18b (A15) — `.msg-tool-btn`, les gestes du canal commercial, existe enfin
 * dans la feuille de la messagerie : 44 px au moins, jetons de la charte (clair
 * et sombre), anneau de focus, survol et désactivé, aucune couleur littérale.
 */
import { describe, expect, it } from "vitest"

import { MESSAGERIE_STYLES_CSS } from "./messagerie-styles"

const CSS = MESSAGERIE_STYLES_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
const block = (selector: string) => {
  const start = CSS.indexOf(`${selector} {`)
  expect(start, `${selector} introuvable`).toBeGreaterThan(-1)
  return CSS.slice(start, CSS.indexOf("}", start))
}

describe(".msg-tool-btn (P18b, A15)", () => {
  it("cible d'au moins 44 px, sur les jetons de la charte", () => {
    const rule = block(".msg-tool-btn")
    expect(rule).toMatch(/min-height:\s*44px;/)
    expect(rule).toMatch(/min-width:\s*44px;/)
    expect(rule).toMatch(/border:\s*1px solid var\(--esp-action-cancel-border, var\(--input\)\);/)
    expect(rule).toMatch(/background:\s*var\(--esp-action-cancel-bg, var\(--card\)\);/)
    expect(rule).toMatch(/border-radius:\s*var\(--esp-primitive-button-radius, 10px\);/)
    expect(rule).toMatch(/color:\s*var\(--card-foreground\);/)
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
  })

  it("états focus, survol et désactivé", () => {
    expect(block(".msg-tool-btn:focus-visible")).toMatch(/outline:\s*2px solid var\(--ring\);/)
    expect(CSS).toMatch(/\.msg-tool-btn:hover:not\(:disabled\)\s*\{\s*background:\s*var\(--muted\);\s*\}/)
    expect(CSS).toMatch(/\.msg-tool-btn:disabled\s*\{[^}]*cursor:\s*not-allowed;/)
  })

  it("distingue accepter et refuser avec un repli neutre hors des chartes ANTSIA", () => {
    for (const role of ["success", "danger"] as const) {
      const rule = block(`.msg-tool-btn[data-role="${role}"]`)
      expect(rule).toContain(`background: var(--esp-action-${role}-fill, var(--card));`)
      expect(rule).toContain(`color: var(--esp-action-${role}-on, var(--card-foreground));`)
      expect(block(`.msg-tool-btn[data-role="${role}"]:hover:not(:disabled)`)).toContain(`background: var(--esp-action-${role}-fill, var(--muted));`)
    }
  })
})
