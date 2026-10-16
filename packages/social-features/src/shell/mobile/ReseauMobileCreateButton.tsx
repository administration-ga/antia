// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileCreateButton.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/mobile/`) ; vues immersives jugées sur la table des routes INJECTÉE (`shouldShowTabBar(pathname, useRoutes())`) au lieu des chemins de l'espace ; carte de choix par la coque légère (`shell/floating-card/EspaceFloatingCard`) et décalage bas par `shell/floating-surface/use-surface-insets` ; formats lus dans le catalogue du moteur (`creationEntries`, libellé et description par leurs CLÉS i18n `labelKey` et `descriptionKey`) ; textes par l'i18n (`reseau:reseauMobileCreateButton.*`) ; fond des choix au survol par le jeton de la charte (`--esp-neutral-hover`) sans repli de couleur littérale ; rendu, focus rendu au déclencheur et pose « choix » inchangés.
"use client"

/**
 * ReseauMobileCreateButton — la commande « Créer » du téléphone (R-02).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE COMMANDE FLOTTANTE, ET PAS UN ONGLET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * À 390 px, le réseau n'offrait qu'UNE porte de création : le déclencheur
 * « Partager une information » du fil, et seulement sur sa vue nue. Créer
 * était donc une capacité du FIL, quand c'est une capacité du LIEU.
 *
 * ⚠️ **« Créer » n'est PAS un onglet de plus.** `RESEAU_MOBILE_TABS` DÉRIVE de
 * `RESEAU_AGENT_TAB_IDS` (`reseau-mobile-tabs.ts`) : y glisser une commande en
 * ferait une destination, avec un état actif qui ne s'allumerait jamais.
 *
 * ⚠️ **La commande est un FRÈRE de `.rm-scroll`, jamais son enfant.** Ce
 * scroller déclare `container-type: inline-size`, donc `contain: layout` : un
 * `position: fixed` à l'intérieur s'y trouverait cadré et DÉFILERAIT avec le
 * fil — le même piège que celui documenté en tête de `ReseauMobileShell`.
 *
 * ⚠️ **Le décalage bas se MESURE** (`useSurfaceInsets`) : la barre de
 * navigation n'a pas la même hauteur selon l'écran, et une constante recopiée
 * ferait flotter la commande au milieu de rien ou la masquerait derrière la
 * barre. Même mesure que `CallMinimizedPill`.
 */

import { useRoutes } from "@antsia/api/network"
import { usePathname } from "@antsia/api/routing"
import { Icon } from "@antsia/ui"
import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { creationEntries, type CreationKind } from "../../features/reseau-personnel/creation-controller"
import { EspaceFloatingCard } from "../floating-card/EspaceFloatingCard"
import { useSurfaceInsets } from "../floating-surface/use-surface-insets"
import { shouldShowTabBar } from "./reseau-mobile-tabs"

export interface ReseauMobileCreateButtonProps {
  /** Le format choisi. L'hôte décide ce qu'il ouvre (ou vers où il navigue). */
  onSelect: (kind: CreationKind) => void
  /**
   * Le handle publié de la personne, ou `null`. Sans lui, « Album » n'est pas
   * offert : un album vit sur le profil public, et sans handle il n'y a pas
   * d'adresse où le poser — `creationEntries` tranche.
   */
  handle?: string | null
}

export function ReseauMobileCreateButton({ onSelect, handle = null }: ReseauMobileCreateButtonProps) {
  const { t } = useTranslation("reseau")
  const routes = useRoutes()
  const pathname = usePathname()
  const visible = shouldShowTabBar(pathname, routes)
  const [open, setOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const insets = useSurfaceInsets(visible)

  /*
   * Le focus REVIENT au déclencheur à la fermeture — et il doit revenir
   * APRÈS le démontage de la carte : `useModalA11y` restitue le focus dans sa
   * fonction de nettoyage, qui s'exécute avant cet effet. Le poser dans le
   * `onClose` le ferait donc écraser une milliseconde plus tard.
   */
  useEffect(() => {
    if (wasOpen.current && !open) fabRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // Une vue immersive (une actu, une conversation, une conférence) occupe
  // l'écran entier : ses propres commandes y suffisent. Même définition de
  // « immersif » que la barre d'onglets — jamais une seconde.
  if (!visible) return null

  const entries = creationEntries({ mobile: true, handle })

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-4 z-40 flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border border-border bg-primary px-4 py-2.5 font-bold text-[13px] text-primary-foreground shadow-lg print:hidden"
        style={{
          // Au-dessus de la barre : sa hauteur MESURÉE, plus le retrait que
          // la barre prend elle-même du bas (0,75 rem + zone sûre), plus
          // l'espace entre les deux surfaces.
          bottom: `calc(${insets.bottom}px + 0.75rem + 12px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        {t("reseauMobileCreateButton.create")}
      </button>

      <EspaceFloatingCard
        open={open}
        onClose={() => setOpen(false)}
        title={t("reseauMobileCreateButton.create")}
        // Une liste de formats n'ouvre aucun clavier : elle reste une CARTE
        // au téléphone. Le plein écran en ferait une page.
        kind="choice"
      >
        <div role="group" aria-label={t("reseauMobileCreateButton.formats")} className="grid gap-1">
          {entries.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              onClick={() => {
                setOpen(false)
                onSelect(entry.kind)
              }}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--esp-r-chrome,var(--radius))] px-2.5 py-2 text-left transition-colors hover:bg-[var(--esp-neutral-hover)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--esp-neutral-hover)] text-muted-foreground"
              >
                <Icon name={entry.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-foreground">{t(entry.labelKey)}</span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">{t(entry.descriptionKey)}</span>
              </span>
            </button>
          ))}
        </div>
      </EspaceFloatingCard>
    </>
  )
}
