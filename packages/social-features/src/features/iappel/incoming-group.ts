// Dupliqué de socle/packages/agent-features/src/features/iappel/incoming-group.ts @ ad2e7fdc2 — adaptations : libellés et énumération accessible traduits par i18n avec leurs pluriels (`t` ajouté en dernier paramètre de `incomingGroupSummary` et `incomingGroupBannerLabel`, clés `iappel:incomingGroup.…`) ; genre `meeting` retiré du vocabulaire (le résumé ne vaut que pour `group`).
/**
 * incoming-group — ce que l'écran d'appel entrant dit d'un appel de GROUPE.
 *
 * Fiche « iCom — appels de groupe de 2 à 11 », point de vue B (ADR-0149) :
 * l'invité doit savoir, AVANT de décrocher, qu'il ne sera pas seul à l'autre
 * bout — et avec qui. D'où une ligne « Appel de groupe · N personnes » et une
 * pile de quatre visages au plus, suivie d'une bulle « +k ».
 *
 * ⚠️ Le décompte est celui du SERVEUR (`group.memberCount`, appelant compris),
 * jamais la longueur de la pile : `listRinging` n'envoie que quatre conviés,
 * appelant et destinataire exclus. Compter les visages dirait « 6 personnes »
 * pour un appel à onze.
 *
 * Module PUR (aucun import React) : le paquet teste en environnement `node`,
 * et la règle se vérifie ici par table plutôt qu'à l'œil dans la carte. Les
 * phrases passent par la fonction de traduction REÇUE (`t`, clés qualifiées
 * `iappel:incomingGroup.…`).
 */

import type { TFunction } from "i18next"

import { isLikelyIdentityHash } from "./call-peer"
import type { CallGroupIdentity, CallGroupInviteePreview, CallKind } from "./call-types"
import { shortGroupLabel } from "./group-stage"

/** Visages montrés au plus — au-delà, la pile ne se lit plus dans 28 px. */
export const INCOMING_PILE_MAX_FACES = 4

export interface IncomingGroupSummary {
	/** « Appel de groupe · N personnes », ou « Appel » à deux. */
	label: string
	/** Nombre de personnes dans l'appel, appelant compris. */
	count: number
	/** Les visages de la pile, noms normalisés (`null` = pas de nom publié). */
	shown: readonly CallGroupInviteePreview[]
	/**
	 * Les conviés NON montrés, MOI COMPRIS — la bulle « +k » de la planche,
	 * suivie de « vous compris ». L'appelant, lui, est nommé au-dessus.
	 */
	rest: number
	/** Ce que la pile dit à un lecteur d'écran : « Avec Marie, Paul et 3 autres ». */
	accessibleLabel: string
}

/** Un nom exploitable, ou `null` — même règle que `peerDisplayName`. */
function publishedName(name: string | null | undefined): string | null {
	const trimmed = name?.trim()
	if (trimmed === undefined || trimmed.length === 0) return null
	return isLikelyIdentityHash(trimmed) ? null : trimmed
}

/**
 * « A », « A et B », « A, B et C » — l'énumération de la langue de l'écran,
 * sans virgule d'Oxford : les premiers séparés par des virgules, le dernier
 * par la conjonction traduite.
 */
function spokenList(parts: readonly string[], t: TFunction): string {
	if (parts.length <= 1) return parts[0] ?? ""
	return t("iappel:incomingGroup.listPair", {
		head: parts.slice(0, -1).join(", "),
		last: parts[parts.length - 1],
	})
}

function accessibleLabelOf(
	shown: readonly CallGroupInviteePreview[],
	rest: number,
	fallback: string,
	t: TFunction,
): string {
	if (shown.length === 0) {
		// Sans aucun visage, « et 3 autres » n'aurait pas d'antécédent.
		if (rest === 0) return fallback
		return t("iappel:incomingGroup.withCorrespondents", { count: rest })
	}
	const parts = shown.map((invitee) => invitee.name ?? t("iappel:incomingGroup.namelessInvitee"))
	if (rest > 0) parts.push(t("iappel:incomingGroup.others", { count: rest }))
	return t("iappel:incomingGroup.withList", { list: spokenList(parts, t) })
}

/**
 * Résumé d'un appel entrant de groupe — `null` pour tout ce qui n'en est pas
 * un (tête-à-tête).
 */
export function incomingGroupSummary(
	input: {
		kind?: CallKind
		group?: CallGroupIdentity | null
	},
	t: TFunction,
): IncomingGroupSummary | null {
	if (input.kind !== "group") return null

	const invitees = input.group?.invitees ?? []
	const shown = invitees.slice(0, INCOMING_PILE_MAX_FACES).map((invitee) => ({
		...invitee,
		name: publishedName(invitee.name),
	}))
	/**
	 * ⚠️ Jamais MOINS de personnes annoncées que de visages montrés (conviés +
	 * appelant + moi) : un décompte rassis à côté d'une pile fraîche se lirait
	 * comme une erreur de calcul, et la pile, elle, est ce que l'œil vérifie.
	 */
	const count = Math.max(input.group?.memberCount ?? 0, invitees.length > 0 ? invitees.length + 2 : 0)

	if (input.group === null || input.group === undefined || count === 0) {
		// Un appel de groupe dont le serveur n'a rien dit : le genre suffit.
		const label = t("iappel:incomingGroup.label.groupOnly")
		return { label, count: 0, shown: [], rest: 0, accessibleLabel: label }
	}

	const label = count <= 2 ? t("iappel:incomingGroup.label.call") : t("iappel:incomingGroup.label.group", { count })
	/**
	 * ⚠️ MOI dans le reste, comme sur la planche du 14/09 (point de vue B :
	 * « +2 vous compris » à sept). `listRinging` ne sert pas le destinataire
	 * parmi les visages — son propre avatar dans sa propre sonnerie ne dirait
	 * rien —, mais le compte, lui, doit dire combien de personnes seront au
	 * bout : tous les conviés sauf l'appelant, déjà nommé au-dessus.
	 */
	// À deux, c'est un « Appel » : ni pile, ni reste.
	const rest = count <= 2 ? 0 : Math.max(0, count - 1 - shown.length)
	return {
		label,
		count,
		shown,
		rest,
		accessibleLabel: accessibleLabelOf(shown, rest, label, t),
	}
}

/**
 * Le sur-titre de la bannière de bureau : « <titre court> · N personnes ».
 *
 * `shortGroupLabel` garde la main sur le TITRE (troncature à 28 caractères,
 * repli « Appel de groupe ») ; on ne lui passe pas le décompte, qu'il rendrait
 * nu (« Appel de groupe · 7 ») — ici le nombre porte son unité.
 */
export function incomingGroupBannerLabel(
	group: CallGroupIdentity | null | undefined,
	t: TFunction,
): string {
	const title = shortGroupLabel({ title: group?.title ?? null, memberCount: null }, t)
	const summary = incomingGroupSummary({ kind: "group", group }, t)
	const count = summary?.count ?? 0
	return count > 2 ? t("iappel:incomingGroup.bannerLabel", { title, count }) : title
}
