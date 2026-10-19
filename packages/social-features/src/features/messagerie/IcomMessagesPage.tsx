"use client"

/** Destination Messages P05, réutilisant les vues et les droits du moteur. */
import { useNetwork, useRoutes } from "@antsia/api/network"
import { Link, usePathname, useRouter, useSearchParams } from "@antsia/api/routing"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { IcomMobileTabBar } from "../../shell/mobile/IcomMobileTabBar"
import { ReseauMobileStyles } from "../../shell/mobile/mobile-styles"
import { registerCallHost, useCallHostMode } from "../iappel/call-host-store"
import { useDockState } from "./dock-store"
import { hrefSansInvitationGroupe, INVITATION_GROUPE_PARAM, lireJetonInvitationGroupe } from "./groupe-invitation-link"
import { IcomAppelJournal } from "./IcomAppelJournal"
import { IcomRelationsPanel } from "./IcomRelationsPanel"
import { ICOM_BRIQUE_PARAM } from "./icom-mobile-tabs"
import { ICOM_VIEWS, icomViewFromBrique, icomViewHref } from "./icom-views"
import { MessagerieComposeView } from "./MessagerieComposeView"
import { MessagerieConversationView } from "./MessagerieConversationView"
import { MessagerieGroupeCompose } from "./MessagerieGroupeCompose"
import { MessagerieGroupeInvite } from "./MessagerieGroupeInvite"
import { MessagerieListView } from "./MessagerieListView"
import type { ContextualMessagesInjection } from "./contextual-conversation-model"
import { commercialKey, contextualConversationKey, draftKey, draftTextFor, groupeKey, parseCommercialKey, parseContextualConversationKey, type ConversationKey } from "./messagerie-dock"
import { messagerieListScope, readListState, writeListState } from "./messagerie-list-state"
import { composeGroupeHref, composeHref, conversationHref } from "./messagerie-routes"
import { SOURCE_AGENT } from "./messagerie-source"
import { MessagerieStyles } from "./messagerie-styles"
import type { MessagerieNav } from "./messagerie-views"
import { useInfosPanneau } from "./use-infos-panneau"

/** Identité du dock existant : seule sa surface change, jamais la session d'appel. */
const CALL_HOST_ID = "icom-agent"

export function IcomMessagesPage({ conversationKey = null, compose, isMobile, commercial, contextual }: {
	conversationKey?: ConversationKey | null
	compose?: "personne" | "groupe"
	isMobile: boolean
	commercial?: { renderList: (query: string) => ReactNode; renderConversation: (threadId: string) => ReactNode }
	/** CC-5 : les conversations contextuelles injectées par l'application (filtre « Mises en relation »). */
	contextual?: ContextualMessagesInjection
}) {
	const { t } = useTranslation("messagerie")
	const { networkId, personId } = useNetwork()
	const routes = useRoutes()
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const infos = useInfosPanneau()
	const dock = useDockState()
	const nonLus = SOURCE_AGENT.useUnreadTotals()
	const scope = messagerieListScope(String(networkId), String(personId), isMobile ? "phone" : "desktop")
	const hasDetail = conversationKey !== null || compose !== undefined
	const rawView = searchParams.get(ICOM_BRIQUE_PARAM)
	const view = hasDetail && rawView === null ? readListState(scope).view : icomViewFromBrique(rawView)
	const base = routes.messages()
	useEffect(() => {
		if (!hasDetail) writeListState(scope, { view })
	}, [scope, view, hasDetail])
	const nav = useMemo<MessagerieNav>(() => ({
		openConversation: (key) => router.push(conversationHref(key, base) ?? base, { scroll: false }),
		openCompose: () => router.push(composeHref(base), { scroll: false }),
		openComposeGroupe: () => router.push(composeGroupeHref(base), { scroll: false }),
		back: () => router.push(icomViewHref(readListState(scope).view, base), { scroll: false }),
	}), [router, base, scope])
	const [callHost, setCallHost] = useState<HTMLDivElement | null>(null)
	const callMode = useCallHostMode(CALL_HOST_ID)
	useEffect(() => {
		if (isMobile || !callHost) return
		return registerCallHost({ id: CALL_HOST_ID, scopes: ["personnel"], pose: "medium", element: callHost })
	}, [callHost, isMobile])
	const invitation = searchParams.get(INVITATION_GROUPE_PARAM)
	const commercialId = conversationKey ? parseCommercialKey(conversationKey) : null
	const contextualId = conversationKey ? parseContextualConversationKey(conversationKey) : null
	const detail = commercialId !== null ? commercial?.renderConversation(commercialId) ?? <p role="status">{t("icomViews.chooseConversationBody")}</p>
		: contextualId !== null ? contextual?.renderConversation(contextualId) ?? <p role="status">{t("icomViews.chooseConversationBody")}</p>
		: compose === "personne" ? <MessagerieComposeView variant="page" nav={nav} />
		: compose === "groupe" ? <MessagerieGroupeCompose variant="page" nav={nav} open />
		: conversationKey !== null ? <MessagerieConversationView
			conversationKey={conversationKey} variant="page" nav={nav}
			draft={draftTextFor(dock, conversationKey)}
			onOpenProfile={(handle) => router.push(routes.profile(handle))}
			infosOpen={infos.ouvert} onOpenInfos={infos.ouvrir} onCloseInfos={infos.fermer}
			onLeftGroup={() => router.replace(icomViewHref(readListState(scope).view, base))}
		/>
		: <div className="icom-page-empty"><h2>{t("icomViews.chooseConversation")}</h2><p>{t("icomViews.chooseConversationBody")}</p></div>

	if (isMobile && hasDetail) return <><MessagerieStyles /><div className="msg-panel" data-variant="page" data-fill="screen" data-open="true">{detail}</div></>

	return <>
		<MessagerieStyles />
		<section className="icom-messages-page" data-mobile={isMobile ? "true" : "false"} aria-label={t("icomViews.title")}>
			<header className="icom-page-heading"><h1>{t("icomViews.title")}</h1><div className="icom-page-heading-links"><Link href={routes.home()}>{t("icomViews.backToFeed")}</Link>{routes.me ? <Link href={routes.me()}>{t("icomViews.myProfile")}</Link> : null}</div></header>
			<div className="icom-page-columns">
				<aside className="icom-page-list" aria-label={t("icomViews.navigation")}>
					<nav className="icom-page-navigation" aria-label={t("icomViews.navigation")}>
						{ICOM_VIEWS.map((item) => <Link key={item.id} href={icomViewHref(item.id, base)} aria-current={view === item.id ? "page" : undefined} onClick={() => writeListState(scope, { view: item.id })}>{t(item.labelKey)}</Link>)}
					</nav>
					<div className="msg-panel" data-variant="page" data-open="true">
						{invitation !== null ? <MessagerieGroupeInvite token={lireJetonInvitationGroupe(searchParams.toString())} onClose={() => router.replace(hrefSansInvitationGroupe(pathname, searchParams.toString()), { scroll: false })} onJoined={(threadId) => router.replace(conversationHref(groupeKey(threadId), base) ?? base)} />
						: view === "conversations" ? <MessagerieListView key={scope} variant="page" nav={nav} unread={nonLus.total.total} activeKey={conversationKey} showDockControls={false} destinationMode stateScope={scope} renderCommercialList={commercial?.renderList} renderContextualList={contextual?.renderList} />
						: <IcomRelationsPanel mode={view === "appels" ? "appel" : "contact"} variant="page" showDockControls={false}
							onOpenDraft={(handle) => nav.openConversation(draftKey(handle))}
							onOpenGroup={(threadId) => nav.openConversation(groupeKey(threadId))}
							onCreateGroup={nav.openComposeGroupe}
							journal={view === "appels" ? (controls) => <IcomAppelJournal leadingControls={controls} commercial={commercial !== undefined} onOpenCommercialThread={commercial ? (threadId) => nav.openConversation(commercialKey(threadId)) : undefined} onOpenContextualThread={contextual ? (threadId) => nav.openConversation(contextualConversationKey(threadId)) : undefined} /> : undefined}
						/>}
					</div>
				</aside>
				{!isMobile ? <div className="msg-panel icom-page-detail" data-variant="page" data-open="true" data-call={callMode === "none" ? undefined : callMode}>
					<div className="icom-call-host" data-pose="medium" ref={setCallHost} />
					{detail}
				</div> : null}
			</div>
		</section>
		{isMobile ? <><ReseauMobileStyles /><IcomMobileTabBar active={ICOM_VIEWS.find((item) => item.id === view)?.brique ?? "ichat"} badges={{ unreadMessages: nonLus.total.total }} /></> : null}
	</>
}
