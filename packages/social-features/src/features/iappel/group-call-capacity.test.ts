// Dupliqué de socle/packages/agent-features/src/features/iappel/group-call-capacity.test.ts @ ad2e7fdc2 — adaptations : plafonds lus dans les contrats du moteur ; compteur lu dans les locales françaises du moteur (`t` réel) — attendus inchangés ; cas retirés : exemption d'un compte d'administration (plafond de mille, compteur sans dénominateur) — aucun compte « illimité » dans le moteur ; cas ajouté : le compteur en anglais.
import { describe, expect, it } from "vitest"

import { GROUP_CALL_MIN_OTHERS } from "@antia/social-contracts/callGroup"
import { GROUP_CALL_DEFAULT_MAX_PARTICIPANTS } from "@antia/social-contracts/groupCapacity"

import { createAppI18n } from "../../i18n"
import {
	correspondentsCounter,
	effectiveCapacity,
	isSelectionComplete,
	maxCorrespondents,
} from "./group-call-capacity"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" })
const t = i18n.getFixedT("fr")

describe("effectiveCapacity — le serveur d'abord, le défaut sinon", () => {
	it("prend la valeur servie, entière", () => {
		expect(effectiveCapacity(5)).toBe(5)
		expect(effectiveCapacity(1000)).toBe(1000)
		expect(effectiveCapacity(9.7)).toBe(9)
	})

	it("replie sur le DÉFAUT", () => {
		// Une composition que le serveur refuse perd le geste entier.
		expect(effectiveCapacity(undefined)).toBe(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS)
		expect(effectiveCapacity(null)).toBe(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS)
		expect(effectiveCapacity(0)).toBe(GROUP_CALL_DEFAULT_MAX_PARTICIPANTS)
	})
})

describe("maxCorrespondents — le plafond moins l'appelant", () => {
	it("vaut dix par défaut (ADR-0149)", () => {
		expect(maxCorrespondents()).toBe(10)
		expect(maxCorrespondents(11)).toBe(10)
	})

	it("suit un appel posé plus petit", () => {
		expect(maxCorrespondents(5)).toBe(4)
	})

	it("ne descend jamais sous le minimum d'un appel de groupe", () => {
		expect(maxCorrespondents(1)).toBe(GROUP_CALL_MIN_OTHERS)
		expect(maxCorrespondents(2)).toBe(GROUP_CALL_MIN_OTHERS)
	})
})

describe("correspondentsCounter — une seule phrase pour tout le réseau", () => {
	it("compte les cochés sur le plafond de l'appel", () => {
		expect(correspondentsCounter(0, undefined, t)).toBe("0/10 correspondants")
		expect(correspondentsCounter(3, undefined, t)).toBe("3/10 correspondants")
		expect(correspondentsCounter(9, 11, t)).toBe("9/10 correspondants")
	})

	it("au plafond, dit « complet » ET le total, vous compris", () => {
		expect(correspondentsCounter(10, undefined, t)).toBe(
			"10/10 correspondants — appel complet (11 en tout, vous compris)",
		)
		expect(correspondentsCounter(4, 5, t)).toBe(
			"4/4 correspondants — appel complet (5 en tout, vous compris)",
		)
	})

	it("ne dépasse jamais le plafond — une sélection périmée se lit « complet »", () => {
		expect(correspondentsCounter(50, 7, t)).toBe(
			"6/6 correspondants — appel complet (7 en tout, vous compris)",
		)
	})

	it("se dit aussi en anglais, mêmes chiffres", () => {
		const en = i18n.getFixedT("en")
		expect(correspondentsCounter(3, undefined, en)).toBe("3/10 people")
		expect(correspondentsCounter(10, undefined, en)).toBe("10/10 people — call full (11 in all, including you)")
	})
})

describe("isSelectionComplete", () => {
	it("bascule à la dernière case cochable", () => {
		expect(isSelectionComplete(9)).toBe(false)
		expect(isSelectionComplete(10)).toBe(true)
		expect(isSelectionComplete(4, 5)).toBe(true)
	})
})
