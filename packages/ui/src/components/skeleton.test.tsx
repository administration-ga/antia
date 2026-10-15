// Dupliqué de socle/packages/ui-v2/src/components/skeleton.test.tsx @ ad2e7fdc2 — adaptations : environnement jsdom déclaré en tête (l'environnement par défaut du paquet est `node`).
// @vitest-environment jsdom
/**
 * Tests RTL pour les primitives Skeleton (ADR-0014) — chargement des écrans
 * authentifiés réactifs. Couvre dimensions, classe shimmer, accessibilité
 * (décoratif → aria-hidden) et les variantes composées.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonTable,
} from "./skeleton"

describe("Skeleton", () => {
  test("porte la classe shimmer .gc-skeleton et est décoratif (aria-hidden)", () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector(".gc-skeleton") as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute("aria-hidden")).toBe("true")
  })

  test("dimensions par défaut : largeur 100%, hauteur 14px", () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector(".gc-skeleton") as HTMLElement
    expect(el.style.width).toBe("100%")
    expect(el.style.height).toBe("14px")
  })

  test("applique largeur/hauteur/rayon personnalisés", () => {
    const { container } = render(<Skeleton width={120} height={20} radius={8} />)
    const el = container.querySelector(".gc-skeleton") as HTMLElement
    expect(el.style.width).toBe("120px")
    expect(el.style.height).toBe("20px")
    expect(el.style.borderRadius).toBe("8px")
  })

  test("variante circle → borderRadius 50%", () => {
    const { container } = render(<Skeleton circle width={28} height={28} />)
    const el = container.querySelector(".gc-skeleton") as HTMLElement
    expect(el.style.borderRadius).toBe("50%")
  })

  test("merge les styles custom", () => {
    const { container } = render(<Skeleton style={{ marginTop: 4 }} />)
    const el = container.querySelector(".gc-skeleton") as HTMLElement
    expect(el.style.marginTop).toBe("4px")
  })
})

describe("SkeletonText", () => {
  test("rend le nombre de lignes demandé", () => {
    const { container } = render(<SkeletonText lines={4} />)
    expect(container.querySelectorAll(".gc-skeleton")).toHaveLength(4)
  })

  test("3 lignes par défaut", () => {
    const { container } = render(<SkeletonText />)
    expect(container.querySelectorAll(".gc-skeleton")).toHaveLength(3)
  })
})

describe("SkeletonStatCard", () => {
  test("rend deux barres (label + valeur), conteneur décoratif", () => {
    const { container } = render(<SkeletonStatCard />)
    expect(container.querySelectorAll(".gc-skeleton")).toHaveLength(2)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("SkeletonTable", () => {
  test("rend rows × columns cellules de chargement", () => {
    const { container } = render(<SkeletonTable rows={3} columns={4} />)
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(container.querySelectorAll(".gc-skeleton")).toHaveLength(12)
  })

  test("rend des en-têtes réels quand `headers` est fourni", () => {
    render(
      <SkeletonTable rows={2} headers={["Réf", "Statut"]} />,
    )
    expect(screen.getByText("Réf")).toBeDefined()
    expect(screen.getByText("Statut")).toBeDefined()
  })

  test("le nombre de colonnes suit `headers` quand fourni", () => {
    const { container } = render(
      <SkeletonTable rows={1} headers={["A", "B", "C"]} />,
    )
    // 1 ligne × 3 colonnes = 3 cellules de chargement
    expect(container.querySelectorAll("tbody .gc-skeleton")).toHaveLength(3)
  })
})

describe("SkeletonCard", () => {
  test("rend un contenu de chargement par défaut", () => {
    const { container } = render(<SkeletonCard />)
    expect(
      container.querySelectorAll(".gc-skeleton").length,
    ).toBeGreaterThan(0)
  })

  test("rend les enfants fournis à la place du contenu par défaut", () => {
    render(
      <SkeletonCard>
        <span>contenu custom</span>
      </SkeletonCard>,
    )
    expect(screen.getByText("contenu custom")).toBeDefined()
  })
})
