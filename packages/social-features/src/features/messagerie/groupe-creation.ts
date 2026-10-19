// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-creation.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
/**
 * groupe-creation — ce qui doit se passer APRÈS qu'un groupe est né.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Lorsqu'on crée un groupe dans iCom, on n'arrive pas à revenir. »
 *
 * Le composeur de groupe était la SEULE vue du module à ne pas implémenter le
 * contrat `MessagerieNav` : il câblait `dockStore` en dur. Dans le dock, ça
 * marchait. Sur les deux poses « page » — le téléphone et le volet droit du
 * bureau — aucun des trois gestes ne faisait rien de visible, parce que
 * l'écran y est décidé par l'URL et non par le magasin :
 *
 *  · la flèche retour mutait un état que personne n'écoutait ;
 *  · après création, on RESTAIT sur le composeur, le groupe créé invisible ;
 *  · le chevron d'en-tête repliait le dock du BUREAU depuis le téléphone —
 *    une action inerte localement, à effet distant.
 *
 * Et la route du composeur est immersive : la barre iCom n'y est pas montée.
 * Le seul contrôle de sortie affiché était donc précisément celui qui ne
 * marchait pas.
 *
 * Ce module ne porte que la DÉCISION, pour qu'elle soit testable sans monter
 * le composant. Un seul import, celui des clés de conversation.
 */

import { groupeKey, type ConversationKey } from "./messagerie-dock"

/** Ce que le serveur rend quand un groupe est créé — ou retrouvé. */
export interface ResultatDeCreation {
	threadId: string
	/** Faux quand la clé d'idempotence a retrouvé un groupe déjà créé. */
	created: boolean
}

export interface SuiteDeCreation {
	/** La conversation à ouvrir. */
	cle: ConversationKey
}

/**
 * Où mène la création d'un groupe.
 *
 * ⚠️ `created: false` mène AU MÊME ENDROIT que `created: true`. Un rejeu — la
 * clé d'idempotence a retrouvé le groupe — doit atterrir sur le groupe, pas
 * laisser l'usager sur un composeur qui semble n'avoir rien fait.
 *
 * `null` quand le serveur ne rend pas d'identifiant exploitable : mieux vaut
 * revenir à la liste que fabriquer une adresse `groupe:` vide, qui donnerait
 * une route à trois segments — ni conversation, ni écran immersif, un
 * cul-de-sac.
 */
export function suiteDeCreation(resultat: ResultatDeCreation): SuiteDeCreation | null {
	const id = resultat.threadId.trim()
	if (id.length === 0) return null
	return { cle: groupeKey(id) }
}
