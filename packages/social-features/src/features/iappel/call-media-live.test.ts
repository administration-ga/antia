// Dupliqué de socle/packages/agent-features/src/features/iappel/call-media-live.test.ts @ ad2e7fdc2 — adaptations : aucune (module pur inchangé, mêmes cas).
import { describe, expect, it } from "vitest"
import { shouldPublishMedia } from "./call-media-live"

describe("shouldPublishMedia — le média suit le STATUT, pas seulement l'actif", () => {
	it("un appel actif et en cours publie", () => {
		expect(shouldPublishMedia({ status: "active", isActive: true })).toBe(true)
	})

	it("un appel actif ET PARQUÉ ne publie plus — LE cas du seul appel tenu", () => {
		// `holdSlot` garde volontairement `activeSlotId` sur l'appel mis en
		// attente quand il est le seul de la ligne (`call-store.test.ts`). Lire
		// `isActive` seul laissait donc le micro publié et l'audio distant
		// rendu : la pause n'était qu'un changement de libellé.
		expect(shouldPublishMedia({ status: "held", isActive: true })).toBe(false)
	})

	it("un appel terminé ne publie plus, même s'il reste l'actif le temps de l'écran de fin", () => {
		expect(shouldPublishMedia({ status: "ended", isActive: true })).toBe(false)
	})

	it("un appel qui n'est pas l'actif ne publie pas, quel que soit son statut", () => {
		for (const status of ["incoming", "connecting", "active", "held", "ended"] as const) {
			expect(shouldPublishMedia({ status, isActive: false }), status).toBe(false)
		}
	})

	it("un appel actif en cours d'établissement publie : les props vivantes valent intention", () => {
		// Le slot naît `connecting` sur le chemin sortant et n'atteint jamais
		// `active` : le taire éteindrait le micro de tout appel sortant.
		expect(shouldPublishMedia({ status: "connecting", isActive: true })).toBe(true)
	})
})
