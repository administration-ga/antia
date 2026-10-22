"use client"

/**
 * FeedMasonryGrid — le fil du bureau en grille de deux à quatre colonnes
 * (étude du 22/10/2026, décision du propriétaire : « 3 ou 4 en mode desktop »).
 * Écrit pour le moteur, aucun équivalent au socle.
 *
 * Chaque publication garde la hauteur que lui donne son média, sans cadre
 * imposé : la grille est en maçonnerie. L'ordre du DOM reste celui du fil,
 * chronologique — celui que suivent le clavier et les lecteurs d'écran ; seul le
 * placement visuel change. Le placement automatique de CSS Grid pose chaque
 * carte dans la première colonne libre, donc dans celle qui finit le plus haut :
 * c'est la maçonnerie, sans bibliothèque ni positionnement absolu.
 *
 * Mécanique : des rangées implicites de 8 px, sans écart vertical ; chaque carte
 * s'étend sur autant de rangées que sa hauteur et la gouttière en demandent
 * (`grid-row-end: span n`). Un `ResizeObserver` la mesure : une galerie qui se
 * charge, une légende dépliée ou des commentaires ouverts la font suivre. Ce qui
 * n'est pas une publication (rangée de clips, état de la page, erreur) occupe
 * toute la largeur.
 *
 * ⚠️ Sans `ResizeObserver` (tests, navigateur ancien), `data-measured` n'est
 * jamais posé : la grille garde des rangées automatiques et sa gouttière
 * verticale. Rien ne se chevauche, seule la maçonnerie manque.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react"

/** La hauteur d'une rangée implicite : la précision du placement vertical. */
const ROW_PX = 8

/**
 * La feuille de la grille, hors du JSX : un littéral enfant de `<style>`
 * passerait pour une chaîne d'interface (cliquet `no-hardcoded-strings`).
 * Gouttière unique (décision du 22/10/2026) : l'écart entre les colonnes et
 * entre les cartes vaut la marge de la page (`--spacing-gutter` de l'application :
 * 16 px, puis 24 px dès 1 200 px).
 * Paliers sur la largeur de la colonne de lecture : 2 colonnes dès 480 px,
 * 3 dès 720 px, 4 dès 1 040 px — chaque carte garde au moins 228 px.
 */
const FEED_GRID_CSS = `
  .rp-feed-grid-frame {
    container: rp-feed / inline-size;
    min-width: 0;
  }
  .rp-feed-grid {
    --rp-feed-grid-gap: var(--spacing-gutter, 16px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    column-gap: var(--rp-feed-grid-gap);
    row-gap: var(--rp-feed-grid-gap);
    align-items: start;
  }
  .rp-feed-grid[data-measured] {
    grid-auto-rows: ${ROW_PX}px;
    row-gap: 0;
  }
  .rp-feed-grid > *,
  .rp-feed-grid > [data-feed-anchor] > * {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .rp-feed-grid .rp-charte-card,
  .rp-feed-grid > [data-slot="card"]:has(> span[aria-hidden="true"]) {
    grid-column: auto;
  }
  @container rp-feed (min-width: 480px) {
    .rp-feed-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @container rp-feed (min-width: 720px) {
    .rp-feed-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @container rp-feed (min-width: 1040px) {
    .rp-feed-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
`

/** Le nombre de rangées qu'une carte occupe : sa hauteur, puis la gouttière qui la suit. */
export function masonryRowSpan(height: number, gap: number, row: number = ROW_PX): number {
  return Math.max(1, Math.ceil((Math.max(0, height) + Math.max(0, gap)) / row))
}

export function FeedMasonryGrid({ children }: { children: ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return

    const place = (element: HTMLElement, height: number) => {
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
      const value = `span ${masonryRowSpan(height, gap)}`
      if (element.style.gridRowEnd !== value) element.style.gridRowEnd = value
    }
    const sizes = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement
        const box = entry.borderBoxSize?.[0]
        place(element, box ? box.blockSize : element.getBoundingClientRect().height)
      }
    })

    /* Les enveloppes d'ancre du fil (`display: contents`) ne font pas de boîte :
       leurs enfants sont les vrais éléments de la grille, et leur liste change
       aussi quand une page du fil se met à jour. */
    const observed = new Set<HTMLElement>()
    const wrappers = new WeakSet<Element>()
    const sync = (changes: MutationObserver) => {
      const current = new Set<HTMLElement>()
      const visit = (parent: Element) => {
        for (const child of Array.from(parent.children)) {
          if (!(child instanceof HTMLElement)) continue
          if (getComputedStyle(child).display === "contents") {
            if (!wrappers.has(child)) {
              wrappers.add(child)
              changes.observe(child, { childList: true })
            }
            visit(child)
          } else {
            current.add(child)
          }
        }
      }
      visit(grid)
      for (const element of observed) {
        if (current.has(element)) continue
        sizes.unobserve(element)
        observed.delete(element)
      }
      for (const element of current) {
        if (observed.has(element)) continue
        sizes.observe(element)
        observed.add(element)
      }
    }
    const changes = new MutationObserver((_records, observer) => sync(observer))

    changes.observe(grid, { childList: true })
    sync(changes)
    grid.dataset.measured = ""
    return () => {
      changes.disconnect()
      sizes.disconnect()
      delete grid.dataset.measured
      for (const element of observed) element.style.removeProperty("grid-row-end")
    }
  }, [])

  return (
    <div className="rp-feed-grid-frame">
      <style href="rp-feed-grid" precedence="default">{FEED_GRID_CSS}</style>
      <div ref={gridRef} className="rp-feed-grid" data-feed-grid="">
        {children}
      </div>
    </div>
  )
}
