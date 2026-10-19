// Dupliqué de socle/packages/agent-features/src/features/iappel/call-seats.test.ts @ ad2e7fdc2 — adaptations : phrases lues dans les locales françaises du moteur (`t` réel, pluriels i18next) — mots et chiffres inchangés.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { CallParticipantState } from "./call-types"
import { describeCallSeats, projectCallSeats, summarizeCallParticipants } from "./call-seats"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * IC-03 / IC-04 — les places d'un appel, en UNE projection.
 *
 * Deux compteurs indépendants — la projection serveur et le Set optimiste du
 * panneau — étaient ADDITIONNÉS sans union par identité ni acquittement :
 * 3 personnes, D puis E ajoutés et synchronisés ⇒ l'hôte disait 7−5=2, le
 * panneau 2−2=0 « Plafond atteint ». Et tout état sauf `left` comptait comme
 * une place occupée : un refus n'était plus réinvitable.
 */

const p = (userId: string, state: CallParticipantState) => ({ userId, state })
const ids = (values: string[]) => new Set(values)

describe("projectCallSeats — l'exemple de l'audit", () => {
	it("applique le plafond fourni par le serveur et ferme une capacité invalide", () => {
		const input = { participants: [p("A", "host"), p("B", "connected")], optimistic: ids([]) }
		expect(projectCallSeats({ ...input, max: 100 }).remaining).toBe(98)
		expect(projectCallSeats({ ...input, max: 4 }).remaining).toBe(2)
		expect(projectCallSeats({ ...input, max: Number.NaN }).remaining).toBe(0)
	})

	it("3 personnes, D puis E ajoutés PUIS synchronisés ⇒ 2 places, pas 0", () => {
		const optimistic = ids(["D", "E"])
		// Avant la synchro : D et E ne sont que des optimismes.
		const before = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("B", "connected"), p("C", "connected")],
			optimistic,
		})
		expect(before.reserved).toBe(5)
		expect(before.remaining).toBe(2)
		expect(before.pendingOptimistic).toEqual(["D", "E"])
		expect(before.acknowledged).toEqual([])

		// Après : le serveur les porte — ils ne comptent qu'UNE fois.
		const after = projectCallSeats({ max: 7,
			participants: [
				p("A", "host"),
				p("B", "connected"),
				p("C", "connected"),
				p("D", "ringing"),
				p("E", "ringing"),
			],
			optimistic,
		})
		expect(after.reserved).toBe(5)
		expect(after.remaining).toBe(2)
		expect(after.acknowledged).toEqual(["D", "E"])
		expect(after.pendingOptimistic).toEqual([])
		expect([...after.reservedIds].sort()).toEqual(["A", "B", "C", "D", "E"])
	})

	it("un optimisme non acquitté compte une fois, et reste engagé", () => {
		const seats = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("B", "connected")],
			optimistic: ids(["D"]),
		})
		expect(seats.reserved).toBe(3)
		expect(seats.reservedIds.has("D")).toBe(true)
		expect(seats.pendingOptimistic).toEqual(["D"])
	})

	it("un optimisme que le serveur rend REFUSÉ est acquitté, et ne réserve pas", () => {
		const seats = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("D", "declined")],
			optimistic: ids(["D"]),
		})
		expect(seats.acknowledged).toEqual(["D"])
		expect(seats.reservedIds.has("D")).toBe(false)
		expect(seats.reserved).toBe(1)
	})

	it("RÉINVITER un refusé : l'optimisme tient tant que la projection répète « declined »", () => {
		// La projection porte DÉJÀ la personne — en « declined », d'AVANT la
		// réinvitation. L'acquitter là-dessus la rendrait libre alors que son
		// téléphone sonne : l'état connu au clic est ce qui départage.
		const optimistic = new Map([["D", "declined" as const]])
		const stale = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("D", "declined")],
			optimistic,
		})
		expect(stale.acknowledged).toEqual([])
		expect(stale.pendingOptimistic).toEqual(["D"])
		expect(stale.reserved).toBe(2)

		// Le serveur a vu la réinvitation : « ringing » ≠ « declined » ⇒ acquitté,
		// et réservé par LUI désormais — une seule fois.
		const fresh = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("D", "ringing")],
			optimistic,
		})
		expect(fresh.acknowledged).toEqual(["D"])
		expect(fresh.pendingOptimistic).toEqual([])
		expect(fresh.reserved).toBe(2)

		// Absente au clic (`null`), présente ensuite dans n'importe quel état :
		// acquittée aussi — un Set vaut « absente au clic ».
		const appeared = projectCallSeats({ max: 7,
			participants: [p("A", "host"), p("E", "declined")],
			optimistic: new Map([["E", null]]),
		})
		expect(appeared.acknowledged).toEqual(["E"])
	})
})

describe("projectCallSeats — qui réserve (même règle que le serveur)", () => {
	it("hôte, connecté et sonnerie réservent ; refus, manqué, indisponible, parti libèrent", () => {
		const seats = projectCallSeats({ max: 7,
			participants: [
				p("host", "host"),
				p("c", "connected"),
				p("r", "ringing"),
				p("d", "declined"),
				p("m", "missed"),
				p("u", "unavailable"),
				p("l", "left"),
			],
			optimistic: ids([]),
		})
		expect([...seats.reservedIds].sort()).toEqual(["c", "host", "r"])
		expect(seats.reserved).toBe(3)
		expect(seats.remaining).toBe(4)
		expect(seats.counts).toEqual({ connected: 2, ringing: 1, unreachable: 4 })
	})

	it("le plafond est 7 et le reste ne descend jamais sous zéro", () => {
		const full = projectCallSeats({ max: 7,
			participants: ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
				p(id, id === "a" ? "host" : "connected"),
			),
			optimistic: ids(["h", "i"]),
		})
		expect(full.reserved).toBe(9)
		expect(full.remaining).toBe(0)
		expect(full.max).toBe(7)
	})

	it("dédoublonne par identité", () => {
		const seats = projectCallSeats({ max: 7,
			participants: [p("a", "host"), p("b", "ringing"), p("b", "ringing")],
			optimistic: ids(["b"]),
		})
		expect(seats.reserved).toBe(2)
	})

	it("sans projection (tête-à-tête non promu) : repli sur les places présumées occupées", () => {
		const seats = projectCallSeats({ max: 7, participants: undefined, optimistic: ids([]) })
		expect(seats.hasProjection).toBe(false)
		expect(seats.reserved).toBe(2)
		expect(seats.remaining).toBe(5)

		const withOptimism = projectCallSeats({ max: 7,
			participants: undefined,
			optimistic: ids(["D"]),
			fallbackOccupied: 2,
		})
		expect(withOptimism.reserved).toBe(3)
		expect(withOptimism.remaining).toBe(4)
		expect(withOptimism.pendingOptimistic).toEqual(["D"])
	})

	it("un repli plus large (effectif annoncé par le slot) est respecté", () => {
		const seats = projectCallSeats({ max: 7,
			participants: undefined,
			optimistic: ids([]),
			fallbackOccupied: 5,
		})
		expect(seats.remaining).toBe(2)
	})
})

describe("describeCallSeats — « N personnes · M invitations en attente · K places disponibles »", () => {
	it("le contrat d'expérience du plan, mot pour mot", () => {
		const seats = projectCallSeats({ max: 7,
			participants: [
				p("a", "host"),
				p("b", "connected"),
				p("c", "connected"),
				p("d", "connected"),
				p("e", "ringing"),
				p("f", "ringing"),
			],
			optimistic: ids([]),
		})
		expect(describeCallSeats(seats, t)).toBe(
			"4 personnes · 2 invitations en attente · 1 place disponible",
		)
	})

	it("accorde singulier et pluriel, et compte les optimismes parmi les invitations", () => {
		expect(
			describeCallSeats(
				projectCallSeats({ max: 7,
					participants: [p("a", "host")],
					optimistic: ids(["x"]),
				}),
				t,
			),
		).toBe("1 personne · 1 invitation en attente · 5 places disponibles")
	})

	it("tait les invitations quand il n'y en a pas, et dit « complet » à zéro place", () => {
		expect(
			describeCallSeats(
				projectCallSeats({ max: 7,
					participants: [p("a", "host"), p("b", "connected")],
					optimistic: ids([]),
				}),
				t,
			),
		).toBe("2 personnes · 5 places disponibles")
		expect(
			describeCallSeats(
				projectCallSeats({ max: 7,
					participants: ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
						p(id, id === "a" ? "host" : "connected"),
					),
					optimistic: ids([]),
				}),
				t,
			),
		).toBe("7 personnes · complet (7 participants, vous compris)")
	})

	it("sans projection, ne prétend pas savoir qui est en ligne", () => {
		expect(
			describeCallSeats(projectCallSeats({ max: 7, participants: undefined, optimistic: ids([]) }), t),
		).toBe("5 places disponibles")
		expect(
			describeCallSeats(projectCallSeats({ max: 7, participants: undefined, optimistic: ids(["d"]) }), t),
		).toBe("1 invitation en attente · 4 places disponibles")
	})
})

describe("summarizeCallParticipants — la projection de l'en-tête", () => {
	it("rend les mêmes chiffres que projectCallSeats.counts", () => {
		const participants = [p("a", "host"), p("b", "ringing"), p("c", "left")]
		expect(summarizeCallParticipants(participants)).toEqual({
			connected: 1,
			ringing: 1,
			unreachable: 1,
		})
		expect(summarizeCallParticipants(participants)).toEqual(
			projectCallSeats({ max: 7, participants, optimistic: ids([]) }).counts,
		)
	})
})
