import type { EngineRoutes } from "@antsia/api/network"
import type { UsageScreen } from "@antsia/social-features/shell/analytics"
import type { ReseauDestinationMatch } from "@antsia/social-features/shell/reseau-menu-destinations"

import { parsePublicPostContinuation, PUBLIC_POST_CONTINUATION_PARAM } from "./public-post-continuation"
import { NOTIFICATION_REFERENCE_PARAM, parseNotificationReference } from "./notification-open"
import { appendShopContact, parseShopContactContinuation, type ShopContactContinuation } from "./shop-contact-continuation"
import type { CatalogFilters } from "./catalog-search"

function catalogQuery(filters: CatalogFilters, cursor?: string | null): string {
  const query = new URLSearchParams()
  if (filters.kind) query.set("type", filters.kind)
  if (filters.collectionRef) query.set("collection", filters.collectionRef)
  if (filters.query) query.set("recherche", filters.query)
  if (cursor) query.set("curseur", cursor)
  return query.size ? `?${query}` : ""
}

/** Le segment de la route « nouveau statut » (lu aussi par la page des statuts). */
export const STORIES_NEW_SEGMENT = "nouvelle"

/** P14B : l'ancre de la section des décisions d'UNE page dans « Mes données » (lue aussi par cette section). */
export function pageDecisionsAnchor(pageId: string): string {
  return `decisions-page-${encodeURIComponent(pageId)}`
}

/**
 * Table des routes d'antsia.ga — le SEUL fichier de l'application où une URL
 * s'écrit (cliquet `no-hardcoded-urls`). Les paquets du moteur ne connaissent
 * aucune URL : l'application leur passe `engineRoutes` (`NetworkProvider`).
 */
export const routes = {
  home: () => "/",
  signIn: (intent?: "sign-up", postId?: string, notificationReference?: string, shopContact?: ShopContactContinuation) => {
    const query = new URLSearchParams()
    if (intent === "sign-up") query.set("inscription", "1")
    const continuation = parsePublicPostContinuation(postId)
    if (continuation) query.set(PUBLIC_POST_CONTINUATION_PARAM, continuation)
    else {
      const notification = parseNotificationReference(notificationReference)
      if (notification) query.set(NOTIFICATION_REFERENCE_PARAM, notification)
      else appendShopContact(query, shopContact)
    }
    return query.size > 0 ? `/entrer?${query}` : "/entrer"
  },
  signedOut: (incomplete: boolean) => incomplete ? "/entrer?deconnexion=incomplete" : "/entrer",
  application: (origin: string) => new URL("/", origin).href,
  welcome: (postId?: string, notificationReference?: string, shopContact?: ShopContactContinuation) => {
    const continuation = parsePublicPostContinuation(postId)
    if (continuation) return `/bienvenue?${new URLSearchParams({ [PUBLIC_POST_CONTINUATION_PARAM]: continuation })}`
    const notification = parseNotificationReference(notificationReference)
    if (notification) return `/bienvenue?${new URLSearchParams({ [NOTIFICATION_REFERENCE_PARAM]: notification })}`
    const query = new URLSearchParams()
    appendShopContact(query, shopContact)
    return query.size ? `/bienvenue?${query}` : "/bienvenue"
  },
  feed: () => "/fil",
  feedPreferences: () => "/mon-fil",
  memberPost: (id: string) => `/fil?${new URLSearchParams({ post: id })}`,
  discover: () => "/decouvrir",
  /**
   * La destination « Découvrir » des MEMBRES — sous la coque persistante (un
   * appel en cours y survit). Distincte de la découverte PUBLIQUE ci-dessus
   * (`discover`), servie sans compte hors de la coque.
   */
  memberDiscover: () => "/explorer",
  publicProfile: (handle: string) => `/@${encodeURIComponent(handle)}`,
  officialPage: (handle: string) => `/pages/${encodeURIComponent(handle)}`,
  publication: (id: string) => `/publications/${encodeURIComponent(id)}`,
  tag: (tag: string) => `/tags/${encodeURIComponent(tag)}`,
  province: (slug: string) => `/provinces/${encodeURIComponent(slug)}`,
  nationalFeed: () => "/fil?portee=national",
  memberProvince: (slug: string) => `/fil?${new URLSearchParams({ portee: "province", province: slug })}`,
  memberTag: (tag: string) => `/fil?${new URLSearchParams({ portee: "national", tag })}`,
  memberFeedWindow: (filter: { province?: string; tag?: string }, cursor?: string) => {
    const query = new URLSearchParams({ portee: filter.province ? "province" : "national" })
    if (filter.province) query.set("province", filter.province)
    if (filter.tag) query.set("tag", filter.tag)
    if (cursor) query.set("curseur", cursor)
    return `/fil?${query}`
  },
  groups: () => "/groupes",
  events: () => "/evenements",
  memberTab: (tab: "groupes" | "evenements") => `/fil?${new URLSearchParams({ tab })}`,
  direct: (id: string) => `/direct/${encodeURIComponent(id)}`,
  publicAlbum: (handle: string, albumId: string) => `/@${encodeURIComponent(handle)}/albums/${encodeURIComponent(albumId)}`,
  about: () => "/a-propos",
  legal: () => "/mentions-legales",
  privacy: () => "/confidentialite",
  transparency: () => "/transparence",
  moderation: () => "/moderation",
  moderationView: (view: "reports" | "pending" | "appeals", team?: string, cursor?: string) => {
    const query = new URLSearchParams({ vue: view })
    if (team && view !== "appeals") query.set("equipe", team)
    if (cursor) query.set("curseur", cursor)
    return `/moderation?${query}`
  },
  settings: () => "/parametres",
  dataSettings: () => "/parametres/donnees",
  authSession: () => "/api/auth/get-session",
  authToken: () => "/api/auth/convex/token",
  publicSessionBridge: () => "/api/session-bridge",
  apdpvp: () => "https://www.apdpvp.ga/textes-et-decisions/",
  officialJournal: () => "https://journal-officiel.ga/20085-025-2023-/",
  gdpr: () => "https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr",
  /** iCom en pages (téléphone, liens directs) : la messagerie et ses sous-adresses. */
  messages: () => "/messages",
  commercialConversation: (threadId: string) => `/messages/commerce/${encodeURIComponent(threadId)}`,
  /** Statuts (stories) en plein écran. */
  stories: () => "/actus",
  /** Le composeur de statut, ouvert sur le lecteur. */
  storiesNew: () => `/actus/${STORIES_NEW_SEGMENT}`,
  profile: (handle: string) => `/profil/${encodeURIComponent(handle)}`,
  /** La destination « Profil » des membres : mon espace (profil, préférences, réglages, sortie). */
  me: () => "/moi",
  page: (handle: string) => `/page/${encodeURIComponent(handle)}`,
  myShops: () => "/mes-boutiques",
  myOrders: () => "/mes-commandes",
  cart: () => "/panier",
  purchases: () => "/mes-achats",
  purchase: (purchaseId: string) => `/mes-achats/${encodeURIComponent(purchaseId)}`,
  checkoutPrepare: (handle: string, offerRef: string) => `/boutique/${encodeURIComponent(handle)}/preparer/${encodeURIComponent(offerRef)}`,
  checkoutAttempt: (attemptId: string) => `/mes-commandes/${encodeURIComponent(attemptId)}`,
  paymentList: () => "/mes-paiements",
  paymentAttempt: (paymentAttemptId: string) => `/mes-paiements/${encodeURIComponent(paymentAttemptId)}`,
  paymentReturn: (paymentAttemptId: string) => `/mes-paiements/${encodeURIComponent(paymentAttemptId)}/retour`,
  shopDirectory: () => "/explorer#boutiques",
  shopLinkCallback: () => "/mes-boutiques/liaison/retour",
  shopEditor: (id: string) => `/mes-boutiques/${encodeURIComponent(id)}`,
  storefront: (handle: string) => `/boutique/${encodeURIComponent(handle)}`,
  shopContact: (handle: string, offerRef?: string) => `/boutique/${encodeURIComponent(handle)}/contacter${offerRef ? `?${new URLSearchParams({ offre: offerRef })}` : ""}`,
  publicStorefront: (handle: string) => `/boutiques/${encodeURIComponent(handle)}`,
  shopCatalog: (handle: string, filters: CatalogFilters = {}, cursor?: string | null) => `/boutique/${encodeURIComponent(handle)}/catalogue${catalogQuery(filters, cursor)}`,
  publicShopCatalog: (handle: string, filters: CatalogFilters = {}, cursor?: string | null) => `/boutiques/${encodeURIComponent(handle)}/catalogue${catalogQuery(filters, cursor)}`,
  shopOffer: (handle: string, offerRef: string) => `/boutique/${encodeURIComponent(handle)}/offres/${encodeURIComponent(offerRef)}`,
  publicShopOffer: (handle: string, offerRef: string) => `/boutiques/${encodeURIComponent(handle)}/offres/${encodeURIComponent(offerRef)}`,
  /** P15 : offres d'emploi (Découvrir, vitrine membre, fiche, SSR public) et Mes candidatures (Profil). */
  jobDirectory: () => "/explorer#emplois",
  shopJobs: (handle: string) => `/boutique/${encodeURIComponent(handle)}/emplois`,
  shopJob: (handle: string, jobRef: string) => `/boutique/${encodeURIComponent(handle)}/emplois/${encodeURIComponent(jobRef)}`,
  publicShopJob: (handle: string, jobRef: string) => `/boutiques/${encodeURIComponent(handle)}/emplois/${encodeURIComponent(jobRef)}`,
  myApplications: () => "/mes-candidatures",
  /** P14B : la fiche d'UNE candidature (ouverture ciblée d'un avis), relue par le serveur. */
  jobApplication: (applicationId: string) => `/mes-candidatures/${encodeURIComponent(applicationId)}`,
  /** P14 : devis, rendez-vous et prestations (membre seulement), « Mes demandes » (Profil) et rubrique Services de Découvrir. */
  serviceQuote: (handle: string, offerRef: string) => `/boutique/${encodeURIComponent(handle)}/devis/${encodeURIComponent(offerRef)}`,
  serviceBooking: (handle: string, offerRef: string) => `/boutique/${encodeURIComponent(handle)}/rendez-vous/${encodeURIComponent(offerRef)}`,
  serviceOrder: (handle: string, offerRef: string) => `/boutique/${encodeURIComponent(handle)}/prestation/${encodeURIComponent(offerRef)}`,
  serviceRequests: () => "/mes-demandes",
  serviceRequest: (requestRowId: string) => `/mes-demandes/${encodeURIComponent(requestRowId)}`,
  serviceDirectory: () => "/explorer#services",
  conference: (sessionId: string) => `/conference/${encodeURIComponent(sessionId)}`,
  personalControls: () => "/mes-donnees",
  /** P14B : les décisions de modération visant une page représentée, section de « Mes données ». */
  pageModerationDecisions: (pageId: string) => `/mes-donnees#${pageDecisionsAnchor(pageId)}`,
  notificationCenter: () => "/fil?notifications=1",
  openNotification: (reference?: string) => {
    const notification = parseNotificationReference(reference)
    return notification ? `/notifications/ouvrir?${new URLSearchParams({ [NOTIFICATION_REFERENCE_PARAM]: notification })}` : "/notifications/ouvrir"
  },
  pushWorker: () => "/notifications-worker",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
} as const

/** L'entrée membre préserve seulement cette intention, jamais l'adresse complète. */
export function shopContactFromLocation(pathname: string, search: string): ShopContactContinuation | undefined {
  const match = /^\/boutique\/([^/]+)\/contacter$/u.exec(pathname)
  if (!match) return undefined
  try {
    const handle = decodeURIComponent(match[1]!)
    const offers = new URLSearchParams(search).getAll("offre")
    if (offers.length > 1) return undefined
    const contact = parseShopContactContinuation({ kind: "shop_contact", handle, ...(offers[0] === undefined ? {} : { offerRef: offers[0] }) })
    return contact && pathname === routes.shopContact(contact.handle) ? contact : undefined
  } catch { return undefined }
}

/** Les adresses que les surfaces du moteur lisent par `useRoutes()`. */
export const engineRoutes: EngineRoutes = {
  home: routes.feed,
  post: routes.memberPost,
  messages: routes.messages,
  commercialConversation: routes.commercialConversation,
  stories: routes.stories,
  profile: routes.profile,
  page: routes.page,
  conference: routes.conference,
  // Les paramètres de l'application (affichage, thème, langue et fuseau) : entrée du rail et du Profil.
  settings: routes.settings,
  // Navigation par destinations (P02) : les deux destinations propres de
  // l'application, déclarées avec `NetworkProvider navigation="destinations"`.
  discover: routes.memberDiscover,
  me: routes.me,
  // P14B : destinations typées des avis (cloche, ouverture d'une notification poussée).
  serviceRequest: routes.serviceRequest,
  jobApplication: routes.jobApplication,
  pageModerationDecisions: routes.pageModerationDecisions,
  personalDecisions: routes.personalControls,
}

/**
 * Une page de DIRECT (`/direct/…`, `/conference/…`) : plein écran, sans barre
 * ni rail de navigation posés sur ses commandes.
 */
export function isLiveSessionPath(pathname: string): boolean {
  return [routes.direct(""), routes.conference("")].some((prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length)
}

/**
 * La destination d'une page que SEULE l'application sait ranger : le fil
 * filtré (national, province, mot-clé) relève de « Découvrir », mes
 * préférences du fil, mes paramètres, mes boutiques et la modération relèvent de « Profil » ;
 * une vitrine membre relève de « Découvrir ». `undefined`
 * pour toute autre page — la coque la range elle-même (fil et volets,
 * Découvrir, Profil, Messages, mon profil public).
 */
export function memberDestinationFor(
  pathname: string,
  search: { get: (name: string) => string | null },
): ReseauDestinationMatch | null | undefined {
  if (pathname === routes.feed() && search.get("portee") !== null) return { id: "decouvrir", current: "section" }
  if (pathname.startsWith(routes.storefront("")) && pathname.length > routes.storefront("").length) return { id: "decouvrir", current: "section" }
  if (pathname === routes.myShops() || pathname.startsWith(`${routes.myShops()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.myOrders() || pathname.startsWith(`${routes.myOrders()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.cart() || pathname === routes.purchases() || pathname.startsWith(`${routes.purchases()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.paymentList() || pathname.startsWith(`${routes.paymentList()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.myApplications() || pathname.startsWith(`${routes.myApplications()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.serviceRequests() || pathname.startsWith(`${routes.serviceRequests()}/`)) return { id: "profil", current: "section" }
  if (pathname === routes.feedPreferences() || pathname === routes.moderation() || pathname === routes.settings()) return { id: "profil", current: "section" }
  return undefined
}

/** Une catégorie fermée : aucun handle, identifiant, paramètre ou chemin envoyé. */
export function usageScreenForPath(pathname: string): UsageScreen | null {
  if (pathname === routes.feed()) return "feed"
  if (pathname === routes.personalControls()) return "data"
  if (pathname === routes.messages() || pathname.startsWith(`${routes.messages()}/`)) return "messages"
  if (pathname === routes.stories() || pathname.startsWith(`${routes.stories()}/`)) return "stories"
  if (/^\/profil\/[^/]+\/albums\/[^/]+$/.test(pathname)) return "albums"
  if (pathname.startsWith("/profil/")) return "profile"
  if (pathname.startsWith("/page/")) return "page"
  if (pathname.startsWith("/conference/")) return "conference"
  return null
}

/** Seule une origine HTTPS sans sous-chemin peut fournir le point de capture. */
export function analyticsCaptureEndpoint(host: string | undefined): string | null {
  if (!host || host.trim() !== host || /\s/.test(host)) return null
  try {
    const url = new URL(host)
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null
    return new URL("/i/v0/e/", url).href
  } catch { return null }
}
