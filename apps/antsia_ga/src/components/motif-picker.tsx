"use client"

import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { cn } from "@antsia/ui/lib/cn"
import { Check } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

/** Le fond uni, choix par défaut : aucun motif posé sur la page. */
const NONE = "none"

/**
 * Préférences > Motif de fond (ADR-0027) : le fond reste uni par défaut ; le
 * membre peut y poser un motif discret (points, quadrillage, grain, projecteur),
 * peint sur le fond de la page seulement, jamais sur les cartes. Le choix est
 * immédiat et propre à l'appareil, comme le mode sombre. Puces sans contour : le
 * choix se lit à l'aplat d'identité et au crochet ; l'anneau n'apparaît qu'au focus.
 */
export function MotifPicker() {
  const appearance = useOptionalAppearance()
  const { t } = useTranslation("antsia")
  const name = useId()
  const hintId = `${name}-hint`
  if (appearance === null || appearance.motifs.length === 0) return null
  const current = appearance.motif ?? NONE

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="text-sm font-semibold text-foreground">{t("preferences.motif.label")}</legend>
      <p id={hintId} className="-mt-1 text-xs text-muted-foreground">{t("preferences.motif.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {[NONE, ...appearance.motifs].map((id) => {
          const checked = current === id
          return (
            <label
              key={id}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--esp-chip-radius,0.625rem)] px-3.5 text-sm font-semibold transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                checked
                  ? "bg-[var(--primary-fill)] text-[color:var(--primary-fill-on,var(--on-fill))]"
                  : "bg-[var(--esp-chip-bg,var(--muted))] text-foreground hover:bg-[var(--esp-neutral-hover,var(--muted))]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={checked}
                onChange={() => appearance.setMotif(id === NONE ? null : id)}
                aria-describedby={hintId}
                className="sr-only"
              />
              {checked ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} /> : null}
              {t(`preferences.motif.options.${id}`)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
