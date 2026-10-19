// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-appel-selection.ts @ ad2e7fdc2 — adaptations : plafond d'appel CONSTANT du moteur (`GROUP_CALL_MAX_PARTICIPANTS` de `@antsia/social-contracts/callGroup`, onze appelant compris) — la lecture `threadCallCapacity` du socle est retirée, le paramètre `capacity` reste (défaut : le plafond constant) ; comptes exemptés retirés (`exempt` ôté de `needsInviteeSelection` : aucun compte « illimité » dans le moteur) ; phrases traduites (`t` en DERNIER paramètre de `selectionHint` et `selectionBlockReason`, clés qualifiées `messagerie:groupeAppelSelection.…`) ; doc recadrée (plus de lanceur de poste).
/**
 * groupe-appel-selection — CHOISIR QUI APPELER dans un fil de groupe (IC-08).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE FERME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un fil de groupe porte plus de monde qu'un appel : un appel s'arrête à onze,
 * appelant compris (`GROUP_CALL_MAX_PARTICIPANTS`, plafond CONSTANT du
 * moteur). Au-delà, « Appeler le groupe » échouait — le refus arrivait après
 * le geste, sans issue nommée.
 *
 * ⚠️ Le plafond s'annonce AVANT la soumission, jamais après : un écran qui
 * laisse composer ce qu'il refusera ensuite fait perdre le geste deux fois.
 *
 * ⚠️ Le COMPTE et le COMPTEUR ne s'écrivent pas ici : ils viennent de
 * `iappel/group-call-capacity.ts`. Ce module garde ce qui est propre au FIL
 * (la liste qui vieillit, la bascule vers le sélecteur, le refus lisible) et
 * DÉLÈGUE le reste.
 *
 * Tout ce qui décide vit ici, hors composant, pour être vérifiable en `node`.
 * Aucun import React.
 */

import { GROUP_CALL_MIN_OTHERS } from "@antsia/social-contracts/callGroup"
import type { TFunction } from "i18next"
import {
	correspondentsCounter,
	effectiveCapacity,
	maxCorrespondents,
} from "../iappel/group-call-capacity"

export { GROUP_CALL_MIN_OTHERS }

/**
 * Combien de personnes on peut appeler, appelant NON compris.
 *
 * Délègue à `maxCorrespondents` : le `- 1` (l'appelant occupe une place) et le
 * plancher (jamais sous le minimum d'un appel de groupe) y sont tenus UNE fois.
 * Le nom reste, parce que le sélecteur du fil le lit.
 */
export function maxInvitees(capacity?: number | null): number {
	return maxCorrespondents(capacity)
}

/**
 * Ce fil se choisit-il, ou s'appelle-t-il d'un bloc ?
 *
 * La comparaison porte sur le plafond EFFECTIF : celui qu'on passe, sinon le
 * plafond constant du moteur (`effectiveCapacity`). Le moteur ne connaît aucun
 * compte sans plafond : il n'y a pas d'exemption à court-circuiter.
 */
export function needsInviteeSelection(input: {
	memberCount: number | null | undefined
	capacity?: number | null
}): boolean {
	const membres = input.memberCount
	if (typeof membres !== "number") return false
	return membres > effectiveCapacity(input.capacity)
}

/**
 * Cocher / décocher — le plafond est tenu ICI, pas au clic sur « Appeler ».
 *
 * Rend le MÊME ensemble quand le plafond est atteint : l'appelant ne perd
 * jamais sa sélection parce qu'il a cliqué une fois de trop.
 */
export function toggleInvitee(
	current: ReadonlySet<string>,
	userId: string,
	max: number = maxInvitees(),
): ReadonlySet<string> {
	if (current.has(userId)) {
		const next = new Set(current)
		next.delete(userId)
		return next
	}
	if (current.size >= max) return current
	const next = new Set(current)
	next.add(userId)
	return next
}

/**
 * Le décompte lisible — LA phrase du sélecteur :
 * « 3/10 correspondants », puis « 10/10 correspondants — appel complet
 * (11 en tout, vous compris) ».
 */
export function selectionHint(
	count: number,
	capacity: number | null | undefined,
	t: TFunction,
): string {
	return correspondentsCounter(count, capacity, t)
}

/**
 * Ce que la sélection porte et que le fil ne porte PLUS.
 *
 * Le serveur refuse l'appel entier dans ce cas : l'écran doit pouvoir retirer
 * les lignes périmées avant de soumettre, plutôt que d'échouer au clic.
 */
export function invalidInvitees(
	selection: ReadonlySet<string>,
	liveMemberIds: readonly string[],
): string[] {
	const vivants = new Set(liveMemberIds)
	return [...selection].filter((userId) => !vivants.has(userId))
}

/** L'appel est-il composable en l'état ? */
export function canStartGroupCall(input: {
	count: number
	capacity?: number | null
}): boolean {
	return (
		input.count >= GROUP_CALL_MIN_OTHERS &&
		input.count <= maxInvitees(input.capacity)
	)
}

/**
 * Pourquoi le bouton est inerte — une phrase, jamais un bouton muet.
 *
 * `null` quand l'appel est composable : il n'y a alors rien à dire, et une
 * phrase permanente sous un bouton actif se lit comme un avertissement.
 */
export function selectionBlockReason(
	input: {
		count: number
		capacity?: number | null
	},
	t: TFunction,
): string | null {
	if (input.count < GROUP_CALL_MIN_OTHERS) {
		return t("messagerie:groupeAppelSelection.tooFew", {
			min: GROUP_CALL_MIN_OTHERS,
		})
	}
	if (input.count > maxInvitees(input.capacity)) {
		return t("messagerie:groupeAppelSelection.tooMany", {
			max: maxInvitees(input.capacity) + 1,
		})
	}
	return null
}
