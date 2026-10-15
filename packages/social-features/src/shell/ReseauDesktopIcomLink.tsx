// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReseauDesktopIcomLink.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; décomptes par la source personnelle d'iCom du moteur (`SOURCE_AGENT.useUnreadTotals`, réseau courant) ; nom accessible et mot visible par l'i18n (`desktopIcomLabel(unread, t)` : `t` en DERNIER paramètre, clés qualifiées `reseau:reseauDesktopIcomLink.*`, pluriel par `count`) ; « Réseau personnel » et « iRéseau » deviennent « réseau » ; rendu, détachement du dock et pastille inchangés.
"use client"

/**
 * Porte iCom de la page réseau au bureau.
 *
 * La messagerie n'est pas un volet du réseau : elle ne revient donc ni dans
 * `ReseauMenuRail`, ni dans les onglets. Cette porte permanente vit dans la
 * barre d'identité et détache le téléphone iCom au-dessus de la page. Elle
 * reste visible quel que soit le volet ouvert.
 */

import { Icon } from "@antia/ui"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

import { dockStore } from "../features/messagerie/dock-store"
import { combinerNonLus, SOURCE_AGENT, type TotalNonLus } from "../features/messagerie/messagerie-source"
import { formatUnreadBadge } from "../features/reseau-personnel/shared"

/**
 * Les deux décomptes du SERVEUR, réunis en un chiffre (IC-06).
 *
 * ⚠️ Ce helper additionnait la part « groupes » sur la LISTE rendue : une
 * personne membre de plus de groupes que la fenêtre n'en charge voyait une
 * pastille trop basse, et l'écran affirmait le faux. Les deux moitiés viennent
 * désormais de queries qui comptent, et le plafond « 99+ » est porté par le
 * serveur.
 */
export function icomUnreadTotal(directs: TotalNonLus | undefined, groupes: TotalNonLus | undefined): number {
  return combinerNonLus(directs, groupes).total
}

/** Le nom accessible de la porte : le geste, puis ce qui attend. */
export function desktopIcomLabel(unread: number, t: TFunction): string {
  if (unread <= 0) return t("reseau:reseauDesktopIcomLink.open")
  return t("reseau:reseauDesktopIcomLink.openWithUnread", { count: unread })
}

export function ReseauDesktopIcomLink() {
  const { t } = useTranslation("reseau")
  const nonLus = SOURCE_AGENT.useUnreadTotals()
  const unread = icomUnreadTotal(nonLus.directs, nonLus.groupes)
  const badge = formatUnreadBadge(unread)

  return (
    <button
      type="button"
      aria-label={desktopIcomLabel(unread, t)}
      className="rp-desktop-icom-link"
      onClick={() => dockStore.detach()}
      style={{
        position: "relative",
        display: "inline-flex",
        minHeight: 32,
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        border: "1px solid var(--primary-500)",
        borderRadius: 999,
        padding: "6px 12px",
        background: "var(--ink-0)",
        color: "var(--primary-500)",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      <Icon name="messageCircle" size={15} />
      <span>{t("reseauDesktopIcomLink.label")}</span>
      {badge ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -7,
            right: -7,
            display: "inline-flex",
            minWidth: 18,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            paddingInline: 4,
            background: "var(--danger-fill)",
            color: "var(--on-fill)",
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}
