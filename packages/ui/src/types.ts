// Dupliqué de socle/packages/ui-v2/src/types.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import type { CSSProperties, ReactNode } from "react"

export type Tone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "archived"
  | "active"
  | "semi"
  | "inactive"
  | "destruct"

export type Size = "sm" | "md" | "lg"

export interface SidebarItemLink {
  id: string
  label: string
  icon: string
  count?: number
  /** Nombre d'éléments urgents, affiché dans une pastille distincte. */
  urgentCount?: number
  /**
   * Libellé ACCESSIBLE des pastilles chiffrées (« 12 dossiers à traiter »,
   * « 3 urgents »). Une pastille ne porte qu'un nombre nu : sans ce libellé,
   * un lecteur d'écran annonce « iCorrespondance 12 3 » sans jamais dire de
   * quoi il s'agit. La sidebar ne les fabrique pas — elle n'a pas d'i18n :
   * ils arrivent traduits de l'app hôte.
   */
  countLabel?: string
  urgentCountLabel?: string
  /**
   * Le module porté par cet item n'est pas accessible : la ligne est GRISÉE.
   *
   * Un rail de navigation ne porte que des PASTILLES — jamais une phrase
   * d'état. « Verrouillé » et « Essai : 12 jours restants, extensible »
   * s'écrivaient ici en toutes lettres : à 280 px de large, le libellé du
   * module lui-même se faisait tronquer par son propre badge (« iC… » pour
   * iCorrespondance). L'indisponibilité se DIT par le gris ; ce qu'il faut
   * faire pour la lever se dit dans le module, pas dans le rail.
   *
   * La ligne reste cliquable : la page de destination explique comment
   * débloquer (`ModuleUpsellPanel`). Une entrée éteinte et morte laisserait
   * l'agent sans recours.
   */
  locked?: boolean
  /**
   * Phrase annonçant le verrou aux technologies d'assistance (« Verrouillé »).
   * Le gris ne dit rien à un lecteur d'écran, et la sidebar n'a pas d'i18n :
   * ce libellé arrive traduit de l'app hôte, comme `countLabel`. Sans lui, la
   * ligne est grisée sans être annoncée.
   */
  lockedLabel?: string
  href?: string
  children?: SidebarItemLink[]
}

export interface SidebarItemSection {
  section: string
}

export interface SidebarItemSpacer {
  /**
   * Espace extensible : absorbe la hauteur libre et pousse les items qui le
   * suivent vers le bas de la sidebar (ex. section « Compte »).
   */
  spacer: true
}

export type SidebarItem =
  | SidebarItemLink
  | SidebarItemSection
  | SidebarItemSpacer

export interface StylableProps {
  style?: CSSProperties
  className?: string
  children?: ReactNode
}
