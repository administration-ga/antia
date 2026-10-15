// Dupliqué de socle/packages/agent-features/src/features/iappel/call-journal.test.ts @ ad2e7fdc2 — adaptations : lignes = DTO du moteur (`listCallHistory`) ; le classement est fait par le serveur (testé dans `@antia/social-domain/callJournal` et `convex/modules/calls/calls.test.ts`), l'écran en garde la lecture : sens de l'appel, refus automatiques du moteur, « hors ligne » jamais refus, correspondant à rappeler (appelant d'un appel de groupe compris) ; cas retirés : renvoi au secrétariat (3), appel passé du back-office vers son espace d'agent (3), appel prioritaire (1), repli de l'horodatage sur la création (le moteur rend toujours `startedAt`).
import { describe, expect, it } from "vitest"

import type { CounterpartLabel } from "@antia/social-contracts/counterpart"

import {
	categorizeCallRow,
	groupCallJournal,
	journalEntryOf,
	type CallHistoryRow,
} from "./call-journal"

/**
 * Ce que ces cas gardent : un appel personnel REÇU s'affichait comme
 * « sortant » parce que l'ancien code classait sur l'appartenance à une file
 * plutôt que sur l'auteur. Chaque `it` vérifie une règle de lecture ou de
 * calcul qui a un jour trompé l'écran.
 */

const OTHER = "persons_other"

function label(displayName: string | null): CounterpartLabel {
	return { displayName, handle: null, headline: null, avatarUrl: null, source: displayName === null ? "unknown" : "published" }
}

function row(over: Partial<CallHistoryRow> = {}): CallHistoryRow {
	return {
		callId: "calls_1" as CallHistoryRow["callId"],
		kind: "direct",
		category: "outgoing",
		reason: null,
		mediaType: "audio",
		startedAt: 1_000,
		durationMs: null,
		declineNote: null,
		counterpart: { personId: OTHER as NonNullable<CallHistoryRow["counterpart"]>["personId"], label: label("Marie Ndong") },
		group: null,
		createdByMe: true,
		...over,
	}
}

describe("categorizeCallRow — la catégorie du serveur, relue", () => {
	it("un appel REÇU (créé par un autre) se lit `incoming` — le défaut corrigé", () => {
		const r = row({ createdByMe: false, category: "incoming" })
		expect(categorizeCallRow(r)).toEqual({ category: "incoming", reason: null })
		expect(journalEntryOf(r).direction).toBe("incoming")
	})

	it("un appel PASSÉ (créé par moi) se lit `outgoing`", () => {
		const r = row({ createdByMe: true, category: "outgoing" })
		expect(categorizeCallRow(r)).toEqual({ category: "outgoing", reason: null })
		expect(journalEntryOf(r).direction).toBe("outgoing")
	})

	for (const reason of ["dnd", "busy", "in_meeting", "outside_relations"] as const) {
		it(`refus automatique « ${reason} » : ni manqué ni refusé humainement`, () => {
			const r = row({ createdByMe: false, category: "auto_declined", reason })
			expect(categorizeCallRow(r)).toEqual({ category: "auto_declined", reason })
		})
	}

	it("`missed` : vraiment manqué", () => {
		expect(categorizeCallRow(row({ createdByMe: false, category: "missed" })).category).toBe("missed")
	})

	it("`declined` : refus humain", () => {
		expect(categorizeCallRow(row({ createdByMe: false, category: "declined" })).category).toBe("declined")
	})

	it("« hors ligne » n'entre TOUJOURS pas dans les refus automatiques", () => {
		// Un appelé simplement absent n'a rien refusé : le ranger là serait
		// une accusation à la place d'une absence — même si une ligne le
		// prétendait.
		const r = row({ createdByMe: false, category: "auto_declined", reason: "offline" as CallHistoryRow["reason"] })
		expect(categorizeCallRow(r)).toEqual({ category: "missed", reason: null })
	})
})

describe("journalEntryOf — la durée, et qui est en face", () => {
	it("sans décrochage, la durée est `null` — jamais la sonnerie comptée", () => {
		expect(journalEntryOf(row({ durationMs: null })).durationMs).toBeNull()
	})

	it("décroché, la durée exacte du serveur", () => {
		expect(journalEntryOf(row({ durationMs: 3_500 })).durationMs).toBe(3_500)
	})

	it("counterpartUserId : si j'ai appelé, c'est l'appelé", () => {
		const entry = journalEntryOf(row({ createdByMe: true }))
		expect(entry.counterpartUserId).toBe(OTHER)
		expect(entry.counterpartLabel?.displayName).toBe("Marie Ndong")
	})

	it("counterpartUserId : si on m'a appelé, c'est l'appelant", () => {
		expect(journalEntryOf(row({ createdByMe: false, category: "incoming" })).counterpartUserId).toBe(OTHER)
	})

	it("correspondant absent alors que j'ai appelé : `null`, pas une exception", () => {
		expect(journalEntryOf(row({ createdByMe: true, counterpart: null })).counterpartUserId).toBeNull()
	})

	it("un appel de GROUPE reçu se rappelle par son appelant", () => {
		const caller = { personId: "persons_caller" as NonNullable<CallHistoryRow["counterpart"]>["personId"], label: label("Paul Obame") }
		const entry = journalEntryOf(
			row({ kind: "group", counterpart: null, createdByMe: false, category: "incoming", group: { caller, threadId: null } }),
		)
		expect(entry.kind).toBe("group")
		expect(entry.counterpartUserId).toBe("persons_caller")
		expect(entry.counterpartLabel?.displayName).toBe("Paul Obame")
	})

	it("un appel de groupe que J'AI lancé ne se rappelle pas d'un seul geste", () => {
		const caller = { personId: "persons_me" as NonNullable<CallHistoryRow["counterpart"]>["personId"], label: label("Moi") }
		const entry = journalEntryOf(row({ kind: "group", counterpart: null, createdByMe: true, group: { caller, threadId: null } }))
		expect(entry.counterpartUserId).toBeNull()
		expect(entry.counterpartLabel).toBeNull()
	})

	it("valeurs par défaut : personnel, note nulle sans `declineNote`", () => {
		const entry = journalEntryOf(row())
		expect(entry.mediaType).toBe("audio")
		expect(entry.scope).toBe("personnel")
		expect(entry.note).toBeNull()
	})

	it("`declineNote` traverse jusqu'à `note`", () => {
		const entry = journalEntryOf(row({ declineNote: "Je conduis, je rappelle" }))
		expect(entry.note).toBe("Je conduis, je rappelle")
	})
})

describe("groupCallJournal — le tri, et ce qui compte comme « à traiter »", () => {
	it("liste vide", () => {
		expect(groupCallJournal([])).toEqual({
			missed: [],
			all: [],
			unseenMissedCount: 0,
			lastMissedAt: null,
		})
	})

	it("`all` est trié du plus récent au plus ancien", () => {
		const rows = [
			row({ callId: "vieux" as CallHistoryRow["callId"], startedAt: 1_000 }),
			row({ callId: "recent" as CallHistoryRow["callId"], startedAt: 9_000 }),
			row({ callId: "moyen" as CallHistoryRow["callId"], startedAt: 5_000 }),
		]
		const { all } = groupCallJournal(rows)
		expect(all.map((e) => e.meetingId)).toEqual(["recent", "moyen", "vieux"])
	})

	it("un appel manqué SORTANT n'entre pas dans `missed`, mais reste dans `all`", () => {
		const rows = [
			row({
				callId: "sans-reponse" as CallHistoryRow["callId"],
				createdByMe: true,
				category: "missed",
				startedAt: 1_000,
			}),
		]
		const { missed, all } = groupCallJournal(rows)
		expect(missed).toHaveLength(0)
		expect(all).toHaveLength(1)
	})

	it("un appel manqué ENTRANT entre dans `missed`", () => {
		const rows = [
			row({ callId: "loupe" as CallHistoryRow["callId"], createdByMe: false, category: "missed", startedAt: 1_000 }),
		]
		const { missed } = groupCallJournal(rows)
		expect(missed.map((e) => e.meetingId)).toEqual(["loupe"])
	})

	it("un refus automatique ENTRANT compte aussi comme manqué à traiter", () => {
		const rows = [
			row({
				callId: "auto" as CallHistoryRow["callId"],
				createdByMe: false,
				category: "auto_declined",
				reason: "dnd",
				startedAt: 1_000,
			}),
		]
		const { missed } = groupCallJournal(rows)
		expect(missed).toHaveLength(1)
	})

	it("`unseenMissedCount` compte les manqués de ce lot — pas de re-filtrage par date ici", () => {
		const rows = [
			row({ callId: "a" as CallHistoryRow["callId"], createdByMe: false, category: "missed", startedAt: 1_000 }),
			row({ callId: "b" as CallHistoryRow["callId"], createdByMe: false, category: "missed", startedAt: 2_000 }),
		]
		const { unseenMissedCount } = groupCallJournal(rows)
		expect(unseenMissedCount).toBe(2)
	})

	it("`lastMissedAt` est l'horodatage du manqué le plus récent", () => {
		const rows = [
			row({ callId: "a" as CallHistoryRow["callId"], createdByMe: false, category: "missed", startedAt: 1_000 }),
			row({ callId: "b" as CallHistoryRow["callId"], createdByMe: false, category: "missed", startedAt: 5_000 }),
		]
		const { lastMissedAt } = groupCallJournal(rows)
		expect(lastMissedAt).toBe(5_000)
	})

	it("aucun manqué : `lastMissedAt` est `null`", () => {
		const rows = [row({ createdByMe: true, startedAt: 1_000 })]
		const { lastMissedAt } = groupCallJournal(rows)
		expect(lastMissedAt).toBeNull()
	})
})
