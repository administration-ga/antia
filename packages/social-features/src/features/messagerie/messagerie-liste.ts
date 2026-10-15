// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-liste.ts @ ad2e7fdc2 — adaptations : branche « poste » élaguée (recherche par fonction, `poste.positionTitle`) ; nom du correspondant NULLABLE (contrat `counterpartLabel` du moteur) ; dates dans la langue courante (`locale` en paramètre, formats mis en cache par langue) et « hier » rendu par `Intl.RelativeTimeFormat` ; aperçu et état vide traduits (`t` en dernier paramètre, clés qualifiées) ; `apercuFil` ajouté — le moteur ne dénormalise que le texte et la NATURE du dernier message (`lastMessageKind`, `lastMessageAttachmentCount`, `lastMessageDeleted`), la phrase d'un vocal, de pièces, d'un appel ou d'un retrait se compose ici ; l'état vide ne dépend plus d'une source sans groupes (une seule source, personnelle).
/**
 * messagerie-liste — ce que la LISTE des conversations décide.
 *
 * Filtrer et dater sont deux décisions, pas deux détails de rendu : ce qui
 * reste dans le corps d'un composant n'est vérifiable qu'à l'œil. Même patron
 * que `messagerie-dock.ts`.
 *
 * Un seul import, un type : ce module ne connaît que des données.
 */

import type { TFunction } from "i18next"

/** Le minimum qu'une ligne de conversation doit porter pour être filtrée. */
export interface FiltrableThread {
	/** `displayName` nul : le correspondant n'a rien à nommer (libellé neutre à l'écran). */
	counterpart: { displayName: string | null; handle?: string | null }
}

/**
 * Repli de comparaison : sans accents, sans casse, sans espaces de bord.
 *
 * Chercher « mengue » doit trouver « MENGUE MÉ NZOGHE ». On écrit les noms
 * avec des accents et on les cherche sans — c'est le cas NORMAL, pas le cas
 * limite.
 */
export function normaliseRecherche(valeur: string): string {
	return valeur
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim()
}

/**
 * Filtre les conversations sur le nom OU l'identifiant.
 *
 * Une requête vide rend la liste ENTIÈRE — et la même référence, pour que le
 * rendu ne se relance pas quand on efface le champ.
 */
export function filtrerThreads<T extends FiltrableThread>(
	threads: readonly T[],
	requete: string,
): readonly T[] {
	const terme = normaliseRecherche(requete)
	if (terme.length === 0) return threads
	return threads.filter((thread) => {
		const nom = normaliseRecherche(thread.counterpart.displayName ?? "")
		const handle = normaliseRecherche(thread.counterpart.handle ?? "")
		return nom.includes(terme) || handle.includes(terme)
	})
}

/** Deux instants tombent-ils le même jour civil ? */
function memeJour(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	)
}

/** Les formats d'une langue — construits une fois, puis réutilisés. */
interface FormatsDeLangue {
	heure: Intl.DateTimeFormat
	jourMois: Intl.DateTimeFormat
	jourMoisAn: Intl.DateTimeFormat
	relatif: Intl.RelativeTimeFormat
}

const FORMATS = new Map<string, FormatsDeLangue>()

function formatsPour(locale: string): FormatsDeLangue {
	const connus = FORMATS.get(locale)
	if (connus !== undefined) return connus
	const formats: FormatsDeLangue = {
		heure: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
		jourMois: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }),
		jourMoisAn: new Intl.DateTimeFormat(locale, {
			day: "numeric",
			month: "short",
			year: "numeric",
		}),
		// `numeric: "auto"` : « hier » / « yesterday », et non « il y a 1 jour ».
		relatif: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
	}
	FORMATS.set(locale, formats)
	return formats
}

/**
 * L'horodatage d'une ligne, au modèle des messageries : l'heure aujourd'hui,
 * « hier » hier, le jour et le mois dans l'année, l'année au-delà.
 *
 * La précision DÉCROÎT avec l'ancienneté, et c'est le but : à midi on veut
 * savoir s'il a écrit il y a dix minutes ; trois mois plus tard, la minute
 * exacte n'apprend plus rien et vole la place du nom.
 *
 * `locale` : la langue de l'écran (`i18n.language`), jamais une langue écrite
 * en dur. Le fuseau est celui du navigateur.
 *
 * `null` — un fil sans message — rend une chaîne VIDE, jamais « 1 janv. 1970 ».
 */
export function formatThreadTime(
	at: number | null,
	now: number,
	locale: string,
): string {
	if (at === null || !Number.isFinite(at)) return ""
	const quand = new Date(at)
	const maintenant = new Date(now)
	const formats = formatsPour(locale)

	if (memeJour(quand, maintenant)) return formats.heure.format(quand)

	const hier = new Date(maintenant)
	hier.setDate(hier.getDate() - 1)
	if (memeJour(quand, hier)) return formats.relatif.format(-1, "day")

	return quand.getFullYear() === maintenant.getFullYear()
		? formats.jourMois.format(quand)
		: formats.jourMoisAn.format(quand)
}

/**
 * L'aperçu d'une ligne : « Vous : » quand le dernier mot est de nous.
 *
 * Un fil sans message rend une invite plutôt qu'un vide — un fil existe parce
 * que quelqu'un a écrit, sauf justement dans le cas d'un brouillon.
 *
 * ⚠️ Le texte est un contenu d'utilisateur : il est interpolé SANS
 * échappement HTML (React échappe déjà au rendu ; échapper deux fois
 * afficherait `&amp;` à la place de `&`).
 */
export function apercuThread(
	texte: string | null,
	deMoi: boolean,
	t: TFunction,
): string {
	if (texte === null || texte.trim().length === 0) {
		return t("messagerie:messagerieListe.noMessageYet")
	}
	return deMoi
		? t("messagerie:messagerieListe.fromMe", {
				text: texte,
				interpolation: { escapeValue: false },
			})
		: texte
}

/** Ce qu'une ligne de la liste sait de son DERNIER message (DTO du moteur). */
export interface ApercuDuFil {
	/** Le texte de l'aperçu — `null` pour un vocal, des pièces seules ou un aperçu retiré. */
	lastMessageText: string | null
	lastMessageByMe: boolean
	/** `text`, `voice`, `attachments`, `call`, `system` — ou rien (fil vide). */
	lastMessageKind?: string | null
	lastMessageAttachmentCount?: number | null
	/** La dernière LIGNE a été retirée pour tous. */
	lastMessageDeleted?: boolean
}

/**
 * L'aperçu COMPLET d'une ligne, depuis ce que le moteur dit du dernier message.
 *
 * Le socle écrivait une phrase d'aperçu même pour un vocal ou une pièce
 * (« 📎 fichier ») ; le moteur, lui, ne dénormalise que le TEXTE et la NATURE
 * de la ligne (`lastMessageKind`, `lastMessageAttachmentCount`). La phrase se
 * compose donc ici, traduite : sans cela, un vocal s'afficherait « Aucun
 * message pour l'instant ».
 */
export function apercuFil(fil: ApercuDuFil, t: TFunction): string {
	const texte = fil.lastMessageText
	if (texte !== null && texte.trim().length > 0) {
		return apercuThread(texte, fil.lastMessageByMe, t)
	}
	if (fil.lastMessageDeleted === true) {
		return t("messagerie:messagerieListe.deleted")
	}
	const nature =
		fil.lastMessageKind === "voice"
			? t("messagerie:messagerieListe.voiceNote")
			: fil.lastMessageKind === "attachments"
				? t("messagerie:messagerieListe.attachments", {
						count: fil.lastMessageAttachmentCount ?? 1,
					})
				: fil.lastMessageKind === "call"
					? t("messagerie:messagerieListe.call")
					: null
	if (nature === null) return apercuThread(null, fil.lastMessageByMe, t)
	return apercuThread(nature, fil.lastMessageByMe, t)
}

/**
 * Le texte de la liste VIDE : il dit les deux gestes qui la remplissent —
 * écrire à une relation, ou réunir plusieurs connexions en groupe.
 */
export function messageListeVide(t: TFunction): string {
	return t("messagerie:messagerieListe.empty")
}
