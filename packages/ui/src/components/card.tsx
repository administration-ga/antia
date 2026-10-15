// Dupliqué de socle/packages/ui-v2/src/components/card.tsx @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

import type { CSSProperties, MouseEventHandler, ReactNode } from "react"

export interface CardProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  padded?: boolean
  hover?: boolean
  onClick?: MouseEventHandler<HTMLDivElement>
}

export const Card = ({
  children,
  className,
  style,
  padded = true,
  hover = false,
  onClick,
}: CardProps) => (
  <div
    data-slot="card"
    className={className}
    onClick={onClick}
    style={{
      background: "var(--ink-0)",
      border: "1px solid var(--ink-200)",
      borderRadius: "var(--radius-lg)",
      // Jeton : 24 px de rembourrage sur les deux bords coûtent 48 px de
      // largeur utile, soit 13 % d'un écran de 375 px. Il descend à 16 px
      // sous 1024 px (cf. `@workspace/ui/styles/globals.css`).
      padding: padded ? "var(--ui2-card-pad, 24px)" : 0,
      boxShadow: "var(--shadow-xs)",
      cursor: hover || onClick ? "pointer" : "default",
      transition: "border-color .12s, box-shadow .12s",
      ...style,
    }}
  >
    {children}
  </div>
)
