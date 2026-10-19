import { describe, expect, it } from "vitest"

import { DIRECT_SCENE_CELL_CLASS, directTileFit } from "./direct-tile-fit"
import { emissionTileAspect } from "./direct-immersive"

/** Ce que le navigateur calcule pour `directTileFit` dans une case de `width` × `height`. */
function rendered(aspect: number, cell: { width: number; height: number }) {
  const match = /^min\(100cqw, ([\d.]+)cqh\)$/.exec(directTileFit(aspect).width)
  expect(match).not.toBeNull()
  const width = Math.min(cell.width, (Number(match![1]) / 100) * cell.height)
  return { width, height: width / aspect }
}

describe("taille d'une tuile du studio dans sa case", () => {
  it("la case est un conteneur de taille qui centre la tuile", () => {
    expect(DIRECT_SCENE_CELL_CLASS.split(" ")).toEqual(expect.arrayContaining(["grid", "min-h-0", "min-w-0", "place-items-center", "[container-type:size]"]))
  })

  // Cases mesurées dans Chromium le 19/10/2026 (avant correctif, la tuile suivait la hauteur).
  it.each([
    { cell: { width: 162, height: 249.2 }, case: "téléphone 390 px, grille de 4" },
    { cell: { width: 380, height: 300 }, case: "tablette 834 px, grille de 4" },
    { cell: { width: 417, height: 480 }, case: "bureau 1280 px, duo" },
    { cell: { width: 204.5, height: 236 }, case: "bureau 1280 px, grille fixe" },
    { cell: { width: 128, height: 96 }, case: "vignette du bandeau" },
  ])("$case : la tuile tient en largeur ET en hauteur, à la proportion de la source", ({ cell }) => {
    for (const format of ["television", "computer", "mobile"] as const) {
      const aspect = emissionTileAspect(format)
      expect(directTileFit(aspect).aspectRatio).toBe(aspect)
      const tile = rendered(aspect, cell)
      expect(tile.width).toBeLessThanOrEqual(cell.width + 1e-9)
      expect(tile.height).toBeLessThanOrEqual(cell.height + 1e-9)
      // La plus grande possible : elle touche au moins un bord de sa case.
      expect(Math.max(tile.width / cell.width, tile.height / cell.height)).toBeCloseTo(1)
    }
  })
})
