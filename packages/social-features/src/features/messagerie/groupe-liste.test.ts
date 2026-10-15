// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-liste.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
	filtrerConversationsParType,
	filtrerGroupes,
	formaterNonLus,
	fusionnerConversations,
	sommerNonLus,
	sommerNonLusParType,
} from "./groupe-liste"

/**
 * UNE liste pour deux familles de conversations : la fusion est un tri, donc
 * une décision — elle se prouve ici, pas à l'œil dans la carte.
 */

describe("fusionnerConversations", () => {
	it("entrelace 1:1 et groupes par dernier message, le plus récent d'abord", () => {
		const chats = [
			{ chatId: "c1", lastMessageAt: 300 },
			{ chatId: "c2", lastMessageAt: 100 },
		]
		const groupes = [{ threadId: "g1", lastMessageAt: 200 }]
		const liste = fusionnerConversations(chats, groupes)
		expect(
			liste.map((entree) =>
				entree.kind === "chat" ? entree.chat.chatId : entree.groupe.threadId,
			),
		).toEqual(["c1", "g1", "c2"])
	})

	it("préserve la nature de chaque ligne — le rendu n'a pas à deviner", () => {
		const liste = fusionnerConversations(
			[{ chatId: "c1", lastMessageAt: 1 }],
			[{ threadId: "g1", lastMessageAt: 2 }],
		)
		expect(liste[0]).toEqual({
			kind: "groupe",
			groupe: { threadId: "g1", lastMessageAt: 2 },
		})
		expect(liste[1]).toEqual({
			kind: "chat",
			chat: { chatId: "c1", lastMessageAt: 1 },
		})
	})

	it("relègue les conversations sans date en fin de liste", () => {
		const liste = fusionnerConversations(
			[{ chatId: "muet", lastMessageAt: null }],
			[{ threadId: "g1", lastMessageAt: 5 }],
		)
		expect(liste[0]?.kind).toBe("groupe")
		expect(liste[1]?.kind).toBe("chat")
	})

	it("à date égale, l'ordre d'entrée survit (tri stable) : les 1:1 d'abord", () => {
		const liste = fusionnerConversations(
			[{ chatId: "c1", lastMessageAt: 7 }],
			[{ threadId: "g1", lastMessageAt: 7 }],
		)
		expect(liste.map((entree) => entree.kind)).toEqual(["chat", "groupe"])
	})

	it("fusionne aussi quand une famille est vide", () => {
		expect(fusionnerConversations([], [])).toEqual([])
		const seulement = fusionnerConversations(
			[],
			[{ threadId: "g1", lastMessageAt: 1 }],
		)
		expect(seulement).toHaveLength(1)
	})
})

describe("filtrerGroupes — le pendant de filtrerThreads, sur le TITRE", () => {
	const groupes = [
		{ title: "Réunion budgétaire" },
		{ title: "Comité Mengué Mé Nzoghe" },
	]

	it("trouve sans les accents — le cas NORMAL, pas le cas limite", () => {
		expect(filtrerGroupes(groupes, "mengue")).toEqual([groupes[1]])
		expect(filtrerGroupes(groupes, "REUNION")).toEqual([groupes[0]])
	})

	it("rend la liste ENTIÈRE — et la même référence — sur requête vide", () => {
		expect(filtrerGroupes(groupes, "")).toBe(groupes)
		expect(filtrerGroupes(groupes, "   ")).toBe(groupes)
	})

	it("rend vide quand rien ne correspond", () => {
		expect(filtrerGroupes(groupes, "introuvable")).toEqual([])
	})
})

describe("filtrerConversationsParType", () => {
	const chats = [
		{ chatId: "c1", lastMessageAt: 300 },
		{ chatId: "c2", lastMessageAt: 100 },
	]
	const groupes = [{ threadId: "g1", lastMessageAt: 200 }]

	it("garde et entrelace les deux familles pour « toutes »", () => {
		const liste = filtrerConversationsParType(chats, groupes, "toutes")
		expect(
			liste.map((entree) =>
				entree.kind === "chat" ? entree.chat.chatId : entree.groupe.threadId,
			),
		).toEqual(["c1", "g1", "c2"])
	})

	it("ne rend que les conversations individuelles", () => {
		const liste = filtrerConversationsParType(
			chats,
			groupes,
			"individuelles",
		)
		expect(liste.map((entree) => entree.kind)).toEqual(["chat", "chat"])
	})

	it("ne rend que les groupes", () => {
		const liste = filtrerConversationsParType(chats, groupes, "groupes")
		expect(liste).toEqual([
			{ kind: "groupe", groupe: { threadId: "g1", lastMessageAt: 200 } },
		])
	})
})

describe("non-lus séparés", () => {
	it("somme les deux familles sans les mélanger", () => {
		expect(
			sommerNonLusParType(
				[
					{ unreadCount: 2 },
					{ unreadCount: 3 },
				],
				[{ unreadCount: 7 }],
			),
		).toEqual({
			individuelles: { total: 5, capped: false },
			groupes: { total: 7, capped: false },
		})
	})

	it("propage le plafond d'un seul fil, même quand la somme vaut 99", () => {
		const total = sommerNonLus([
			{ unreadCount: 99, unreadCapped: true },
		])
		expect(total).toEqual({ total: 99, capped: true })
		expect(formaterNonLus(total)).toBe("99+")
	})

	it("plafonne la présentation quand la somme dépasse 99", () => {
		const total = sommerNonLus([
			{ unreadCount: 60 },
			{ unreadCount: 40 },
		])
		expect(total).toEqual({ total: 100, capped: true })
		expect(formaterNonLus(total)).toBe("99+")
	})

	it("rend le nombre exact sous la borne, et aucune pastille à zéro", () => {
		expect(formaterNonLus(sommerNonLus([{ unreadCount: 8 }]))).toBe("8")
		expect(formaterNonLus(sommerNonLus([]))).toBeNull()
	})
})
