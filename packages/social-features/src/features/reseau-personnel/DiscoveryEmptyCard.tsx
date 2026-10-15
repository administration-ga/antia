// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/DiscoveryEmptyCard.tsx @ ad2e7fdc2 — adaptations : primitives de `@antia/ui`, surfaces de la coque (`shell/design-styles`) ; « l'agent » devient « la personne » dans la doc ; code inchangé (titre et message déjà traduits par l'appelant).
"use client"

import { Card } from "@antia/ui"

import { RESEAU_SURFACE_STYLE } from "../../shell/design-styles"
import type { DiscoveryPresentation } from "./suggestions-actions"

/**
 * Une liste de découverte vide reste une information utile.
 *
 * Le rail ne doit pas sembler cassé quand la personne a déjà épuisé les
 * candidats disponibles : on conserve le titre de la carte et on explique
 * l'absence, sans relâcher les filtres de confidentialité côté serveur.
 */
export function DiscoveryEmptyCard({
  title,
  message,
  presentation,
}: {
  /** Déjà traduit par l'appelant. */
  title: string
  /** Déjà traduit par l'appelant. */
  message: string
  presentation: DiscoveryPresentation
}) {
  const content = (
    <section className="rp-discovery-module" aria-label={title} style={{ padding: presentation === "carousel" ? "2px 0" : 20 }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: presentation === "carousel" ? 15 : 10.5,
          fontWeight: 700,
          letterSpacing: presentation === "carousel" ? undefined : "0.09em",
          textTransform: presentation === "carousel" ? undefined : "uppercase",
          color: presentation === "carousel" ? "var(--ink-900)" : "var(--ink-500)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--ink-600)",
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
    </section>
  )

  return presentation === "carousel" ? (
    content
  ) : (
    <Card padded={false} style={RESEAU_SURFACE_STYLE}>
      {content}
    </Card>
  )
}
