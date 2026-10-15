// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-media-carousel.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
  carouselIndexForKey,
  carouselIndexFromScroll,
  clampCarouselIndex,
} from "./post-media-carousel"

describe("carouselIndexForKey", () => {
  it("avance et recule d'une image sans boucler aux extrémités", () => {
    expect(carouselIndexForKey("ArrowRight", 1, 4)).toBe(2)
    expect(carouselIndexForKey("ArrowLeft", 1, 4)).toBe(0)
    expect(carouselIndexForKey("ArrowLeft", 0, 4)).toBe(0)
    expect(carouselIndexForKey("ArrowRight", 3, 4)).toBe(3)
  })

  it("Home et End atteignent directement les bornes", () => {
    expect(carouselIndexForKey("Home", 2, 4)).toBe(0)
    expect(carouselIndexForKey("End", 0, 4)).toBe(3)
  })

  it("ignore les touches qui appartiennent à la page", () => {
    expect(carouselIndexForKey("PageDown", 1, 4)).toBeNull()
    expect(carouselIndexForKey("Enter", 1, 4)).toBeNull()
  })
})

describe("carouselIndexFromScroll", () => {
  it("retient l'image la plus proche après le swipe natif", () => {
    expect(carouselIndexFromScroll(0, 680, 4)).toBe(0)
    expect(carouselIndexFromScroll(400, 680, 4)).toBe(1)
    expect(carouselIndexFromScroll(1_360, 680, 4)).toBe(2)
  })

  it("borne les valeurs transitoires produites par l'overscroll", () => {
    expect(carouselIndexFromScroll(-900, 680, 4)).toBe(0)
    expect(carouselIndexFromScroll(9_999, 680, 4)).toBe(3)
  })

  it("reste sur la première image avant toute mesure du viewport", () => {
    expect(carouselIndexFromScroll(900, 0, 4)).toBe(0)
  })
})

describe("clampCarouselIndex", () => {
  it("protège les changements de nombre de médias", () => {
    expect(clampCarouselIndex(-1, 3)).toBe(0)
    expect(clampCarouselIndex(8, 3)).toBe(2)
    expect(clampCarouselIndex(1, 0)).toBe(0)
  })
})
