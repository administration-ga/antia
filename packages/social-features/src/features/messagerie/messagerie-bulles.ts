// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-bulles.ts @ ad2e7fdc2 — adaptations : dates et heures par la langue courante (paramètre `locale` : `GroupMessagesOptions.locale`, `dayLabel(at, now, locale, t)`, `bubbleTime(at, locale)`) au lieu de « fr-FR » en dur, formateurs mis en cache par langue ; libellés par clés i18n qualifiées (`messagerie:messagerieBulles.*`) — `MESSAGE_DELETED_LABEL`/`MESSAGE_MASKED_LABEL` deviennent `MESSAGE_DELETED_KEY`/`MESSAGE_MASKED_KEY`, `t` en dernier paramètre de `dayLabel`, `groupMessages` et `bubbleText`. ; PA6 : préférence de fuseau injectée, calendrier grégorien et caches langue/fuseau.
/**
 * messagerie-bulles — la mise en SALVES du fil de messages.
 *
 * Module pur, testé en environnement `node` : ce qui reste dans le corps d'un
 * composant n'est vérifiable qu'à l'œil. Ce que la conversation DÉCIDE — où
 * couper un jour, où couper une salve, quelle bulle porte l'heure, quelle
 * bulle porte l'ergot — vit donc ici, jamais dans le `.tsx`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE SALVE, ET NON UNE BULLE PAR MESSAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toute messagerie regroupe : cinq messages envoyés d'affilée forment un bloc,
 * avec un seul avatar, un seul horodatage, et des coins arrondis seulement en
 * haut et en bas. Rendre cinq bulles autonomes double la hauteur du fil et
 * fait clignoter l'attention d'un horodatage à l'autre.
 *
 * Trois choses cassent une salve, dans cet ordre :
 *  · le JOUR change — et un séparateur de date s'intercale ;
 *  · l'EXPÉDITEUR change ;
 *  · plus de `gapMs` s'écoule (défaut 5 min) — deux phrases séparées d'une
 *    heure ne sont pas la même prise de parole.
 *
 * ⚠️ Un message SUPPRIMÉ reste dans le fil. Le retirer décalerait les salves
 * autour de lui (deux blocs se souderaient) et effacerait le fait qu'il y a eu
 * un message — ce qui est précisément l'information que « Message supprimé »
 * existe pour donner. Son corps est remplacé, sa place ne l'est pas.
 *
 * ⚠️ `mine` se calcule de DEUX façons, et l'ordre compte : par le
 * correspondant quand on le connaît (c'est ainsi que le dock l'a toujours
 * fait — un fil 1:1 n'a que deux voix, celle de l'autre suffit à trancher), et
 * seulement à défaut par mon propre identifiant. L'inverse ferait passer tous
 * les messages pour ceux de l'autre le temps que MON identité soit chargée —
 * et l'écran afficherait un fil entièrement à gauche pendant une seconde.
 *
 * ⚠️ Les dates et les heures se disent dans la LANGUE de l'écran (`locale`),
 * au fuseau du lecteur : un « 3 août » figé en français sous une interface
 * anglaise, ou une heure ramenée à un fuseau qui n'est pas celui du lecteur,
 * seraient deux façons d'afficher le faux.
 *
 * Un seul import, de type : la fonction de traduction, reçue en dernier
 * paramètre (clés QUALIFIÉES, résolues par n'importe quel `t`).
 */

import type { TFunction } from "i18next"
import { civilDateParts, formatViewerDate, isPreviousCivilDay, sameCivilDay } from "@antsia/api/civil-date"

/** Deux prises de parole séparées de plus que ça ne sont plus une salve. */
export const BULLE_GAP_MS = 5 * 60 * 1000

/** La clé du corps rendu à la place d'un message retiré par son auteur. */
export const MESSAGE_DELETED_KEY = "messagerie:messagerieBulles.deleted"

/** La clé du corps rendu quand le serveur a retiré le texte (expéditeur bloqué). */
export const MESSAGE_MASKED_KEY = "messagerie:messagerieBulles.masked"

/** Le minimum qu'un message doit porter pour être mis en salves. */
export interface GroupableMessage {
	id: string
	senderId: string
	createdAt: number
	/** Retiré POUR TOUT LE MONDE par son auteur. */
	deleted?: boolean
}

/** Une rangée du fil : un séparateur de date, ou une bulle. */
export type BulleRow<M extends GroupableMessage> =
	| { kind: "date"; id: string; at: number; label: string }
	| {
			kind: "message"
			id: string
			message: M
			/** De moi ? Décide du côté et de la couleur de la bulle. */
			mine: boolean
			/** Première bulle de sa salve — celle qui porte le nom et l'avatar. */
			first: boolean
			/** Dernière bulle de sa salve — celle qui porte l'ergot. */
			last: boolean
			/** Cette bulle affiche-t-elle l'heure ? Une seule par salve. */
			showTime: boolean
	  }

export interface GroupMessagesOptions {
	/** MON identifiant — repli quand le correspondant n'est pas connu. */
	selfId?: string | null
	/** L'identifiant de l'AUTRE — la voie principale sur un fil 1:1. */
	counterpartId?: string | null
	/** L'instant de référence, pour les libellés « Aujourd'hui »/« Hier ». */
	now: number
	/** La langue de l'écran (`i18n.language`), pour nommer les jours. */
	locale: string
	/** La préférence du lecteur ; absente, compatibilité avec le fuseau personnel. */
	timeZone?: string
	/** Le silence au-delà duquel une salve se coupe. */
	gapMs?: number
}

const FORMATS = {
	jour: { weekday: "long", day: "numeric", month: "long" },
	jourAn: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
	heure: { hour: "2-digit", minute: "2-digit" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

/**
 * Le libellé d'un séparateur de date.
 *
 * « Aujourd'hui » et « Hier » plutôt qu'une date : ce sont les deux seuls
 * jours qu'on nomme dans une conversation. Au-delà, le jour de la semaine et
 * la date — et l'année dès qu'elle diffère, sans quoi « lundi 3 février »
 * désignerait deux jours différents dans un fil de deux ans.
 *
 * Un instant non fini rend une chaîne VIDE, jamais « 1 janvier 1970 ».
 */
export function dayLabel(at: number, now: number, locale: string, t: TFunction, timeZone?: string): string {
	if (!Number.isFinite(at)) return ""
	if (sameCivilDay(at, now, timeZone)) return t("messagerie:messagerieBulles.today")
	if (isPreviousCivilDay(at, now, timeZone)) return t("messagerie:messagerieBulles.yesterday")
	const sameYear = civilDateParts(at, timeZone).year === civilDateParts(now, timeZone).year
	return formatViewerDate(at, locale, FORMATS[sameYear ? "jour" : "jourAn"], timeZone)
}

/** De moi ? Le correspondant d'abord, mon identifiant à défaut (cf. en-tête). */
function estDeMoi(
	senderId: string,
	selfId: string | null | undefined,
	counterpartId: string | null | undefined,
): boolean {
	if (counterpartId !== null && counterpartId !== undefined && counterpartId.length > 0) {
		return String(senderId) !== String(counterpartId)
	}
	if (selfId !== null && selfId !== undefined && selfId.length > 0) {
		return String(senderId) === String(selfId)
	}
	// Ni l'un ni l'autre : personne ne peut trancher. Tout à GAUCHE — une bulle
	// attribuée à tort à l'autre se corrige d'un coup d'œil, une bulle attribuée
	// à tort à soi fait croire qu'on a écrit ce qu'on a reçu.
	return false
}

/**
 * Met le fil en rangées : séparateurs de date et bulles annotées.
 *
 * Les messages sont attendus en ordre CHRONOLOGIQUE (le plus ancien d'abord),
 * comme la conversation les remet en ordre après les pages de
 * `messaging.messages.paginateMessages` et `groups.messages.paginateGroupMessages`.
 * Aucun tri n'est refait ici : re-trier masquerait un jour une inversion venue
 * de l'appelant au lieu de la faire voir.
 */
export function groupMessages<M extends GroupableMessage>(
	messages: readonly M[],
	options: GroupMessagesOptions,
	t: TFunction,
): readonly BulleRow<M>[] {
	const gapMs = options.gapMs ?? BULLE_GAP_MS
	const rows: BulleRow<M>[] = []
	if (messages.length === 0) return rows

	// Première passe : où commence une salve ? On a besoin du VOISIN SUIVANT
	// pour dire `last`, d'où deux passes plutôt qu'une accumulation à rebours.
	const debuts: boolean[] = []
	for (let i = 0; i < messages.length; i += 1) {
		const message = messages[i]!
		const precedent = i > 0 ? messages[i - 1]! : null
		if (precedent === null) {
			debuts.push(true)
			continue
		}
		const jourChange = !sameCivilDay(message.createdAt, precedent.createdAt, options.timeZone)
		const auteurChange = String(message.senderId) !== String(precedent.senderId)
		const silence = message.createdAt - precedent.createdAt > gapMs
		debuts.push(jourChange || auteurChange || silence)
	}

	for (let i = 0; i < messages.length; i += 1) {
		const message = messages[i]!
		const precedent = i > 0 ? messages[i - 1]! : null
		const jourChange =
			precedent === null ||
			!sameCivilDay(message.createdAt, precedent.createdAt, options.timeZone)

		if (jourChange) {
			rows.push({
				kind: "date",
				// L'identifiant du message qui OUVRE le jour : deux fils fusionnés
				// dans la même liste React ne peuvent pas collisionner, et une clé
				// bâtie sur l'horodatage collisionnerait pour deux messages simultanés.
				id: `d-${message.id}`,
				at: message.createdAt,
				label: dayLabel(message.createdAt, options.now, options.locale, t, options.timeZone),
			})
		}

		const first = debuts[i] === true
		const last = i === messages.length - 1 || debuts[i + 1] === true

		rows.push({
			kind: "message",
			id: message.id,
			message,
			mine: estDeMoi(message.senderId, options.selfId, options.counterpartId),
			first,
			last,
			// UN SEUL horodatage par salve, sous la dernière bulle — c'est la
			// convention de toutes les messageries, et c'est aussi la bulle la plus
			// proche de la suivante, donc celle dont l'heure renseigne le plus.
			showTime: last,
		})
	}

	return rows
}

/**
 * Le corps à rendre dans une bulle.
 *
 * L'ordre des questions porte la règle : un message retiré par son auteur ne
 * révèle pas son texte même quand le serveur l'a encore envoyé, et un corps
 * masqué (blocage) ne se distingue pas d'un message vide sans son libellé.
 * Un point de décision UNIQUE, partagé par le 1:1 et les groupes — deux
 * copies dériveraient, et l'une des deux finirait par afficher le texte.
 */
export function bubbleText(
	args: {
		deleted?: boolean
		masked?: boolean
		text: string | null | undefined
	},
	t: TFunction,
): string {
	if (args.deleted === true) return t(MESSAGE_DELETED_KEY)
	if (args.masked === true) return t(MESSAGE_MASKED_KEY)
	return args.text ?? ""
}

/** L'heure sous une bulle, dans la langue de l'écran — vide sur un instant non fini. */
export function bubbleTime(at: number, locale: string, timeZone?: string): string {
	if (!Number.isFinite(at)) return ""
	return formatViewerDate(at, locale, FORMATS.heure, timeZone)
}
