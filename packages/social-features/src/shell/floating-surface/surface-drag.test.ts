// Dupliqué de socle/packages/agent-features/src/features/floating-surface/surface-drag.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle).
import { describe, expect, it } from "vitest"
import {
	SURFACE_DRAG_MARGIN,
	clampToFrame,
	parseStoredPlacement,
	reanchor,
	restorePlacement,
	serializePlacement,
	settlePlacement,
} from "./surface-drag"

const BOX = { width: 400, height: 680 }
const INSETS = { top: 0, right: 0, bottom: 0, left: 240 }

describe("surface flottante partagée", () => {
	it("reclamp une fenêtre 400 × 680 quand le viewport rétrécit", () => {
		const stored = { corner: "bottom-right" as const, x: 1000, y: 200 }
		expect(
			reanchor(stored, BOX, { width: 980, height: 760 }, INSETS),
		).toEqual({
			x: 980 - SURFACE_DRAG_MARGIN - BOX.width,
			y: 760 - SURFACE_DRAG_MARGIN - BOX.height,
		})
	})

	it("borne aussi une position libre en tenant compte du rail", () => {
		expect(
			clampToFrame(
				{ x: -100, y: -100 },
				BOX,
				{ width: 1440, height: 900 },
				INSETS,
			),
		).toEqual({ x: 240 + SURFACE_DRAG_MARGIN, y: SURFACE_DRAG_MARGIN })
	})

	it("relit le format courant et tolère tout stockage de session abîmé", () => {
		const placement = { corner: "top-right" as const, x: 12, y: 34 }
		expect(parseStoredPlacement(serializePlacement(placement))).toEqual(placement)
		for (const raw of [null, "", "{", "null", "{}", '{"corner":"ailleurs"}']) {
			expect(parseStoredPlacement(raw)).toBeNull()
		}
	})

	it("garde iCom libre au relâchement tandis que le défaut iAppel reste aux coins", () => {
		const viewport = { width: 1440, height: 900 }
		const libre = settlePlacement(
			{ x: 510, y: 100 },
			BOX,
			viewport,
			{ top: 0, right: 0, bottom: 0, left: 0 },
			"free",
		)
		expect(libre.pos).toEqual({ x: 510, y: 100 })
		expect(libre.placement).toMatchObject({ x: 510, y: 100 })

		const historique = settlePlacement(
			{ x: 510, y: 100 },
			BOX,
			viewport,
			{ top: 0, right: 0, bottom: 0, left: 0 },
		)
		expect(historique.pos).not.toEqual({ x: 510, y: 100 })
	})

	it("reclamp le mode libre sans le ré-ancrer à un coin", () => {
		const stored = { corner: "bottom-right" as const, x: 430, y: 80 }
		const insets = { top: 0, right: 0, bottom: 0, left: 0 }
		expect(
			restorePlacement(stored, BOX, { width: 1440, height: 900 }, insets, "free"),
		).toEqual({ x: 430, y: 80 })
		expect(
			restorePlacement(stored, BOX, { width: 760, height: 720 }, insets, "free"),
		).toEqual({ x: 344, y: 24 })
	})
})
