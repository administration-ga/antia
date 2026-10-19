"use client"

/**
 * CC-5 (contrat CONVERSATION-CONTEXTUELLE-V1 §10.1, §11.3 ; ADR-0025) — la liste des
 * conversations CONTEXTUELLES : ce que rend le filtre « Mises en relation » de la vue
 * Conversations, ou un écran de l'application (les fils d'une page, côté équipe).
 *
 * Deux lectures, jamais mélangées à la boîte personnelle ni au canal P10 :
 *  · MES fils (`threads.paginateMine`) : demandeur ou répondant-personne ;
 *  · les fils d'une PAGE dont je suis signataire vivant (`threads.paginateForPage`).
 *
 * Chaque ligne est relue par le moteur ; une ligne dont le droit est tombé n'est pas rendue.
 * Aucun aperçu de message (§3.2 : le fil n'en stocke aucun) : la ligne dit l'autre côté, la
 * nature et l'état. La recherche est LOCALE aux fils chargés, et l'écran le dit.
 */
import type { Id } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import type { ContextualKind } from "@antsia/social-domain/contextualMessaging"
import { useTranslation } from "react-i18next"

import { conserveDonneesEnErreur, montreSquelette } from "../../shell/query-state"
import { ReseauQueryError } from "../../shell/ReseauQueryError"
import { Avatar } from "../reseau-personnel/Avatar"
import {
  contextualCounterpartAvatar,
  contextualCounterpartName,
  contextualKindLabel,
  contextualVisibleState,
  filterContextualThreads,
} from "./contextual-conversation-model"
import { CONTEXTUAL_MESSAGING_SOURCE, type ContextualMessagingSource, type ContextualThread } from "./contextual-messaging-source"
import { formatThreadTime } from "./messagerie-liste"
import { etatDeSource, type SourcePageListe } from "./messagerie-source"
import { MessagerieStyles } from "./messagerie-styles"

export interface ContextualConversationListProps {
  /** La recherche de la liste Messages — locale aux fils déjà chargés. */
  query?: string
  /** Les fils d'une PAGE dont je suis signataire vivant (« Demandes reçues ») plutôt que les miens. */
  pageId?: Id<"pages"> | null
  /** Une seule nature (liste fermée du moteur) ; absente, toutes. */
  kind?: ContextualKind
  /** Le fil ouvert à côté de la liste (bureau) — marqué `aria-current`. */
  activeThreadId?: string | null
  /** Ouvrir une conversation ; l'application compose l'adresse (`conversationHref`). */
  onOpen: (threadId: string) => void
  /** D'où viennent les fils — par défaut, la source contextuelle du moteur. */
  source?: ContextualMessagingSource
}

export function ContextualConversationList(props: ContextualConversationListProps) {
  const { networkId, personId } = useNetwork()
  // Changer de lecteur, de page ou de nature repart d'une première page : rien d'accumulé ne survit.
  const key = JSON.stringify([networkId, personId, props.pageId ?? null, props.kind ?? null])
  const pageId = props.pageId ?? null
  return pageId === null ? <MyContextualThreads key={key} {...props} /> : <PageContextualThreads key={key} {...props} pageId={pageId} />
}

function MyContextualThreads(props: ContextualConversationListProps) {
  const list = (props.source ?? CONTEXTUAL_MESSAGING_SOURCE).useMyThreadsPage(props.kind)
  return <ContextualThreadRows {...props} list={list} />
}

function PageContextualThreads(props: ContextualConversationListProps & { pageId: Id<"pages"> }) {
  const list = (props.source ?? CONTEXTUAL_MESSAGING_SOURCE).usePageThreadsPage(props.pageId, props.kind)
  return <ContextualThreadRows {...props} list={list} />
}

function ContextualThreadRows({ list, query = "", activeThreadId = null, onOpen }: ContextualConversationListProps & { list: SourcePageListe<ContextualThread> }) {
  const { t, i18n } = useTranslation("messagerie")
  const timeZone = useViewerTimeZone()
  const all = list.data ?? []
  // L'état décidé par le contrat partagé (IC-07) : une panne n'est jamais une liste vide.
  const etat = etatDeSource(list)
  const visible = filterContextualThreads(all, query, t)
  const term = query.trim()
  const now = Date.now()
  const loadMore = list.hasMore ? (
    <button type="button" className="msg-row justify-center font-semibold" disabled={list.isLoadingMore} onClick={list.loadMore}>
      {list.isLoadingMore ? t("contextualConversation.list.loading") : t("contextualConversation.list.loadMore")}
    </button>
  ) : null

  return (
    <>
      <MessagerieStyles />
      <h2 className="sr-only">{t("contextualConversation.list.title")}</h2>
      {term.length > 0 || list.hasMore ? <p className="msg-list-scope">{t("contextualConversation.list.scope")}</p> : null}
      {conserveDonneesEnErreur(etat, all.length) ? (
        <div className="px-2.5 pt-2">
          <ReseauQueryError title={t("contextualConversation.list.errorTitle")} message={t("contextualConversation.list.errorMessage")} onRetry={list.refetch} />
        </div>
      ) : null}
      {etat === "erreur" && all.length === 0 ? (
        <div className="p-2.5">
          <ReseauQueryError title={t("contextualConversation.list.errorTitle")} message={t("contextualConversation.list.errorMessage")} onRetry={list.refetch} />
        </div>
      ) : montreSquelette(etat) ? (
        <p className="msg-empty" role="status">{t("contextualConversation.list.loading")}</p>
      ) : all.length === 0 && !list.hasMore ? (
        <p className="msg-empty">{t("contextualConversation.list.empty")}</p>
      ) : visible.length === 0 ? (
        <div className="msg-empty">
          <p className="m-0">{t("contextualConversation.list.noMatch", { term })}</p>
          {loadMore}
        </div>
      ) : (
        <ul className="msg-list">
          {visible.map((thread) => {
            const id = String(thread.threadId)
            const name = contextualCounterpartName(thread, t)
            const avatar = contextualCounterpartAvatar(thread)
            const state = contextualVisibleState(thread)
            return (
              <li key={id}>
                <button
                  type="button"
                  className="msg-row"
                  data-unread={thread.unread ? "true" : "false"}
                  aria-current={activeThreadId === id ? "true" : undefined}
                  onClick={() => onOpen(id)}
                >
                  <Avatar displayName={name} avatarUrl={avatar.url} hasIdentity={avatar.hasIdentity} shape={avatar.shape} size={44} />
                  <span className="msg-row-main">
                    <span className="msg-row-name">{name}</span>
                    <span className="msg-row-preview">
                      {t("contextualConversation.list.summary", { kind: contextualKindLabel(thread.kind, t), state: t(`contextualConversation.stateShort.${state}`) })}
                    </span>
                  </span>
                  {thread.unread ? (
                    <>
                      <span aria-hidden="true" className="msg-badge">{"•"}</span>
                      <span className="sr-only">{t("contextualConversation.list.unread")}</span>
                    </>
                  ) : (
                    <span className="msg-row-time">{formatThreadTime(thread.lastMessageAt, now, i18n.language, timeZone)}</span>
                  )}
                </button>
              </li>
            )
          })}
          {loadMore !== null ? <li>{loadMore}</li> : null}
        </ul>
      )}
    </>
  )
}
