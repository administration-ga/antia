// Dupliqué de socle/packages/agent-features/src/components/espace-kit/EspaceEmptyState.tsx @ ad2e7fdc2 — adaptations : aucune sur le code (jetons seulement, textes fournis traduits par l'appelant) ; commentaire rapporté au moteur (les surfaces administratives du socle — poste, iBoîte, réglages — ne sont pas dupliquées).
"use client"

import type { ReactNode } from "react"

/**
 * L'état vide du kit d'espace : un filet PLEIN (pas de bordure pointillée —
 * la charte du réseau n'en emploie aucune), la même surface que
 * `.esk-card`, une icône décorative, un titre optionnel et le texte qui
 * explique l'absence.
 *
 * ⚠️ **`compact` est ADDITIF** (X-09, 2026-09-07). Le régime historique — 24 px
 * de rembourrage, texte centré, action posée sur une ligne à part — reste le
 * défaut (le kit est aussi monté hors du réseau, par d'autres applications du
 * moteur, qu'aucun constat ne vise). La variante compacte range le texte et
 * son unique action sur la MÊME ligne quand la place le permet, et divise le
 * rembourrage par deux. C'est la moitié « hauteurs décoratives » de X-09 : deux
 * états vides successifs — « Mes groupes » puis « Découverte » — occupaient à
 * eux seuls près de deux cents pixels pour dire deux fois « rien ici ».
 */
export function EspaceEmptyState({
  text,
  title,
  icon,
  action,
  compact = false,
}: {
  text: string
  title?: string
  icon?: ReactNode
  action?: ReactNode
  /** Rembourrage réduit, texte aligné à gauche, action sur la même ligne. */
  compact?: boolean
}) {
  return (
    <div className="esk-empty" data-density={compact ? "compact" : undefined}>
      {icon ? (
        <div aria-hidden="true" style={{ marginBottom: 8 }}>
          {icon}
        </div>
      ) : null}
      {title ? (
        <p
          style={{
            margin: "0 0 4px",
            fontWeight: 700,
            color: "var(--ink-800)",
          }}
        >
          {title}
        </p>
      ) : null}
      <p style={{ margin: 0 }}>{text}</p>
      {action ? (
        <div
          className="esk-empty-action"
          style={compact ? undefined : { marginTop: 12 }}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}
