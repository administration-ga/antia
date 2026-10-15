// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/mobile-shell.test.ts @ ad2e7fdc2 — adaptations : l'accord avec le seuil du dock de messagerie se vérifie dans `@antia/social-features` (un paquet d'interface n'importe pas les surfaces) ; la barre basse se lit sur `MOBILE_ONLY_CLASS` au lieu de `personal-nav` (coque de l'espace agent, non reprise).
import { describe, expect, it } from "vitest"
import { MOBILE_ONLY_CLASS } from "./breakpoint"
import {
	isReseauMobileWidth,
	RESEAU_MOBILE_MAX_PX,
	RESEAU_MOBILE_QUERY,
	resolveMobileViewport,
} from "./mobile-shell"

describe("mobile-shell — le seuil est un complément, pas un chiffre rond", () => {
	it("se raccorde au seuil de la barre basse personnelle (960 px)", () => {
		// `min-[960px]:hidden` masque la barre À PARTIR de 960 : la coquille
		// mobile doit donc servir jusqu'à 959 inclus, sans trou ni recouvrement.
		expect(MOBILE_ONLY_CLASS).toBe("min-[960px]:hidden")
		expect(RESEAU_MOBILE_MAX_PX + 1).toBe(960)
	})

	it("compose sa requête média à partir du seuil, jamais en le recopiant", () => {
		expect(RESEAU_MOBILE_QUERY).toBe(`(max-width: ${RESEAU_MOBILE_MAX_PX}px)`)
		expect(RESEAU_MOBILE_QUERY).toBe("(max-width: 959px)")
	})
})

describe("mobile-shell — isReseauMobileWidth", () => {
	it("sert les largeurs de téléphone et de tablette portrait", () => {
		expect(isReseauMobileWidth(320)).toBe(true)
		expect(isReseauMobileWidth(375)).toBe(true)
		expect(isReseauMobileWidth(430)).toBe(true)
		expect(isReseauMobileWidth(768)).toBe(true)
	})

	it("sert la borne haute et refuse le pixel suivant", () => {
		expect(isReseauMobileWidth(RESEAU_MOBILE_MAX_PX)).toBe(true)
		expect(isReseauMobileWidth(RESEAU_MOBILE_MAX_PX + 1)).toBe(false)
	})

	it("refuse les largeurs de poste de travail", () => {
		expect(isReseauMobileWidth(1024)).toBe(false)
		expect(isReseauMobileWidth(1440)).toBe(false)
		expect(isReseauMobileWidth(2560)).toBe(false)
	})

	it("refuse une largeur NON MESURÉE plutôt que de la lire comme étroite", () => {
		expect(isReseauMobileWidth(0)).toBe(false)
		expect(isReseauMobileWidth(-1)).toBe(false)
		expect(isReseauMobileWidth(Number.NaN)).toBe(false)
		expect(isReseauMobileWidth(Number.POSITIVE_INFINITY)).toBe(false)
	})
})

describe("mobile-shell — resolveMobileViewport", () => {
	it("rend `null` tant que le navigateur n'a pas répondu", () => {
		expect(resolveMobileViewport(undefined)).toBeNull()
	})

	it("ne confond JAMAIS « on ne sait pas » avec « ce n'est pas un mobile »", () => {
		// La distinction porte tout : `false` monterait l'arbre de bureau sur un
		// téléphone le temps d'un rendu, avec ses abonnements Convex.
		expect(resolveMobileViewport(undefined)).not.toBe(false)
		expect(resolveMobileViewport(false)).toBe(false)
	})

	it("rend le booléen tel quel quand il existe", () => {
		expect(resolveMobileViewport(true)).toBe(true)
		expect(resolveMobileViewport(false)).toBe(false)
	})
})
