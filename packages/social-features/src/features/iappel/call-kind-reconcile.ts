// Dupliqué de socle/packages/agent-features/src/features/iappel/call-kind-reconcile.ts @ ad2e7fdc2 — adaptations : instantané lu sur l'ÉTAT de l'appel du moteur (`calls.lifecycle.getCall` : `kind` en `callKind`, `title` du fil, `participantCount` au lieu du tableau `participants` du document `meetings`) ; titre par défaut d'un groupe traduit par i18n (`t` ajouté en dernier paramètre de `planSlotReconciliation`, clé `iappel:callKindReconcile.defaultGroupTitle`).
/**
 * call-kind-reconcile — LE GENRE D'UN APPEL SE LIT SUR L'APPEL, PAS SUR LA
 * PHOTOGRAPHIE DU SLOT (IC-02, Lot 01 du plan espace agent, 2026-09-06).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `slot.callKind` est décidé à la CRÉATION du slot : `listRinging.kind` pour
 * l'appelé, `"group"` pour un appel de groupe lancé, rien (donc `direct`) pour
 * l'appel sortant. Quand A ajoute C à son tête-à-tête avec B, le serveur
 * promeut l'appel (`kind: "group"`) — mais aucun slot ne l'apprend : toute la
 * surface (grille, nom, places, rappel, skip de `listParticipants`) branche
 * sur la photographie, et A comme B restent en vue 1:1 pendant que C entre
 * dans une salle de groupe.
 *
 * L'hôte souscrit pourtant DÉJÀ à l'état canonique de l'appel
 * (`calls.lifecycle.getCall`). Ce module dit quoi en reprendre, et quand ne
 * RIEN faire — un instantané arrive à chaque changement de l'appel, et
 * réécrire le slot à chaque fois relancerait le rendu de la surface entière.
 *
 * Module PUR : aucun React, aucun store, testé en `node`.
 */

import type { TFunction } from "i18next"

import type { CallSlot } from "../../stores/call-store"
import type { CallGroupIdentity, CallKind } from "./call-types"

/**
 * Le sous-ensemble de l'état de l'appel (`getCall`) que la réconciliation
 * lit. Le nom du type est celui du socle (le document `meetings`).
 */
export interface MeetingKindSnapshot {
	/** Le `kind` de `getCall` : `direct` ou `group`. */
	callKind?: string | null
	/** Le titre du fil d'origine d'un appel de groupe ; `null` sans fil. */
	title?: string | null
	/** Les lignes de l'appel, hôte compris (`getCall.participantCount`). */
	participantCount?: number | null
}

/**
 * Le genre EFFECTIF de l'appel de tête.
 *
 *  · l'appel dit « group » ⇒ group, quoi que le slot ait photographié ;
 *  · un slot « group » ne rétrograde JAMAIS (un appel en cours de
 *    chargement, ou une valeur inconnue, ne défait pas une grille) ;
 *  · sinon, la photographie du slot — et `direct` à défaut.
 */
export function deriveEffectiveCallKind(input: {
	slotCallKind: CallKind | undefined
	meetingCallKind: string | null | undefined
}): CallKind {
	if (input.meetingCallKind === "group") return "group"
	if (input.slotCallKind === "group") return "group"
	return input.slotCallKind ?? "direct"
}

/**
 * Ce que le slot doit REPRENDRE de l'appel — ou `null` s'il n'y a rien à
 * reprendre. `null` est la réponse la plus fréquente, et c'est voulu : elle
 * est ce qui évite la tempête d'émissions.
 *
 * L'effectif suit celui de `listRinging` (les lignes de l'appel, hôte
 * compris) : c'est l'identité de groupe que l'appelé reçoit à la sonnerie, et
 * la surface ne doit pas en avoir deux. Sans titre de fil, le slot garde le
 * titre qu'il connaît déjà, sinon le titre par défaut traduit (le même que la
 * scène d'appel).
 */
export function planSlotReconciliation(
	slot: Pick<CallSlot, "callKind" | "group">,
	meeting: MeetingKindSnapshot | null | undefined,
	t: TFunction,
): { callKind: "group"; group: CallGroupIdentity } | null {
	if (!meeting || meeting.callKind !== "group") return null

	const title =
		meeting.title !== undefined && meeting.title !== null && meeting.title.trim().length > 0
			? meeting.title
			: (slot.group?.title ?? t("iappel:callKindReconcile.defaultGroupTitle"))
	const memberCount = meeting.participantCount ?? slot.group?.memberCount ?? 0

	const unchanged =
		slot.callKind === "group" &&
		slot.group?.title === title &&
		slot.group?.memberCount === memberCount
	if (unchanged) return null

	return { callKind: "group", group: { title, memberCount } }
}
