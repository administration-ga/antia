// Dupliqué de socle/packages/agent-features/src/features/stories/stories-entry.ts @ ad2e7fdc2 — adaptations : aucune dans le code (drapeau de module, aucun libellé) ; commentaire rapporté à l'accueil du réseau (`useRoutes().home()`) au lieu de la route de l'espace du socle.
"use client"

/**
 * stories-entry — le lecteur sait-il d'où l'on vient ?
 *
 * `close` pousse l'accueil du réseau (`useRoutes().home()`) — juste sur un
 * LIEN DIRECT (une notification, un rechargement : il n'y a rien derrière),
 * faux depuis l'app : fermer le lecteur ouvert du fil REVIENT au fil en
 * perdant la position de défilement et les pages « Voir plus » déjà montées,
 * et depuis les Actus d'iCom il renvoie au fil au lieu de Messages. `router.back()` restaure les
 * deux — mais seulement quand l'entrée d'historique du dessous est à nous.
 *
 * D'où ce drapeau de module : chaque POINT D'ENTRÉE de l'app le lève juste
 * avant de naviguer (rail du fil, rangée/brique Actus, onglet Stories), et le
 * lecteur le CONSOMME à son montage. Un module et non un état React — le
 * marqueur et le lecteur vivent dans des arbres différents ; et non
 * `sessionStorage` — la question est « cette navigation-CI vient-elle de
 * l'app ? », pas « une navigation est-elle déjà venue de l'app ? » : un
 * drapeau qui survivrait ferait faire `back()` à un lien direct ouvert plus
 * tard dans le même onglet.
 *
 * La DÉCISION (back ou push) reste dans `stories-viewer.ts`
 * (`storiesCloseAction`), testée — ici ne vit que la mémoire d'un instant.
 */

let openedFromApp = false

/** À appeler par un point d'entrée de l'app, juste AVANT sa navigation. */
export function markStoriesOpenedFromApp(): void {
	openedFromApp = true
}

/** Lu UNE fois, au montage du lecteur — et le drapeau retombe aussitôt. */
export function consumeStoriesOpenedFromApp(): boolean {
	const was = openedFromApp
	openedFromApp = false
	return was
}
