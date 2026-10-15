// Dupliqué de socle/packages/ui-v2/src/components/badge.test.tsx @ ad2e7fdc2 — adaptations : environnement jsdom déclaré en tête (l'environnement par défaut du paquet est `node`).
// @vitest-environment jsdom
/**
 * Tests RTL pour le composant Badge — couvre les tones, dots, et icônes.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Badge } from "./badge"

describe("Badge", () => {
  test("rend le texte enfant", () => {
    render(<Badge>En instruction</Badge>)
    expect(screen.getByText("En instruction")).toBeDefined()
  })

  test("applique le style du tone primary par défaut quand demandé", () => {
    render(<Badge tone="primary">P</Badge>)
    const el = screen.getByText("P")
    expect(el.style.background).toContain("primary-50")
    expect(el.style.color).toContain("primary-600")
  })

  test("affiche un dot quand dot=true", () => {
    const { container } = render(
      <Badge tone="danger" dot>
        Urgent
      </Badge>,
    )
    // Un <span> dot est rendu avant le texte
    const dots = container.querySelectorAll("span > span")
    expect(dots.length).toBeGreaterThan(0)
  })

  test("rend sans dot quand dot omis", () => {
    const { container } = render(<Badge>X</Badge>)
    // Pas d'enfant span (juste le texte)
    const inner = container.firstChild as HTMLElement
    const children = Array.from(inner.children)
    expect(children).toHaveLength(0)
  })

  test("supporte la taille sm", () => {
    render(
      <Badge size="sm">S</Badge>,
    )
    const el = screen.getByText("S")
    expect(el.style.fontSize).toBe("11px")
  })

  test("supporte la taille md (par défaut)", () => {
    render(<Badge>M</Badge>)
    const el = screen.getByText("M")
    expect(el.style.fontSize).toBe("12px")
  })

  test("merge les styles custom", () => {
    render(
      <Badge style={{ marginLeft: 12 }}>X</Badge>,
    )
    const el = screen.getByText("X")
    expect(el.style.marginLeft).toBe("12px")
  })
})
