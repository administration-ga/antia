// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileHeader.tsx @ ad2e7fdc2 — adaptations : sans la coque de l'espace agent (`espace-mobile-volets` retiré) — la porte d'iCom mène à la messagerie en pages de l'application (`useRoutes().messages()`), la cloche du moteur montée sans base de l'espace (ses cibles se composent sur `useRoutes()`) ; `profileHref` devient `string | null` (un profil non publié n'a pas d'adresse : la pastille reste, sans lien) ; libellés par l'i18n (`reseau:reseauMobileHeader.*`, nom accessible d'iCom accordé par `count`) ; « iRéseau » devient « réseau » ; rendu, recherche à la demande et focus inchangés.
"use client"

/**
 * ReseauMobileHeader — l'en-tête collant de la coquille mobile.
 *
 * Quatre choses, et rien d'autre : où l'on est (« Réseau »), une recherche
 * ouverte à la demande, la porte d'iCom, qui l'on est. Deux en-têtes empilés
 * au-dessus d'un fil lui prendraient le tiers de l'écran : la coque de
 * l'application n'en pose pas d'autre sur cette page.
 *
 * La porte d'iCom est arrivée le 2026-08-21, quand l'onglet « Messages » a
 * quitté la barre basse : sans elle, répondre à un message depuis le fil
 * coûtait deux gestes de menu. C'est une NAVIGATION vers la messagerie — le
 * motif de la messagerie des réseaux sociaux — pas une réintégration du volet.
 *
 * ⚠️ Le mot « Réseau » est rendu par un `<p>`, pas par un `<h1>`. La page en
 * porte déjà un, en `sr-only` (cf. `ReseauMobilePage`) : deux titres de
 * niveau 1 donneraient deux points d'entrée à un lecteur d'écran, sur une page
 * qui n'en a qu'un.
 *
 * ⚠️ Le champ de recherche est à ≥ 16 px de corps. Sous ce seuil, Safari iOS
 * ZOOME automatiquement à la mise au point et laisse la page zoomée après la
 * saisie — l'écrire ici évite d'en dépendre ailleurs pour un champ qui est le
 * geste principal de l'en-tête.
 */

import { useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { Icon, TextInput } from "@antsia/ui"
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { NotificationBell } from "../../features/notifications/NotificationBell"
import { Avatar } from "../../features/reseau-personnel/Avatar"
import { formatUnreadBadge } from "../../features/reseau-personnel/shared"

export interface ReseauMobileHeaderProps {
  /** Lance la recherche — le parent décide ce que « chercher » veut dire. */
  onSearch: (query: string) => void
  /** La recherche EN COURS, pour que le champ reparte de ce qu'on regarde. */
  searchQuery: string
  /** Mon profil (`useRoutes().profile(handle)`) — `null` tant qu'il n'est pas publié. */
  profileHref: string | null
  avatarUrl: string | null
  displayName: string
  /** Conversations non lues d'iCom — la pastille de la porte d'en-tête. */
  unreadMessages?: number
}

export function ReseauMobileHeader({ onSearch, searchQuery, profileHref, avatarUrl, displayName, unreadMessages }: ReseauMobileHeaderProps) {
  const { t } = useTranslation("reseau")
  const routes = useRoutes()
  /**
   * Le brouillon est LOCAL, semé par la recherche en cours. Remonter chaque
   * frappe au parent relancerait la query à chaque lettre : la recherche se
   * valide, elle ne se devine pas (même conduite que sur le bureau).
   */
  const [draft, setDraft] = useState(searchQuery)
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setDraft(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (!searchOpen) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [searchOpen])

  const closeSearch = () => {
    setDraft(searchQuery)
    setSearchOpen(false)
    window.requestAnimationFrame(() => searchButtonRef.current?.focus())
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSearch(draft.trim())
    setSearchOpen(false)
    window.requestAnimationFrame(() => searchButtonRef.current?.focus())
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    closeSearch()
  }

  const unreadBadge = formatUnreadBadge(unreadMessages)
  const avatar = <Avatar displayName={displayName} avatarUrl={avatarUrl} size={34} />

  return (
    <header className="rm-header">
      <div className="rm-header-row">
        {searchOpen ? (
          <form role="search" aria-label={t("reseauMobileHeader.searchLabel")} onSubmit={submit} className="rm-search">
            <div style={{ minWidth: 0, flex: 1 }}>
              <TextInput
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t("reseauMobileHeader.searchPlaceholder")}
                aria-label={t("reseauMobileHeader.searchLabel")}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  background: "var(--card)",
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingLeft: 14,
                  paddingRight: 14,
                  fontSize: 16,
                }}
              />
            </div>
            <button
              type="submit"
              aria-label={t("reseauMobileHeader.searchSubmit")}
              className="rm-tab min-h-11 min-w-11"
              style={{ flex: "0 0 auto", width: 44 }}
            >
              <Icon name="search" size={18} />
            </button>
            <button
              type="button"
              aria-label={t("reseauMobileHeader.searchClose")}
              className="rm-tab min-h-11 min-w-11"
              style={{ flex: "0 0 auto", width: 44 }}
              onClick={closeSearch}
            >
              <Icon name="x" size={18} />
            </button>
          </form>
        ) : (
          <>
            <p className="rm-wordmark">{t("reseauMobileHeader.wordmark")}</p>
            <button
              ref={searchButtonRef}
              type="button"
              aria-label={searchQuery.length > 0 ? t("reseauMobileHeader.searchEdit") : t("reseauMobileHeader.searchOpen")}
              aria-expanded={searchOpen}
              className="rm-tab min-h-11 min-w-11"
              style={{ flex: "0 0 auto", width: 44 }}
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" size={20} />
            </button>
          </>
        )}
        {/* La porte d'iCom. PAS d'`aria-label` sec : le nom accessible se
            compose du `sr-only` — pastille comprise quand elle existe. */}
        <Link href={routes.messages()} className="rm-tab min-h-11 min-w-11" style={{ flex: "0 0 auto", width: 44 }}>
          <span className="rm-tab-icon">
            <Icon name="messageCircle" size={20} />
            {unreadBadge !== null ? (
              <span className="rm-tab-badge">
                <span aria-hidden="true">{unreadBadge}</span>
              </span>
            ) : null}
          </span>
          <span className="sr-only">
            {unreadMessages !== undefined && unreadMessages > 0
              ? t("reseauMobileHeader.icomOpenWithUnread", { count: unreadMessages })
              : t("reseauMobileHeader.icomOpen")}
          </span>
        </Link>
        {/* La cloche. Sur la page réseau au téléphone, la coque n'en pose
            aucune autre : sans elle, ce réseau serait le SEUL endroit sans
            accès aux notifications (R-03). Elle est posée ici, à la facture
            des onglets. */}
        <NotificationBell variant="reseau" />
        {profileHref !== null ? (
          <Link href={profileHref} className="rm-avatar-link" aria-label={t("reseauMobileHeader.profileLink")}>
            {/* `Avatar` porte déjà `aria-hidden` : le nom du lien vient de
                l'`aria-label` ci-dessus, jamais des initiales. */}
            {avatar}
          </Link>
        ) : (
          // Sans profil publié, pas d'adresse : la pastille reste, décorative.
          <span className="rm-avatar-link">{avatar}</span>
        )}
      </div>
    </header>
  )
}
