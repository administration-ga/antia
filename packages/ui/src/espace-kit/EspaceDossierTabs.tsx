// Dupliqué de socle/packages/agent-features/src/components/espace-kit/EspaceDossierTabs.tsx @ ad2e7fdc2 — adaptations : aucune sur le code (copie textuelle) : libellés, décomptes et nom de la liste d'onglets arrivent déjà traduits de l'appelant ; renvois des commentaires rapportés à la coque du moteur.
"use client"

import type { KeyboardEvent, ReactNode } from "react"

/**
 * Un onglet du dossier — le décompte est optionnel et double,
 * volontairement : `badge` est le chiffre affiché (`aria-hidden`), `badgeLabel`
 * la phrase qui dit CE QUE ce chiffre compte pour qui n'entend pas le visuel.
 * Un « 3 » nu annoncé après « Relations » ne dit pas 3 quoi (même règle que
 * `TabLabel` dans `ReseauAgentPage.tsx`, coque du réseau). Le paquet n'a pas
 * d'i18n : les deux arrivent traduits de l'appelant.
 */
export interface EspaceDossierTab {
  id: string
  label: string
  badge?: string | null
  badgeLabel?: string | null
  /**
   * Icône DÉCORATIVE, posée avant le libellé. Elle est masquée aux lecteurs
   * d'écran : le libellé porte déjà le sens, et l'annoncer deux fois est du
   * bruit. Facultative — un onglet sans icône reste aligné avec ses voisins.
   */
  icon?: ReactNode
}

/**
 * Le tablist « chemise » du kit d'espace — mêmes règles ARIA et clavier que
 * `ReseauAgentTabs` (`shell/ReseauAgentPage.tsx` de `@antsia/social-features`) :
 * flèches droite/bas → suivant (cyclique), gauche/haut → précédent,
 * Home/End → premier/dernier, et le focus SUIT toujours la sélection.
 *
 * Le clavier est géré au niveau du CONTENEUR (`role="tablist"`), pas bouton
 * par bouton : l'index de départ se déduit de `current`, qui reste toujours
 * la vérité côté appelant (un clic ou une flèche appellent `onChange` puis
 * déplacent le focus, jamais l'inverse).
 */
export function EspaceDossierTabs({
  tabs,
  current,
  onChange,
  "aria-label": ariaLabel,
  panelId,
  idPrefix,
  className,
}: {
  tabs: readonly EspaceDossierTab[]
  current: string
  onChange: (id: string) => void
  "aria-label": string
  panelId: string
  idPrefix: string
  className?: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const ids = tabs.map((tab) => tab.id)
    if (ids.length === 0) return
    const index = ids.indexOf(current)
    const base = index === -1 ? 0 : index
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? ids[(base + 1) % ids.length]
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? ids[(base - 1 + ids.length) % ids.length]
          : event.key === "Home"
            ? ids[0]
            : event.key === "End"
              ? ids[ids.length - 1]
              : undefined
    if (next === undefined) return
    event.preventDefault()
    onChange(next)
    document.getElementById(idPrefix + next)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={["esk-tabs", className].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === current
        return (
          <button
            key={tab.id}
            id={idPrefix + tab.id}
            type="button"
            role="tab"
            aria-controls={panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="esk-tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.icon ? (
              <span className="esk-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
            ) : null}
            {tab.label}
            {tab.badge ? (
              <>
                <span className="esk-count" aria-hidden="true">
                  {tab.badge}
                </span>
                <span className="sr-only">{tab.badgeLabel ?? ""}</span>
              </>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
