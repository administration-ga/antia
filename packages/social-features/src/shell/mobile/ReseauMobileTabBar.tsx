// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileTabBar.tsx @ ad2e7fdc2 — adaptations : sans la coque de l'espace agent (`espace-mobile-volets`, `espace-mobile-volets-row`, `personal-nav` retirés) — le bouton fixe « Menu » OUVRE le menu principal du réseau (`ReseauMobileMenuSheet`, feuille du bas) au lieu de remplacer les sous-menus par les volets de l'espace ; seuil mobile par `MOBILE_ONLY_CLASS` (`@antia/ui/overlay`) ; adresses des volets composées sur la base injectée (`reseauTabHref(id, useRoutes().home())`) ; volets SERVIS seuls (`isServedReseauTab` : « Conférences » attend le module `live`) ; libellés par l'i18n (`reseau:reseauMobileTabBar.*`, libellé court du volet par sa clé) ; « iRéseau » devient « réseau » ; mêmes props (`active`, `badges`), mêmes repères (`data-mobile-nav`, `data-reseau-mobile-nav`) et mêmes classes de géométrie (`.esp-reseau-tabbar`, `.rm-*`).
"use client"

/**
 * ReseauMobileTabBar — la barre basse du réseau.
 *
 * Ce composant ne DÉCIDE rien : combien d'onglets, lesquels, où ils mènent,
 * lequel est actif et qui porte une pastille vivent dans `reseau-mobile-tabs.ts`,
 * où c'est vérifiable. Il ne porte que le rendu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENU FIXE · SOUS-MENUS RÉELS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Menu » occupe une largeur fixe et ne participe jamais au défilement : il
 * ouvre le menu principal du réseau (statuts, profil, réglages). Les volets
 * réels de la page défilent à sa droite, avec une séparation visuelle et
 * sémantique entre les deux niveaux de navigation.
 *
 * ⚠️ Même géométrie que la barre d'iCom, au pixel : `fixed`, gouttière de
 * 12 px, encoche ajoutée en bas, masquée à partir de 960 px. Ce n'est pas de
 * la coquetterie : les deux barres ne coexistent JAMAIS, mais elles se
 * remplacent l'une l'autre en changeant de page — une différence de hauteur
 * ou d'ancrage ferait sauter tout le bas de l'écran à chaque navigation.
 *
 * ⚠️ `data-mobile-nav` est un REPÈRE lu par les éléments flottants qui doivent
 * se tenir au-dessus d'elle (`use-surface-insets` la MESURE plutôt que de
 * recopier sa hauteur). L'omettre les ferait retomber dessus.
 * `data-reseau-mobile-nav` distingue laquelle des barres est en place, pour
 * qui a besoin de le savoir.
 *
 * ⚠️ La charte décide de l'habillage, pas ce fichier : `.esp-reseau-tabbar`
 * porte fond, filet, relief et rayon, et ne déclare aucune couleur ici.
 */

import { useRoutes } from "@antia/api/network"
import { Link, usePathname } from "@antia/api/routing"
import { Icon, type IconName } from "@antia/ui"
import { MOBILE_ONLY_CLASS } from "@antia/ui/overlay"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { isServedReseauTab } from "../reseau-menu"
import { ReseauMobileMenuSheet } from "./ReseauMobileMenuSheet"
import { RESEAU_MOBILE_TABS, reseauTabHref, tabBadge, type ReseauMobileTabId } from "./reseau-mobile-tabs"

export interface ReseauMobileTabBarProps {
  active: ReseauMobileTabId | null
  badges: { unreadNotifications?: number }
}

/** L'icône du bouton fixe : la même que la première place de la barre d'iCom. */
const MENU_ICON: IconName = "grid"

/**
 * Le contenu d'un onglet — icône, pastille, libellé.
 *
 * ⚠️ Le chiffre est `aria-hidden` et doublé d'une phrase en `sr-only` : un
 * « 3 » nu, annoncé après « Relations », ne dit pas 3 quoi. Même règle que
 * les onglets du bureau.
 */
function TabInner({
  icon,
  label,
  badge,
}: {
  icon: IconName
  label: string
  badge: { badge: string; label: string } | null
}) {
  return (
    <>
      <span className="rm-tab-icon">
        <Icon name={icon} size={20} />
        {badge ? (
          <span className="rm-tab-badge">
            <span aria-hidden="true">{badge.badge}</span>
          </span>
        ) : null}
      </span>
      <span className="rm-tab-label">{label}</span>
      {badge ? <span className="sr-only">{badge.label}</span> : null}
    </>
  )
}

export function ReseauMobileTabBar({ active, badges }: ReseauMobileTabBarProps) {
  const { t } = useTranslation("reseau")
  const home = useRoutes().home()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const subtabsRef = useRef<HTMLDivElement>(null)

  /* Une navigation rend la page demandée nue : le menu n'est jamais conservé
     depuis l'adresse précédente. */
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  /* Un lien profond vers un volet situé hors champ doit rendre l'actif
     visible dès l'arrivée. Pas d'animation imposée : le repositionnement est
     instantané et respecte donc aussi reduced-motion. */
  useEffect(() => {
    subtabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [active])

  return (
    <nav
      aria-label={t("reseauMobileTabBar.navLabel")}
      data-mobile-nav=""
      data-reseau-mobile-nav=""
      className={`fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 z-40 print:hidden ${MOBILE_ONLY_CLASS}`}
    >
      <div className="esp-reseau-tabbar border backdrop-blur-md">
        <div className="rm-tabbar-row">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rm-menu-tab min-h-11 min-w-11"
            aria-label={t("reseauMobileTabBar.menuLabel")}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <span className="rm-tab-icon">
              <Icon name={MENU_ICON} size={20} />
            </span>
            <span className="rm-tab-label">{t("reseauMobileTabBar.menu")}</span>
          </button>

          <div ref={subtabsRef} className="rm-subtabs" role="group" aria-label={t("reseauMobileTabBar.subtabsLabel")}>
            {RESEAU_MOBILE_TABS.filter((tab) => isServedReseauTab(tab.id)).map((tab) => {
              const href = reseauTabHref(tab.id, home)
              const badge = tabBadge(tab.id, badges)
              const isActive = tab.id === active

              return (
                <Link
                  key={tab.id}
                  href={href}
                  /* PAS d'`aria-label` : il REMPLACERAIT le contenu du lien,
                     donc la phrase de la pastille. Le nom accessible se compose
                     du texte visible + du `sr-only` — exactement ce qu'il faut
                     annoncer. */
                  aria-current={isActive ? "page" : undefined}
                  className="rm-tab min-h-11 min-w-11"
                >
                  <TabInner icon={tab.icon} label={t(tab.shortLabelKey)} badge={badge} />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      <ReseauMobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </nav>
  )
}
