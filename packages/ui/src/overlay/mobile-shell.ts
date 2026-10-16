// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/mobile-shell.ts @ ad2e7fdc2 — adaptations : seuil lu dans `./breakpoint` (renommé du chrome de poste) ; documentation des seuils voisins repointée sur le moteur (la barre de l'espace personnel du socle et `mobile.css` n'existent pas ici).
import { MOBILE_MAX_PX, MOBILE_QUERY } from "./breakpoint"

/**
 * mobile-shell — le SEUIL de la coquille mobile d'iRéseau, et rien d'autre.
 *
 * `packages/agent-features` tourne en environnement `node`, SANS
 * testing-library : ce qui reste dans le corps d'un composant n'est vérifiable
 * qu'à l'œil (cf. CLAUDE.md). Le seuil, sa requête média et la lecture d'un
 * `matches` encore inconnu vivent donc ici.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 959 px — UN COMPLÉMENT EXACT, PAS UN CHIFFRE ROND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois décisions déjà prises dans ce dépôt se mesurent au MÊME endroit, et le
 * seul moyen qu'aucune plage de largeurs ne tombe entre elles est de les faire
 * dériver du même nombre :
 *
 *  · `MOBILE_ONLY_CLASS` (`./breakpoint`) rend `min-[960px]:hidden` : la
 *    barre basse existe jusqu'à 959 px inclus, le rail prend le relais à 960 ;
 *  · `DOCK_MIN_VIEWPORT_PX = 960` (messagerie de `@antsia/social-features`)
 *    est le seuil sous lequel la carte de messagerie ne se rend pas.
 *
 * Un seuil à 960 ici — ou à 768, le `md` des shells institutionnels — ouvrirait
 * une bande où l'arbre mobile s'affiche pendant que le chrome de l'espace se
 * croit encore au bureau, ou l'inverse. C'est exactement le défaut que
 * `.pb-mobile-nav` / `.pb-mobile-nav-md` documentent : deux seuils différents
 * pour deux barres, et 88 px de vide entre les deux.
 *
 * ⚠️ Le seuil se mesure ici sur le VIEWPORT, et non sur le conteneur comme les
 * paliers de `reseau-layout.ts`. Ce n'est pas une incohérence : ce qu'on décide
 * ici, c'est quel ARBRE monter (téléphone ou bureau) — donc quel chrome
 * l'espace pose autour, ce qui dépend de l'écran et de rien d'autre. Les
 * container queries répondent à une autre question : combien de colonnes tient
 * la page une fois le chrome posé.
 *
 * Le seuil vient du chrome partagé ; ce module reste pur.
 */

/**
 * Dernière largeur SERVIE par la coquille mobile, en pixels (inclus).
 *
 * Complément exact de `min-[960px]:hidden` et de `DOCK_MIN_VIEWPORT_PX`.
 */
export const RESEAU_MOBILE_MAX_PX = MOBILE_MAX_PX

/** La requête média correspondante — une seule écriture, jamais recopiée. */
export const RESEAU_MOBILE_QUERY = MOBILE_QUERY

/**
 * Cette largeur relève-t-elle de la coquille mobile ?
 *
 * ⚠️ Une largeur non mesurée (`NaN`, `Infinity`, zéro, négative) n'est PAS un
 * téléphone : elle rend `false`. Zéro survient réellement — un conteneur
 * démonté, une mesure prise avant la mise en page — et le traiter comme
 * « très étroit » ferait basculer l'écran sur l'arbre mobile au poste de
 * travail, le temps d'un rendu.
 */
export function isReseauMobileWidth(width: number): boolean {
	if (!Number.isFinite(width) || width <= 0) return false
	return width <= RESEAU_MOBILE_MAX_PX
}

/**
 * Ce que dit un `matches` de `matchMedia`, quand on l'a.
 *
 * `undefined` — le navigateur n'a pas encore répondu, ou il n'y a pas de
 * navigateur — rend `null`, et `null` n'est PAS `false`. La nuance porte tout :
 * `false` ferait monter l'arbre de BUREAU sur un téléphone le temps du premier
 * rendu, puis le remplacerait — deux arbres montés, deux séries d'abonnements
 * Convex ouverts puis fermés, et un saut de mise en page visible. `null` dit
 * « on ne sait pas encore » et laisse l'appelant rendre une ossature.
 */
export function resolveMobileViewport(
	matches: boolean | undefined,
): boolean | null {
	return matches === undefined ? null : matches
}
