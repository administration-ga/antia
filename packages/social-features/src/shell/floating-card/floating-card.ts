// Dupliqué de socle/packages/agent-features/src/features/espace-personnel/floating-card.ts @ ad2e7fdc2 — adaptations : logique inchangée (copie textuelle de la décision) ; déplacé dans la coque (`shell/floating-card/`) ; exemples de cartes de choix pris dans le réseau (la cloche, le menu « Créer ») au lieu des cartes de poste et d'affiliation de l'espace agent.
/**
 * floating-card — la POSE des cartes flottantes de la coque.
 *
 * ── Ce qui décide, ce n'est pas la largeur seule : c'est le CLAVIER ───────
 * Le plein écran au téléphone n'a jamais été une préférence de taille, mais
 * la seule réponse au clavier virtuel : il prend la moitié de la hauteur, et
 * seule la surface immersive suit `--kb-inset` (même raison que
 * `storyComposePose`, le composeur d'actus). Une carte qui SAISIT
 * (`"compose"` — un assistant, une contestation) le prend donc au téléphone,
 * et reste une carte compacte au bureau.
 *
 * Une carte qui ne fait que proposer un CHOIX ou porter une information
 * (`"choice"` — la cloche, le menu « Créer ») n'ouvre aucun clavier et tient en
 * quelques lignes : la prendre en plein écran la transformait en PAGE, ce
 * qu'elle n'est pas. Elle reste une carte flottante PARTOUT, la même géométrie
 * au téléphone qu'au bureau.
 *
 * `null` (rendu serveur / premier passage client) ne compte que pour
 * `"compose"` : plein écran, parce que se tromper vers la carte ferait
 * clignoter deux géométries au chargement du téléphone, et que l'inverse ne
 * coûte qu'un voile tardif au bureau. Pour `"choice"`, la question ne se pose
 * pas — une seule géométrie, donc rien à faire clignoter.
 *
 * Module PUR : la décision se teste ici, le composant câble.
 */

export type FloatingCardPose = "card" | "fullscreen"

/**
 * La NATURE de la carte, seule chose qui distingue les deux poses.
 * `"compose"` = elle saisit (clavier) · `"choice"` = elle propose ou informe.
 */
export type FloatingCardKind = "compose" | "choice"

export function floatingCardPose(
	isMobile: boolean | null,
	kind: FloatingCardKind = "compose",
): FloatingCardPose {
	if (kind === "choice") return "card"
	return isMobile === false ? "card" : "fullscreen"
}
