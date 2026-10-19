// Dupliqué de socle/packages/agent-features/src/features/espace-personnel/floating-card.test.ts @ ad2e7fdc2 — adaptations : aucune hors du déplacement dans la coque (`shell/floating-card/`) ; les sept cas portés tels quels.
import { describe, expect, it } from "vitest"
import { floatingCardPose } from "./floating-card"

describe("floatingCardPose", () => {
	describe("carte qui SAISIT (compose) — le clavier commande", () => {
		it("bureau connu = carte compacte sur voile", () => {
			expect(floatingCardPose(false)).toBe("card")
		})

		it("téléphone = plein écran (le clavier exige la surface immersive)", () => {
			expect(floatingCardPose(true)).toBe("fullscreen")
		})

		it("largeur inconnue (SSR) = plein écran — jamais la carte, qui ferait clignoter le téléphone", () => {
			expect(floatingCardPose(null)).toBe("fullscreen")
		})

		it("« compose » est le défaut : ne rien passer ne change rien", () => {
			expect(floatingCardPose(true, "compose")).toBe(floatingCardPose(true))
			expect(floatingCardPose(false, "compose")).toBe(floatingCardPose(false))
			expect(floatingCardPose(null, "compose")).toBe(floatingCardPose(null))
		})
	})

	describe("carte qui PROPOSE (choice) — aucune saisie, donc aucun clavier", () => {
		it("téléphone = carte flottante, comme au bureau — pas une page", () => {
			expect(floatingCardPose(true, "choice")).toBe("card")
		})

		it("bureau = carte flottante, inchangé", () => {
			expect(floatingCardPose(false, "choice")).toBe("card")
		})

		it("largeur inconnue (SSR) = carte : une seule géométrie, rien à faire clignoter", () => {
			expect(floatingCardPose(null, "choice")).toBe("card")
		})
	})
})
