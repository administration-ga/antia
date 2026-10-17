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
