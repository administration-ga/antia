// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-media-carousel.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
/**
 * Décisions pures du carrousel média.
 *
 * Elles restent hors du composant pour verrouiller les deux entrées qui ne
 * dépendent pas du navigateur : la touche pressée et la page la plus proche
 * après un geste natif de défilement.
 */

export type CarouselNavigationKey = "ArrowLeft" | "ArrowRight" | "Home" | "End"

/** Renvoie la nouvelle page, ou `null` quand la touche ne pilote pas le carrousel. */
export function carouselIndexForKey(
  key: string,
  currentIndex: number,
  count: number
): number | null {
  if (count <= 0) return null
  const lastIndex = count - 1
  const current = clampCarouselIndex(currentIndex, count)

  switch (key as CarouselNavigationKey) {
    case "ArrowLeft":
      return Math.max(0, current - 1)
    case "ArrowRight":
      return Math.min(lastIndex, current + 1)
    case "Home":
      return 0
    case "End":
      return lastIndex
    default:
      return null
  }
}

/** Page visuellement dominante après un swipe ou un défilement à la souris. */
export function carouselIndexFromScroll(
  scrollLeft: number,
  viewportWidth: number,
  count: number
): number {
  if (count <= 0 || viewportWidth <= 0) return 0
  return clampCarouselIndex(
    Math.round(Math.max(0, scrollLeft) / viewportWidth),
    count
  )
}

export function clampCarouselIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.trunc(index)))
}
