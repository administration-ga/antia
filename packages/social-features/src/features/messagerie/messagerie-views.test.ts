// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-views.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
	isCompactPose,
	isRepliablePose,
	type MessagerieVariant,
} from "./messagerie-views"

const POSES: readonly MessagerieVariant[] = ["dock", "page", "window"]

describe("les trois poses — compacité et repli sont deux questions", () => {
	it("la carte du rail et la fenêtre sont compactes, la page non", () => {
		expect(isCompactPose("dock")).toBe(true)
		expect(isCompactPose("window")).toBe(true)
		expect(isCompactPose("page")).toBe(false)
	})
	it("seule la carte du rail se replie — la fenêtre se range par sa croix", () => {
		expect(isRepliablePose("dock")).toBe(true)
		expect(isRepliablePose("window")).toBe(false)
		expect(isRepliablePose("page")).toBe(false)
	})
	it("une pose repliable est toujours compacte", () => {
		for (const pose of POSES) {
			if (isRepliablePose(pose)) expect(isCompactPose(pose)).toBe(true)
		}
	})
})
