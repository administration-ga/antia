// Dupliqué de socle/packages/ui-v2/src/components/theme-toggle.tsx @ 25398f565 — adaptations : sélecteur natif nommé plutôt que bascule à deux états ; retour système toujours disponible, état commun du provider, phrases par i18n et jetons du moteur, cible 44 px et focus visible.
"use client"

import { useId } from "react"
import { useTranslation } from "react-i18next"

import { useOptionalAppearance, type AppearanceMode } from "./provider"

export function AppearanceControl() {
  const appearance = useOptionalAppearance()
  const { t } = useTranslation("shell")
  const id = useId()
  if (appearance === null) return null

  return (
    <label htmlFor={id} className="grid gap-1.5 px-2.5 py-2 text-sm font-semibold text-foreground">
      <span>{t("appearance.label")}</span>
      <select
        id={id}
        value={appearance.mode}
        onChange={(event) => appearance.setMode(event.currentTarget.value as AppearanceMode)}
        style={{ font: "inherit" }}
        className="min-h-11 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <option value="system">{t("appearance.system")}</option>
        <option value="light">{t("appearance.light")}</option>
        <option value="dark">{t("appearance.dark")}</option>
      </select>
    </label>
  )
}
