// Dupliqué de socle/packages/ui-v2/src/components/button.a11y.test.tsx @ ad2e7fdc2 — adaptations : environnement jsdom déclaré en tête (l'environnement par défaut du paquet est `node`).
// @vitest-environment jsdom
/**
 * Cliquet de PLANCHER TACTILE sur `Button`.
 *
 * Ce que ces tests tiennent tient à une mécanique, pas à un chiffre : les
 * styles de ce composant sont appliqués EN LIGNE, et un style en ligne
 * l'emporte sur toute feuille. Une hauteur écrite en dur y est donc
 * DÉFINITIVE — aucune requête média ne peut la relever au téléphone.
 *
 * D'où la forme des assertions : elles vérifient que la hauteur minimale est
 * une `var()`, PAS qu'elle vaut 44 px. Le chiffre appartient à la feuille de
 * jetons (`@workspace/ui/styles/globals.css`), qui n'est pas chargée ici ;
 * ce qui appartient au composant, c'est de laisser la cascade décider.
 *
 * Le défaut d'origine (2026-08-05) : l'ordre du spread appliquait `VARIANTS`
 * puis `SIZES` APRÈS la base, si bien que `variant="link"` et `size="sm"`
 * écrasaient `--ui2-button-min-h`. Mesuré à l'écran : ~18 px de haut pour les
 * boutons « lien » du panneau de notifications, 32 px pour tout un rail.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Button } from "./button"

const heightOf = (label: string) =>
  (screen.getByRole("button", { name: label }) as HTMLButtonElement).style
    .minHeight

describe("Button — plancher tactile", () => {
  test("la taille par défaut passe par un jeton", () => {
    render(<Button>Défaut</Button>)
    expect(heightOf("Défaut")).toContain("--ui2-button-min-h")
  })

  test("size=sm ne fige PAS 32 px — il écrasait le jeton de base", () => {
    render(<Button size="sm">Compact</Button>)
    const height = heightOf("Compact")
    expect(height).toContain("var(")
    expect(height).toContain("--ui2-button-sm-min-h")
    expect(height).not.toMatch(/^\d+px$/)
  })

  test("variant=link ne fige NI `auto` NI un rembourrage nul", () => {
    render(<Button variant="link">Lien</Button>)
    const button = screen.getByRole("button", { name: "Lien" }) as HTMLButtonElement
    expect(button.style.minHeight).toContain("--ui2-button-link-min-h")
    expect(button.style.minHeight).not.toBe("auto")
    expect(button.style.padding).toContain("--ui2-button-link-pad")
  })

  test("size=lg reste en dur — il est DÉJÀ au-dessus du plancher", () => {
    // Le faire varier le ferait rétrécir au téléphone : 48 px est un choix de
    // hiérarchie visuelle, pas une dette d'accessibilité.
    render(<Button size="lg">Grand</Button>)
    expect(heightOf("Grand")).toBe("48px")
  })

  test("aucune combinaison variante × taille ne retombe sur une valeur figée", () => {
    const variants = ["primary", "secondary", "ghost", "outline", "danger", "success", "link"] as const
    const sizes = ["sm", "md"] as const
    for (const variant of variants) {
      for (const size of sizes) {
        const label = `${variant}-${size}`
        const { unmount } = render(
          <Button variant={variant} size={size}>
            {label}
          </Button>,
        )
        expect(heightOf(label)).toContain("var(")
        unmount()
      }
    }
  })
})
