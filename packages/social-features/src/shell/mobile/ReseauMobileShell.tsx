// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileShell.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/mobile/`) avec la barre, la commande « Créer » et la feuille de styles qu'il monte ; commentaires rapportés au moteur (la personne, et non « l'agent ») ; props, charpente et ordre des frères inchangés.
"use client"

/**
 * ReseauMobileShell — la charpente de la coquille mobile : en-tête collant,
 * contenu défilant, barre d'onglets, feuille de menu.
 *
 * ⚠️ Ce composant NE DOIT PAS être rendu à l'intérieur de `.rp-scope`.
 * `.rp-scope` déclare `container-type: inline-size`, ce qui implique
 * `contain: layout` : la barre d'onglets en `position: fixed` s'y trouverait
 * cadrée sur la grille du fil au lieu du viewport, et DÉFILERAIT avec elle.
 * C'est le même piège que celui documenté en tête de `ReseauAgentPage` et de
 * `SharePostDialog` — sauf qu'ici il n'y a pas de portail pour le rattraper :
 * une barre de navigation n'est pas une modale.
 *
 * Le conteneur nommé `rp-page` vit donc UN CRAN PLUS BAS, sur le scroller
 * (`.rm-scroll`), qui n'a aucun descendant en `position: fixed` — les trois
 * surfaces flottantes du réseau (`SharePostDialog`, `PostOverflowMenu`,
 * `ReportContentDialog`) passent toutes par un portail vers `<body>`. Les
 * requêtes `@container rp-page` déjà écrites par le composeur et les cartes
 * continuent donc de s'appliquer au téléphone.
 *
 * ⚠️ La barre d'onglets est un FRÈRE du scroller, jamais son enfant : dans le
 * scroller elle défilerait avec le fil. **La commande « Créer » aussi**, pour
 * exactement la même raison (R-02, 2026-09-06).
 */

import type { ReactNode } from "react"
import { ReseauMobileStyles } from "./mobile-styles"
import { ReseauMobileCreateButton } from "./ReseauMobileCreateButton"
import { ReseauMobileTabBar } from "./ReseauMobileTabBar"
import type { CreationKind } from "../../features/reseau-personnel/creation-controller"
import type { ReseauMobileTabId } from "./reseau-mobile-tabs"

export interface ReseauMobileShellProps {
  header?: ReactNode
  children: ReactNode
  /** `false` sur une vue immersive — cf. `shouldShowTabBar`. */
  showTabBar: boolean
  /** L'onglet actif, ou `null` quand aucun ne l'est (Relations, Groupes…). */
  active?: ReseauMobileTabId | null
  /**
   * ⚠️ Plus AUCUNE pastille d'onglet depuis le 2026-09-06 (R-03) : le seul
   * canal qu'elles portaient — l'activité du réseau — vit sur la cloche de
   * l'en-tête. La prop survit parce que `ReseauMobileTabBar` la réclame ;
   * `tabBadge` rend `null` pour tous les onglets.
   */
  badges?: { unreadNotifications?: number }
  /**
   * Le format choisi dans la commande « Créer », ou `undefined` pour ne pas
   * la monter du tout (une coquille sans surface de création).
   */
  onCreate?: (kind: CreationKind) => void
  /** Le handle publié de la personne — transmis à la commande « Créer » (Album). */
  myHandle?: string | null
}

export function ReseauMobileShell({
  header,
  children,
  showTabBar,
  active = null,
  badges = {},
  onCreate,
  myHandle = null,
}: ReseauMobileShellProps) {
  return (
    <div className="rm-shell">
      <ReseauMobileStyles />
      {header}
      <div className="rm-scroll citizen-scrollbar">
        <div className="rm-column">{children}</div>
      </div>
      {/* FRÈRE du scroller : la commande se cache d'elle-même sur les vues
          immersives (même `shouldShowTabBar` que la barre, jamais une seconde
          définition de « plein écran »). */}
      {onCreate ? (
        <ReseauMobileCreateButton onSelect={onCreate} handle={myHandle} />
      ) : null}
      {showTabBar ? (
        <ReseauMobileTabBar active={active} badges={badges} />
      ) : null}
    </div>
  )
}
