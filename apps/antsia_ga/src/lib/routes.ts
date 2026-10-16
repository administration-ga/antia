import type { EngineRoutes } from "@antsia/api/network"

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
}
