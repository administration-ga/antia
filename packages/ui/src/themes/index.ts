/**
 * Registre des thèmes d'application du moteur. Un thème = un fichier
 * `<nom>.css` dans ce dossier, qui surcharge la charte de base sur
 * `[data-charte="<nom>"]`. `diasporale` appartient à la session DIASPORALE
 * (fichier `diasporale.css`, écrit par elle).
 */
export const APPLICATION_THEMES = ["antsia", "admin-antsia", "diasporale"] as const
export type ApplicationTheme = (typeof APPLICATION_THEMES)[number]

/** Les thèmes qu'un membre d'antsia.ga choisit dans ses réglages (charte d'origine + sept thèmes). */
export { ANTSIA_THEME_IDS, ANTSIA_THEMES, antsiaCharteFor, type AntsiaThemeId } from "./antsia-themes"
