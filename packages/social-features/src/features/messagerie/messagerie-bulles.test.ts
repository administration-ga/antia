// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-bulles.test.ts @ ad2e7fdc2 — adaptations : le module reçoit la langue (`locale`) et la traduction (`t`) — les cas l'appellent comme l'écran français (langue « fr », traduction française du moteur) et attendent le texte exact du socle (`MESSAGE_DELETED_LABEL`/`MESSAGE_MASKED_LABEL` deviennent les textes traduits des clés) ; un cas ajouté : jours, libellés et heures suivent la langue (anglais).
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
	BULLE_GAP_MS,
	bubbleText as bubbleTextT,
	bubbleTime as bubbleTimeT,
	dayLabel as dayLabelT,
	groupMessages as groupMessagesT,
	MESSAGE_DELETED_KEY,
	MESSAGE_MASKED_KEY,
	type BulleRow,
	type GroupableMessage,
	type GroupMessagesOptions,
} from "./messagerie-bulles"

const fr = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")
const en = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("en")

/** Le module tel que l'écran français l'appelle. */
function groupMessages<M extends GroupableMessage>(
	messages: readonly M[],
	options: Omit<GroupMessagesOptions, "locale">,
): readonly BulleRow<M>[] {
	return groupMessagesT(messages, { ...options, locale: "fr" }, fr)
}
function dayLabel(at: number, now: number): string {
	return dayLabelT(at, now, "fr", fr)
}
function bubbleText(args: Parameters<typeof bubbleTextT>[0]): string {
	return bubbleTextT(args, fr)
}
function bubbleTime(at: number): string {
	return bubbleTimeT(at, "fr")
}
const MESSAGE_DELETED_LABEL = fr(MESSAGE_DELETED_KEY)
const MESSAGE_MASKED_LABEL = fr(MESSAGE_MASKED_KEY)

/** 2026-08-18 à 10 h 00, heure locale — l'instant de référence des tests. */
const NOW = new Date(2026, 7, 18, 10, 0, 0).getTime()
const MINUTE = 60_000
const JOUR = 24 * 60 * MINUTE

function msg(
	id: string,
	senderId: string,
	createdAt: number,
	deleted?: boolean,
): GroupableMessage {
	return deleted === undefined
		? { id, senderId, createdAt }
		: { id, senderId, createdAt, deleted }
}

function bulles<M extends GroupableMessage>(
	rows: readonly BulleRow<M>[],
): Extract<BulleRow<M>, { kind: "message" }>[] {
	return rows.filter(
		(row): row is Extract<BulleRow<M>, { kind: "message" }> =>
			row.kind === "message",
	)
}

describe("dayLabel", () => {
	it("nomme le jour courant « Aujourd'hui »", () => {
		expect(dayLabel(NOW - 3 * 60 * MINUTE, NOW)).toBe("Aujourd'hui")
	})

	it("nomme la veille « Hier »", () => {
		expect(dayLabel(NOW - JOUR, NOW)).toBe("Hier")
	})

	it("donne le jour de la semaine et la date dans l'année courante", () => {
		const label = dayLabel(new Date(2026, 7, 3, 9, 0).getTime(), NOW)
		expect(label).toContain("3")
		expect(label).toContain("août")
		expect(label).not.toContain("2026")
	})

	it("ajoute l'ANNÉE dès qu'elle diffère", () => {
		const label = dayLabel(new Date(2025, 1, 3, 9, 0).getTime(), NOW)
		expect(label).toContain("2025")
	})

	it("rend une chaîne vide sur un instant non fini, jamais 1970", () => {
		expect(dayLabel(Number.NaN, NOW)).toBe("")
		expect(dayLabel(Number.POSITIVE_INFINITY, NOW)).toBe("")
	})
})

describe("groupMessages — séparateurs de date", () => {
	it("ouvre TOUJOURS le fil par un séparateur", () => {
		const rows = groupMessages([msg("m1", "moi", NOW)], {
			selfId: "moi",
			now: NOW,
		})
		expect(rows[0]?.kind).toBe("date")
		expect(rows).toHaveLength(2)
	})

	it("intercale un séparateur au CHANGEMENT de jour", () => {
		const rows = groupMessages(
			[msg("m1", "a", NOW - JOUR), msg("m2", "a", NOW)],
			{ selfId: "a", now: NOW },
		)
		const dates = rows.filter((row) => row.kind === "date")
		expect(dates).toHaveLength(2)
		expect(dates[0]).toMatchObject({ label: "Hier" })
		expect(dates[1]).toMatchObject({ label: "Aujourd'hui" })
	})

	it("n'en intercale AUCUN entre deux messages du même jour", () => {
		const rows = groupMessages(
			[msg("m1", "a", NOW - 2 * MINUTE), msg("m2", "a", NOW)],
			{ selfId: "a", now: NOW },
		)
		expect(rows.filter((row) => row.kind === "date")).toHaveLength(1)
	})

	it("un changement de jour COUPE la salve, même sans changer d'auteur", () => {
		const rows = groupMessages(
			[msg("m1", "a", NOW - JOUR), msg("m2", "a", NOW)],
			{ selfId: "a", now: NOW },
		)
		const messages = bulles(rows)
		expect(messages[1]?.first).toBe(true)
		expect(messages[0]?.last).toBe(true)
	})

	it("donne au séparateur une clé dérivée du message qui ouvre le jour", () => {
		const rows = groupMessages([msg("m1", "a", NOW)], { selfId: "a", now: NOW })
		expect(rows[0]?.id).toBe("d-m1")
	})

	it("rend une liste vide sur un fil vide", () => {
		expect(groupMessages([], { selfId: "a", now: NOW })).toHaveLength(0)
	})
})

describe("groupMessages — regroupement en salves", () => {
	it("regroupe deux messages du même auteur sous 5 min", () => {
		const rows = bulles(
			groupMessages([msg("m1", "a", NOW - MINUTE), msg("m2", "a", NOW)], {
				selfId: "a",
				now: NOW,
			}),
		)
		expect(rows[0]).toMatchObject({ first: true, last: false })
		expect(rows[1]).toMatchObject({ first: false, last: true })
	})

	it("coupe la salve au-delà du silence de 5 min", () => {
		const rows = bulles(
			groupMessages(
				[msg("m1", "a", NOW - BULLE_GAP_MS - 1), msg("m2", "a", NOW)],
				{ selfId: "a", now: NOW },
			),
		)
		expect(rows[0]?.last).toBe(true)
		expect(rows[1]?.first).toBe(true)
	})

	it("ne coupe PAS exactement au seuil — le silence doit le dépasser", () => {
		const rows = bulles(
			groupMessages([msg("m1", "a", NOW - BULLE_GAP_MS), msg("m2", "a", NOW)], {
				selfId: "a",
				now: NOW,
			}),
		)
		expect(rows[1]?.first).toBe(false)
	})

	it("respecte un `gapMs` sur mesure", () => {
		const rows = bulles(
			groupMessages([msg("m1", "a", NOW - 10_000), msg("m2", "a", NOW)], {
				selfId: "a",
				now: NOW,
				gapMs: 5_000,
			}),
		)
		expect(rows[1]?.first).toBe(true)
	})

	it("coupe la salve au CHANGEMENT d'auteur", () => {
		const rows = bulles(
			groupMessages([msg("m1", "a", NOW - MINUTE), msg("m2", "b", NOW)], {
				selfId: "a",
				now: NOW,
			}),
		)
		expect(rows[0]).toMatchObject({ first: true, last: true })
		expect(rows[1]).toMatchObject({ first: true, last: true })
	})

	it("un message seul est à la fois premier et dernier de sa salve", () => {
		const rows = bulles(
			groupMessages([msg("m1", "a", NOW)], { selfId: "a", now: NOW }),
		)
		expect(rows[0]).toMatchObject({ first: true, last: true, showTime: true })
	})

	it("n'affiche l'heure QUE sur la dernière bulle d'une salve", () => {
		const rows = bulles(
			groupMessages(
				[
					msg("m1", "a", NOW - 2 * MINUTE),
					msg("m2", "a", NOW - MINUTE),
					msg("m3", "a", NOW),
				],
				{ selfId: "a", now: NOW },
			),
		)
		expect(rows.map((row) => row.showTime)).toEqual([false, false, true])
	})
})

describe("groupMessages — à qui est la bulle", () => {
	it("tranche par le CORRESPONDANT quand il est connu", () => {
		const rows = bulles(
			groupMessages([msg("m1", "autre", NOW), msg("m2", "moi", NOW)], {
				counterpartId: "autre",
				now: NOW,
			}),
		)
		expect(rows[0]?.mine).toBe(false)
		expect(rows[1]?.mine).toBe(true)
	})

	it("le correspondant PRIME sur mon identifiant", () => {
		// Un `selfId` erroné ne doit pas renverser le fil quand l'autre est connu.
		const rows = bulles(
			groupMessages([msg("m1", "moi", NOW)], {
				counterpartId: "autre",
				selfId: "quelqun-dautre",
				now: NOW,
			}),
		)
		expect(rows[0]?.mine).toBe(true)
	})

	it("retombe sur mon identifiant à défaut de correspondant", () => {
		const rows = bulles(
			groupMessages([msg("m1", "moi", NOW), msg("m2", "autre", NOW)], {
				selfId: "moi",
				now: NOW,
			}),
		)
		expect(rows[0]?.mine).toBe(true)
		expect(rows[1]?.mine).toBe(false)
	})

	it("met tout à GAUCHE quand aucune identité n'est encore connue", () => {
		const rows = bulles(
			groupMessages([msg("m1", "qui-sait", NOW)], { now: NOW }),
		)
		expect(rows[0]?.mine).toBe(false)
	})

	it("traite une chaîne vide comme une identité absente", () => {
		const rows = bulles(
			groupMessages([msg("m1", "moi", NOW)], {
				counterpartId: "",
				selfId: "moi",
				now: NOW,
			}),
		)
		expect(rows[0]?.mine).toBe(true)
	})
})

describe("groupMessages — un message supprimé garde sa place", () => {
	it("conserve la bulle supprimée dans le fil", () => {
		const rows = bulles(
			groupMessages(
				[
					msg("m1", "a", NOW - 2 * MINUTE),
					msg("m2", "a", NOW - MINUTE, true),
					msg("m3", "a", NOW),
				],
				{ selfId: "a", now: NOW },
			),
		)
		expect(rows).toHaveLength(3)
		expect(rows[1]?.message.deleted).toBe(true)
	})

	it("ne casse PAS la salve autour d'elle", () => {
		const rows = bulles(
			groupMessages(
				[
					msg("m1", "a", NOW - 2 * MINUTE),
					msg("m2", "a", NOW - MINUTE, true),
					msg("m3", "a", NOW),
				],
				{ selfId: "a", now: NOW },
			),
		)
		expect(rows.map((row) => row.first)).toEqual([true, false, false])
	})

	it("porte son libellé de retrait à la place du corps", () => {
		expect(bubbleText({ deleted: true, text: "secret" })).toBe(
			MESSAGE_DELETED_LABEL,
		)
	})
})

describe("bubbleText — l'ordre des questions", () => {
	it("le retrait par l'auteur PRIME sur le masquage", () => {
		expect(bubbleText({ deleted: true, masked: true, text: "x" })).toBe(
			MESSAGE_DELETED_LABEL,
		)
	})

	it("le masquage prime sur le corps", () => {
		expect(bubbleText({ masked: true, text: "x" })).toBe(MESSAGE_MASKED_LABEL)
	})

	it("rend le corps quand rien ne le retire", () => {
		expect(bubbleText({ text: "bonjour" })).toBe("bonjour")
	})

	it("rend une chaîne vide plutôt que « null » sur un corps absent", () => {
		expect(bubbleText({ text: null })).toBe("")
		expect(bubbleText({ text: undefined })).toBe("")
	})
})

describe("les libellés de retrait", () => {
	it("gardent le texte du socle en français", () => {
		expect(MESSAGE_DELETED_LABEL).toBe("Message supprimé")
		expect(MESSAGE_MASKED_LABEL).toBe("Message masqué")
	})
})

describe("la langue de l'écran", () => {
	it("nomme les jours, les retraits et les heures dans la langue courante", () => {
		expect(dayLabelT(NOW - 3 * 60 * MINUTE, NOW, "en", en)).toBe("Today")
		expect(dayLabelT(NOW - JOUR, NOW, "en", en)).toBe("Yesterday")
		expect(dayLabelT(new Date(2026, 7, 3, 9, 0).getTime(), NOW, "en", en)).toContain("August")
		expect(bubbleTextT({ deleted: true, text: "x" }, en)).toBe("Message deleted")
		const rows = groupMessagesT([msg("m1", "a", NOW)], { selfId: "a", now: NOW, locale: "en" }, en)
		expect(rows[0]).toMatchObject({ kind: "date", label: "Today" })
		expect(bubbleTimeT(new Date(2026, 7, 18, 21, 5).getTime(), "en")).toMatch(/9:05/)
	})
})

describe("bubbleTime", () => {
	it("rend une heure sur un instant valide", () => {
		expect(bubbleTime(new Date(2026, 7, 18, 9, 5).getTime())).toMatch(/\d{2}/)
	})

	it("rend une chaîne vide sur un instant non fini", () => {
		expect(bubbleTime(Number.NaN)).toBe("")
	})
})
