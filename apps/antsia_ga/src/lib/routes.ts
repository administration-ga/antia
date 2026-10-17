import type { EngineRoutes } from "@antsia/api/network"
import type { UsageScreen } from "@antsia/social-features/shell/analytics"

/** Le segment de la route « nouveau statut » (lu aussi par la page des statuts). */
export const STORIES_NEW_SEGMENT = "nouvelle"

/**
 * Table des routes d'antsia.ga — le SEUL fichier de l'application où une URL
 * s'écrit (cliquet `no-hardcoded-urls`). Les paquets du moteur ne connaissent
 * aucune URL : l'application leur passe `engineRoutes` (`NetworkProvider`).
 */
export const routes = {
  home: () => "/",
  signIn: () => "/entrer",
  signedOut: (incomplete: boolean) => incomplete ? "/entrer?deconnexion=incomplete" : "/entrer",
  application: (origin: string) => new URL("/", origin).href,
  welcome: () => "/bienvenue",
  feed: () => "/fil",
  memberPost: (id: string) => `/fil?${new URLSearchParams({ post: id })}`,
  discover: () => "/decouvrir",
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
  /** Statuts (stories) en plein écran. */
  stories: () => "/actus",
  /** Le composeur de statut, ouvert sur le lecteur. */
  storiesNew: () => `/actus/${STORIES_NEW_SEGMENT}`,
  profile: (handle: string) => `/profil/${encodeURIComponent(handle)}`,
  page: (handle: string) => `/page/${encodeURIComponent(handle)}`,
  conference: (sessionId: string) => `/conference/${encodeURIComponent(sessionId)}`,
  personalControls: () => "/mes-donnees",
  pushWorker: () => "/notifications-worker",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
} as const

/** Les adresses que les surfaces du moteur lisent par `useRoutes()`. */
export const engineRoutes: EngineRoutes = {
  home: routes.feed,
  messages: routes.messages,
  stories: routes.stories,
  profile: routes.profile,
  page: routes.page,
  conference: routes.conference,
  settings: routes.personalControls,
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
