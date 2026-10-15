// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-menu.ts @ ad2e7fdc2 — adaptations : déplacé dans la coque (`shell/`) ; volets SERVIS par le moteur décidés ici (`RESEAU_SERVED_TAB_IDS`, `isServedReseauTab`, `servedReseauTab` : « Conférences » attend le module `live`, aucun onglet, rail ni entrée de menu n'y mène) ; entrées décrites par la CLÉ i18n du volet (`labelKey`) au lieu d'un libellé ; adresses composées sur la BASE de la page réseau injectée (`menuItemsFor(counts, base)`) et sur la table des routes (`shortcutsFor(pages, groups, links, max)` : fiche d'une page par `links.page(handle)`, groupe par `reseauAgentGroupeHref(id, links.home)`) — plus aucune route de l'espace en dur ; phrase de la pastille par l'i18n (`menuBadgeLabel(item, t)`, clés qualifiées `reseau:reseauMenu.*`, pluriel par `count`) ; commentaires rapportés au moteur.
/**
 * reseau-menu — ce que le RAIL-MENU de bureau porte, hors de tout composant.
 *
 * Ce qui reste dans le corps d'un composant n'est vérifiable qu'à l'œil : la
 * composition du menu vit donc ici, dans un module pur testé en environnement
 * `node`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES ITEMS SE DÉRIVENT DES VOLETS — ils ne se recopient JAMAIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `RESEAU_AGENT_TABS` (`reseau-agent-nav.ts`) est la source de vérité des
 * volets ; ce module en dérive des entrées de menu, comme la barre d'onglets et
 * la feuille « Menu » du téléphone le font de leur côté. Recopier la liste ici
 * donnerait un rail qui affiche six volets quand la page en rend sept — c'est
 * précisément ce qui est arrivé, au socle, au manifeste de navigation resté à
 * trois valeurs pendant que la page en rendait quatre puis huit.
 *
 * « Messages » reste volontairement absent de CE rail : la messagerie est une
 * application autonome portée par iCom. « Activité » l'a quitté le 2026-09-06
 * (R-03) — non pas filtré, mais RETIRÉ de `RESEAU_AGENT_TABS` : le relevé des
 * notifications est le contenu de la cloche du chrome, pas un lieu du réseau.
 * Ce rail n'a donc plus de pastille d'activité ; le décompte vit sur la
 * cloche, une seule fois.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE ADRESSE N'EST ÉCRITE ICI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La page réseau est l'accueil de l'application (`useRoutes().home()`), et la
 * fiche d'une page vit où l'application le dit (`useRoutes().page(handle)`) :
 * les fabriques reçoivent ces adresses, elles n'en écrivent aucune.
 */

import type { IconName } from "@antia/ui"
import type { TFunction } from "i18next"

import {
	RESEAU_AGENT_TAB_DEFAULT,
	RESEAU_AGENT_TAB_IDS,
	RESEAU_AGENT_TABS,
	reseauAgentGroupeHref,
	reseauAgentHref,
	type ReseauAgentTabId,
} from "./reseau-agent-nav"

// ═══════════════════════════════════════════════════════════════════════════
// LES VOLETS SERVIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les volets que le moteur NE sert PAS encore.
 *
 * « Conférences » attend le module `live` : tant que ses directs et ses
 * rediffusions ne sont pas servis, le volet n'aurait rien à montrer — et une
 * entrée qui mène à un écran vide est un cul-de-sac, pas un volet. Le contrat
 * de navigation (`reseau-agent-nav.ts`) le garde, pour que ses adresses et ses
 * alias restent stables le jour où il revient ; c'est ICI, en un mot, qu'il
 * revient.
 */
const RESEAU_UNSERVED_TAB_IDS: readonly ReseauAgentTabId[] = Object.freeze(["conferences"])

/**
 * Les volets RENDUS par la page réseau, dans l'ordre du contrat — la seule
 * liste que lisent la tablist, le rail-menu et la barre du téléphone. Dérivée
 * de `RESEAU_AGENT_TAB_IDS`, jamais recopiée.
 */
export const RESEAU_SERVED_TAB_IDS: readonly ReseauAgentTabId[] = Object.freeze(
	RESEAU_AGENT_TAB_IDS.filter((id) => !RESEAU_UNSERVED_TAB_IDS.includes(id)),
)

/** Ce volet est-il rendu par la page réseau du moteur ? */
export function isServedReseauTab(id: ReseauAgentTabId): boolean {
	return RESEAU_SERVED_TAB_IDS.includes(id)
}

/**
 * Le volet à MONTRER pour un volet demandé : lui-même s'il est servi, le volet
 * par défaut sinon. Une adresse ancienne (`?tab=directs`) aboutit donc au fil
 * au lieu d'un écran vide — une page d'accueil ne refuse pas de s'ouvrir.
 */
export function servedReseauTab(id: ReseauAgentTabId): ReseauAgentTabId {
	return isServedReseauTab(id) ? id : RESEAU_AGENT_TAB_DEFAULT
}

// ═══════════════════════════════════════════════════════════════════════════
// LES ENTRÉES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les décomptes que le menu sait porter en pastille.
 *
 * ⚠️ Un SEUL depuis le 2026-09-06 : `unreadActivity` a disparu avec le volet
 * Activité (R-03). Le laisser en champ inerte aurait donné un décompte produit
 * par la page et consommé par personne — le genre de plomberie qu'on retrouve
 * six mois plus tard en croyant qu'elle affiche quelque chose.
 */
export interface ReseauMenuCounts {
	/** Invitations de connexion reçues — volet Relations. */
	invitations?: number
}

/**
 * Une entrée du menu.
 *
 * Chaque entrée mène à un volet : les commandes transversales vivent sur leur
 * surface propre, hors de ce rail.
 */
export interface ReseauMenuItem {
	id: ReseauAgentTabId
	/** Clé i18n qualifiée du libellé — celle du volet (`reseau-agent-nav`). */
	labelKey: string
	icon: IconName
	/** L'adresse du volet. */
	href: string
	/** Le décompte à afficher, ou `null` quand il n'y a rien à signaler. */
	badge: number | null
}

/**
 * L'icône de chaque volet.
 *
 * Déclarée par un `Record` COMPLET plutôt que par un `switch` à cas par défaut :
 * un volet ajouté à `RESEAU_AGENT_TAB_IDS` sans icône fait alors échouer le
 * typage, au lieu de se rendre avec un chevron générique que personne ne
 * remarque.
 */
const TAB_ICONS: Record<ReseauAgentTabId, IconName> = {
	fil: "home",
	relations: "users",
	groupes: "layers",
	pages: "building",
	conferences: "video",
	evenements: "calendar",
	enregistrements: "bookmark",
}

/**
 * Une pastille ne s'affiche que si elle dit quelque chose.
 *
 * `0` et `undefined` rendent `null` : un « 0 » à côté de « Relations » se lit
 * comme un décompte à traiter, alors qu'il annonce précisément qu'il n'y a
 * rien à faire.
 */
function badgeOf(count: number | undefined): number | null {
	if (count === undefined || count <= 0) return null
	return count
}

/**
 * Les entrées du rail-menu, dans l'ordre des volets.
 *
 * Le rail remplace la tablist à largeur égale : il en reprend donc TOUS les
 * volets SERVIS, dans le même ordre, sans liste recopiée ni exclusion
 * silencieuse.
 *
 * `base` est l'adresse de la page réseau (`useRoutes().home()`).
 */
export function menuItemsFor(counts: ReseauMenuCounts, base: string): ReseauMenuItem[] {
	return RESEAU_AGENT_TABS.filter((tab) => isServedReseauTab(tab.id)).map((tab) => ({
		id: tab.id,
		labelKey: tab.labelKey,
		icon: TAB_ICONS[tab.id],
		href: reseauAgentHref(tab.id, base),
		badge: tab.id === "relations" ? badgeOf(counts.invitations) : null,
	}))
}

// ═══════════════════════════════════════════════════════════════════════════
// LES RACCOURCIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combien de raccourcis le rail porte au maximum.
 *
 * Au-delà, la liste devient un second menu qu'il faut parcourir : les
 * raccourcis servent à revenir vite là où l'on va souvent, pas à tout lister.
 * Les pages et les groupes complets ont chacun leur volet.
 */
export const SHORTCUTS_MAX = 5

/** Un raccourci : une page suivie ou un groupe dont je suis membre. */
export interface ReseauShortcut {
	id: string
	label: string
	href: string
	/** Logo de la page ou visuel du groupe — `null` rend une initiale. */
	imageUrl: string | null
}

/** Ce qu'il faut savoir d'une page pour en faire un raccourci. */
export interface ShortcutPageInput {
	pageId: string
	handle: string
	name: string
	logoUrl?: string | null
}

/** Ce qu'il faut savoir d'un groupe pour en faire un raccourci. */
export interface ShortcutGroupInput {
	groupId: string
	name: string
	imageUrl?: string | null
}

/**
 * Les adresses dont les raccourcis ont besoin — celles de `useRoutes()` :
 * la page réseau (`home()`, où s'ouvre le volet d'un groupe) et la fiche d'une
 * page (`page(handle)`).
 */
export interface ShortcutLinks {
	home: string
	page: (handle: string) => string
}

/**
 * Les raccourcis du rail : les pages suivies d'abord, puis les groupes.
 *
 * L'ordre n'est pas cosmétique — une page publie POUR moi (je m'y suis abonné
 * pour la lire), un groupe est un lieu où je vais écrire. À nombre de places
 * limité, ce qui arrive prime sur ce qu'on visite.
 */
export function shortcutsFor(
	pages: readonly ShortcutPageInput[],
	groups: readonly ShortcutGroupInput[],
	links: ShortcutLinks,
	max: number = SHORTCUTS_MAX,
): ReseauShortcut[] {
	const shortcuts: ReseauShortcut[] = [
		...pages.map((page) => ({
			id: `page:${page.pageId}`,
			label: page.name,
			href: links.page(page.handle),
			imageUrl: page.logoUrl ?? null,
		})),
		...groups.map((group) => ({
			id: `groupe:${group.groupId}`,
			label: group.name,
			href: reseauAgentGroupeHref(group.groupId, links.home),
			imageUrl: group.imageUrl ?? null,
		})),
	]
	return max <= 0 ? [] : shortcuts.slice(0, max)
}

/**
 * Le complément parlé d'une pastille.
 *
 * Un « 3 » nu, annoncé après « Relations », ne dit pas 3 quoi — même arbitrage
 * que `TabLabel` dans la barre d'onglets, et que `unreadBadgeLabel` pour la
 * messagerie.
 */
export function menuBadgeLabel(item: ReseauMenuItem, t: TFunction): string | null {
	if (item.badge === null) return null
	switch (item.id) {
		case "relations":
			return t("reseau:reseauMenu.badge.invitations", { count: item.badge })
		default:
			return null
	}
}
