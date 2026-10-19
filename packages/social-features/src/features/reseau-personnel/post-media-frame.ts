/**
 * Le CADRE d'un média de publication dans la présentation « media » — module
 * pur, testé (lot P03 de l'étude social-commerce du 18/10/2026,
 * `docs/etudes/2026-10-18-social-commerce/04_PARCOURS_FIL_ET_PUBLICATIONS.md` §2).
 *
 * La présentation historique (« classic ») impose un cadre 16:10 et recadre les
 * photos (`cover`). Ici, le cadre suit le RATIO RÉEL du média, dans des bornes :
 *  · photo : de 4:5 (portrait de référence du fil) à 1,91:1 (paysage) — un
 *    carré tient tel quel ;
 *  · vidéo : de 9:16 (vertical) à 16:9 (paysage).
 * Hors de ces bornes, le cadre s'arrête à la borne et le média ENTIER y tient
 * (`contain`) avec des bandes de fond : jamais de recadrage qui masquerait une
 * étiquette, un prix ou un visage, jamais de déformation.
 *
 * Le ratio vient des dimensions DÉCLARÉES du `PostMediaDto` quand elles
 * existent (aucun saut à l'affichage), sinon des dimensions que le navigateur
 * mesure au chargement. Avant toute mesure, un carré est réservé : le milieu
 * des bornes, le plus petit saut possible quand le média arrive.
 *
 * Ces dimensions ne servent QU'AU rendu : elles ne décident d'aucun droit ni
 * d'aucune admission (la garde des fichiers reste seule juge, `servableUrl`).
 */
import type { PostMediaDto } from "@antsia/social-contracts/media"

/** Bornes du cadre d'une photo : 4:5 (portrait de référence) à 1,91:1. */
export const PHOTO_FRAME_RATIO = { min: 4 / 5, max: 1.91 } as const

/** Bornes du cadre d'une vidéo : 9:16 (vertical) à 16:9. */
export const VIDEO_FRAME_RATIO = { min: 9 / 16, max: 16 / 9 } as const

/** Le cadre réservé tant que le ratio est inconnu : le carré. */
export const RESERVED_FRAME_RATIO = 1

/**
 * Rapport largeur / hauteur de dimensions VALIDES, sinon `null` : une
 * dimension absente, nulle, négative ou non finie ne vaut rien.
 */
export function intrinsicRatio(width: number | undefined, height: number | undefined): number | null {
  if (width === undefined || height === undefined) return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}

/** Le ratio déclaré par le DTO d'un média, s'il est exploitable. */
export function declaredRatio(item: Pick<PostMediaDto, "width" | "height">): number | null {
  return intrinsicRatio(item.width, item.height)
}

/**
 * Le ratio du CADRE pour un média : son ratio réel ramené dans les bornes de
 * sa nature, ou le carré réservé quand il est inconnu.
 */
export function frameRatioFor(kind: PostMediaDto["kind"], ratio: number | null): number {
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return RESERVED_FRAME_RATIO
  const range = kind === "video" ? VIDEO_FRAME_RATIO : PHOTO_FRAME_RATIO
  return Math.min(range.max, Math.max(range.min, ratio))
}

/**
 * La valeur CSS `aspect-ratio` d'un cadre — arrondie au dix-millième : un
 * rendu stable d'un passage à l'autre (serveur, hydratation), sans flottant
 * bruité.
 */
export function aspectRatioValue(ratio: number): string {
  return String(Math.round(ratio * 10_000) / 10_000)
}

/**
 * Un média RETENU par la garde des fichiers : pas d'URL, ou une retenue
 * nommée. Défense en profondeur : une URL accompagnée d'une retenue n'est
 * jamais rendue (le serveur ne produit pas cette paire, l'écran ne la croit pas).
 */
export function isWithheldMedia(item: Pick<PostMediaDto, "url" | "withheld">): boolean {
  return item.url === null || item.withheld !== null
}

/**
 * Le cadre d'une GALERIE : celui de sa première photo (le choix de l'auteur,
 * comme la couverture d'un album) ; les suivantes s'y tiennent entières, avec
 * des bandes si leur ratio diffère. `measuredFirst` : le ratio mesuré par le
 * navigateur quand le DTO n'en déclare pas.
 */
export function galleryFrameRatio(images: readonly Pick<PostMediaDto, "width" | "height">[], measuredFirst: number | null): number {
  const first = images[0]
  const ratio = (first ? declaredRatio(first) : null) ?? measuredFirst
  return frameRatioFor("image", ratio)
}
