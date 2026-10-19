// ADR-0026 : l'amorçage de l'apparence d'antsia.ga, prêt pour la CSP à jeton ; ADR-0027 : sept thèmes et motifs de fond.
import { readFileSync } from "node:fs"

import { appearanceBootScript } from "@antsia/social-features/shell/appearance/boot-script"
import { ANTSIA_THEMES } from "@antsia/ui"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { APPEARANCE } from "@/lib/appearance"
import { AppearanceBootScript, APPEARANCE_BOOT_SCRIPT } from "./appearance-boot-script"

describe("AppearanceBootScript", () => {
  it("porte le nonce de la requête quand la CSP à jeton en fournit un", () => {
    const html = renderToStaticMarkup(<AppearanceBootScript nonce="bm9uY2UtZGUtdGVzdA==" />)
    expect(html.startsWith('<script nonce="bm9uY2UtZGUtdGVzdA==">')).toBe(true)
    expect(html.endsWith("</script>")).toBe(true)
  })

  it("sans nonce, aucun attribut : le script relève de la politique actuelle", () => {
    const html = renderToStaticMarkup(<AppearanceBootScript />)
    expect(html).toBe(`<script>${APPEARANCE_BOOT_SCRIPT}</script>`)
  })

  it("rejoue la configuration du fournisseur d'antsia.ga : préfixe du réseau racine, sept thèmes et motifs de fond", () => {
    expect(APPEARANCE.storagePrefix).toBe("antsia:antsia:")
    // Dérivée du contrat pur (module serveur), la liste reste exactement le registre des chartes d'@antsia/ui.
    expect(APPEARANCE.themes).toEqual(ANTSIA_THEMES)
    // ADR-0027 : motifs proposés, aucun par défaut.
    expect([...APPEARANCE.motifs]).toEqual(["points", "quadrillage", "grain", "projecteur"])
    expect(APPEARANCE_BOOT_SCRIPT).toBe(appearanceBootScript({ storagePrefix: "antsia:antsia:", themes: ANTSIA_THEMES, motifs: APPEARANCE.motifs }))
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"t":"antsia:antsia:theme"')
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"a":"antsia:antsia:appearance"')
    // Gaboma, le thème par défaut, habille la page de la charte du réseau.
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"d":"gaboma"')
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"gaboma":"antsia"')
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"f":"antsia:antsia:motif"')
    expect(APPEARANCE_BOOT_SCRIPT).toContain('"g":["points","quadrillage","grain","projecteur"]')
  })

  it("reste importable par la mise en page serveur : ni « use client » ni index d'@antsia/ui (crochets React)", () => {
    const sources = ["../lib/appearance.ts", "./appearance-boot-script.tsx", "../../../../packages/social-features/src/shell/appearance/boot-script.ts"]
    for (const path of sources) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8")
      expect(source, path).not.toMatch(/^\s*["']use client["']/m)
      expect(source, path).not.toMatch(/from\s+["']@antsia\/ui["']/)
      expect(source, path).not.toMatch(/from\s+["']@antsia\/social-features\/shell\/appearance["']/)
    }
  })
})
