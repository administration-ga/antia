// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/feed-scopes.test.ts @ ad2e7fdc2 — adaptations : deux portées (celles du domaine du moteur), la portée « mon_administration » retirée — ses cas deviennent « une ancienne adresse retombe sur la portée par défaut » ; libellés lus par un `t` français (les chips portent des clés) ; cas ajoutés : la liste vient du domaine, une graphie héritée (`toString`) ne trouve rien.
import { FEED_SCOPES } from "@antsia/social-domain/content"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	chipsVisibleFor,
	FEED_SCOPE_CHIPS,
	FEED_SCOPE_DEFAULT,
	FEED_SCOPE_IDS,
	feedScopeArg,
	feedScopeById,
	parseFeedScope,
} from "./feed-scopes"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

describe("FEED_SCOPE_CHIPS", () => {
	it("porte EXACTEMENT les deux portées, dans l'ordre du rendu", () => {
		expect(FEED_SCOPE_CHIPS.map((c) => c.id)).toEqual(["pour_vous", "recents"])
		// La table et la liste d'identifiants ne peuvent pas diverger : deux
		// sources donneraient une chip rendue sans être adressable, ou l'inverse.
		expect(FEED_SCOPE_CHIPS.map((c) => c.id)).toEqual([...FEED_SCOPE_IDS])
	})

	it("ne recopie pas les portées : ce sont celles du domaine", () => {
		expect([...FEED_SCOPE_IDS]).toEqual([...FEED_SCOPES])
	})

	it("décrit chaque portée — « Récents » ne dit pas de quoi", () => {
		for (const chip of FEED_SCOPE_CHIPS) {
			const label = t(chip.labelKey)
			const description = t(chip.descriptionKey)
			expect(label.length).toBeGreaterThan(0)
			expect(description.length).toBeGreaterThan(0)
			// Une clé absente se rendrait elle-même : le libellé serait la clé.
			expect(label).not.toBe(chip.labelKey.replace(/^reseau:/, ""))
			expect(description).not.toBe(chip.descriptionKey.replace(/^reseau:/, ""))
		}
		expect(t(feedScopeById("pour_vous").labelKey)).toBe("Pour vous")
		expect(t(feedScopeById("recents").labelKey)).toBe("Récents")
	})

	it("s'ouvre sur « Pour vous » — le fil d'avant les chips", () => {
		expect(FEED_SCOPE_DEFAULT).toBe("pour_vous")
		expect(parseFeedScope(null)).toBe("pour_vous")
		expect(parseFeedScope(undefined)).toBe("pour_vous")
		expect(parseFeedScope("")).toBe("pour_vous")
		expect(parseFeedScope("   ")).toBe("pour_vous")
	})
})

describe("parseFeedScope", () => {
	it("accepte ses propres identifiants, quelle que soit la casse", () => {
		for (const id of FEED_SCOPE_IDS) {
			expect(parseFeedScope(id)).toBe(id)
			expect(parseFeedScope(id.toUpperCase())).toBe(id)
			expect(parseFeedScope(`  ${id} `)).toBe(id)
		}
	})

	it("fait aboutir les synonymes plausibles d'un lien recopié", () => {
		expect(parseFeedScope("pour-vous")).toBe("pour_vous")
		expect(parseFeedScope("pourvous")).toBe("pour_vous")
		expect(parseFeedScope("foryou")).toBe("pour_vous")
		expect(parseFeedScope("recent")).toBe("recents")
	})

	it("une adresse de l'ancienne portée « Mon administration » retombe sur le défaut", () => {
		// La portée n'existe pas dans le moteur : le lien s'ouvre, sur le fil par défaut.
		expect(parseFeedScope("mon_administration")).toBe(FEED_SCOPE_DEFAULT)
		expect(parseFeedScope("mon-administration")).toBe(FEED_SCOPE_DEFAULT)
		expect(parseFeedScope("collegues")).toBe(FEED_SCOPE_DEFAULT)
	})

	it("ne fabrique jamais une portée morte", () => {
		expect(parseFeedScope("n-importe-quoi")).toBe(FEED_SCOPE_DEFAULT)
		// Une propriété héritée de l'objet des alias n'est pas une portée.
		expect(parseFeedScope("toString")).toBe(FEED_SCOPE_DEFAULT)
		expect(parseFeedScope("constructor")).toBe(FEED_SCOPE_DEFAULT)
		for (const raw of ["", "x", "POUR_VOUS", "?", "../admin"]) {
			expect(() => feedScopeById(parseFeedScope(raw))).not.toThrow()
		}
	})
})

describe("feedScopeArg", () => {
	it("rend `undefined` pour la portée par défaut", () => {
		// La query garde ainsi EXACTEMENT la signature qu'elle avait avant les
		// chips : un fil par défaut n'envoie pas d'argument de portée.
		expect(feedScopeArg("pour_vous")).toBeUndefined()
	})

	it("rend la portée telle quelle pour l'autre", () => {
		expect(feedScopeArg("recents")).toBe("recents")
	})
})

describe("chipsVisibleFor", () => {
	it("montre les chips dans le fil non filtré, et nulle part ailleurs", () => {
		expect(chipsVisibleFor("fil", { kind: "feed" })).toBe(true)
		// Les autres volets ne portent pas de fil à recomposer.
		expect(chipsVisibleFor("relations", { kind: "feed" })).toBe(false)
		expect(chipsVisibleFor("enregistrements", { kind: "feed" })).toBe(false)
	})

	it("les cache dès qu'une vue REMPLACE le fil", () => {
		// Filtrer un filtre n'a pas de sens, et le bouton de retour de la vue en
		// cours ramène au fil ENTIER — pas à la chip qu'on croyait active.
		expect(chipsVisibleFor("fil", { kind: "tag", tag: "numerique" })).toBe(false)
		expect(chipsVisibleFor("fil", { kind: "search", query: "budget" })).toBe(false)
		expect(chipsVisibleFor("fil", { kind: "post", postId: "abc" })).toBe(false)
	})
})
