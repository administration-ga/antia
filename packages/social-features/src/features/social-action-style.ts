import type { CSSProperties } from "react"

/** Actions sociales compactes : angle modéré ANTSIA, repli du réseau consommateur.
 * La couleur reste portée par la variante métier du bouton. Les filtres et
 * la navigation gardent leur propre géométrie. */
export const COMPACT_SOCIAL_ACTION_STYLE: CSSProperties = {
  borderRadius: "var(--esp-social-action-radius, var(--ui2-button-radius, 6px))",
  minHeight: 44,
  padding: "8px 14px",
  fontWeight: 600,
  lineHeight: 1.25,
  whiteSpace: "normal",
  textAlign: "center",
}
