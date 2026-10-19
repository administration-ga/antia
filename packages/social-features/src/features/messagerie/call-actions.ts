// Dupliqué de socle/packages/agent-features/src/features/messagerie/call-actions.ts @ ad2e7fdc2 — adaptations : libellés par clés i18n qualifiées (`messagerie:callActions.*`), `t` en dernier paramètre de `callActionsFor` ; l'appel 1:1 du moteur (`calls.direct.callMember`) remplace `callByHandle` dans la doctrine (le handle reste la condition : sans profil publié, personne n'est joignable).
/**
 * call-actions — quels boutons d'APPEL l'en-tête d'une conversation porte.
 *
 * Module pur, testé en environnement `node`. La règle « ce fil peut-il
 * s'appeler, et comment ? » a trois cas dont deux se ratent en silence — elle
 * vit donc ici.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS GENRES DE FIL, TROIS RÉPONSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · BROUILLON — rien. `calls.direct.callMember` sonnerait bien (il adresse
 *    une personne, pas le fil), mais appeler quelqu'un à qui l'on n'a jamais
 *    écrit, depuis un écran de rédaction, n'est pas le geste attendu : le
 *    premier message est ce qui ouvre la conversation.
 *  · 1:1 — audio et vidéo, à condition de connaître le HANDLE : le moteur ne
 *    joint qu'une personne au profil PUBLIÉ (`reachablePerson`). Un fil chargé
 *    dont le correspondant n'a pas (ou plus) de profil publié ne porte pas de
 *    handle, et les boutons disparaissent au lieu d'échouer à l'appui.
 *  · GROUPE — audio ET vidéo, comme le 1:1, plus le libellé « Rejoindre »
 *    quand un appel est déjà en cours dans le fil.
 *
 *    ⚠️ Le groupe n'a longtemps eu qu'UN bouton, sans variante média, au motif
 *    qu'« une réunion se rejoint, la caméra s'y allume ou non ». C'était la
 *    conséquence d'un canal mal choisi : l'appel de groupe partait sur
 *    iRÉUNION. Depuis qu'il est un APPEL (2026-08-22), il se demande comme
 *    tout appel — en audio ou en vidéo, et le média voyage jusqu'au serveur.
 *    Laisser un bouton unique aurait reconduit le défaut corrigé sur le 1:1 :
 *    un « Appel vidéo » qui ouvre un appel audio, sans rien dire.
 *
 * ⚠️ `hasActiveCall` et `groupCallLive` ne disent PAS la même chose, et les
 * confondre casse le geste principal du groupe :
 *
 *   `hasActiveCall`  — JE suis déjà dans un appel. On ne peut pas en ouvrir
 *                      un second : TOUT est désactivé, groupe compris.
 *   `groupCallLive`  — le groupe a un appel en cours, auquel je ne participe
 *                      pas. Le bouton reste ACTIF, et son libellé devient
 *                      « Rejoindre » : c'est très exactement le moment où il
 *                      sert le plus.
 *
 * Un seul import, de type : la fonction de traduction reçue en dernier
 * paramètre (clés QUALIFIÉES, résolues par n'importe quel `t`).
 */

import type { TFunction } from "i18next"

/** Le genre de fil, tel que `parseKey` le rend. */
export type CallConversationKind = "chat" | "groupe" | "draft"

export interface CallAction {
	/** Le bouton existe-t-il sur cet écran ? */
	available: boolean
	/** Existe mais inerte — un appel est déjà en cours. */
	disabled: boolean
	/** Nom accessible ET infobulle : un pictogramme nu n'apprend rien. */
	label: string
}

export interface CallActions {
	audio: CallAction
	video: CallAction
	group: CallAction
}

const ABSENT: CallAction = Object.freeze({
	available: false,
	disabled: true,
	label: "",
})

const AUCUN: CallActions = Object.freeze({
	audio: ABSENT,
	video: ABSENT,
	group: ABSENT,
})

export interface CallActionsContext {
	kind: CallConversationKind
	/** L'adresse du correspondant — sans profil publié, personne à joindre. */
	counterpartHandle?: string | null
	/** JE suis déjà dans un appel : plus rien ne s'ouvre. */
	hasActiveCall: boolean
	/** LE GROUPE a un appel en cours : on le REJOINT (libellé seul). */
	groupCallLive?: boolean
}

export function callActionsFor(context: CallActionsContext, t: TFunction): CallActions {
	if (context.kind === "draft") return AUCUN

	const disabled = context.hasActiveCall === true

	if (context.kind === "groupe") {
		const live = context.groupCallLive === true
		return {
			audio: {
				available: true,
				disabled,
				label: live ? t("messagerie:callActions.joinOngoing") : t("messagerie:callActions.groupAudio"),
			},
			video: {
				available: true,
				disabled,
				label: live
					? t("messagerie:callActions.joinVideo")
					: t("messagerie:callActions.groupVideo"),
			},
			// `group` reste le marqueur « ce fil est un groupe » : il porte le
			// libellé d'ensemble et l'état « appel vivant » que l'en-tête lit
			// pour sa signalétique. Il n'est plus un bouton à lui seul.
			group: {
				available: false,
				disabled,
				label: live
					? t("messagerie:callActions.joinOngoing")
					: t("messagerie:callActions.startGroup"),
			},
		}
	}

	const handle = context.counterpartHandle
	const joignable = typeof handle === "string" && handle.trim().length > 0
	if (!joignable) return AUCUN

	return {
		audio: { available: true, disabled, label: t("messagerie:callActions.audio") },
		video: { available: true, disabled, label: t("messagerie:callActions.video") },
		group: ABSENT,
	}
}
