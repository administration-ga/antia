// Dupliqué de socle/packages/agent-features/src/features/direct/direct-call-coexistence.ts @ ad2e7fdc2 — adaptations : domaine pur et tests portés ; aucune dépendance inter-produit.
/**
 * direct-call-coexistence — UN APPEL PENDANT UN DIRECT : deux appareils, pas
 * un seul.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA DOCTRINE (propriétaire, 2026-09-14)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Le live ne peut pas impacter un appel téléphonique. S'il y a un appel, je
 * coupe juste le micro du live et je peux parler avec la personne qui
 * m'appelle. » Le direct et l'appel sont deux SALLES LiveKit distinctes
 * (`DirectRoomMount` d'un côté, `CallRoomPool` de l'autre) ; rien ne les
 * relie, et c'est ce qui permet de les tenir toutes les deux. Ce module dit
 * ce que le direct fait de lui-même quand un appel prend la ligne :
 *
 *  · son MICRO se coupe — ce qu'on dit au téléphone ne part pas à l'antenne ;
 *  · son SON se baisse (jamais coupé : on garde un œil et une oreille sur la
 *    conférence, c'est tout l'intérêt de ne pas la quitter) ;
 *  · et quand l'appel se termine, le micro REVIENT tel qu'il était — mais
 *    seulement s'il était allumé avant, et seulement si la personne ne l'a
 *    pas rallumé elle-même entre-temps (un choix explicite pendant l'appel
 *    n'est pas défait).
 *
 * Un appel EN ATTENTE n'occupe pas la ligne : la personne ne parle à
 * personne, le micro du direct peut vivre. Seuls `connecting` et `active`
 * comptent — c'est la même définition que `isLiveSlot` côté sonnerie,
 * restreinte à ce qui fait parler.
 *
 * Module PUR : aucun import React, LiveKit ou Convex — la décision se lit et
 * se couvre entièrement, le composant (`DirectCallCoexistence`) applique.
 */

/** Ce que le direct a retenu de lui-même quand l'appel a pris la ligne. */
export interface LiveCallHold {
	/** Le micro du direct était-il allumé AVANT l'appel ? */
	micWasEnabled: boolean
}

/**
 * Le volume du son du direct pendant un appel. Assez bas pour laisser la
 * voix de l'appelant passer, assez haut pour qu'on entende encore que la
 * conférence continue — le modèle est le téléphone qui baisse la musique.
 */
export const DIRECT_CALL_DUCK_VOLUME = 0.15

/** Un slot d'appel, vu d'ici : on ne lit que ce qui décide. */
export interface CoexistenceSlotView {
	status: "incoming" | "connecting" | "active" | "held" | "ended"
	kind?: "direct" | "queue"
}

/**
 * La ligne est-elle OCCUPÉE — quelqu'un parle, ou est sur le point de parler ?
 * Un appel parqué (`held`) ne compte pas ; un appel de la file du centre
 * d'appels compte comme un autre — c'est une voix au téléphone.
 */
export function isCallBusy(slots: readonly CoexistenceSlotView[]): boolean {
	return slots.some(
		(slot) => slot.status === "connecting" || slot.status === "active",
	)
}

export interface LiveDuringCallInput {
	callBusy: boolean
	/** Le micro que le direct VEUT publier en ce moment (intention). */
	micEnabled: boolean
	/** Ce qui a été retenu à la prise de ligne — `null` hors appel. */
	hold: LiveCallHold | null
}

export interface LiveDuringCallPlan {
	/** Le correctif d'intention à appliquer — `null` si rien ne bouge. */
	intent: { micEnabled: boolean } | null
	/** Ce que le magasin doit retenir ensuite. */
	hold: LiveCallHold | null
}

/**
 * LA décision, à chaque changement d'état de la ligne ou du micro.
 *
 *  · la ligne se prend (`callBusy`, aucune retenue) → on retient l'état du
 *    micro et on le coupe s'il était allumé ;
 *  · la ligne reste prise → RIEN : rallumer son micro pendant l'appel est un
 *    choix, on ne le défait pas ;
 *  · la ligne se libère → on rend le micro s'il était allumé avant ET qu'il
 *    est encore coupé ; la retenue s'efface dans tous les cas.
 */
export function planLiveDuringCall(input: LiveDuringCallInput): LiveDuringCallPlan {
	if (input.callBusy) {
		if (input.hold !== null) return { intent: null, hold: input.hold }
		return {
			intent: input.micEnabled ? { micEnabled: false } : null,
			hold: { micWasEnabled: input.micEnabled },
		}
	}
	if (input.hold === null) return { intent: null, hold: null }
	return {
		intent:
			input.hold.micWasEnabled && !input.micEnabled
				? { micEnabled: true }
				: null,
		hold: null,
	}
}

/** Le volume du rendu audio du direct — baissé tant qu'on est au téléphone. */
export function directAudioVolume(callBusy: boolean): number {
	return callBusy ? DIRECT_CALL_DUCK_VOLUME : 1
}

/**
 * Ce que l'écran DIT pendant l'appel — une seule phrase, la même dans la
 * page et dans la carte flottante. `null` hors appel.
 */
export function liveDuringCallNotice(input: {
	callBusy: boolean
	/** Un intervenant publie ; un spectateur n'a pas de micro à couper. */
	publishes: boolean
}): string | null {
	if (!input.callBusy) return null
	return input.publishes
		? "Appel en cours — votre micro du direct est coupé et le son du direct est baissé."
		: "Appel en cours — le son du direct est baissé."
}
