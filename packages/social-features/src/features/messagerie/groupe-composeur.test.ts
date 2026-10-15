// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-composeur.test.ts @ ad2e7fdc2 — adaptations : raison de refus lue par un `t` français (`createAppI18n`) ; bornes du contrat du moteur (plafond 256, plus « 21 avec le créateur ») ; cas neufs : bornes égales au contrat, raison anglaise, refus d'une photo de groupe (`refusPhotoDeGroupe`).
import {
	GROUP_MEMBERS_MAX,
	GROUP_MIN_OTHERS,
	GROUP_TITLE_MAX_LENGTH,
} from "@antia/social-contracts/groupCapacity"
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
	GROUPE_MAX_AUTRES,
	GROUPE_MAX_MEMBRES,
	GROUPE_MIN_AUTRES,
	GROUPE_PHOTO_ACCEPT,
	GROUPE_PHOTO_MAX_MO,
	GROUPE_TITRE_MAX,
	peutContinuer,
	peutEnvoyer,
	refusPhotoDeGroupe,
	toggleSelection,
	validerSelection,
} from "./groupe-composeur"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t

/**
 * Le composeur de groupe DÉCIDE ici — sélection, plafond, titre, envoi.
 * Les bornes sont celles du contrat que le serveur applique : si l'une bouge,
 * c'est CE fichier qui doit le faire remarquer en revue.
 */

describe("bornes — lues dans le contrat, jamais recopiées", () => {
	it("le plafond, le minimum et la longueur du titre sont ceux du serveur", () => {
		expect(GROUPE_MAX_MEMBRES).toBe(GROUP_MEMBERS_MAX)
		expect(GROUPE_MAX_AUTRES).toBe(GROUP_MEMBERS_MAX - 1)
		expect(GROUPE_MIN_AUTRES).toBe(GROUP_MIN_OTHERS)
		expect(GROUPE_TITRE_MAX).toBe(GROUP_TITLE_MAX_LENGTH)
	})
})

describe("toggleSelection — cocher, décocher, plafonner", () => {
	it("ajoute puis retire, dans l'ordre du choix", () => {
		let selection = toggleSelection([], "a")
		selection = toggleSelection(selection, "b")
		expect(selection).toEqual(["a", "b"])
		expect(toggleSelection(selection, "a")).toEqual(["b"])
	})

	it("au plafond, cocher de plus est un NON-geste : même référence", () => {
		const pleine = Array.from({ length: GROUPE_MAX_AUTRES }, (_, i) => `h${i}`)
		expect(toggleSelection(pleine, "de-trop")).toBe(pleine)
		// Décocher, en revanche, reste toujours possible.
		expect(toggleSelection(pleine, "h0")).toHaveLength(GROUPE_MAX_AUTRES - 1)
	})

	it("ignore un handle vide", () => {
		const selection = ["a"]
		expect(toggleSelection(selection, "")).toBe(selection)
	})
})

describe("validerSelection — la raison est une phrase montrable", () => {
	it("refuse en deçà de deux personnes : à deux, le 1:1 existe déjà", () => {
		expect(validerSelection([], t).ok).toBe(false)
		expect(validerSelection(["a"], t).ok).toBe(false)
		const verdict = validerSelection(["a"], t)
		if (!verdict.ok) expect(verdict.raison).toContain("au moins 2")
	})

	it("accepte de deux personnes jusqu'au plafond, créateur compris", () => {
		expect(validerSelection(["a", "b"], t).ok).toBe(true)
		const pleine = Array.from({ length: GROUPE_MAX_AUTRES }, (_, i) => `h${i}`)
		expect(validerSelection(pleine, t).ok).toBe(true)
	})

	it("refuse au-delà du plafond, en nommant le plafond RÉEL", () => {
		const trop = Array.from(
			{ length: GROUPE_MAX_AUTRES + 1 },
			(_, i) => `h${i}`,
		)
		const verdict = validerSelection(trop, t)
		expect(verdict.ok).toBe(false)
		if (!verdict.ok) expect(verdict.raison).toContain(String(GROUPE_MAX_MEMBRES))
	})

	it("ne compte pas double un état restauré qui doublerait", () => {
		expect(validerSelection(["a", "a"], t).ok).toBe(false)
	})

	it("dit la raison dans la langue de l'écran", () => {
		const verdict = validerSelection(["a"], tEn)
		if (!verdict.ok) expect(verdict.raison).toContain("at least 2")
		expect(verdict.ok).toBe(false)
	})
})

describe("peutContinuer — l'étape participants ne dépend pas du titre", () => {
	it("reste bloqué sous deux autres personnes", () => {
		expect(peutContinuer([])).toBe(false)
		expect(peutContinuer(["a"])).toBe(false)
	})

	it("avance de deux autres personnes jusqu'au plafond", () => {
		expect(peutContinuer(["a", "b"])).toBe(true)
		const pleine = Array.from({ length: GROUPE_MAX_AUTRES }, (_, i) => `h${i}`)
		expect(peutContinuer(pleine)).toBe(true)
	})
})

describe("peutEnvoyer — titre explicite ET sélection valable", () => {
	it("part avec un titre et deux personnes", () => {
		expect(peutEnvoyer("Budget 2026", ["a", "b"])).toBe(true)
	})

	it("ne part jamais sans titre effectif", () => {
		expect(peutEnvoyer("", ["a", "b"])).toBe(false)
		expect(peutEnvoyer("   ", ["a", "b"])).toBe(false)
	})

	it("ne déduit jamais le titre des participants", () => {
		const participants = ["alice", "bob"]
		expect(peutEnvoyer("", participants)).toBe(false)
		expect(peutEnvoyer("Comité budget 2026", participants)).toBe(true)
	})

	it("ne part jamais avec un titre au-delà de la borne serveur", () => {
		expect(peutEnvoyer("T".repeat(GROUPE_TITRE_MAX + 1), ["a", "b"])).toBe(
			false,
		)
		expect(peutEnvoyer("T".repeat(GROUPE_TITRE_MAX), ["a", "b"])).toBe(true)
	})

	it("ne part jamais avec une sélection invalide", () => {
		expect(peutEnvoyer("Titre", ["a"])).toBe(false)
	})
})

describe("refusPhotoDeGroupe — le refus nomme la photo de GROUPE", () => {
	const photo = (type: string, octets: number) =>
		new Blob([new Uint8Array(octets)], { type })

	it("accepte JPEG, PNG et WebP sous le poids maximal", () => {
		for (const type of GROUPE_PHOTO_ACCEPT.split(",")) {
			expect(refusPhotoDeGroupe(photo(type, 1024), t)).toBeNull()
		}
	})

	it("refuse un autre format, sans parler de photo de profil", () => {
		const refus = refusPhotoDeGroupe(photo("image/gif", 1024), t)
		expect(refus).toBe("Formats acceptés : JPEG, PNG ou WebP.")
	})

	it("refuse une photo trop lourde en nommant la photo de groupe et sa borne", () => {
		const refus = refusPhotoDeGroupe(
			photo("image/png", GROUPE_PHOTO_MAX_MO * 1024 * 1024 + 1),
			t,
		)
		expect(refus).toBe(
			`Une photo de groupe est limitée à ${GROUPE_PHOTO_MAX_MO} Mo.`,
		)
	})
})
