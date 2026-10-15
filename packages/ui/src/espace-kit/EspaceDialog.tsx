// Dupliqué de socle/packages/agent-features/src/components/espace-kit/EspaceDialog.tsx @ ad2e7fdc2 — adaptations : imports internes au paquet en relatif (`../sheet/overlay-scope` pour la portée de charte des portails, `../components/icon`, `../hooks/use-modal-a11y`) ; libellé de la croix « Fermer » en dur → nouvelle prop OBLIGATOIRE `closeLabel` traduite par l'appelant (le paquet n'a pas d'i18n, comme le tiroir et `Alert`) ; commentaires du Poste rapportés à la coque qui publie la portée ; construction inchangée.
"use client"

/**
 * La boîte de dialogue du kit d'espace — même construction que
 * `SharePostDialog.tsx` (réseau personnel), et pour la MÊME raison : les
 * pages du réseau déclarent `container-type: inline-size` pour mesurer leur
 * largeur réelle, ce qui implique `contain: layout` — tout descendant en
 * `position: fixed` devient alors cadré sur la grille au lieu du viewport, et
 * défilerait avec la page. Le portail sort la boîte de ce confinement, et rend
 * l'inertage de `useModalA11y` exact (le hook épargne l'enfant de `<body>` qui
 * contient le dialogue).
 *
 * Le portail vise l'HÔTE DE LA COQUE quand il existe (`useOverlayContainer`,
 * portée de charte publiée par `OverlayScopeProvider`) : la boîte hérite alors
 * la charte de la coque qui la monte — police, rayons, contrôles, couleurs —
 * au lieu de celle de la racine. À défaut, `document.body`.
 *
 * Carte EN TRANCHES : en-tête fixe, corps seul défilant (et seulement si la
 * fenêtre manque), pied d'actions fixe. Une boîte qui défilerait d'un bloc
 * ferait sortir titre et actions de la vue sur un écran de portable.
 *
 * `mounted` retarde le premier rendu réel d'un tour : `createPortal` a
 * besoin du DOM, absent au rendu serveur — rendre autre chose au premier
 * passage client provoquerait un désaccord d'hydratation.
 *
 * ⚠️ `closeLabel` est OBLIGATOIRE : la croix n'a pas de texte visible, et le
 * paquet n'a pas d'i18n — sans ce libellé traduit par l'appelant, le seul
 * bouton de fermeture n'aurait aucun nom pour un lecteur d'écran.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Icon } from "../components/icon"
import { useModalA11y } from "../hooks/use-modal-a11y"
import { useOverlayContainer } from "../sheet/overlay-scope"

export function EspaceDialog({
  title,
  description,
  onClose,
  closeLabel,
  footer,
  width,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  /** Nom accessible de la croix de fermeture, traduit par l'appelant (« Fermer »). */
  closeLabel: string
  footer?: ReactNode
  width?: number
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const container = useOverlayContainer()
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <EspaceDialogContent
      title={title}
      description={description}
      onClose={onClose}
      closeLabel={closeLabel}
      footer={footer}
      width={width}
    >
      {children}
    </EspaceDialogContent>,
    container ?? document.body,
  )
}

function EspaceDialogContent({
  title,
  description,
  onClose,
  closeLabel,
  footer,
  width,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  closeLabel: string
  footer?: ReactNode
  width?: number
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Échap, focus initial, piège de focus, inertage du reste de la page et
  // restitution du focus au déclencheur — le tout par le hook partagé.
  useModalA11y({ containerRef: dialogRef, onClose })

  return (
    <div
      className="esk-dialog-veil"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="esk-dialog"
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className="esk-dialog-header">
          <h2 id={titleId} className="esk-dialog-title">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="esk-dialog-description">
              {description}
            </p>
          ) : null}
          <button
            type="button"
            className="esk-dialog-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="esk-dialog-body">{children}</div>
        {footer ? <div className="esk-dialog-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
