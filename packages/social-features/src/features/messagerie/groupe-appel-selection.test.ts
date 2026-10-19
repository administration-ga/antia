// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-appel-selection.test.ts @ ad2e7fdc2 — adaptations : phrases lues par un `t` français (`createAppI18n`, `t` en dernier paramètre de `selectionHint` et `selectionBlockReason`) ; cas « compte EXEMPTÉ » retiré avec l'exemption (aucun compte « illimité » dans le moteur, plafond constant) ; « organisation » et « compte d'administration » du socle deviennent un plafond passé en paramètre (le calcul est le même) ; cas neuf : le plafond par défaut est la constante du contrat.
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
	canStartGroupCall,
	GROUP_CALL_MIN_OTHERS,
	invalidInvitees,
	maxInvitees,
	needsInviteeSelection,
	selectionBlockReason,
	selectionHint,
	toggleInvitee,
} from "./groupe-appel-selection"
import { GROUP_CALL_MAX_PARTICIPANTS } from "@antsia/social-contracts/callGroup"
import { correspondentsCounter } from "../iappel/group-call-capacity"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t

/**
 * Un appel de groupe s'arrête à onze personnes, appelant compris (plafond
 * CONSTANT du moteur) ; au-delà, c'est une conférence. Le sélecteur du fil
 * DÉLÈGUE son compte et sa phrase au module partagé
 * (`iappel/group-call-capacity.ts`) : ces tests tiennent la délégation, pas
 * une seconde copie de la règle.
 */

describe("needsInviteeSelection — un fil plus grand qu'un appel", () => {
	it("le défaut est onze, appelant compris", () => {
		expect(GROUP_CALL_MAX_PARTICIPANTS).toBe(11)
	})

	it("sous le plafond, on appelle d'un bloc", () => {
		expect(needsInviteeSelection({ memberCount: 5 })).toBe(false)
		expect(
			needsInviteeSelection({ memberCount: GROUP_CALL_MAX_PARTICIPANTS }),
		).toBe(false)
	})

	it("au-dessus, il faut choisir", () => {
		expect(
			needsInviteeSelection({ memberCount: GROUP_CALL_MAX_PARTICIPANTS + 1 }),
		).toBe(true)
		expect(needsInviteeSelection({ memberCount: 25, capacity: 11 })).toBe(true)
	})

	it("le plafond passé l'emporte sur la constante", () => {
		// Un plafond plus haut ne force pas le sélecteur…
		expect(
			needsInviteeSelection({ memberCount: 150, capacity: 1000 }),
		).toBe(false)
		// …et un plafond plus bas le fait apparaître plus tôt.
		expect(needsInviteeSelection({ memberCount: 6, capacity: 5 })).toBe(true)
	})

	it("sans plafond passé, c'est la constante du moteur qui décide", () => {
		expect(needsInviteeSelection({ memberCount: 12, capacity: null })).toBe(true)
		expect(needsInviteeSelection({ memberCount: 11, capacity: null })).toBe(false)
	})

	it("sans effectif connu, on ne conclut rien", () => {
		expect(needsInviteeSelection({ memberCount: undefined })).toBe(false)
		expect(needsInviteeSelection({ memberCount: null })).toBe(false)
	})
})

describe("toggleInvitee — le plafond se tient à la coche", () => {
	it("coche, décoche", () => {
		const vide = new Set<string>()
		const un = toggleInvitee(vide, "a", 3)
		expect([...un]).toEqual(["a"])
		expect([...toggleInvitee(un, "a", 3)]).toEqual([])
	})

	it("au plafond, un clic de plus ne PERD pas la sélection", () => {
		const trois = new Set(["a", "b", "c"])
		const apres = toggleInvitee(trois, "d", 3)
		expect(apres).toBe(trois)
		// Et on peut toujours décocher pour faire de la place.
		expect([...toggleInvitee(apres, "b", 3)]).toEqual(["a", "c"])
	})

	it("le plafond par défaut vaut dix correspondants — onze moins l'appelant", () => {
		expect(maxInvitees()).toBe(10)
		expect(maxInvitees(GROUP_CALL_MAX_PARTICIPANTS)).toBe(
			GROUP_CALL_MAX_PARTICIPANTS - 1,
		)
		expect(maxInvitees(5)).toBe(4)
		// Jamais sous le minimum d'un appel de groupe : un plafond absurde ne
		// doit pas rendre l'écran inutilisable.
		expect(maxInvitees(1)).toBe(GROUP_CALL_MIN_OTHERS)
	})
})

describe("selectionHint — LA phrase du sélecteur", () => {
	it("« x/10 correspondants » tant qu'il reste de la place", () => {
		expect(selectionHint(0, undefined, t)).toBe("0/10 correspondants")
		expect(selectionHint(3, 11, t)).toBe("3/10 correspondants")
		// Un plafond de cinq : « x/4 » (fiche §8, cas transverses).
		expect(selectionHint(2, 5, t)).toBe("2/4 correspondants")
	})

	it("au plafond, la phrase dit ce qui est composé ET pourquoi", () => {
		expect(selectionHint(10, 11, t)).toBe(
			"10/10 correspondants — appel complet (11 en tout, vous compris)",
		)
	})

	it("ne dépasse jamais le plafond, et n'est pas une seconde copie", () => {
		expect(selectionHint(50, 11, t)).toContain("appel complet")
		for (const [count, capacity] of [
			[0, 11],
			[4, 11],
			[10, 11],
			[3, 5],
		] as const) {
			expect(selectionHint(count, capacity, t)).toBe(
				correspondentsCounter(count, capacity, t),
			)
		}
	})
})

describe("invalidInvitees — la liste a pu vieillir", () => {
	it("nomme ceux qui ne sont plus membres", () => {
		expect(invalidInvitees(new Set(["a", "b"]), ["a"])).toEqual(["b"])
		expect(invalidInvitees(new Set(["a"]), ["a", "b"])).toEqual([])
	})
})

describe("canStartGroupCall / selectionBlockReason", () => {
	it("à une seule, ce n'est pas un appel de groupe", () => {
		expect(canStartGroupCall({ count: 1 })).toBe(false)
		expect(selectionBlockReason({ count: 1 }, t)).toContain("au moins 2")
	})

	it("à deux, c'est bon, et rien ne s'affiche", () => {
		expect(canStartGroupCall({ count: 2 })).toBe(true)
		expect(selectionBlockReason({ count: 2 }, t)).toBeNull()
	})

	it("à dix correspondants, l'appel est encore composable", () => {
		expect(canStartGroupCall({ count: 10, capacity: 11 })).toBe(true)
		expect(selectionBlockReason({ count: 10, capacity: 11 }, t)).toBeNull()
	})

	it("au-delà du plafond, la phrase dit le plafond", () => {
		expect(canStartGroupCall({ count: 11, capacity: 11 })).toBe(false)
		expect(selectionBlockReason({ count: 11, capacity: 11 }, t)).toBe(
			"Un appel s'arrête à 11 participants, vous compris.",
		)
	})
})
