// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-header.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; décisions et valeurs inchangées ; commentaires rapportés au réseau (« iRéseau » devient « réseau », le dossier administratif du socle n'est plus cité comme modèle).
/**
 * reseau-header — quelle EN-TÊTE du réseau afficher, et où.
 *
 * Module PUR (aucun import React), même patron que `reseau-layout.ts` et
 * `reseau-agent-nav.ts` : ses tests tournent en environnement `node`,
 * sans testing-library, donc ce qui se DÉCIDE vit ici, où c'est vérifiable.
 *
 * Deux variantes existent, une seule est retenue pour l'instant (LOT A,
 * 2026-08-19) :
 *
 *  · `"strip"` — la barre compacte (`.ip-strip` du socle, régime `desk`) :
 *    avatar 52 px, nom et handle sur une ligne, accroche poussée à droite.
 *    AUCUNE bannière, à AUCUN volet. C'est la décision retenue pour ce lot
 *    (`RESEAU_HEADER_VARIANT`).
 *  · `"cover-fil"` — conservée pour mémoire, non branchée : une bannière ne
 *    réapparaîtrait que sur le fil, jamais sur les autres volets — une
 *    couverture au-dessus d'un annuaire de contacts ou d'un agenda n'a pas de
 *    sens, ce n'est pas le mur qu'elle habille sur LinkedIn ou Facebook.
 */

import type { ReseauAgentTabId } from "./reseau-agent-nav"

export type ReseauHeaderVariant = "strip" | "cover-fil"

/** Décision retenue pour ce lot : la barre compacte, sans bannière, partout. */
export const RESEAU_HEADER_VARIANT: ReseauHeaderVariant = "strip"

/** Hauteur de la bannière réduite (variante `cover-fil`), en pixels. */
export const RESEAU_COVER_HEIGHT = 104

/**
 * Diamètre de l'avatar à cheval sur la bannière (variante `cover-fil`), en
 * pixels. La marge qui le fait chevaucher vaut la MOITIÉ de ce diamètre plus
 * le liseré de 4 px : -(88 / 2 + 4) = -48 — arithmétique vérifiée par le test
 * voisin, pour qu'un changement de l'un des deux nombres se voie tout de
 * suite dans l'autre.
 */
export const RESEAU_COVER_AVATAR = 88

/**
 * La bannière se montre-t-elle pour CE volet, sous CETTE variante ?
 *
 * `"strip"` ne montre jamais de bannière, quel que soit le volet — c'est le
 * choix retenu par ce lot. `"cover-fil"` n'en montre que sur le fil : les
 * autres volets ne sont pas le mur qu'une couverture habille.
 */
export function showCover(
  variant: ReseauHeaderVariant,
  tab: ReseauAgentTabId,
): boolean {
  if (variant === "strip") return false
  return tab === "fil"
}

/** Diamètre de l'avatar de la barre compacte (variante `strip`), en pixels. */
export function stripAvatarSize(): number {
  return 52
}
