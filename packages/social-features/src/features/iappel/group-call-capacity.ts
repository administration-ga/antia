// Dupliqué de socle/packages/agent-features/src/features/iappel/group-call-capacity.ts @ ad2e7fdc2 — adaptations : plafonds lus dans les contrats du moteur (`@antsia/social-contracts/groupCapacity`, `@antsia/social-contracts/callGroup`) ; plafond CONSTANT (`threadCallCapacity`, `myCallCapacity` et le lanceur de poste retirés — aucun compte « illimité » dans le moteur, donc plus de compteur sans dénominateur) ; compteur traduit par i18n (`t` ajouté en dernier paramètre de `correspondentsCounter`, clés `iappel:groupCallCapacity.…`).
/**
 * group-call-capacity — COMBIEN de correspondants, et comment on le DIT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN SEUL COMPTEUR POUR TOUT LE RÉSEAU (ADR-0149, 2026-09-14)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le sélecteur d'un fil (`GroupCallInviteePicker`) et le panneau d'ajout
 * composent un appel de groupe sous le MÊME plafond. Deux compositions pour un
 * même geste se lisent comme deux règles différentes.
 *
 * D'où ce module, et une seule phrase : « x/10 correspondants », puis
 * « 10/10 correspondants — appel complet (11 en tout, vous compris) ». Le
 * chiffre est le plafond de l'APPEL (onze dans le moteur, constant ; un appel
 * déjà posé porte le sien), jamais deviné par l'écran.
 *
 * Module PUR : aucun React, testé en `node`.
 */

import { GROUP_CALL_MIN_OTHERS } from "@antsia/social-contracts/callGroup"
import { GROUP_CALL_DEFAULT_MAX_PARTICIPANTS } from "@antsia/social-contracts/groupCapacity"
import type { TFunction } from "i18next"

/**
 * Le plafond EFFECTIF, appelant compris — la valeur servie par le serveur, ou
 * le défaut tant qu'elle n'est pas arrivée. Mieux vaut un plafond par défaut
 * qu'une composition que le serveur refusera.
 */
export function effectiveCapacity(capacity?: number | null): number {
	return typeof capacity === "number" && capacity > 0
		? Math.floor(capacity)
		: GROUP_CALL_DEFAULT_MAX_PARTICIPANTS
}

/**
 * Combien de CORRESPONDANTS on peut cocher, appelant NON compris.
 *
 * Le `- 1` n'est pas cosmétique : l'appelant occupe une place, et l'oublier
 * fait composer une liste que le serveur refuse au dernier clic. Jamais sous
 * le minimum d'un appel de groupe : un plafond absurde ne doit pas rendre
 * l'écran inutilisable.
 */
export function maxCorrespondents(capacity?: number | null): number {
	return Math.max(GROUP_CALL_MIN_OTHERS, effectiveCapacity(capacity) - 1)
}

/** Le sélecteur est-il COMPLET — plus une case à cocher ? */
export function isSelectionComplete(
	picked: number,
	capacity?: number | null,
): boolean {
	return picked >= maxCorrespondents(capacity)
}

/**
 * Le compteur du sélecteur.
 *
 *  · « 3/10 correspondants » tant qu'il reste de la place ;
 *  · « 10/10 correspondants — appel complet (11 en tout, vous compris) »
 *    au plafond : l'appelant lit d'un coup ce qu'il a composé ET pourquoi la
 *    onzième case s'est éteinte.
 *
 * Le chiffre affiché ne dépasse jamais le plafond : une sélection périmée
 * (plafond abaissé entre-temps) se lit « complet », pas « 12/10 ».
 */
export function correspondentsCounter(
	picked: number,
	capacity: number | null | undefined,
	t: TFunction,
): string {
	const max = maxCorrespondents(capacity)
	const shown = Math.max(0, Math.min(picked, max))
	if (shown >= max) {
		return t("iappel:groupCallCapacity.full", { max, total: max + 1 })
	}
	return t("iappel:groupCallCapacity.counter", { shown, max })
}
