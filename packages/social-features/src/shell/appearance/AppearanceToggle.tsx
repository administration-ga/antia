"use client"

import { Moon, Sun } from "lucide-react"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"

import { useOptionalAppearance } from "./provider"

/** Le rond gris des icônes de l'en-tête (ADR-0027) ; replis : fond transparent et rond plein. */
const DEFAULT_LOOK =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--esp-header-icon-radius,999px)] bg-[var(--esp-header-icon-bg,transparent)] text-foreground transition-colors hover:bg-[var(--esp-neutral-hover,var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export interface AppearanceToggleProps {
  /** Remplace la facture par défaut, pour adopter celle de l'hôte (onglets de l'en-tête mobile). */
  className?: string
  /** La géométrie de l'hôte quand ses règles l'emportent sur les classes (largeur fixe d'un onglet). */
  style?: CSSProperties
}

/**
 * Le bouton rond du mode sombre : chaque appui passe du clair au sombre, puis
 * du sombre au clair. Il pose un choix explicite (comme le sélecteur
 * d'apparence), mémorisé pour ce réseau sur cet appareil ; « Système » reste
 * offert dans les préférences.
 *
 * L'icône suit la classe `.dark` que le script d'amorçage pose sur <html> avant
 * l'affichage : la lune en clair, le soleil en sombre, sans saut à
 * l'hydratation. `aria-pressed` dit si le mode sombre est actif ; le nom reste
 * stable (« Mode sombre ») et le titre annonce l'effet du prochain appui.
 */
export function AppearanceToggle({ className, style }: AppearanceToggleProps) {
  const appearance = useOptionalAppearance()
  const { t } = useTranslation("shell")
  if (appearance === null) return null
  const dark = appearance.resolvedAppearance === "dark"

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={t("appearance.darkMode")}
      title={dark ? t("appearance.toLight") : t("appearance.toDark")}
      onClick={() => appearance.setMode(dark ? "light" : "dark")}
      className={className ?? DEFAULT_LOOK}
      style={style}
      data-appearance-toggle=""
    >
      <Moon aria-hidden="true" className="size-5 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-5 dark:block" />
    </button>
  )
}
