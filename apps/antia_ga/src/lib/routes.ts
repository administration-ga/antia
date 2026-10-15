/**
 * Table des routes d'antia.ga — le SEUL fichier de l'application où une URL
 * s'écrit (cliquet `no-hardcoded-urls`). Les paquets du moteur ne connaissent
 * aucune URL : l'application leur passe cet adaptateur (PA6).
 */
export const routes = {
  home: () => "/",
  signIn: () => "/entrer",
  welcome: () => "/bienvenue",
  feed: () => "/fil",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
} as const
