/**
 * Table des routes de la console du moteur — le SEUL fichier de l'application où une URL
 * s'écrit (cliquet `no-hardcoded-urls`). Les paquets du moteur ne connaissent
 * aucune URL : l'application leur passe cet adaptateur (PA6).
 */
export const routes = {
  home: () => "/",
  signIn: () => "/entrer",
  signedOut: (incomplete = false) => incomplete ? "/entrer?deconnexion=incomplete" : "/entrer",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
} as const
