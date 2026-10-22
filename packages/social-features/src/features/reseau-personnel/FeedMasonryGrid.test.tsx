// Écrit pour le moteur (étude du 22/10/2026) : la grille du fil au bureau, en maçonnerie.
// @vitest-environment jsdom

import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FeedMasonryGrid, masonryRowSpan } from "./FeedMasonryGrid"

/** Un `ResizeObserver` de test : il retient ses cibles et laisse le test livrer les mesures. */
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []
  readonly targets = new Set<Element>()
  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this)
  }
  observe(target: Element) {
    this.targets.add(target)
  }
  unobserve(target: Element) {
    this.targets.delete(target)
  }
  disconnect() {
    this.targets.clear()
  }
  deliver(target: Element, blockSize: number) {
    const entry = { target, borderBoxSize: [{ blockSize, inlineSize: 240 }] } as unknown as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  ResizeObserverStub.instances = []
})

describe("masonryRowSpan", () => {
  it("couvre la hauteur de la carte puis la gouttière, en rangées de 8 px", () => {
    expect(masonryRowSpan(400, 16)).toBe(52)
    expect(masonryRowSpan(401, 16)).toBe(53)
    expect(masonryRowSpan(400, 24)).toBe(53)
  })

  it("n'occupe jamais moins d'une rangée", () => {
    expect(masonryRowSpan(0, 0)).toBe(1)
    expect(masonryRowSpan(-12, -4)).toBe(1)
  })
})

describe("FeedMasonryGrid", () => {
  it("sans ResizeObserver, garde une grille sans rangées implicites (aucun chevauchement)", () => {
    vi.stubGlobal("ResizeObserver", undefined)
    const view = render(
      <FeedMasonryGrid>
        <article>Première</article>
      </FeedMasonryGrid>,
    )
    const grid = view.container.querySelector(".rp-feed-grid")
    expect(grid).not.toBeNull()
    expect(grid).not.toHaveAttribute("data-measured")
    expect(grid?.textContent).toBe("Première")
  })

  it("mesure chaque carte, y compris sous une enveloppe d'ancre, et suit les ajouts", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    const view = render(
      <FeedMasonryGrid>
        <article data-testid="a">A</article>
        <div style={{ display: "contents" }} data-feed-anchor="b">
          <article data-testid="b">B</article>
        </div>
      </FeedMasonryGrid>,
    )
    const grid = view.container.querySelector<HTMLElement>(".rp-feed-grid")!
    expect(grid).toHaveAttribute("data-measured")
    const observer = ResizeObserverStub.instances[0]!
    const a = view.getByTestId("a")
    const b = view.getByTestId("b")
    // L'enveloppe `display: contents` n'est pas un élément de la grille : son enfant l'est.
    expect([...observer.targets]).toEqual([a, b])

    observer.deliver(a, 400)
    expect(a.style.gridRowEnd).toBe(`span ${masonryRowSpan(400, Number.parseFloat(getComputedStyle(grid).columnGap) || 0)}`)

    view.rerender(
      <FeedMasonryGrid>
        <article data-testid="a">A</article>
        <div style={{ display: "contents" }} data-feed-anchor="b">
          <article data-testid="b">B</article>
        </div>
        <article data-testid="c">C</article>
      </FeedMasonryGrid>,
    )
    // Le MutationObserver livre ses changements en microtâche.
    await act(async () => {
      await Promise.resolve()
    })
    expect(observer.targets.has(view.getByTestId("c"))).toBe(true)

    view.unmount()
    expect(observer.targets.size).toBe(0)
  })
})
