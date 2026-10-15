// Dupliqué de socle/packages/ui-v2/src/components/card.test.tsx @ ad2e7fdc2 — adaptations : environnement jsdom déclaré en tête (l'environnement par défaut du paquet est `node`).
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Card } from "./card"

describe("Card", () => {
  it("publie le slot de contrat et compose la classe appelante", () => {
    const { container } = render(<Card className="carte-metier">Corps</Card>)
    const card = container.firstElementChild as HTMLElement

    expect(card.dataset.slot).toBe("card")
    expect(card.classList.contains("carte-metier")).toBe(true)
  })

  it("consomme les jetons de surface, rayon et ombre", () => {
    const { container } = render(<Card>Corps</Card>)
    const style = container.firstElementChild?.getAttribute("style") ?? ""

    expect(style).toContain("background: var(--ink-0)")
    expect(style).toContain("border-radius: var(--radius-lg)")
    expect(style).toContain("box-shadow: var(--shadow-xs)")
  })
})
