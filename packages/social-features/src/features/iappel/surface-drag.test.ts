// Dupliqué de socle/packages/agent-features/src/features/iappel/surface-drag.test.ts @ ad2e7fdc2 — adaptations : aucune sur les cas — ils passent par le relais d'iAppel (`./surface-drag`) vers la surface flottante de la coque (lot W7).
import { describe, expect, it } from "vitest"
import {
	SURFACE_DRAG_MARGIN,
	clampToFrame,
	cornerForEdgeKey,
	cornerPosition,
	defaultPlacement,
	hasEngaged,
	nearestCorner,
	nudge,
	parseStoredPlacement,
	reanchor,
	serializePlacement,
	type DragInsets,
} from "./surface-drag"

const BOX = { width: 400, height: 680 }
const ECRAN = { width: 1440, height: 900 }
const SANS_OBSTACLE: DragInsets = { top: 0, right: 0, bottom: 0, left: 0 }

describe("cornerPosition", () => {
	it("pose la surface à la marge, dans les quatre coins", () => {
		const hg = cornerPosition("top-left", BOX, ECRAN, SANS_OBSTACLE)
		expect(hg).toEqual({ x: SURFACE_DRAG_MARGIN, y: SURFACE_DRAG_MARGIN })

		const bd = cornerPosition("bottom-right", BOX, ECRAN, SANS_OBSTACLE)
		expect(bd).toEqual({
			x: ECRAN.width - SURFACE_DRAG_MARGIN - BOX.width,
			y: ECRAN.height - SURFACE_DRAG_MARGIN - BOX.height,
		})
	})

	it("tient compte d'une barre latérale", () => {
		const avecRail: DragInsets = { ...SANS_OBSTACLE, left: 240 }
		expect(cornerPosition("top-left", BOX, ECRAN, avecRail).x).toBe(
			240 + SURFACE_DRAG_MARGIN,
		)
	})

	it("tient compte d'une barre basse", () => {
		const avecBarre: DragInsets = { ...SANS_OBSTACLE, bottom: 64 }
		expect(cornerPosition("bottom-left", BOX, ECRAN, avecBarre).y).toBe(
			ECRAN.height - 64 - SURFACE_DRAG_MARGIN - BOX.height,
		)
	})
})

describe("clampToFrame", () => {
	it("ramène une position sortie du cadre", () => {
		expect(clampToFrame({ x: -500, y: -500 }, BOX, ECRAN, SANS_OBSTACLE)).toEqual({
			x: SURFACE_DRAG_MARGIN,
			y: SURFACE_DRAG_MARGIN,
		})
		expect(clampToFrame({ x: 99999, y: 99999 }, BOX, ECRAN, SANS_OBSTACLE)).toEqual({
			x: ECRAN.width - SURFACE_DRAG_MARGIN - BOX.width,
			y: ECRAN.height - SURFACE_DRAG_MARGIN - BOX.height,
		})
	})

	it("préfère le bord HAUT-GAUCHE quand la surface est plus grande que la place", () => {
		// Une surface qui déborde en bas à droite cache ses propres commandes ;
		// celle qui déborde en bas les garde atteignables.
		const petitEcran = { width: 320, height: 400 }
		expect(clampToFrame({ x: 200, y: 200 }, BOX, petitEcran, SANS_OBSTACLE)).toEqual({
			x: SURFACE_DRAG_MARGIN,
			y: SURFACE_DRAG_MARGIN,
		})
	})

	it("survit à un viewport encore à zéro", () => {
		// Le piège classique : `innerWidth` lu avant la première mesure. La
		// fenêtre doit se poser quelque part de visible, pas à NaN.
		const p = clampToFrame({ x: 10, y: 10 }, BOX, { width: 0, height: 0 }, SANS_OBSTACLE)
		expect(Number.isFinite(p.x)).toBe(true)
		expect(Number.isFinite(p.y)).toBe(true)
		expect(p).toEqual({ x: SURFACE_DRAG_MARGIN, y: SURFACE_DRAG_MARGIN })
	})
})

describe("nearestCorner", () => {
	it("choisit le coin dont le centre est le plus proche", () => {
		expect(nearestCorner({ x: 20, y: 20 }, BOX, ECRAN, SANS_OBSTACLE)).toBe("top-left")
		expect(nearestCorner({ x: 1000, y: 20 }, BOX, ECRAN, SANS_OBSTACLE)).toBe(
			"top-right",
		)
		expect(nearestCorner({ x: 20, y: 200 }, BOX, ECRAN, SANS_OBSTACLE)).toBe(
			"bottom-left",
		)
		expect(nearestCorner({ x: 1000, y: 200 }, BOX, ECRAN, SANS_OBSTACLE)).toBe(
			"bottom-right",
		)
	})

	it("est déterministe au centre exact de l'écran", () => {
		// Sans départage explicite, deux coins équidistants donneraient un
		// résultat dépendant de l'ordre d'itération — intestable.
		const centre = {
			x: (ECRAN.width - BOX.width) / 2,
			y: (ECRAN.height - BOX.height) / 2,
		}
		const a = nearestCorner(centre, BOX, ECRAN, SANS_OBSTACLE)
		const b = nearestCorner(centre, BOX, ECRAN, SANS_OBSTACLE)
		expect(a).toBe(b)
	})
})

describe("reanchor", () => {
	it("conserve le coin quand l'écran rétrécit", () => {
		// C'est LA raison de persister un coin plutôt que des pixels : des
		// coordonnées brutes ramèneraient la fenêtre hors champ.
		const place = { corner: "bottom-right" as const, x: 1024, y: 204 }
		const petit = { width: 900, height: 800 }
		const p = reanchor(place, BOX, petit, SANS_OBSTACLE)
		expect(p).toEqual({
			x: 900 - SURFACE_DRAG_MARGIN - BOX.width,
			y: 800 - SURFACE_DRAG_MARGIN - BOX.height,
		})
	})

	it("pousse une fenêtre de gauche quand une barre latérale apparaît", () => {
		const place = { corner: "top-left" as const, x: 16, y: 16 }
		const avecRail: DragInsets = { ...SANS_OBSTACLE, left: 240 }
		expect(reanchor(place, BOX, ECRAN, avecRail).x).toBe(240 + SURFACE_DRAG_MARGIN)
	})
})

describe("hasEngaged", () => {
	it("engage à exactement trois pixels, pas avant", () => {
		const o = { x: 100, y: 100 }
		expect(hasEngaged(o, { x: 102, y: 102 })).toBe(false)
		expect(hasEngaged(o, { x: 103, y: 100 })).toBe(true)
		expect(hasEngaged(o, { x: 100, y: 103 })).toBe(true)
		expect(hasEngaged(o, { x: 97, y: 100 })).toBe(true)
	})
})

describe("nudge", () => {
	it("déplace d'un pas et reste dans le cadre", () => {
		const p = nudge({ x: 100, y: 100 }, 16, 0, BOX, ECRAN, SANS_OBSTACLE)
		expect(p).toEqual({ x: 116, y: 100 })
	})

	it("ne sort jamais du cadre, même sur un pas rapide", () => {
		const p = nudge({ x: 20, y: 20 }, -64, -64, BOX, ECRAN, SANS_OBSTACLE)
		expect(p).toEqual({ x: SURFACE_DRAG_MARGIN, y: SURFACE_DRAG_MARGIN })
	})
})

describe("defaultPlacement", () => {
	it("reste le bas-droite historique", () => {
		// Les deux surfaces y étaient clouées avant d'être déplaçables : une
		// installation neuve ne doit rien voir changer.
		expect(defaultPlacement(BOX, ECRAN, SANS_OBSTACLE).corner).toBe("bottom-right")
	})
})

describe("parseStoredPlacement", () => {
	it("relit ce que serializePlacement a écrit", () => {
		const place = { corner: "top-right" as const, x: 12, y: 34 }
		expect(parseStoredPlacement(serializePlacement(place))).toEqual(place)
	})

	it("refuse tout ce qui n'est pas exactement un placement", () => {
		// Un stockage local survit aux versions du code : une charge d'un
		// format antérieur ne doit pas poser la fenêtre à NaN pixels.
		expect(parseStoredPlacement(null)).toBeNull()
		expect(parseStoredPlacement("")).toBeNull()
		expect(parseStoredPlacement("pas du json")).toBeNull()
		expect(parseStoredPlacement("null")).toBeNull()
		expect(parseStoredPlacement("{}")).toBeNull()
		expect(parseStoredPlacement('{"corner":"nulle-part"}')).toBeNull()
		expect(parseStoredPlacement('{"x":10,"y":10}')).toBeNull()
	})

	it("tolère des coordonnées manquantes ou aberrantes si le coin est bon", () => {
		// Le coin suffit : `reanchor` recalcule tout le reste.
		expect(parseStoredPlacement('{"corner":"top-left"}')).toEqual({
			corner: "top-left",
			x: 0,
			y: 0,
		})
		expect(parseStoredPlacement('{"corner":"top-left","x":null,"y":"x"}')).toEqual({
			corner: "top-left",
			x: 0,
			y: 0,
		})
	})
})

describe("cornerForEdgeKey — Origine et Fin mènent TOUJOURS au même coin", () => {
	it("Origine en haut à gauche, Fin en bas à droite", () => {
		expect(cornerForEdgeKey("Home")).toBe("top-left")
		expect(cornerForEdgeKey("End")).toBe("bottom-right")
	})

	it("ne répond à aucune autre touche — les flèches gardent leur pas", () => {
		for (const key of ["ArrowLeft", "ArrowUp", "Escape", "PageUp", "h", ""]) {
			expect(cornerForEdgeKey(key), key).toBeNull()
		}
	})

	it("le coin de `Fin` est celui de l'ancrage d'origine", () => {
		// Ce n'est pas un hasard : `Fin` doit ramener là où la fenêtre était
		// clouée avant d'être déplaçable, sans avoir à viser.
		const box = { width: 400, height: 680 }
		const viewport = { width: 1440, height: 900 }
		const insets = { top: 0, right: 0, bottom: 0, left: 0 }
		expect(cornerForEdgeKey("End")).toBe(
			defaultPlacement(box, viewport, insets).corner,
		)
	})
})
