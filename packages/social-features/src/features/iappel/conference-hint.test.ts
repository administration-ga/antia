// Dupliqué de socle/packages/agent-features/src/features/iappel/conference-hint.test.ts @ ad2e7fdc2 — adaptations : textes lus dans les locales françaises du moteur (`t` réel) — attendus inchangés ; cas retirés : comptes exemptés (T1, T2, T3 — aucun compte « illimité » dans le moteur) et audience d'équipe de poste (« toute l'équipe »).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { conferenceHintCopy, planConferenceHint } from "./conference-hint"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

describe("planConferenceHint — T1, avant l'appel", () => {
	it("s'affiche quand le fil dépasse le plafond de l'appel", () => {
		expect(
			planConferenceHint({ moment: "before", members: 25, capacity: 11 }),
		).toEqual({ kind: "T1" })
	})

	it("ne s'affiche pas quand le fil tient dans l'appel — huit s'appelle d'un bloc", () => {
		expect(planConferenceHint({ moment: "before", members: 8, capacity: 11 })).toBeNull()
		expect(planConferenceHint({ moment: "before", members: 11, capacity: 11 })).toBeNull()
	})

	it("sans effectif connu, on ne conclut rien", () => {
		expect(planConferenceHint({ moment: "before", members: null, capacity: 11 })).toBeNull()
		expect(planConferenceHint({ moment: "before", capacity: 11 })).toBeNull()
	})

	it("ne revient pas une fois fermée", () => {
		expect(
			planConferenceHint({
				moment: "before",
				members: 25,
				capacity: 11,
				dismissed: new Set(["T1"]),
			}),
		).toBeNull()
	})
})

describe("planConferenceHint — T2, la dernière case cochable", () => {
	it("apparaît au dixième correspondant coché, pas avant", () => {
		expect(planConferenceHint({ moment: "picking", picked: 9, capacity: 11 })).toBeNull()
		expect(planConferenceHint({ moment: "picking", picked: 10, capacity: 11 })).toEqual({
			kind: "T2",
		})
	})

	it("suit le plafond de l'appel — un appel posé à cinq", () => {
		expect(planConferenceHint({ moment: "picking", picked: 3, capacity: 5 })).toBeNull()
		expect(planConferenceHint({ moment: "picking", picked: 4, capacity: 5 })).toEqual({
			kind: "T2",
		})
	})

	it("une seule fois par ouverture : fermée, elle ne revient pas", () => {
		expect(
			planConferenceHint({
				moment: "picking",
				picked: 10,
				capacity: 11,
				dismissed: new Set(["T2"]),
			}),
		).toBeNull()
	})

})

describe("planConferenceHint — T3, en cours d'appel", () => {
	it("apparaît quand il ne reste aucun siège, et disparaît dès qu'un se libère", () => {
		expect(planConferenceHint({ moment: "in_call", seats: 0, capacity: 11 })).toEqual({
			kind: "T3",
		})
		expect(planConferenceHint({ moment: "in_call", seats: 1, capacity: 11 })).toBeNull()
	})

	it("ne se ferme pas — c'est un état, pas un avis", () => {
		expect(
			planConferenceHint({
				moment: "in_call",
				seats: 0,
				capacity: 11,
				dismissed: new Set(["T3"]),
			}),
		).toEqual({ kind: "T3" })
	})

	it("sans projection des places, rien", () => {
		expect(planConferenceHint({ moment: "in_call", seats: null, capacity: 11 })).toBeNull()
		expect(planConferenceHint({ moment: "in_call", capacity: 11 })).toBeNull()
	})
})

describe("conferenceHintCopy — les textes de la fiche, chiffres de l'appel", () => {
	it("T1 nomme le fil, le plafond et la sortie", () => {
		const copy = conferenceHintCopy("T1", { capacity: 11, members: 25 }, t)
		expect(copy.title).toBe("Ce groupe compte 25 membres.")
		expect(copy.body).toBe(
			"Un appel de groupe réunit 11 personnes au plus, vous compris. Choisissez jusqu'à 10 correspondants, ou réunissez tout le groupe en conférence.",
		)
		expect(copy.primary).toBe("Choisir 10 personnes")
		expect(copy.secondary).toBe("Lancer une conférence")
	})

	it("T2 dit « complet » et propose la conférence sans bloquer", () => {
		const copy = conferenceHintCopy("T2", { capacity: 11 }, t)
		expect(copy.title).toBe("10 correspondants — l'appel est complet.")
		expect(copy.body).toBe(
			"Pour parler à plus de monde en même temps, la conférence accueille tout le groupe.",
		)
		expect(copy.primary).toBe("Lancer une conférence")
		expect(copy.secondary).toBe("Continuer l'appel")
	})

	it("T3 est une ligne : un titre, une phrase, un seul lien", () => {
		const copy = conferenceHintCopy("T3", { capacity: 11 }, t)
		expect(copy.title).toBe("Appel complet · 11 personnes.")
		expect(copy.body).toBe("Pour réunir plus de monde, lancez une conférence.")
		expect(copy.primary).toBe("Lancer une conférence")
		expect(copy.secondary).toBeNull()
	})

	it("le chiffre est celui de l'APPEL, jamais la constante", () => {
		const copy = conferenceHintCopy("T1", { capacity: 5, members: 9 }, t)
		expect(copy.body).toContain("5 personnes au plus")
		expect(copy.body).toContain("jusqu'à 4 correspondants")
		expect(copy.primary).toBe("Choisir 4 personnes")
		expect(conferenceHintCopy("T3", { capacity: 5 }, t).title).toBe(
			"Appel complet · 5 personnes.",
		)
	})
})
