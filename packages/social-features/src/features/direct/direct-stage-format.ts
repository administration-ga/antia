// Dupliqué de socle/packages/agent-features/src/features/direct/direct-stage-format.ts @ ad2e7fdc2 — adaptations : contrat de format seul ; capacité importée du domaine et libellés dans les locales.
/**
 * Occupation de l'antenne d'un DIRECT — QUI a une place, et laquelle.
 *
 * Module PUR : aucun import React ou LiveKit. Les spectateurs cachés sont
 * rejetés par leur préfixe d'identité avant même que le composant ne décide
 * quoi rendre.
 *
 * ⚠️ CE MODULE NE DÉCIDE PLUS DE LA DISPOSITION (D-04). L'en-tête affirmait ici
 * que « la scène garde toujours huit places, quel que soit le nombre de pistes
 * connectées » : c'était le défaut, pas la règle. Six cases « Place intervenant
 * n » occupaient les trois quarts de l'écran d'un direct à deux, et le cadre de
 * la scène était dimensionné en `vh` selon le format d'ÉMISSION — la session
 * imposant sa hauteur à un lecteur qu'elle ne connaît pas.
 *
 * Depuis le 2026-09-07, la disposition se mesure sur le CONTENEUR
 * (`direct-scene.ts`), et les places libres ne se rendent plus que là où elles
 * veulent dire quelque chose : la console de l'hôte (« n / 8 intervenants »,
 * `antennaCapacityLabel`) et la grille fixe qu'il a explicitement demandée.
 */

import { DIRECT_MAX_SPEAKERS } from "@antsia/social-domain/live/domain"

export const DIRECT_STAGE_CAPACITY = DIRECT_MAX_SPEAKERS

export type DirectStageFormat = "television" | "computer" | "mobile"

export type DirectStageLayout = {
  aspectRatio: "16 / 9" | "4 / 3" | "9 / 16"
  columns: 2 | 4
  rows: 2 | 4
}

const STAGE_LAYOUTS: Record<DirectStageFormat, DirectStageLayout> = {
  television: { aspectRatio: "16 / 9", columns: 4, rows: 2 },
  computer: { aspectRatio: "4 / 3", columns: 4, rows: 2 },
  mobile: { aspectRatio: "9 / 16", columns: 2, rows: 4 },
}

/** Les anciennes sessions ou une valeur réseau inconnue restent lisibles. */
export function normalizeDirectStageFormat(value: unknown): DirectStageFormat {
  return value === "television" || value === "mobile" || value === "computer"
    ? value
    : "computer"
}

export function directStageLayout(value: unknown): DirectStageLayout {
  return STAGE_LAYOUTS[normalizeDirectStageFormat(value)]
}
