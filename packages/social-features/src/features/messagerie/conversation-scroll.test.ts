// Dupliqué de socle/packages/agent-features/src/features/messagerie/conversation-scroll.test.ts @ ad2e7fdc2 — adaptations : `newMessagesLabel` reçoit la traduction française du moteur (`t` en dernier paramètre) — les libellés attendus restent le texte exact du socle ; un cas ajouté : l'accord suit la langue (anglais).
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
	croissanceDuFil,
	initialScrollState,
	isNearBottom,
	NEAR_BOTTOM_PX,
	newMessagesLabel as newMessagesLabelT,
	reduceOnMessages,
} from "./conversation-scroll"

const fr = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")
const en = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("en")

/** Le libellé tel que l'écran français le rend. */
function newMessagesLabel(count: number): string {
	return newMessagesLabelT(count, fr)
}

describe("isNearBottom", () => {
	it("dit vrai quand on est exactement en bas", () => {
		expect(
			isNearBottom({ scrollTop: 400, scrollHeight: 1000, clientHeight: 600 }),
		).toBe(true)
	})

	it("tolère la marge d'un fil qui vient de grandir de quelques pixels", () => {
		expect(
			isNearBottom({
				scrollTop: 400 - NEAR_BOTTOM_PX,
				scrollHeight: 1000,
				clientHeight: 600,
			}),
		).toBe(true)
	})

	it("dit faux quand on a remonté au-delà de la marge", () => {
		expect(
			isNearBottom({ scrollTop: 100, scrollHeight: 1000, clientHeight: 600 }),
		).toBe(false)
	})

	it("accepte une tolérance sur mesure", () => {
		expect(
			isNearBottom(
				{ scrollTop: 390, scrollHeight: 1000, clientHeight: 600 },
				5,
			),
		).toBe(false)
	})

	it("répond vrai sur des mesures non finies plutôt que de décrocher", () => {
		expect(
			isNearBottom({
				scrollTop: Number.NaN,
				scrollHeight: 1000,
				clientHeight: 600,
			}),
		).toBe(true)
	})
})

describe("reduceOnMessages — le défilement de l'utilisateur", () => {
	it("part épinglé, sans rien en attente", () => {
		expect(initialScrollState()).toEqual({ pinned: true, unseen: 0 })
	})

	it("décroche quand on remonte", () => {
		const next = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		expect(next.pinned).toBe(false)
	})

	it("se ré-épingle et éteint la pastille quand on revient au bas", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, { kind: "messages", added: 3, fromMe: false })
		expect(state.unseen).toBe(3)
		state = reduceOnMessages(state, { kind: "scroll", nearBottom: true })
		expect(state).toEqual({ pinned: true, unseen: 0 })
	})

	it("rend LA MÊME référence quand rien ne change", () => {
		const state = initialScrollState()
		expect(reduceOnMessages(state, { kind: "scroll", nearBottom: true })).toBe(
			state,
		)
		expect(reduceOnMessages(state, { kind: "jump" })).toBe(state)
	})

	it("rend la même référence sur un second décrochage", () => {
		const decroche = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		expect(
			reduceOnMessages(decroche, { kind: "scroll", nearBottom: false }),
		).toBe(decroche)
	})
})

describe("reduceOnMessages — les arrivées", () => {
	it("n'accumule RIEN tant que le fil suit le bas", () => {
		const state = reduceOnMessages(initialScrollState(), {
			kind: "messages",
			added: 5,
			fromMe: false,
		})
		expect(state).toEqual({ pinned: true, unseen: 0 })
	})

	it("accumule les arrivées quand on lit plus haut", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, { kind: "messages", added: 2, fromMe: false })
		state = reduceOnMessages(state, { kind: "messages", added: 1, fromMe: false })
		expect(state).toEqual({ pinned: false, unseen: 3 })
	})

	it("MON message ré-épingle, où qu'on soit dans le fil", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, { kind: "messages", added: 4, fromMe: false })
		state = reduceOnMessages(state, { kind: "messages", added: 1, fromMe: true })
		expect(state).toEqual({ pinned: true, unseen: 0 })
	})

	it("ignore un décompte négatif — une liste qui rétrécit n'ajoute rien", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, { kind: "messages", added: -3, fromMe: false })
		expect(state.unseen).toBe(0)
	})

	it("ignore un décompte non fini", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, {
			kind: "messages",
			added: Number.NaN,
			fromMe: false,
		})
		expect(state.unseen).toBe(0)
	})

	it("le saut au bas éteint la pastille", () => {
		let state = reduceOnMessages(initialScrollState(), {
			kind: "scroll",
			nearBottom: false,
		})
		state = reduceOnMessages(state, { kind: "messages", added: 7, fromMe: false })
		state = reduceOnMessages(state, { kind: "jump" })
		expect(state).toEqual({ pinned: true, unseen: 0 })
	})
})

describe("newMessagesLabel", () => {
	it("rend une chaîne VIDE à zéro — la pastille ne se rend pas", () => {
		expect(newMessagesLabel(0)).toBe("")
		expect(newMessagesLabel(-2)).toBe("")
	})

	it("accorde le singulier", () => {
		expect(newMessagesLabel(1)).toBe("1 nouveau message")
	})

	it("accorde le pluriel", () => {
		expect(newMessagesLabel(4)).toBe("4 nouveaux messages")
	})

	it("plafonne au-delà de 99", () => {
		expect(newMessagesLabel(140)).toBe("99+ nouveaux messages")
		expect(newMessagesLabel(99)).toBe("99 nouveaux messages")
	})

	it("accorde dans la langue de l'écran", () => {
		expect(newMessagesLabelT(1, en)).toBe("1 new message")
		expect(newMessagesLabelT(4, en)).toBe("4 new messages")
		expect(newMessagesLabelT(0, en)).toBe("")
	})
})

describe("croissanceDuFil — le passé chargé n'est pas une arrivée", () => {
	it("compte une arrivée quand le DERNIER message change", () => {
		expect(
			croissanceDuFil({
				totalAvant: 50,
				totalApres: 51,
				dernierIdAvant: "m50",
				dernierIdApres: "m51",
			}),
		).toEqual({ enBas: 1, enHaut: 0 })
	})

	it("compte du PASSÉ quand le dernier message est intact", () => {
		// Le défaut qu'on évite : « 50 nouveaux messages » annoncés pour des
		// anciens qu'on vient soi-même de demander, le fil restant dépinglé.
		expect(
			croissanceDuFil({
				totalAvant: 50,
				totalApres: 100,
				dernierIdAvant: "m50",
				dernierIdApres: "m50",
			}),
		).toEqual({ enBas: 0, enHaut: 50 })
	})

	it("l'OUVERTURE d'un fil compte comme une arrivée — sinon elle s'ouvre en haut", () => {
		expect(
			croissanceDuFil({
				totalAvant: 0,
				totalApres: 50,
				dernierIdAvant: null,
				dernierIdApres: "m50",
			}),
		).toEqual({ enBas: 50, enHaut: 0 })
	})

	it("ne compte rien quand le fil ne grandit pas, ou rétrécit", () => {
		for (const [avant, apres] of [
			[50, 50],
			[50, 49],
		] as const) {
			expect(
				croissanceDuFil({
					totalAvant: avant,
					totalApres: apres,
					dernierIdAvant: "m50",
					dernierIdApres: "m50",
				}),
			).toEqual({ enBas: 0, enHaut: 0 })
		}
	})

	it("le cas mixte penche vers l'ARRIVÉE — manquer un message est pire", () => {
		expect(
			croissanceDuFil({
				totalAvant: 50,
				totalApres: 101,
				dernierIdAvant: "m50",
				dernierIdApres: "m51",
			}),
		).toEqual({ enBas: 51, enHaut: 0 })
	})
})
