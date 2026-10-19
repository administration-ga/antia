"use client"

import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { Check } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { useThemeChoice } from "./personal-theme"

/**
 * Préférences > Thème : la charte d'origine et les sept thèmes d'antsia.ga.
 * Chaque option est peinte dans SON thème (`data-charte` sur l'option) : le
 * membre voit le fond, la carte, le texte et la couleur d'action avant de
 * choisir. Le choix est immédiat, sans bouton d'enregistrement : en session, il
 * s'enregistre sur le compte (`PersonalTheme`) ; sinon il reste sur l'appareil.
 * Aucun contour (surfaces de couleurs différentes) : le choix se lit au
 * crochet et au nom dans la couleur d'action ; l'anneau n'apparaît qu'au focus.
 */
export function ThemePicker() {
  const appearance = useOptionalAppearance()
  const choose = useThemeChoice()
  const { t } = useTranslation("antsia")
  const name = useId()
  const hintId = `${name}-hint`
  if (appearance === null || appearance.themes.length < 2) return null
  const select = choose ?? appearance.setTheme

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="text-sm font-semibold text-foreground">{t("preferences.theme.label")}</legend>
      <p id={hintId} className="-mt-1 text-xs text-muted-foreground">{t(choose ? "preferences.theme.hint" : "preferences.theme.hintDevice")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {appearance.themes.map((entry) => {
          const checked = appearance.theme === entry.id
          return (
            <label
              key={entry.id}
              data-charte={entry.charte}
              className={`relative grid min-w-0 cursor-pointer gap-2 rounded-[var(--radius)] bg-card p-2 text-card-foreground shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background ${checked ? "shadow-[var(--shadow-md)]" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={entry.id}
                checked={checked}
                onChange={() => select(entry.id)}
                aria-describedby={hintId}
                className="sr-only"
              />
              <span aria-hidden="true" className="flex h-12 items-end gap-1.5 rounded-[calc(var(--radius)-4px)] bg-background p-1.5">
                <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-1 rounded-md bg-card px-1.5 shadow-[var(--shadow-xs)]">
                  <span className="h-1.5 w-3/4 rounded-full bg-foreground" />
                  <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground" />
                </span>
                <span className="h-5 w-8 shrink-0 rounded-full bg-primary" />
              </span>
              <span className="flex items-center justify-between gap-1">
                <span className={`truncate text-sm font-semibold ${checked ? "text-primary" : ""}`}>{t(`preferences.theme.options.${entry.id}.name`)}</span>
                {checked ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2.5} /> : null}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">{t(`preferences.theme.options.${entry.id}.description`)}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
