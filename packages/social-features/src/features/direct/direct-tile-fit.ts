/**
 * direct-tile-fit — LA TAILLE D'UNE TUILE DANS SA CASE (studio d'un direct).
 *
 * Une case de la scène (grille de personnes, image dominante, vignette du
 * bandeau) est un CONTENEUR DE TAILLE : la tuile y prend la plus grande taille à
 * la proportion de la source qui tienne en largeur ET en hauteur, centrée. Sa
 * largeur se borne par les unités du conteneur (`cqw`, `cqh`) ; sa hauteur suit la
 * proportion.
 *
 * ⚠️ Jamais `h-full` + `aspect-ratio` : la largeur suivait alors la hauteur de la
 * rangée et débordait la colonne. Mesuré dans Chromium le 19/10/2026, à 390 px :
 * des tuiles de 332 px dans des colonnes de 162 px, chevauchées, épingles rognées.
 */
export const DIRECT_SCENE_CELL_CLASS = "grid min-h-0 min-w-0 place-items-center [container-type:size]"

/** Le style d'une tuile (ou d'une place libre) contenue dans une case `DIRECT_SCENE_CELL_CLASS`. */
export function directTileFit(aspect: number): { aspectRatio: number; width: string } {
  return { aspectRatio: aspect, width: `min(100cqw, ${aspect * 100}cqh)` }
}
