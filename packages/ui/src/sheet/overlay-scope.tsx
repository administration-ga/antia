// Dupliqué de socle/packages/ui/src/components/overlay-scope.tsx @ ad2e7fdc2 — adaptations : `cn` du paquet ; commentaires du Poste conservés comme historique de la cause (portée de charte des portails).
"use client"

/**
 * Portée de charte des surfaces FLOTTANTES — cartes flottantes (dialogues),
 * confirmations, tiroirs, listes déroulantes, menus, infobulles.
 *
 * Toutes ces surfaces sont portalisées dans `<body>` : elles sortent donc du
 * nœud qui porte la charte de la page — pour le Poste,
 * `.dash-v2.poste-workspace[data-charte="espace-structure"]`. Or les jetons
 * (propriétés personnalisées) s'héritent par l'arbre DOM, pas par l'arbre
 * React : une carte ouverte depuis le Poste rendait la police, les rayons,
 * les contrôles et les couleurs de la charte RACINE — la carte d'un autre
 * produit posée sur l'espace de travail. Le pont CSS
 * `body:has(.poste-workspace) [data-slot=dialog-content]` (globals.css) ne
 * rattrapait que le rayon et l'ombre.
 *
 * Le shell qui pose la charte la publie ici (`OverlayScopeProvider`). Le
 * fournisseur monte UN hôte de portail sous `<body>` — un nœud
 * `display: contents` qui porte les classes et le `data-charte` du shell — et
 * chaque primitive portalisée d'`@workspace/ui` y monte sa surface
 * (`container` des portails Radix). Sans boîte, l'hôte ne change rien à la
 * géométrie (surfaces en `position: fixed`, enveloppe « popper » de Radix,
 * contexte d'empilement racine) ; il suffit à rendre effectives les règles
 * scopées de la charte et l'héritage de ses jetons.
 *
 * ⚠️ Pourquoi un hôte et non une enveloppe autour de chaque surface : les
 * portails de Radix enveloppent CHAQUE enfant d'une `Presence`, qui a besoin
 * du nœud animé lui-même pour jouer l'animation de sortie. Une enveloppe
 * intercalée lui cacherait ce nœud — la carte disparaîtrait sèchement.
 *
 * C'est, rendu automatique pour toutes les surfaces d'un espace, le geste que
 * `VerticalShellFrame` faisait à la main sur son tiroir et sa boîte de
 * déconnexion, et que `PortalSurface` (ui-v2) fait pour `<dialog>`.
 *
 * Hors d'un shell qui publie une portée (back-office, pages publiques, espace
 * personnel), l'hôte vaut `undefined` : les primitives portalisent dans
 * `<body>` comme avant. Au rendu serveur et au tout premier rendu client,
 * l'hôte n'existe pas encore — même repli.
 */
import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "../lib/cn"

export interface OverlayScope {
  /** Classes du nœud de charte à re-poser (ex. `dash-v2 poste-workspace`). */
  readonly className: string
  /** Valeur de `data-charte` du nœud de charte (ex. `espace-structure`). */
  readonly charte?: string
}

const OverlayScopeContext = React.createContext<HTMLElement | null>(null)

/**
 * Publie la portée de charte pour toutes les surfaces flottantes ouvertes
 * depuis le sous-arbre. `scope={null}` coupe une portée héritée.
 */
function OverlayScopeProvider({
  scope,
  children,
}: {
  scope: OverlayScope | null
  children?: React.ReactNode
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <OverlayScopeContext.Provider value={scope ? host : null}>
      {children}
      {scope && mounted
        ? createPortal(
            <div
              ref={setHost}
              data-slot="overlay-scope"
              className={cn(scope.className)}
              data-charte={scope.charte}
              // En style EN LIGNE, pas en utilitaire : une règle de charte non
              // « layerisée » qui poserait un jour `display` sur ces classes
              // battrait un utilitaire et redonnerait une boîte à l'hôte.
              style={{ display: "contents" }}
            />,
            document.body
          )
        : null}
    </OverlayScopeContext.Provider>
  )
}

/**
 * L'hôte de portail de la portée en vigueur — `undefined` hors d'un shell qui
 * en publie une (valeur directement passable au `container` des portails).
 */
function useOverlayContainer(): HTMLElement | undefined {
  return React.useContext(OverlayScopeContext) ?? undefined
}

export { OverlayScopeProvider, useOverlayContainer }
