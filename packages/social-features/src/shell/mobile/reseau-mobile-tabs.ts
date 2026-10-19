// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/reseau-mobile-tabs.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT sans la coque de l'espace agent du socle (`personal-nav` et `personal-chrome` retirés, avec la section « Espace agent » du menu et la traduction d'icônes par URL) : adresses par la table des routes INJECTÉE (`reseauTabHref(id, home)`, `activeReseauTab(pathname, tab, home)`, `shouldShowTabBar(pathname, routes)` avec `routes` = `useRoutes()`), vues immersives décidées ici sur les bases de l'application (`isImmersiveRoute` : statuts, conversation et composeurs de la messagerie, conférence) ; menu bâti sur des DESTINATIONS résolues par la coque (`ReseauMenuDestinations` : page réseau, statuts, profil, réglages — une destination absente retire son entrée) ; onglets, entrées et sections décrits par des CLÉS i18n (`labelKey`, `shortLabelKey`) au lieu de libellés ; « iRéseau » devient « réseau » ; drapeaux du menu, pastilles muettes et invariants (aucun doublon, aucun lien vers la page qu'on regarde) inchangés.
/**
 * reseau-mobile-tabs — la barre d'onglets basse du réseau et son menu.
 *
 * Combien d'onglets, lesquels, où ils mènent, lequel est actif, qui porte une
 * pastille, quand la barre s'efface, et ce que le menu porte — tout cela vit
 * ici, où c'est vérifiable, et non dans le corps d'un composant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MENU FIXE · SOUS-MENUS DU RÉSEAU EN DÉFILEMENT HORIZONTAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le premier geste est toujours « Menu » et ne défile jamais. À sa droite,
 * les volets RÉELS de la page réseau reprennent mot pour mot le contrat de
 * `../reseau-agent-nav.ts`. « Créer » n'est pas un volet : une commande
 * flottante porte cette action sans la déguiser en navigation — et
 * « Activité » n'en est pas un non plus, le relevé étant celui de la cloche
 * de l'en-tête.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE ADRESSE N'EST ÉCRITE ICI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'application injecte ses adresses (`useRoutes()`) ; ce module ne compare
 * des chemins qu'à ses BASES — la page réseau (`home`), la messagerie
 * (`messages`), les statuts (`stories`), une conférence (`conference(id)`).
 * La query est ignorée : `?tab=…` choisit un volet de la même page, pas une
 * autre page.
 *
 * Aucun import de composant : ce module ne connaît que des données de
 * navigation (les types importés sont effacés à la compilation).
 */

import type { EngineRoutes } from "@antsia/api/network"
import type { IconName } from "@antsia/ui"

import {
  parseReseauAgentTab,
  RESEAU_AGENT_TAB_IDS,
  RESEAU_AGENT_TABS,
  reseauAgentHref,
  reseauAgentTabById,
  type ReseauAgentTabId,
} from "../reseau-agent-nav"

/** Même source que le rendu bureau : un volet ajouté là-bas ne peut plus être
 * oublié silencieusement au téléphone. */
export const RESEAU_MOBILE_TAB_IDS = RESEAU_AGENT_TAB_IDS

export type ReseauMobileTabId = ReseauAgentTabId

export interface ReseauMobileTab {
  id: ReseauMobileTabId
  /** Clé i18n qualifiée du libellé complet — c'est le nom accessible de la cible. */
  labelKey: string
  /** Clé i18n qualifiée du libellé rendu sous l'icône (~70 px par emplacement). */
  shortLabelKey: string
  /** Nom d'icône `@antsia/ui` — une seule famille dans toute la barre. */
  icon: IconName
}

const RESEAU_MOBILE_TAB_ICONS: Readonly<Record<ReseauAgentTabId, IconName>> = Object.freeze({
  fil: "home",
  relations: "users",
  groupes: "layers",
  pages: "building",
  conferences: "video",
  evenements: "calendar",
  enregistrements: "bookmark",
})

export const RESEAU_MOBILE_TABS: readonly ReseauMobileTab[] = Object.freeze(
  RESEAU_AGENT_TABS.map((tab) => ({
    id: tab.id,
    labelKey: tab.labelKey,
    shortLabelKey: tab.shortLabelKey,
    icon: RESEAU_MOBILE_TAB_ICONS[tab.id],
  })),
)

/** Les adresses de l'application dont la barre a besoin — celles de `useRoutes()`. */
export type ReseauMobileRoutes = Pick<EngineRoutes, "home" | "messages" | "stories" | "conference">

/**
 * Où mène un sous-menu. Ils correspondent tous à un volet existant de la page
 * réseau (`home` = `useRoutes().home()`) : aucune commande d'action et aucun
 * lien inventé dans cette rangée.
 */
export function reseauTabHref(id: ReseauMobileTabId, home: string): string {
  return reseauAgentHref(id, home)
}

/**
 * Le CHEMIN d'une adresse : query et ancre retirées, barres finales ignorées,
 * la racine gardée. `/fil/` et `/fil?tab=x` désignent la même page que `/fil`.
 */
function pathOf(href: string): string {
  const withoutQuery = href.split("?")[0]?.split("#")[0] ?? ""
  const trimmed = withoutQuery.replace(/\/+$/, "")
  if (trimmed.length === 0) return "/"
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

/** Les segments d'un chemin, sans les vides. */
function segmentsOf(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0)
}

/**
 * Les segments SOUS une base — `[]` pour la base elle-même, `null` hors d'elle.
 * La comparaison porte sur le SEGMENT entier : `/messagerie` ne passe pas pour
 * `/messages`.
 */
function segmentsBelow(path: string, base: string): string[] | null {
  if (base === "/") return segmentsOf(path)
  if (path === base) return []
  if (!path.startsWith(`${base}/`)) return null
  return segmentsOf(path.slice(base.length))
}

/** Un segment décodé ; tel quel s'il est mal formé (une adresse tapée à la main). */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * L'onglet ACTIF, ou `null` quand aucun ne l'est.
 *
 * ⚠️ `null` est une réponse à part entière hors de la page à volets. Sur la page
 * réseau (`home`), tous les volets sont réellement rendus dans la rangée, donc
 * chacun peut et doit porter son état actif.
 *
 * La query `tab` est lue par `parseReseauAgentTab` : ses alias comptent, donc
 * `?tab=reseau` allume bien l'onglet Relations — et les trois graphies de
 * l'ancien « Activité » allument le Fil, sur lequel la cloche s'ouvre.
 */
export function activeReseauTab(pathname: string | null, tab: string | null, home: string): ReseauMobileTabId | null {
  if (pathname === null) return null
  // La page réseau NUE : une page sous elle (un profil, une conférence…) est
  // un lieu du réseau sans onglet.
  if (pathOf(pathname) !== pathOf(home)) return null
  return parseReseauAgentTab(tab)
}

/** Ce que porte une pastille : un chiffre muet et la phrase qui le nomme. */
export interface ReseauTabBadge {
  /** Déjà formaté (« 3 », « 99+ ») — rendu `aria-hidden`. */
  badge: string
  /** La phrase traduite, en `sr-only` : un « 3 » nu ne dit pas 3 quoi. */
  label: string
}

/**
 * La pastille d'un onglet, ou `null`.
 *
 * ⚠️ **AUCUN onglet n'en porte**, et la fonction existe à dessein : la barre
 * reste le seul endroit qui saurait où poser un décompte si un volet en
 * méritait un, et son appelant l'interroge pour chaque onglet. Le décompte de
 * l'activité vit sur la CLOCHE de l'en-tête, une seule fois ; celui des
 * messages, sur l'entrée de la messagerie — jamais additionnés.
 */
export function tabBadge(_id: ReseauMobileTabId, _counts: { unreadNotifications?: number }): ReseauTabBadge | null {
  return null
}

/**
 * Les deux composeurs de la messagerie — des FEUILLES sous sa base, jamais des
 * conversations. Un écran de rédaction est aussi immersif qu'une conversation :
 * le clavier y prend la moitié de la hauteur, une barre d'onglets sous lui
 * n'aurait nulle part où se poser.
 *
 * ⚠️ Ces deux noms DOIVENT rester ceux de `messagerie-routes.ts`
 * (`COMPOSE_LEAF`, `COMPOSE_GROUPE_LEAF`) : les changer ensemble, ou pas.
 */
const IMMERSIVE_MESSAGE_LEAVES: readonly string[] = Object.freeze(["nouveau", "nouveau-groupe"])

/**
 * Cette adresse occupe-t-elle l'écran ENTIER ?
 *
 * Trois familles, et la profondeur compte :
 *  · toute page des STATUTS (la liste est déjà le lecteur) ;
 *  · les deux composeurs de la messagerie (`<messages>/nouveau`,
 *    `<messages>/nouveau-groupe`) et UNE conversation
 *    (`<messages>/<genre>/<id>`), jamais la liste ;
 *  · UNE conférence (`conference(id)`), jamais un annuaire.
 *
 * ⚠️ La base nue de la messagerie n'est PAS immersive : c'est une liste, et une
 * liste sans barre d'onglets serait un cul-de-sac.
 */
export function isImmersiveRoute(pathname: string | null, routes: ReseauMobileRoutes): boolean {
  if (pathname === null) return false
  const path = pathOf(pathname)

  if (segmentsBelow(path, pathOf(routes.stories())) !== null) return true

  const message = segmentsBelow(path, pathOf(routes.messages()))
  if (message !== null && message.length > 0) {
    const [leaf] = message
    if (leaf !== undefined && IMMERSIVE_MESSAGE_LEAVES.includes(leaf)) return message.length === 1
    return message.length === 2
  }

  // Une conférence : le chemin est EXACTEMENT celui que la table des routes
  // donne à son dernier segment — quelle que soit la forme de cette route.
  const last = segmentsOf(path).at(-1)
  return last !== undefined && pathOf(routes.conference(decodeSegment(last))) === path
}

/**
 * La barre est-elle rendue ? Elle s'efface sur les vues immersives — une
 * conversation, une story, un direct occupent l'écran entier.
 *
 * Dérivée d'`isImmersiveRoute` et non recopiée : deux définitions de « plein
 * écran » laisseraient une barre flotter sur une story.
 */
export function shouldShowTabBar(pathname: string | null, routes: ReseauMobileRoutes): boolean {
  return !isImmersiveRoute(pathname, routes)
}

/** Une entrée du menu. */
export interface ReseauMenuItem {
  /** Clé i18n qualifiée du libellé. */
  labelKey: string
  url: string
  /** Nom d'icône `@antsia/ui`, comme la barre. */
  icon: IconName
}

export interface ReseauMenuSection {
  /** Clé i18n qualifiée du titre de section. */
  labelKey: string
  items: ReseauMenuItem[]
}

/**
 * Les volets du réseau que l'application peut ne PAS servir, chacun derrière
 * son drapeau.
 *
 * Les déclarer ici plutôt que de les ajouter le jour venu est ce qui rend
 * l'absence VÉRIFIABLE — un test prouve qu'un drapeau faux retire l'entrée,
 * donc qu'aucune entrée de menu ne mène à un 404.
 */
export interface ReseauMenuFlags {
  pages: boolean
  directs: boolean
  evenements: boolean
  enregistrements: boolean
}

/**
 * Les destinations du menu, résolues par la COQUE — jamais écrites ici.
 *
 * Une destination absente (`null`) RETIRE son entrée : une page qui n'existe
 * pas n'est pas un module fermé, c'est un 404.
 */
export interface ReseauMenuDestinations {
  /** La page réseau (`useRoutes().home()`). */
  home: string
  /** Les statuts en plein écran (`useRoutes().stories()`). */
  stories: string
  /** Mon profil (`useRoutes().profile(handle)`), `null` tant que je n'ai pas d'identifiant publié. */
  profile: string | null
  /** Les réglages du compte — `null` tant que l'application ne les sert pas. */
  settings: string | null
}

/** Une entrée qui mène à un VOLET : son libellé est celui du volet. */
function tabItem(id: ReseauAgentTabId, icon: IconName, home: string): ReseauMenuItem {
  return { labelKey: reseauAgentTabById(id).labelKey, url: reseauAgentHref(id, home), icon }
}

/**
 * Le menu du réseau : ce que la barre ne porte pas, et le compte.
 *
 * ⚠️ INVARIANTS, tous vérifiés par le test voisin :
 *  · aucune URL en double — la première occurrence gagne ;
 *  · aucun lien vers la page réseau nue — c'est la page qu'on regarde, et
 *    l'onglet Fil y mène déjà ;
 *  · un drapeau faux RETIRE l'entrée, il ne la grise pas — même règle pour une
 *    destination absente.
 *
 * Fonction PURE : ne mute rien de ce qu'elle reçoit.
 */
export function reseauMenuSections(destinations: ReseauMenuDestinations, flags: ReseauMenuFlags): ReseauMenuSection[] {
  const { home } = destinations
  const items: ReseauMenuItem[] = [
    { labelKey: "reseau:reseauMobileTabs.menu.stories", url: destinations.stories, icon: "camera" },
    tabItem("relations", "users", home),
    tabItem("groupes", "layers", home),
  ]
  /**
   * ⚠️ Les volets sont des `?tab=` sur la page réseau (l'adresse canonique),
   * et non des routes : seules les ENTITÉS en ont une (une page, une
   * conférence). Une route `…/pages` nue n'existe pas.
   */
  if (flags.pages) items.push(tabItem("pages", "building", home))
  if (flags.directs) items.push(tabItem("conferences", "video", home))
  if (flags.evenements) items.push(tabItem("evenements", "calendar", home))
  if (flags.enregistrements) items.push(tabItem("enregistrements", "bookmark", home))
  if (destinations.profile !== null) {
    items.push({ labelKey: "reseau:reseauMobileTabs.menu.profile", url: destinations.profile, icon: "userCircle" })
  }
  if (destinations.settings !== null) {
    items.push({ labelKey: "reseau:reseauMobileTabs.menu.settings", url: destinations.settings, icon: "settings" })
  }

  const seen = new Set<string>()
  const kept = items.filter((item) => {
    // Le réseau lui-même n'est pas une destination du menu du réseau.
    if (item.url === home) return false
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
  return [{ labelKey: "reseau:reseauMobileTabs.sections.reseau", items: kept }]
}

/**
 * La feuille ouverte par le bouton fixe « Menu » ne répète pas les sous-menus
 * déjà visibles dans la rangée horizontale. Elle ne conserve que les
 * destinations complémentaires (statuts, profil, réglages), sous un titre qui
 * le dit.
 */
export function reseauMobileMenuSections(destinations: ReseauMenuDestinations, flags: ReseauMenuFlags): ReseauMenuSection[] {
  const subtabUrls = new Set(RESEAU_MOBILE_TAB_IDS.map((id) => reseauTabHref(id, destinations.home)))
  return reseauMenuSections(destinations, flags)
    .map((section) => ({
      labelKey: "reseau:reseauMobileTabs.sections.more",
      items: section.items.filter((item) => !subtabUrls.has(item.url)),
    }))
    .filter((section) => section.items.length > 0)
}

/**
 * Le menu par défaut : tous volets servis.
 *
 * Le mécanisme des drapeaux reste — un drapeau RETIRE l'entrée au lieu de la
 * griser — parce que c'est lui qui garantit qu'aucune entrée de menu ne mène à
 * un 404 : le jour où un volet se retire, c'est ici que ça se dit, en un mot,
 * et le test voisin exerce toujours les deux branches.
 */
export function defaultReseauMenuSections(destinations: ReseauMenuDestinations): ReseauMenuSection[] {
  return reseauMenuSections(destinations, {
    pages: true,
    directs: true,
    evenements: true,
    enregistrements: true,
  })
}
