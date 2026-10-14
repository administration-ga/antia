/**
 * Registre des thèmes d'application du moteur. Un thème = un fichier
 * `<nom>.css` dans ce dossier, qui surcharge la charte de base sur
 * `[data-charte="<nom>"]`. `diasporale` appartient à la session DIASPORALE
 * (fichier `diasporale.css`, écrit par elle).
 */
export const APPLICATION_THEMES = ["antia", "admin-antia", "diasporale"] as const
export type ApplicationTheme = (typeof APPLICATION_THEMES)[number]
