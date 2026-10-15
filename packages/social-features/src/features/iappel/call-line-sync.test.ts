// Dupliqué de socle/packages/agent-features/src/features/iappel/call-line-sync.test.ts @ ad2e7fdc2 — adaptations : file du centre d'appels retirée — le cas « un appel de la FILE n'est jamais piloté ici » est ôté et la file sort de la liste « ne sème rien » (les cinq autres exclusions y restent) ; slots sans `kind`.
import { describe, expect, it } from "vitest"
import {
	desiredLineState,
	forgottenLines,
	lineAckFor,
	planLineSync,
	seedConnectedLines,
	type LineSlotView,
	type LineWant,
} from "./call-line-sync"

function slot(over: Partial<LineSlotView> & { meetingId: string }): LineSlotView {
	return { status: "active", hasToken: true, ...over }
}

describe("desiredLineState", () => {
	it("l'actif se veut en cours, les autres parqués", () => {
		const wanted = desiredLineState({
			slots: [slot({ meetingId: "a" }), slot({ meetingId: "b", status: "held" })],
			activeSlotId: "b",
		})
		expect(wanted.get("a")).toBe("on_hold")
		expect(wanted.get("b")).toBe("on_hold")
	})

	it("un appel en cours d'établissement qui EST l'actif se veut en cours", () => {
		// C'est le cas nominal d'un sortant : le slot naît `connecting`, et il
		// n'atteint jamais `active` sur le chemin d'iAppel.
		const wanted = desiredLineState({
			slots: [slot({ meetingId: "a", status: "connecting" })],
			activeSlotId: "a",
		})
		expect(wanted.get("a")).toBe("connected")
	})

	it("un appel en cours d'établissement qui n'est PAS l'actif se veut parqué", () => {
		// Un sortant en sonnerie pendant qu'on décroche un entrant. Le magasin
		// le parque déjà ; le serveur répondra « différé ».
		const wanted = desiredLineState({
			slots: [
				slot({ meetingId: "sortant", status: "connecting" }),
				slot({ meetingId: "entrant" }),
			],
			activeSlotId: "entrant",
		})
		expect(wanted.get("sortant")).toBe("on_hold")
		expect(wanted.get("entrant")).toBe("connected")
	})

	it("un appel de GROUPE n'est jamais piloté ici", () => {
		// Un appel de groupe ne se met pas en attente, des deux côtés : le
		// serveur refuse `hold` sur lui, et le pousser dans le plan coûterait
		// trois essais perdus par appel à plusieurs.
		const wanted = desiredLineState({
			slots: [slot({ meetingId: "g", callKind: "group" })],
			activeSlotId: "g",
		})
		expect(wanted.has("g")).toBe(false)
		expect(seedConnectedLines([slot({ meetingId: "g", callKind: "group" })], new Map())).toEqual(
			[],
		)
	})

	it("un appel SANS jeton attend son tour", () => {
		// Le meeting n'est pas rejoint : le serveur refuserait. Il rentre au
		// plan tout seul quand le jeton arrive — c'est l'intérêt de réconcilier
		// plutôt que de réagir à un geste.
		const sansJeton = slot({ meetingId: "a", hasToken: false })
		expect(desiredLineState({ slots: [sansJeton], activeSlotId: "a" }).has("a")).toBe(
			false,
		)
		const avecJeton = { ...sansJeton, hasToken: true }
		expect(desiredLineState({ slots: [avecJeton], activeSlotId: "a" }).get("a")).toBe(
			"connected",
		)
	})

	it("les appels terminés et ceux qui sonnent encore sont hors ligne", () => {
		const wanted = desiredLineState({
			slots: [
				slot({ meetingId: "fini", status: "ended" }),
				slot({ meetingId: "sonne", status: "incoming" }),
			],
			activeSlotId: null,
		})
		expect(wanted.size).toBe(0)
	})
})

describe("planLineSync", () => {
	const vide: ReadonlyMap<string, LineWant> = new Map()

	it("décrocher un second appel parque le premier ET reprend le second", () => {
		// LE scénario du défaut. Avant, rien de tout cela ne partait.
		const ops = planLineSync({
			slots: [
				slot({ meetingId: "a", status: "held" }),
				slot({ meetingId: "b", status: "connecting" }),
			],
			activeSlotId: "b",
			acknowledged: vide,
		})
		expect(ops).toEqual([
			{ meetingId: "a", op: "hold" },
			{ meetingId: "b", op: "resume" },
		])
	})

	it("TOUS les hold partent avant TOUS les resume", () => {
		// Sinon deux correspondants entendent la même conversation, brièvement
		// mais réellement.
		const ops = planLineSync({
			slots: [
				slot({ meetingId: "reprise" }),
				slot({ meetingId: "p1", status: "held" }),
				slot({ meetingId: "p2", status: "held" }),
			],
			activeSlotId: "reprise",
			acknowledged: vide,
		})
		expect(ops.map((o) => o.op)).toEqual(["hold", "hold", "resume"])
	})

	it("au repos, le plan est vide", () => {
		const acquitte = new Map<string, LineWant>([
			["a", "on_hold"],
			["b", "connected"],
		])
		const ops = planLineSync({
			slots: [slot({ meetingId: "a", status: "held" }), slot({ meetingId: "b" })],
			activeSlotId: "b",
			acknowledged: acquitte,
		})
		expect(ops).toEqual([])
	})

	it("basculer d'un appel à l'autre inverse les deux opérations", () => {
		const acquitte = new Map<string, LineWant>([
			["a", "connected"],
			["b", "on_hold"],
		])
		const ops = planLineSync({
			slots: [slot({ meetingId: "a", status: "held" }), slot({ meetingId: "b" })],
			activeSlotId: "b",
			acknowledged: acquitte,
		})
		expect(ops).toEqual([
			{ meetingId: "a", op: "hold" },
			{ meetingId: "b", op: "resume" },
		])
	})

	it("mettre en attente le SEUL appel est une opération à part entière", () => {
		// Il n'y a pas d'autre appel à reprendre : l'écran doit quand même
		// pouvoir parquer, et le serveur le savoir.
		const ops = planLineSync({
			slots: [slot({ meetingId: "a", status: "held" })],
			activeSlotId: "a",
			acknowledged: new Map([["a", "connected"]]),
		})
		expect(ops).toEqual([{ meetingId: "a", op: "hold" }])
	})
})

describe("forgottenLines", () => {
	it("les appels disparus du magasin perdent leur accusé", () => {
		// Sans purge, un rappel immédiat sur le même identifiant hériterait de
		// l'accusé du précédent et son opération ne partirait jamais.
		const acquitte = new Map<string, LineWant>([
			["vivant", "connected"],
			["parti", "on_hold"],
		])
		expect(forgottenLines([slot({ meetingId: "vivant" })], acquitte)).toEqual([
			"parti",
		])
	})

	it("ne purge rien quand tout le monde est là", () => {
		const acquitte = new Map<string, LineWant>([["a", "connected"]])
		expect(forgottenLines([slot({ meetingId: "a" })], acquitte)).toEqual([])
	})
})

describe("seedConnectedLines — une ligne naît connectée", () => {
	it("un appel sortant neuf reçoit son accusé « connected » sans rien envoyer", () => {
		// Le défaut du 2026-09-13 : trois `calls:resume` refusés par appel
		// sortant, parce qu'un slot sans accusé se voyait proposer « reprendre »
		// alors qu'il sonnait encore.
		const acknowledged = new Map<string, LineWant>()
		expect(seedConnectedLines([slot({ meetingId: "a" })], acknowledged)).toEqual(["a"])
		acknowledged.set("a", "connected")
		expect(
			planLineSync({ slots: [slot({ meetingId: "a" })], activeSlotId: "a", acknowledged }),
		).toEqual([])
	})

	it("ne sème rien pour un accusé déjà connu, un parqué, un entrant, un terminé, un sans jeton", () => {
		const acknowledged = new Map<string, LineWant>([["deja", "on_hold"]])
		expect(
			seedConnectedLines(
				[
					slot({ meetingId: "deja" }),
					slot({ meetingId: "parque", status: "held" }),
					slot({ meetingId: "entrant", status: "incoming" }),
					slot({ meetingId: "fini", status: "ended" }),
					slot({ meetingId: "sans", hasToken: false }),
					slot({ meetingId: "neuf", status: "connecting" }),
				],
				acknowledged,
			),
		).toEqual(["neuf"])
	})

	it("la reprise reste proposée après une mise en attente ACQUITTÉE", () => {
		// Semer « connected » ne doit pas empêcher le vrai aller-retour :
		// parqué puis repris, `resume` part bien.
		const acknowledged = new Map<string, LineWant>([["a", "on_hold"]])
		expect(seedConnectedLines([slot({ meetingId: "a" })], acknowledged)).toEqual([])
		expect(
			planLineSync({ slots: [slot({ meetingId: "a" })], activeSlotId: "a", acknowledged }),
		).toEqual([{ meetingId: "a", op: "resume" }])
	})
})

describe("lineAckFor — ce que le serveur a VRAIMENT fait", () => {
	it("une mise en attente honorée s'acquitte", () => {
		expect(lineAckFor("hold", {})).toBe("on_hold")
		expect(lineAckFor("hold", { noop: true })).toBe("on_hold")
	})

	it("une mise en attente DIFFÉRÉE sans promesse se rejoue", () => {
		// LE défaut : `{ noop: true, deferred: true }` était acquitté comme un
		// succès sur un appel pas encore `connected`. L'opération ne repartait
		// jamais, et la base restait `ringing`.
		expect(lineAckFor("hold", { noop: true, deferred: true })).toBeNull()
	})

	it("une mise en attente différée AVEC `holdOnAnswer` s'acquitte : elle aboutira seule", () => {
		// Le serveur retient l'intention et pose `on_hold` au décrochage : la
		// rejouer enverrait le même ordre en boucle pendant toute la sonnerie.
		expect(
			lineAckFor("hold", { noop: true, deferred: true, holdOnAnswer: true }),
		).toBe("on_hold")
	})

	it("une reprise s'acquitte toujours — y compris différée", () => {
		// Annuler une attente qui n'a pas encore pris est exactement ce que le
		// serveur fait alors : il n'y a rien à rejouer.
		expect(lineAckFor("resume", {})).toBe("connected")
		expect(lineAckFor("resume", { noop: true, deferred: true })).toBe("connected")
	})
})
