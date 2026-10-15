// Réécrit d'après socle/packages/agent-features/src/features/messagerie/messagerie-source.test.ts @ ad2e7fdc2 — une seule source (personnelle) : les cas « les deux sources se distinguent » deviennent « la source personnelle sert brouillon et groupes, et ne connaît aucun poste » ; le cliquet « l'espace ne se teste pas dans les vues » est gardé (requêtes propres à la source : celles du moteur) ; s'y ajoutent, portés du cliquet `messagerie-query-states.test.ts` du socle (non recopié : il lit la coque), les cas des fonctions pures de la source (`etatDeSource`, `combinerNonLus`, `fusionnerPagesFils` par `threadId`, `curseursEgaux` à côtés `low`/`high`) et la normalisation de la réponse d'appel du moteur (`resultatAppelDe`).
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import type { Id } from "@antia/api/engine"
import {
	combinerNonLus,
	curseursEgaux,
	etatDeSource,
	fusionnerPagesFils,
	ICOM_UNREAD_CAP,
	resultatAppelDe,
	SOURCE_AGENT,
	type ThreadsPageCursor,
} from "./messagerie-source"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const source = (nom: string) => readFileSync(`${HERE}${nom}`, "utf8")
/** Le source, commentaires ôtés — on garde du code, pas de la prose. */
const code = (nom: string) =>
	source(nom)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/[^\n]*$/gm, "")
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")

describe("la source personnelle — la seule du moteur", () => {
	it("nomme son espace", () => {
		expect(SOURCE_AGENT.espace).toBe("personnel")
	})

	it("sert le brouillon et les groupes", () => {
		expect(SOURCE_AGENT.supporteBrouillon).toBe(true)
		expect(SOURCE_AGENT.supporteGroupes).toBe(true)
	})

	it("expose les membres que les vues consomment — sinon la vue choisit", () => {
		expect(Object.keys(SOURCE_AGENT).sort()).toEqual(
			[
				"espace",
				"supporteBrouillon",
				"supporteGroupes",
				"useGroupThreads",
				"useStartCall",
				"useThreadById",
				"useThreads",
				"useThreadsPage",
				"useUnreadTotals",
			].sort(),
		)
	})

	it("ne connaît AUCUN poste ni aucune organisation", () => {
		const body = code("messagerie-source.ts")
		for (const marqueur of ["SOURCE_POSTE", "useOptionalOrg", "\"poste\"", "orgId", "callUser"]) {
			expect(body, marqueur).not.toContain(marqueur)
		}
	})
})

describe("CLIQUET — l'espace ne se teste pas dans les vues", () => {
	// On injecte une SOURCE, jamais un `if (espace === …)`. Un test sur
	// l'espace se recopie à chaque endroit qui en a besoin, et le dixième est
	// toujours oublié.
	const VUES = [
		"MessagerieListView.tsx",
		"MessagerieConversationView.tsx",
		"MessagerieComposeView.tsx",
		"MessagerieGroupeCompose.tsx",
	]

	it("aucune vue ne branche sur le nom d'un espace", () => {
		const fautives: string[] = []
		for (const vue of VUES) {
			const body = code(vue)
			if (/espace\s*===\s*["'](poste|personnel)["']/.test(body)) {
				fautives.push(`${vue} — branche sur le nom de l'espace`)
			}
		}
		expect(fautives).toEqual([])
	})

	it("aucune vue n'appelle en direct une requête PROPRE à la source", () => {
		// La liste des fils, celle des groupes et l'appel d'un membre : c'est la
		// source qui les nomme, une fois.
		const fautives: string[] = []
		for (const vue of VUES) {
			const body = code(vue)
			for (const marqueur of [
				"inbox.paginateMyThreads",
				"threads.paginateMyGroupThreads",
				"direct.callMember",
			]) {
				if (body.includes(marqueur)) fautives.push(`${vue} — ${marqueur}`)
			}
		}
		expect(fautives).toEqual([])
	})

	it("la source, elle, nomme bien la boîte, les groupes, les décomptes et l'appel", () => {
		// Le cliquet ci-dessus ne vaut que si les requêtes existent QUELQUE
		// PART : sans cette assertion, vider la source rendrait les deux
		// précédentes vertes.
		const body = code("messagerie-source.ts")
		for (const marqueur of [
			"messaging.inbox.paginateMyThreads",
			"messaging.inbox.getThread",
			"messaging.inbox.totalUnread",
			"groups.threads.paginateMyGroupThreads",
			"groups.threads.totalUnread",
			"calls.direct.callMember",
		]) {
			expect(body, marqueur).toContain(marqueur)
		}
	})

	it("la source expose l'erreur, la relance et l'armement (une panne n'est jamais une boîte vide)", () => {
		const body = source("messagerie-source.ts")
		for (const motif of ["isError", "refetch", "isFetching", "enabled", "useThreadsPage", "useUnreadTotals", "useThreadById"]) {
			expect(body, motif).toContain(motif)
		}
	})
})

describe("etatDeSource — le contrat d'état, appliqué à une source", () => {
	const base = {
		data: [] as unknown[] | undefined,
		isLoading: false,
		isError: false,
		error: null,
		refetch: () => {},
		isFetching: false,
		enabled: true,
	}

	it("une liste désactivée n'est jamais en attente", () => {
		expect(etatDeSource({ ...base, data: [], enabled: false, isLoading: false })).toBe("inactif")
	})

	it("une panne reste une panne, avec ou sans données", () => {
		expect(etatDeSource({ ...base, isError: true, data: [] })).toBe("erreur")
		expect(etatDeSource({ ...base, isError: true, data: [1, 2] })).toBe("erreur")
	})

	it("une attente sans donnée est une attente ; avec données, un rafraîchissement", () => {
		expect(etatDeSource({ ...base, data: undefined, isLoading: true, isFetching: true })).toBe("attente")
		expect(etatDeSource({ ...base, data: [1], isFetching: true })).toBe("rafraichissement")
	})

	it("le serveur a répondu : vide ou prêt", () => {
		expect(etatDeSource({ ...base, data: [] })).toBe("vide")
		expect(etatDeSource({ ...base, data: [1] })).toBe("pret")
	})
})

describe("combinerNonLus — un seul chiffre, plafonné une seule fois", () => {
	it("additionne les deux familles", () => {
		expect(combinerNonLus({ total: 2, capped: false }, { total: 5, capped: false })).toEqual({
			total: 7,
			capped: false,
		})
	})

	it("une réponse absente vaut zéro, jamais NaN", () => {
		expect(combinerNonLus(undefined, undefined)).toEqual({ total: 0, capped: false })
		expect(combinerNonLus({ total: 1, capped: false }, undefined)).toEqual({ total: 1, capped: false })
	})

	it("le plafond se propage, et la somme ne le dépasse jamais", () => {
		expect(combinerNonLus({ total: 99, capped: true }, { total: 4, capped: false })).toEqual({
			total: ICOM_UNREAD_CAP,
			capped: true,
		})
		expect(combinerNonLus({ total: 60, capped: false }, { total: 60, capped: false })).toEqual({
			total: ICOM_UNREAD_CAP,
			capped: true,
		})
	})
})

describe("fusionnerPagesFils — ni doublon, ni ligne périmée", () => {
	const fil = (id: string) => ({ threadId: id })

	it("conserve l'ordre du serveur, page vivante d'abord", () => {
		expect(fusionnerPagesFils([fil("a"), fil("b")], [fil("c"), fil("d")]).map((f) => f.threadId)).toEqual([
			"a",
			"b",
			"c",
			"d",
		])
	})

	it("un fil réactivé remonte et ne reste pas à son ancienne place", () => {
		// La page vivante porte `c` en tête (message reçu) ; la page ancienne
		// accumulée le porte encore à sa position d'origine.
		expect(fusionnerPagesFils([fil("c"), fil("a")], [fil("b"), fil("c")]).map((f) => f.threadId)).toEqual([
			"c",
			"a",
			"b",
		])
	})

	it("sans page ancienne, la page vivante est la liste", () => {
		expect(fusionnerPagesFils([fil("a")], []).map((f) => f.threadId)).toEqual(["a"])
	})
})

describe("curseursEgaux — le garde-fou de boucle du chargement par pages", () => {
	const c = (at: number, ct: number): ThreadsPageCursor => ({ low: { at, ct }, high: null })

	it("deux curseurs reconstruits à l'identique sont ÉGAUX", () => {
		// Sans cela, un objet neuf mais équivalent relance le rendu, qui
		// relance l'effet : la liste boucle sans jamais se stabiliser.
		expect(curseursEgaux(c(10, 1), c(10, 1))).toBe(true)
	})

	it("un curseur qui a avancé n'est pas le même", () => {
		expect(curseursEgaux(c(10, 1), c(9, 1))).toBe(false)
		expect(curseursEgaux(c(10, 1), { low: { at: 10, ct: 1 }, high: { at: 5, ct: 2 } })).toBe(false)
	})

	it("null n'est égal qu'à null", () => {
		expect(curseursEgaux(null, null)).toBe(true)
		expect(curseursEgaux(null, c(1, 1))).toBe(false)
		expect(curseursEgaux(c(1, 1), null)).toBe(false)
	})

	it("la queue des fils sans activité (`at: null`) se distingue d'un nombre", () => {
		expect(curseursEgaux({ low: { at: null, ct: 3 }, high: null }, { low: { at: 0, ct: 3 }, high: null })).toBe(
			false,
		)
	})
})

describe("resultatAppelDe — la réponse du moteur, normalisée pour l'écran", () => {
	const appel = "calls_1" as Id<"calls">
	const personne = "persons_2" as Id<"persons">

	it("un appel admis garde le média RETENU par le serveur, et l'appelé désigné", () => {
		expect(
			resultatAppelDe(
				{ admitted: true, callId: appel, calleePersonId: personne, roomName: "call-1", mediaType: "audio" },
				{ adresse: "awa.mba", userId: personne, mediaType: "video" },
			),
		).toEqual({
			meetingId: appel,
			admitted: true,
			voicemailOffered: false,
			targetUserId: personne,
			mediaType: "audio",
		})
	})

	it("un refus est une VALEUR : la raison et l'offre de message vocal voyagent", () => {
		expect(
			resultatAppelDe(
				{ admitted: false, callId: appel, calleePersonId: personne, reason: "dnd", voicemailOffered: true },
				{ adresse: "awa.mba", userId: personne, mediaType: "video" },
			),
		).toEqual({
			meetingId: appel,
			admitted: false,
			reason: "dnd",
			voicemailOffered: true,
			targetUserId: personne,
			mediaType: "video",
		})
	})

	it("appelé par son seul identifiant public : la personne vient du MOTEUR, jamais de l'écran", () => {
		const resultat = resultatAppelDe(
			{ admitted: true, callId: appel, calleePersonId: personne, roomName: "call-1", mediaType: "video" },
			{ adresse: "awa.mba", mediaType: "video" },
		)
		expect(resultat.targetUserId).toBe(personne)
	})
})
