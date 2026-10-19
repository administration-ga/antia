"use client"

/**
 * FeedModeToggle — la bascule Liste / Immersion du fil (lot P04), TOUJOURS
 * visible et étiquetée : deux boutons à bascule (`aria-pressed`) dans un
 * groupe nommé, chacun avec son icône ET son libellé (jamais l'icône seule).
 *
 * Quand l'écran est trop bas pour l'Immersion (paysage, zoom), le bouton
 * « Immersion » reste focalisable mais inactif (`aria-disabled`), et la
 * raison est dite à côté — plutôt qu'un bouton qui disparaît sans
 * explication. Le choix de la personne n'est pas effacé : il revient dès que
 * la hauteur le permet.
 */
import { GalleryVerticalEnd, List } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import type { FeedMode } from "./feed-mode"
import { FeedImmersionStyles } from "./immersive-styles"
import type { FeedModeState } from "./use-feed-mode"

export function FeedModeToggle({ state, onChange }: { state: FeedModeState; onChange?: (mode: FeedMode) => void }) {
  const { t } = useTranslation("reseau")
  const noteId = useId()
  const lowHeight = state.fallback === "lowHeight"

  const choose = (mode: FeedMode) => {
    if (mode === "immersive" && lowHeight) return
    if (mode === state.effective && mode === state.preferred) return
    if (onChange !== undefined) onChange(mode)
    else state.setMode(mode)
  }

  return (
    <div className="fil-mode" role="group" aria-label={t("feedMode.groupLabel")} aria-describedby={lowHeight ? noteId : undefined}>
      <FeedImmersionStyles />
      <button type="button" className="fil-mode-option" aria-pressed={state.effective === "list"} onClick={() => choose("list")}>
        <List aria-hidden="true" size={18} strokeWidth={2.2} />
        <span>{t("feedMode.list")}</span>
      </button>
      <button
        type="button"
        className="fil-mode-option"
        aria-pressed={state.effective === "immersive"}
        aria-disabled={lowHeight || undefined}
        aria-describedby={lowHeight ? noteId : undefined}
        onClick={() => choose("immersive")}
      >
        <GalleryVerticalEnd aria-hidden="true" size={18} strokeWidth={2.2} />
        <span>{t("feedMode.immersive")}</span>
      </button>
      {lowHeight ? (
        <p id={noteId} className="fil-mode-note">
          {t("feedMode.lowHeight")}
        </p>
      ) : null}
    </div>
  )
}
