// Dupliqué de socle/packages/agent-features/src/features/messagerie/IcomBrickHeader.tsx @ ad2e7fdc2 — adaptations : libellés traduits (espace `messagerie`, clés `icomBrickHeader.*`) — annonce des non-lus pluralisée, Rétracter/Déployer la brique, Détacher iCom ; logique inchangée.
"use client"

/**
 * L'en-tête d'une BRIQUE d'iCom — le même pour les quatre.
 *
 * ── Le défaut qu'il corrige (2026-08-20, au socle) ─────────────────────
 * Seule la brique iChat portait un en-tête : elle le rendait elle-même dans
 * `MessagerieListView`. iAppel et Relations, servies par `IcomRelationsPanel`,
 * ouvraient directement sur leur corps. Deux conséquences, dont une qui n'est
 * pas cosmétique :
 *
 *   · on ne lisait nulle part QUELLE brique était ouverte — seule la pastille
 *     de la barre basse le disait, et elle se lit du coin de l'œil ;
 *   · surtout, le chevron de REPLI vit dans cet en-tête. C'est une commande du
 *     DOCK, pas d'iChat : sans en-tête, replier la carte devenait impossible
 *     depuis les autres briques. Il fallait revenir à iChat pour la
 *     refermer.
 *
 * Le nom du module ne s'écrit pas : l'en-tête nomme la BRIQUE affichée —
 * iChat, Statuts, iAppel, Relations — comme WhatsApp titre « Discussions » ou
 * « Appels », jamais « WhatsApp ».
 *
 * ⚠️ Les actions sont des FRÈRES du bouton d'en-tête, jamais ses enfants : un
 * bouton dans un bouton est du balisage invalide, et le clavier n'atteindrait
 * jamais les suivants.
 */

import type { LucideIcon } from "lucide-react"
import { ChevronDown, Maximize2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { dockStore, useDockState } from "./dock-store"
import { dockChevronVisible } from "./icom-dock"

export interface IcomBrickHeaderProps {
  /** Le glyphe de la brique — décoratif, le titre porte le sens. */
  icon: LucideIcon
  /** Le nom affiché, déjà traduit : « iChat », « Statuts », « iAppel », « Relations ». */
  title: string
  /** Replie/déplie la carte. Faux en pleine page, où il n'y a rien à replier. */
  repliable: boolean
  /** État courant du dépliage — sert `aria-expanded` et l'orientation du chevron. */
  open: boolean
  /** Le corps que l'en-tête commande, pour `aria-controls`. */
  bodyId?: string
  /** Nombre de messages non lus. Absent ou nul : aucune pastille. */
  unread?: number
  /** Boutons d'action de la brique, rendus à droite. */
  actions?: ReactNode
  /** Taille du glyphe : 17 en dock, 19 en pleine page. */
  iconSize?: number
  /**
   * Affiche les commandes géométriques du dock dans cet en-tête.
   *
   * La carte iCom ancrée possède sa propre barre globale : ses commandes
   * Rétracter/Détacher y vivent. Les autres hôtes peuvent garder le
   * comportement précédent.
   */
  showDockControls?: boolean
}

export function IcomBrickHeader({
  icon: Icon,
  title,
  repliable,
  open,
  bodyId,
  unread = 0,
  actions,
  iconSize = 17,
  showDockControls = true,
}: IcomBrickHeaderProps) {
  const { t } = useTranslation("messagerie")
  // En FLOTTANT, le chevron de repli disparaît (une fenêtre à hauteur fixe ne
  // se replie pas — la croix de sa barre la range) et le bouton « détacher »
  // n'a plus d'objet. Décision : `dockChevronVisible` (icom-dock.ts, testée).
  const { floating } = useDockState()
  const chevron =
    showDockControls && dockChevronVisible(repliable, floating)
  const replier = open
    ? t("icomBrickHeader.collapse", { title })
    : t("icomBrickHeader.expand", { title })
  return (
    <div className="msg-head-row" data-open={open ? "true" : "false"}>
      {/* WhatsApp sépare l'identité de la surface et ses actions. Le titre
          n'est donc plus un immense bouton de repli : chaque geste possède
          désormais sa propre cible et son propre focus. */}
      <div className="msg-head-identity">
        <span className="msg-head-emblem" aria-hidden="true">
          <Icon size={iconSize} />
        </span>
        <span className="msg-head-title">{title}</span>
        {unread > 0 ? (
          <>
            <span aria-hidden="true" className="msg-badge">
              {unread > 99 ? "99+" : unread}
            </span>
            <span className="sr-only">
              {t("icomBrickHeader.unread", { count: unread })}
            </span>
          </>
        ) : null}
      </div>
      {actions ? <div className="msg-head-actions">{actions}</div> : null}
      {chevron ? (
        <button
          type="button"
          className="msg-icon-btn msg-collapse-btn"
          aria-label={replier}
          title={replier}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => dockStore.toggleOpen()}
        >
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="msg-collapse-icon"
          />
        </button>
      ) : null}
      {/* Détacher en fenêtre « format smartphone » — commande du DOCK (comme
          le chevron), donc offerte par les quatre briques, jamais en pleine
          page ni déjà flottant. FRÈRE du bouton d'en-tête, jamais son enfant. */}
      {chevron ? (
        <button
          type="button"
          className="msg-icon-btn"
          aria-label={t("icomBrickHeader.detach")}
          title={t("icomBrickHeader.detach")}
          onClick={() => dockStore.detach()}
        >
          <Maximize2 aria-hidden="true" size={15} />
        </button>
      ) : null}
    </div>
  )
}
