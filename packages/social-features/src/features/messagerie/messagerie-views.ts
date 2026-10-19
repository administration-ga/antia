// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-views.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
/**
 * messagerie-views — le contrat PARTAGÉ entre le dock du bureau et les pages
 * du téléphone.
 *
 * Les trois vues (liste, conversation, composeur) sont les MÊMES des deux
 * côtés. Deux choses seulement changent, et ce sont exactement les deux champs
 * de ce fichier :
 *
 *  · `variant` — comment la vue se pose. `dock` vit dans une carte de 312 px
 *    à hauteur fixe, avec un en-tête repliable ; `page` occupe l'écran, sans
 *    repli (il n'y a rien à replier : la page EST la conversation).
 *  · `nav` — ce qu'« ouvrir une conversation » veut dire. Dans le dock, c'est
 *    une transition d'état (`dockStore`) ; sur la page, une NAVIGATION
 *    (le routeur). Injecter le geste plutôt que de tester `variant` dans dix
 *    endroits est ce qui garde une seule liste et un seul composeur.
 *
 * ⚠️ Ne PAS remplacer `nav` par des tests sur `variant`. Le jour où une
 * troisième surface arrive (une fenêtre détachée, un panneau d'iTravail), un
 * `variant` de plus oblige à rouvrir chaque branche ; une implémentation de
 * `MessagerieNav` de plus ne touche à rien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA TROISIÈME POSE (2026-08-23) : `window`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La fenêtre iCom de l'espace de POSTE (`features/icom-poste`) rend ces mêmes
 * vues dans une fenêtre flottante « format téléphone ». Géométriquement, c'est
 * la carte du rail (avatars de 32 px, icônes de 17 px, marges serrées) ; mais
 * elle ne se REPLIE pas — une fenêtre à hauteur fixe n'a rien à replier, c'est
 * la croix de sa barre qui la range — et elle ne se « détache » pas davantage :
 * elle est déjà détachée.
 *
 * Deux questions, deux helpers, et les vues n'écrivent plus `=== "dock"` là où
 * elles voulaient dire « compact » : la quatrième pose, si elle vient, se
 * déclare ici et nulle part ailleurs. ⚠️ Ce qui est PROPRE à la page (notes
 * vocales, navigation par le routeur, cibles de 44 px) reste écrit
 * `=== "page"` : ce n'est pas une question de compacité.
 *
 * Types purs, plus deux fonctions sans import : aucune valeur de React.
 */

import type { ConversationKey } from "./messagerie-dock"

/** Où la vue se pose. */
export type MessagerieVariant = "dock" | "page" | "window"

/**
 * La vue se pose-t-elle dans une géométrie COMPACTE (carte du rail, fenêtre
 * flottante) ? Faux pour la page, qui occupe l'écran.
 */
export function isCompactPose(variant: MessagerieVariant): boolean {
	return variant !== "page"
}

/**
 * La pose se replie-t-elle ? Seule la carte du rail : la page n'a rien à
 * replier, la fenêtre a une hauteur fixe et se range par sa croix.
 */
export function isRepliablePose(variant: MessagerieVariant): boolean {
	return variant === "dock"
}

/** Les quatre gestes de navigation de la messagerie. */
export interface MessagerieNav {
	/** Ouvrir une conversation (fil, groupe ou brouillon). */
	openConversation: (key: ConversationKey) => void
	/** Le choix d'un destinataire. */
	openCompose: () => void
	/** La composition d'un groupe. */
	openComposeGroupe: () => void
	/** Revenir en arrière — la liste dans le dock, l'historique sur la page. */
	back: () => void
}
