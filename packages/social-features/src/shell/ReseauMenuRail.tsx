// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReseauMenuRail.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; branché sur le moteur — ma fiche par `people.persons.getMyPerson` (sans réseau ; identité montrée seulement si le profil est publié, portrait servi par la garde des fichiers), mes groupes par `thematicGroups.thematicGroups.myGroups`, mes pages suivies par la première page de `pages.pages.paginateMyPageFollows` (pages GÉNÉRIQUES du moteur, au lieu des pages d'organisation), réseau courant par `useNetwork()` ; adresses par la table des routes INJECTÉE (`useRoutes()` : volets sur `home()`, mon profil sur `profile(handle)`, fiche d'une page sur `page(handle)`, réglages sur `settings?.()`) — `personal-nav` et ses URL de l'espace retirés, une destination absente RETIRE son entrée (et « Voir plus » disparaît quand il n'a plus rien à déplier) ; volets SERVIS seuls (`menuItemsFor(counts, home)`) ; libellés par l'i18n (`reseau:reseauMenuRail.*`, libellé du volet par sa clé, pastille par `menuBadgeLabel(item, t)`) ; « iRéseau » devient « réseau » ; liens par `Link` de `@antia/api/routing`, d'UNE seule pièce (un lien à la facture du bouton fantôme au lieu d'un bouton DANS un lien : deux arrêts de tabulation pour un geste) ; rendu, ordre et styles inchangés.
"use client"

/**
 * Le RAIL-MENU du réseau — la navigation verticale du bureau.
 *
 * ⚠️ Il ne cohabite JAMAIS avec la barre d'onglets : `ReseauAgentPage` allume
 * ce menu et éteint la tablist dans la MÊME container query. Les mêmes volets
 * deux fois à l'écran donneraient deux marqueurs d'« actif » à tenir d'accord.
 *
 * Ce que le rail décide vit dans `reseau-menu.ts`, testé : la liste des
 * entrées y est DÉRIVÉE de `RESEAU_AGENT_TABS`, jamais recopiée. Il reprend
 * les volets servis parce qu'il REMPLACE la tablist horizontale ; Messages vit
 * séparément dans iCom et son dock.
 *
 * ⚠️ Ce rail a REMPLACÉ la carte « Mon réseau » et ses compteurs le
 * 2026-08-18. Les garder tous les deux aurait donné deux chemins vers les
 * relations dans la même colonne ; les chiffres qu'ils portaient sont devenus
 * les pastilles des entrées.
 */

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery, useAuthenticatedPaginatedQuery } from "@antia/api/hooks"
import { useNetwork, useRoutes } from "@antia/api/network"
import { Link } from "@antia/api/routing"
import { Badge, Button, Card, Icon } from "@antia/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar } from "../features/reseau-personnel/Avatar"
import { RESEAU_SURFACE_STYLE } from "./design-styles"
import type { ReseauAgentTabId } from "./reseau-agent-nav"
import { menuBadgeLabel, menuItemsFor, SHORTCUTS_MAX, shortcutsFor, type ReseauMenuCounts } from "./reseau-menu"

const ITEM_STYLE = {
	width: "100%",
	justifyContent: "flex-start",
	gap: 12,
	// La charte impose 44 px de cible ; c'est aussi ce qui rend la colonne
	// lisible en diagonale, ce qu'on fait d'un menu qu'on connaît par cœur.
	minHeight: 44,
	paddingInline: 10,
	textAlign: "left" as const,
}

/**
 * Un LIEN à la facture d'un bouton fantôme (`Button variant="ghost"`) : une
 * destination est un lien d'une seule pièce — un bouton posé DANS un lien
 * ferait deux arrêts de tabulation pour un même geste, et un contenu
 * interactif imbriqué qu'aucun lecteur d'écran n'annonce de la même façon.
 */
const LINK_ITEM_STYLE = {
	...ITEM_STYLE,
	display: "flex",
	alignItems: "center",
	boxSizing: "border-box" as const,
	// En longues seulement : `paddingInline` vient d'`ITEM_STYLE`, et un
	// raccourci `padding` sur la même propriété ferait avertir React.
	paddingBlock: 8,
	borderRadius: 6,
	border: "1px solid transparent",
	background: "transparent",
	color: "var(--ink-700)",
	fontWeight: 600,
	fontSize: 14,
	textDecoration: "none",
	whiteSpace: "nowrap" as const,
}

export function ReseauMenuRail({
	activeTab,
	counts,
	onSelectTab,
}: {
	activeTab: ReseauAgentTabId
	counts?: ReseauMenuCounts
	/** Ouvre un volet. Le rail ne connaît pas le routeur : il le demande. */
	onSelectTab: (tab: ReseauAgentTabId) => void
}) {
	const { t } = useTranslation("reseau")
	const { networkId } = useNetwork()
	const routes = useRoutes()
	const home = routes.home()
	const [expanded, setExpanded] = useState(false)
	// Ma fiche (sur moi-même : sans réseau).
	const myPerson = useAuthenticatedConvexQuery(api.modules.people.persons.getMyPerson, {})
	// Les raccourcis n'en montrent que SHORTCUTS_MAX : une page suffit.
	const pageFollows = useAuthenticatedPaginatedQuery(
		api.modules.pages.pages.paginateMyPageFollows,
		{ networkId },
		{ initialNumItems: SHORTCUTS_MAX },
	)
	const myGroups = useAuthenticatedConvexQuery(api.modules.thematicGroups.thematicGroups.myGroups, { networkId })

	const items = menuItemsFor(counts ?? {}, home)
	const shortcuts = shortcutsFor(
		pageFollows.results.map((page) => ({
			pageId: page.pageId,
			handle: page.handle,
			name: page.name,
			logoUrl: page.logoUrl,
		})),
		(myGroups.data?.items ?? []).map((group) => ({
			groupId: group.groupId,
			name: group.name,
		})),
		{ home, page: routes.page },
	)

	const person = myPerson.data
	// Une identité ne se MONTRE que publiée : sans identifiant public, il n'y a
	// ni profil où mener, ni nom qu'un autre membre verrait.
	const handle = person?.published === true ? (person.handle ?? null) : null
	const profileHref = handle !== null ? routes.profile(handle) : null
	const displayName = person?.displayName ?? handle ?? ""
	const settingsHref = routes.settings?.() ?? null

	return (
		<Card padded={false} style={RESEAU_SURFACE_STYLE}>
			<nav aria-label={t("reseauMenuRail.navLabel")} style={{ padding: 12 }}>
				{/* L'identité mène au profil — c'est le geste qu'on cherche en
				    premier dans un menu de réseau social. */}
				{profileHref !== null ? (
					<Link
						href={profileHref}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							minHeight: 44,
							padding: "6px 10px",
							borderRadius: 8,
							textDecoration: "none",
							color: "inherit",
						}}
					>
						<Avatar displayName={displayName} avatarUrl={person?.avatar?.url ?? null} size={32} />
						<span style={{ display: "grid", gap: 1, minWidth: 0 }}>
							<span style={{ fontSize: 13.5, fontWeight: 700 }}>{displayName}</span>
							<span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>@{handle}</span>
						</span>
					</Link>
				) : null}

				<ul
					style={{
						listStyle: "none",
						margin: "8px 0 0",
						padding: 0,
						display: "grid",
						gap: 2,
					}}
				>
					{items.map((item) => {
						const selected = item.id === activeTab
						const badgeLabel = menuBadgeLabel(item, t)
						return (
							<li key={item.id}>
								<Button
									variant={selected ? "secondary" : "ghost"}
									// `aria-current` et non `aria-selected` : ce sont des liens
									// de navigation, pas les onglets d'un `tablist`.
									aria-current={selected ? "page" : undefined}
									onClick={() => onSelectTab(item.id)}
									style={ITEM_STYLE}
								>
									<Icon name={item.icon} size={18} aria-hidden />
									<span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t(item.labelKey)}</span>
									{item.badge !== null ? (
										<Badge tone="primary" size="sm">
											{/* Le chiffre est masqué au lecteur d'écran : la phrase
											    qui suit dit 3 QUOI, ce qu'un « 3 » nu ne dit pas. */}
											<span aria-hidden="true">{item.badge > 99 ? "99+" : item.badge}</span>
										</Badge>
									) : null}
									{badgeLabel !== null ? <span className="sr-only">{badgeLabel}</span> : null}
								</Button>
							</li>
						)
					})}
				</ul>

				{/* « Voir plus » : les destinations de COMPTE, repliées par défaut.
				    Elles ne sont pas des volets — les mêler à la liste ci-dessus
				    laisserait croire qu'on reste dans le réseau. Une destination
				    que l'application ne sert pas n'a pas d'entrée, et sans entrée
				    il n'y a rien à déplier. */}
				{profileHref !== null || settingsHref !== null ? (
					<>
						<Button variant="ghost" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded} style={ITEM_STYLE}>
							<Icon name={expanded ? "chevronUp" : "chevronDown"} size={18} aria-hidden />
							<span style={{ fontSize: 13.5, fontWeight: 600 }}>
								{expanded ? t("reseauMenuRail.showLess") : t("reseauMenuRail.showMore")}
							</span>
						</Button>
						{expanded ? (
							<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
								{profileHref !== null ? (
									<li>
										<Link href={profileHref} style={LINK_ITEM_STYLE}>
											<Icon name="userCircle" size={18} aria-hidden />
											<span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("reseauMenuRail.myProfile")}</span>
										</Link>
									</li>
								) : null}
								{settingsHref !== null ? (
									<li>
										<Link href={settingsHref} style={LINK_ITEM_STYLE}>
											<Icon name="settings" size={18} aria-hidden />
											<span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("reseauMenuRail.settings")}</span>
										</Link>
									</li>
								) : null}
							</ul>
						) : null}
					</>
				) : null}

				{shortcuts.length > 0 ? (
					<section style={{ marginTop: 14 }}>
						<h2
							style={{
								margin: "0 0 8px",
								fontSize: 10.5,
								fontWeight: 700,
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								color: "var(--muted-foreground)",
								paddingInline: 10,
							}}
						>
							{t("reseauMenuRail.shortcuts")}
						</h2>
						<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
							{shortcuts.map((shortcut) => (
								<li key={shortcut.id}>
									<Link href={shortcut.href} style={LINK_ITEM_STYLE}>
										<Avatar
											displayName={shortcut.label}
											avatarUrl={shortcut.imageUrl}
											size={24}
											shape={shortcut.id.startsWith("page:") ? "square" : "round"}
										/>
										<span
											style={{
												fontSize: 13,
												fontWeight: 600,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{shortcut.label}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</nav>
		</Card>
	)
}
