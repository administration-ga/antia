// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-agent-nav.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT pour la page réseau du moteur — plus aucune route en dur (`RESEAU_AGENT_URL` retiré) : chaque fabrique d'adresse reçoit la BASE de la page réseau en DERNIER paramètre (`useRoutes().home()`), les paramètres de vue (`tab`, `tag`, `groupe`, `vue`, `q`, `post`, `notifications`) inchangés ; volets décrits par des CLÉS i18n (`labelKey`, `shortLabelKey`, `descriptionKey`) au lieu de libellés ; descriptions sans « agents » ni « administrations » (les pages sont celles du moteur : institutions, associations, entreprises, médias, communautés) ; alias « administrations » retiré ; `parseReseauAgentTab` ne lit plus une propriété héritée de l'objet des alias (`toString` rendait une fonction) ; références à iAsted et au manifeste de navigation du socle retirées des commentaires ; API exportée gardée (noms et ordre des paramètres existants).
/**
 * reseau-agent-nav — définition PURE des volets de la page RÉSEAU.
 *
 * Ce qui se DÉCIDE dans cette page — quels volets existent, lequel s'ouvre par
 * défaut, quelles anciennes adresses continuent d'aboutir, quel panneau va au
 * rail et lequel occupe la colonne — vit ici, où c'est vérifiable, et non dans
 * le corps d'un composant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE ADRESSE N'EST ÉCRITE ICI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La page réseau est l'ACCUEIL de l'application (`useRoutes().home()`) : seule
 * l'application sait où elle vit. Chaque fabrique reçoit donc cette BASE en
 * dernier paramètre et n'y ajoute que des paramètres de VUE (`?tab=…`,
 * `?tag=…`…), qui, eux, sont le contrat de cette page. Un composant écrit :
 *
 *     const home = useRoutes().home()
 *     <Link href={reseauAgentHref("relations", home)} />
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE FIL ET LES RELATIONS SONT DEUX VOLETS D'UN MÊME LIEU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les relations ne sont pas empilées SOUS le fil : ce qui est sous un fil
 * infini n'existe pas. Les volets rendent ce choix VISIBLE — la bascule
 * d'onglets est rendue à tous les paliers. Trois conséquences, vérifiées par le
 * test voisin :
 *  · les anciennes graphies d'un volet continuent d'aboutir (`?tab=reseau`
 *    ouvre les Relations) ;
 *  · aucun panneau ne s'affiche deux fois (`railPanelsFor` retire du rail ce
 *    que la colonne porte déjà) ;
 *  · `?tag=` aboutit sur le fil filtré.
 *
 * Aucun import React : ce module ne connaît que des données de navigation.
 */

import type { FeedView } from "./reseau-layout"

/**
 * Les sept volets. L'ordre est celui du rendu — « Groupes » entre les
 * relations et les pages : c'est un lieu où l'on VA, pas un flux qu'on relève.
 *
 * ⚠️ Les pages, les conférences, les évènements et les signets ne sont pas
 * quatre écrans de plus : ce sont des lieux que le réseau a DÉJÀ en base. Un
 * contenu qu'aucune navigation ne mène nulle part n'existe pas.
 *
 * ⚠️ « Activité » n'est PAS un volet : le relevé des notifications est le
 * contenu de la CLOCHE, qui vit dans le chrome et s'ouvre par-dessus n'importe
 * quelle page. Les anciennes adresses n'en meurent pas : `?tab=activite` (et
 * ses deux graphies) aboutit au fil ET ouvre la cloche, cf.
 * `legacyNotificationsRequested`.
 */
export const RESEAU_AGENT_TAB_IDS = ["fil", "relations", "groupes", "pages", "conferences", "evenements", "enregistrements"] as const

export type ReseauAgentTabId = (typeof RESEAU_AGENT_TAB_IDS)[number]

/**
 * Le paramètre de query est `tab` : c'est le contrat par lequel un lien ouvre
 * un volet précis (`useTabQueryState` de `@antsia/api/routing`). Le renommer
 * rendrait la page inatteignable en profondeur.
 */
export const RESEAU_AGENT_TAB_PARAM = "tab"

/**
 * Le paramètre qui ouvre le fil sur un mot-clic.
 *
 * Distinct de `tab` à dessein : un `#hashtag` est un FILTRE du fil, pas un
 * volet. Il ouvre donc le volet « fil » avec sa vue transitoire, et le
 * bouton « Revenir au fil » le lève.
 */
export const RESEAU_AGENT_TAG_PARAM = "tag"

/**
 * Le paramètre qui ouvre le volet Groupes sur UN groupe (sa page). Même
 * mécanique que `tag` : il SÈME l'état initial du volet — une notification,
 * un lien partagé arrivent de l'extérieur — et la navigation interne reste
 * locale ensuite.
 */
export const RESEAU_AGENT_GROUPE_PARAM = "groupe"

/**
 * Le paramètre qui ouvre une SOUS-VUE à l'intérieur d'un volet.
 *
 * ⚠️ À ne pas confondre avec `tab` : `vue` ne DÉSIGNE PAS un volet, il précise
 * lequel des écrans d'un volet est ouvert — aujourd'hui les sous-vues du volet
 * Relations (`relations` · `suggestions` · `invitations`). L'adresse complète
 * porte donc le volet d'abord, sa sous-vue ensuite
 * (`?tab=relations&vue=suggestions`). Un lien qui n'écrirait que `?vue=…`
 * n'ouvre rien — le volet par défaut est le fil, qui ne connaît pas ce
 * paramètre.
 *
 * Il est lu par `useTabQueryState`, comme `tab` : la sous-vue est partageable,
 * survit au rechargement, et le bouton retour la repose.
 */
export const RESEAU_AGENT_VUE_PARAM = "vue"

/**
 * Le paramètre qui ouvre le fil sur une RECHERCHE de publications.
 *
 * Le mot cherché est adressable, exactement comme le mot-clic : un lien se
 * partage, le retour du navigateur ramène au volet d'origine.
 *
 * ⚠️ `q` et non `search` : c'est la convention des barres d'adresse, et le
 * paramètre voyage dans des liens tapés à la main.
 */
export const RESEAU_AGENT_QUERY_PARAM = "q"

/**
 * Le paramètre qui OUVRE LA CLOCHE, d'où qu'on vienne.
 *
 * Ce n'est pas un volet : la carte de notifications se superpose à la page,
 * elle ne la remplace pas. D'où un paramètre à part, consommé UNE fois puis
 * effacé de l'URL. Le laisser en place rouvrirait la carte à chaque retour
 * arrière.
 */
export const RESEAU_AGENT_NOTIFICATIONS_PARAM = "notifications"

/** Volet ouvert quand rien n'est demandé. */
export const RESEAU_AGENT_TAB_DEFAULT: ReseauAgentTabId = "fil"

export interface ReseauAgentTab {
  id: ReseauAgentTabId
  /** Clé i18n qualifiée du libellé complet. */
  labelKey: string
  /** Clé i18n qualifiée du libellé court, pour les chromes contraints. */
  shortLabelKey: string
  /** Clé i18n qualifiée de ce que le volet montre — rendu sous le titre, jamais deviné. */
  descriptionKey: string
}

/** Les trois clés d'un volet, sous `reseau:reseauAgentNav.tabs.<id>`. */
function tabKeys(id: ReseauAgentTabId): ReseauAgentTab {
  const base = `reseau:reseauAgentNav.tabs.${id}`
  return { id, labelKey: `${base}.label`, shortLabelKey: `${base}.shortLabel`, descriptionKey: `${base}.description` }
}

/**
 * Les volets, tels qu'ils se décrivent.
 *
 * ⚠️ Le volet « fil » INTRODUIT le choix de portée, il n'en décrit aucune :
 * répéter la description d'une portée deux fois à dix centimètres d'écart
 * n'apprendrait rien.
 *
 * ⚠️ Le libellé court de « enregistrements » diverge du long À DESSEIN :
 * « Enregistrements » ne tient pas dans un onglet contraint, et « Signets » est
 * le mot que le module `marks` porte déjà côté serveur.
 */
export const RESEAU_AGENT_TABS: readonly ReseauAgentTab[] = Object.freeze(RESEAU_AGENT_TAB_IDS.map(tabKeys))

/**
 * Anciennes graphies qui doivent continuer d'aboutir.
 *
 * Un lien vers un volet vit BIEN au-delà de la session qui l'a posé : toasts,
 * notifications, aide, signets. `reseau` est ici la plus importante : c'est le
 * nom que portait la page des relations avant la fusion des volets.
 */
const RESEAU_AGENT_TAB_ALIASES: Readonly<Record<string, ReseauAgentTabId>> = Object.freeze({
  reseau: "relations",
  "mon-reseau": "relations",
  connexions: "relations",
  people: "relations",
  accueil: "fil",
  feed: "fil",
  publications: "fil",
  /*
   * ⚠️ Les trois graphies de l'ancien volet « Activité » aboutissent au FIL —
   * et ce n'est que la moitié de la réponse : atterrir sur le fil sans rien
   * montrer ferait d'un lien de notification un clic mal visé.
   * `legacyNotificationsRequested` reconnaît ces mêmes valeurs, et la page
   * ouvre alors la CLOCHE.
   */
  activite: "fil",
  activity: "fil",
  notifications: "fil",
  // Groupes thématiques — l'anglais et les graphies probables.
  groups: "groupes",
  groupe: "groupes",
  "groupes-thematiques": "groupes",
  communautes: "groupes",
  // Pages — les graphies probables d'une adresse tapée à la main.
  organisations: "pages",
  orgs: "pages",
  pages_officielles: "pages",
  // Conférences : `directs` est l'ANCIEN nom du volet. `direct`, `live` et
  // `lives` couvrent le singulier des notifications et l'anglais.
  directs: "conferences",
  direct: "conferences",
  live: "conferences",
  lives: "conferences",
  // Évènements — sans accent (une URL en porte rarement) et en anglais.
  evenement: "evenements",
  events: "evenements",
  event: "evenements",
  agenda: "evenements",
  // Signets. `marks` est le nom du module serveur : un lien composé depuis un
  // message d'erreur ou un toast peut très bien le porter.
  signets: "enregistrements",
  bookmarks: "enregistrements",
  saved: "enregistrements",
  enregistres: "enregistrements",
  marks: "enregistrements",
})

/**
 * Le volet désigné par une valeur d'URL — jamais une valeur morte.
 *
 * Insensible à la casse et aux espaces : une URL recopiée à la main ne doit pas
 * échouer sur une majuscule. `null`, valeur vide ou inconnue rendent le volet
 * par défaut, sans erreur — une page d'accueil ne refuse pas de s'ouvrir.
 */
export function parseReseauAgentTab(raw: string | null | undefined): ReseauAgentTabId {
  if (raw === null || raw === undefined) return RESEAU_AGENT_TAB_DEFAULT
  const key = raw.trim().toLowerCase()
  if (key.length === 0) return RESEAU_AGENT_TAB_DEFAULT
  if ((RESEAU_AGENT_TAB_IDS as readonly string[]).includes(key)) {
    return key as ReseauAgentTabId
  }
  // `Object.hasOwn` : une graphie comme `toString` ne trouve rien d'hérité.
  const alias = Object.hasOwn(RESEAU_AGENT_TAB_ALIASES, key) ? RESEAU_AGENT_TAB_ALIASES[key] : undefined
  return alias ?? RESEAU_AGENT_TAB_DEFAULT
}

/**
 * Ajoute des paramètres de VUE à la base injectée — après sa propre query si
 * elle en porte une, et avant son ancre : la table des routes reste libre de sa
 * forme.
 */
function withQuery(base: string, query: string): string {
  const hashAt = base.indexOf("#")
  const path = hashAt === -1 ? base : base.slice(0, hashAt)
  const hash = hashAt === -1 ? "" : base.slice(hashAt)
  return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`
}

/**
 * L'adresse d'un volet. Le volet par défaut rend la BASE NUE : deux adresses
 * pour la même page en feraient deux entrées d'historique et deux liens à
 * comparer.
 *
 * `base` est l'adresse de la page réseau (`useRoutes().home()`).
 */
export function reseauAgentHref(tab: ReseauAgentTabId | undefined, base: string): string {
  if (tab === undefined || tab === RESEAU_AGENT_TAB_DEFAULT) return base
  return withQuery(base, `${RESEAU_AGENT_TAB_PARAM}=${tab}`)
}

/** L'adresse du fil filtré sur un mot-clic. */
export function reseauAgentTagHref(tag: string, base: string): string {
  return withQuery(base, `${RESEAU_AGENT_TAG_PARAM}=${encodeURIComponent(tag)}`)
}

/**
 * L'adresse des RÉSULTATS d'une recherche de publications.
 *
 * Le volet visé est le fil, qui est la valeur par défaut : l'adresse reste
 * donc `base?q=…`, sans `tab=fil` — même règle que `reseauAgentHref`. Une
 * requête vide rend la base NUE : « chercher rien » n'est pas une destination.
 */
export function reseauAgentSearchHref(query: string, base: string): string {
  const cleaned = parseReseauAgentQuery(query)
  if (cleaned === null) return base
  return withQuery(base, `${RESEAU_AGENT_QUERY_PARAM}=${encodeURIComponent(cleaned)}`)
}

/** L'adresse qui OUVRE LA CLOCHE sur la page du réseau. */
export function reseauNotificationsHref(base: string): string {
  return withQuery(base, `${RESEAU_AGENT_NOTIFICATIONS_PARAM}=1`)
}

/** L'adresse de la page d'UN groupe — le volet Groupes ouvert dessus. */
export function reseauAgentGroupeHref(groupId: string, base: string): string {
  return withQuery(base, `${RESEAU_AGENT_TAB_PARAM}=groupes&${RESEAU_AGENT_GROUPE_PARAM}=${encodeURIComponent(groupId)}`)
}

/**
 * Le groupe demandé par l'URL, nettoyé — `null` quand il n'y en a pas. Un
 * identifiant ne se DEVINE pas : la valeur est passée telle quelle au
 * serveur, qui refuse une référence inventée. Il n'a de sens que sur le volet
 * Groupes — même arbitrage que `tag` sur les autres volets : le volet demandé
 * l'emporte, le paramètre est ignoré.
 */
export function parseReseauAgentGroupe(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const groupId = raw.trim()
  return groupId.length === 0 ? null : groupId
}

/**
 * Le mot-clic demandé par l'URL, nettoyé — `null` quand il n'y en a pas.
 *
 * Le `#` de tête est retiré : un lien composé à la main l'écrit naturellement,
 * alors que les publications indexent le mot nu. Sans cela, `?tag=%23numerique`
 * chercherait un mot-clic qui n'existe pas et rendrait un fil vide — un échec
 * qui ressemble à « personne n'a publié là-dessus ».
 */
export function parseReseauAgentTag(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const tag = raw.trim().replace(/^#+/, "")
  return tag.length === 0 ? null : tag
}

/**
 * La recherche demandée par l'URL, nettoyée — `null` quand il n'y en a pas.
 *
 * Aucune autre transformation que le rognage : ce que la personne a tapé est
 * ce que le serveur cherchera. Une requête d'espaces n'est pas une requête.
 */
export function parseReseauAgentQuery(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const query = raw.trim()
  return query.length === 0 ? null : query
}

/**
 * La PUBLICATION à ouvrir à l'arrivée — `?post=<id>` — semée par les
 * notifications et partageable. Ce n'est pas une route : le fil reste la page,
 * la publication est la VUE qu'il prend (`FeedView.kind === "post"`).
 */
export const RESEAU_AGENT_POST_PARAM = "post"

export function parseReseauAgentPost(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const postId = raw.trim()
  return postId.length === 0 ? null : postId
}

/** Les trois graphies de l'ancien volet « Activité ». */
const LEGACY_NOTIFICATION_TABS: readonly string[] = Object.freeze(["activite", "activity", "notifications"])

/**
 * Ce lien-là demandait-il le relevé des notifications ?
 *
 * ⚠️ La question ne se déduit PAS du volet résolu : `parseReseauAgentTab`
 * rend « fil » pour ces trois valeurs comme pour n'importe quelle inconnue.
 * Sans ce prédicat, un lien de cloche atterrirait sur le fil sans rien
 * montrer : un échec indiscernable d'un clic mal visé.
 */
export function legacyNotificationsRequested(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false
  return LEGACY_NOTIFICATION_TABS.includes(raw.trim().toLowerCase())
}

/** Les valeurs qui NIENT une demande, sur un paramètre présent. */
const NEGATIONS: readonly string[] = Object.freeze(["0", "false", "non", "no"])

/**
 * `?notifications=…` demande-t-il l'ouverture de la cloche ?
 *
 * Tolérant à dessein : `1`, `true`, `oui` — n'importe quelle valeur non vide
 * qui ne NIE pas. Un lien tapé à la main ne doit pas échouer sur la graphie
 * d'un booléen, et le pire des deux serait d'ignorer une demande explicite.
 */
export function notificationsRequested(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false
  const value = raw.trim().toLowerCase()
  if (value.length === 0) return false
  return !NEGATIONS.includes(value)
}

/**
 * L'état du fil à l'ouverture de la page, d'après l'URL.
 *
 * Un mot-clic n'a de sens que DANS le fil : `?tab=relations&tag=x` est une
 * adresse contradictoire, et la trancher ici évite d'ouvrir les relations en
 * laissant croire qu'un filtre s'applique quelque part. Le volet demandé
 * l'emporte, le mot-clic est ignoré. Même arbitrage pour `?q=`.
 *
 * ⚠️ **Le mot-clic l'emporte sur la recherche** quand une adresse porte les
 * deux. Aucune des deux fabriques (`reseauAgentTagHref`, `reseauAgentSearchHref`)
 * n'émet jamais l'autre paramètre : `?tag=x&q=y` ne peut venir que d'une URL
 * composée à la main. Le mot-clic gagne parce qu'un filtre nommé est plus
 * précis qu'une recherche plein texte.
 */
export function initialViewFor(tab: ReseauAgentTabId, tag: string | null, query: string | null = null, post: string | null = null): FeedView {
  if (tab !== "fil") return { kind: "feed" }
  if (tag !== null) return { kind: "tag", tag }
  // Une publication précise prime sur une recherche : c'est l'objet le plus
  // étroit, et c'est celui qu'une notification désigne.
  if (post !== null) return { kind: "post", postId: post }
  if (query !== null) return { kind: "search", query }
  return { kind: "feed" }
}

/** Ce qu'une recherche lancée depuis `tab` doit faire de la page. */
export interface SearchNavigation {
  /** La vue que le fil doit prendre. */
  view: FeedView
  /**
   * L'adresse à POUSSER, ou `null` quand on est déjà au bon endroit.
   *
   * Un `push` (et non un `replace`) : « Retour » doit ramener au volet d'où
   * la recherche est partie, pas sauter la page entière.
   */
  href: string | null
}

/**
 * Faut-il changer de volet, et pousser une adresse, pour montrer ces
 * résultats ?
 *
 * Les résultats ne sont rendus que par le fil, et le volet affiché vient de
 * l'URL seule : chercher depuis les Relations sans changer de volet calculerait
 * une réponse que rien ne montre.
 *
 * Une requête VIDE ne navigue jamais : effacer sa recherche depuis les
 * Relations ne doit pas éjecter du volet qu'on regarde.
 */
export function searchNavigationFor(tab: ReseauAgentTabId, query: string, base: string): SearchNavigation {
  const cleaned = parseReseauAgentQuery(query)
  if (cleaned === null) return { view: { kind: "feed" }, href: null }
  return {
    view: { kind: "search", query: cleaned },
    href: tab === "fil" ? null : reseauAgentSearchHref(cleaned, base),
  }
}

/** Le volet, tel qu'il se décrit. `undefined` n'est pas atteignable par `parseReseauAgentTab`. */
export function reseauAgentTabById(id: ReseauAgentTabId): ReseauAgentTab {
  const found = RESEAU_AGENT_TABS.find((tab) => tab.id === id)
  if (found === undefined) {
    throw new Error(`Volet du réseau inconnu : ${id}`)
  }
  return found
}

/** Ce que la colonne centrale porte, selon le volet. */
export type ReseauAgentMainPanel = "feed" | "people" | "groups" | "pages" | "conferences" | "events" | "bookmarks"

export function mainPanelFor(tab: ReseauAgentTabId): ReseauAgentMainPanel {
  switch (tab) {
    case "fil":
      return "feed"
    case "relations":
      return "people"
    case "groupes":
      return "groups"
    case "pages":
      return "pages"
    case "conferences":
      return "conferences"
    case "evenements":
      return "events"
    case "enregistrements":
      return "bookmarks"
  }
}

export interface ReseauAgentRailPanels {
  /** Le rail droit porte-t-il les suggestions de personnes ? */
  suggestions: boolean
  /** Le rail droit porte-t-il les directs en cours ? */
  liveDirects: boolean
  /** Le rail droit porte-t-il les pages à suivre ? */
  pagesToFollow: boolean
  /** Le rail droit porte-t-il les prochains évènements ? */
  events: boolean
}

/**
 * Ce que les rails portent, selon le volet ouvert.
 *
 * INVARIANT : **un panneau ne s'affiche jamais deux fois à l'écran.** Sur un
 * écran large, les rails sont visibles EN MÊME TEMPS que la colonne : laisser
 * les directs au rail droit pendant que le volet « Conférences » les occupe
 * déjà donnerait deux exemplaires côte à côte, avec deux états de lecture à
 * tenir — même raison, à l'échelle de la page, pour laisser le relevé des
 * notifications à la seule cloche.
 *
 * Les suggestions, elles, restent : ce sont des personnes à découvrir, jamais
 * le contenu principal d'un volet.
 *
 * Le rail droit est un rail de DÉCOUVERTE : personnes, pages, évènements et
 * directs. La messagerie, les contacts et l'activité en sont exclus — chacun
 * possède déjà son lieu. Un module quitte le rail quand son volet principal
 * est ouvert, afin de ne jamais apparaître deux fois.
 */
export function railPanelsFor(tab: ReseauAgentTabId): ReseauAgentRailPanels {
  const main = mainPanelFor(tab)
  return {
    suggestions: true,
    liveDirects: main !== "conferences",
    pagesToFollow: main !== "pages",
    events: main !== "events",
  }
}
