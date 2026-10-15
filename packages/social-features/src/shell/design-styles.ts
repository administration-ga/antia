// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/design-styles.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; styles inchangés, jetons de la charte de base du moteur (`--esp-surface-card`, jetons shadcn) et rayon des surfaces du réseau (`--rp-surface-radius`, couche de communication) ; commentaires rapportés au réseau (plus de maquette iProfil ni de charte de l'espace personnel).
import type { CSSProperties } from "react"

/**
 * Surfaces du réseau.
 *
 * Les couleurs restent volontairement sémantiques : la charte de base du
 * moteur (et le thème du réseau) résout ces rôles en clair comme en sombre.
 */
export const RESEAU_SURFACE_STYLE = {
  background: "var(--esp-surface-card, var(--secondary))",
  border: "1px solid var(--border)",
  /* La page réseau du bureau pose son rayon de surface sur .rp-scope. Le repli
     conserve le contrat historique pour les composants rendus hors page. */
  borderRadius: "var(--rp-surface-radius, 18px)",
  boxShadow: "none",
} satisfies CSSProperties

export const RESEAU_CARD_STYLE = {
  ...RESEAU_SURFACE_STYLE,
  padding: "18px 20px",
} satisfies CSSProperties

/**
 * La surface d'une PUBLICATION du fil — sans filet (décision utilisateur du
 * 2026-08-21) : dans un fil où le média traverse la carte bord à bord, le
 * liseré encadrait chaque publication comme une pièce jointe. La carte se
 * distingue du fond par sa seule surface (parchemin sur blanc en clair,
 * gris relevé sur noir en sombre) et par les gouttières du fil.
 *
 * ⚠️ Réservée aux PUBLICATIONS (PostCard). Les panneaux, rails et cartes
 * d'information du réseau gardent `RESEAU_SURFACE_STYLE` et son filet :
 * ce sont des surfaces de dossier, pas des objets de fil.
 */
export const POST_SURFACE_STYLE = {
  ...RESEAU_SURFACE_STYLE,
  border: "none",
} satisfies CSSProperties

export const RESEAU_HERO_STYLE = {
  ...RESEAU_SURFACE_STYLE,
  borderRadius: 20,
  padding: 24,
} satisfies CSSProperties

export const RESEAU_INNER_CARD_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  boxShadow: "none",
} satisfies CSSProperties

export const RESEAU_PRIMARY_ACTION_STYLE = {
  borderRadius: 11,
  padding: "10px 18px",
  fontSize: 13.5,
  fontWeight: 700,
} satisfies CSSProperties

export const RESEAU_SECONDARY_ACTION_STYLE = {
  borderRadius: 11,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--muted-foreground)",
  padding: "9px 13px",
  fontSize: 12.5,
  fontWeight: 700,
} satisfies CSSProperties

export const RESEAU_PILL_ACTION_STYLE = {
  borderRadius: 999,
} satisfies CSSProperties

export const RESEAU_FIELD_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--input)",
  background: "var(--card)",
} satisfies CSSProperties
