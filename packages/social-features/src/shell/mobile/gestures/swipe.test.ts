// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/gestures/swipe.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle).
import { describe, expect, it } from "vitest"
import {
	beginTrack,
	endTrack,
	justEngaged,
	moveTrack,
	nextIndex,
	offsetAlong,
	rubberBand,
	settleTarget,
	shouldCommit,
	SWIPE_HYSTERESIS_PX,
	velocityAlong,
	type SwipeState,
} from "./swipe"

/** Construit un état `tracking` directement, sans repasser par le geste entier. */
function trackingState(
	axis: SwipeState["axis"],
	samples: readonly { d: number; t: number }[],
): SwipeState {
	return {
		phase: "tracking",
		axis,
		startX: 0,
		startY: 0,
		x: 0,
		y: 0,
		startedAt: 0,
		updatedAt: 0,
		samples,
	}
}

describe("beginTrack", () => {
	it("démarre toujours `pending`, sans axe engagé ni échantillon", () => {
		const state = beginTrack(100, 200, 1000)
		expect(state.phase).toBe("pending")
		expect(state.axis).toBeNull()
		expect(state.startX).toBe(100)
		expect(state.startY).toBe(200)
		expect(state.samples).toEqual([])
	})
})

describe("moveTrack — hystérésis et engagement de l'axe", () => {
	it("reste `pending` sous le seuil d'hystérésis", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 4, 4, 16)
		expect(moved.phase).toBe("pending")
		expect(moved.axis).toBeNull()
	})

	it("engage dès que le seuil est atteint (borne inclusive)", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 0, SWIPE_HYSTERESIS_PX, 16)
		expect(moved.phase).toBe("tracking")
		expect(moved.axis).toBe("y")
	})

	it("engage l'axe DOMINANT — x quand |dx| > |dy|", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 30, 5, 16)
		expect(moved.axis).toBe("x")
	})

	it("engage l'axe DOMINANT — y quand |dy| > |dx|", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 5, 30, 16)
		expect(moved.axis).toBe("y")
	})

	it("lockAxis: \"x\" ignore un geste purement vertical — reste `pending`", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 0, 500, 16, { lockAxis: "x" })
		expect(moved.phase).toBe("pending")
		expect(moved.axis).toBeNull()
	})

	it("lockAxis: \"y\" ignore un geste purement horizontal — reste `pending`", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 500, 0, 16, { lockAxis: "y" })
		expect(moved.phase).toBe("pending")
		expect(moved.axis).toBeNull()
	})

	it("l'axe engagé ne change plus, même si l'autre axe domine ensuite", () => {
		const started = beginTrack(0, 0, 0)
		const engaged = moveTrack(started, 5, 30, 16) // engage "y"
		const later = moveTrack(engaged, 400, 30, 32) // dx devient largement dominant
		expect(later.axis).toBe("y")
	})

	it("un appel après `done` est un no-op — la phase reste figée", () => {
		const started = beginTrack(0, 0, 0)
		const ended = endTrack(started, 100)
		const after = moveTrack(ended, 999, 999, 200)
		expect(after).toBe(ended)
	})

	it("un appel sur un état `idle` est un no-op", () => {
		const idle: SwipeState = {
			phase: "idle",
			axis: null,
			startX: 0,
			startY: 0,
			x: 0,
			y: 0,
			startedAt: 0,
			updatedAt: 0,
			samples: [],
		}
		expect(moveTrack(idle, 999, 999, 200)).toBe(idle)
	})

	it("respecte une hystérésis personnalisée (`opts.hysteresis`)", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 0, 2, 16, { hysteresis: 1 })
		expect(moved.phase).toBe("tracking")
	})
})

describe("offsetAlong", () => {
	it("vaut 0 tant que l'axe n'est pas engagé (`pending`)", () => {
		const started = beginTrack(50, 50, 0)
		const moved = moveTrack(started, 52, 53, 16) // sous le seuil
		expect(offsetAlong(moved)).toBe(0)
	})

	it("reflète le déplacement cumulé sur l'axe engagé, une fois `tracking`", () => {
		const started = beginTrack(50, 50, 0)
		const moved = moveTrack(started, 50, 90, 16) // dy = 40, engage "y"
		expect(offsetAlong(moved)).toBe(40)
	})
})

describe("velocityAlong", () => {
	it("est positive quand l'offset augmente dans le temps", () => {
		const state = trackingState("y", [
			{ d: 20, t: 20 },
			{ d: 40, t: 40 },
		])
		expect(velocityAlong(state)).toBeCloseTo(1, 5) // (40-20) / (40-20) px/ms
	})

	it("est négative quand l'offset diminue dans le temps", () => {
		const state = trackingState("y", [
			{ d: 40, t: 20 },
			{ d: 20, t: 40 },
		])
		expect(velocityAlong(state)).toBeCloseTo(-1, 5)
	})

	it("est nulle quand la position n'a pas bougé", () => {
		const state = trackingState("y", [
			{ d: 20, t: 20 },
			{ d: 20, t: 60 },
		])
		expect(velocityAlong(state)).toBe(0)
	})

	it("est nulle (indéterminable) avec moins de deux échantillons", () => {
		expect(velocityAlong(trackingState("y", []))).toBe(0)
		expect(velocityAlong(trackingState("y", [{ d: 20, t: 20 }]))).toBe(0)
	})

	it("est nulle quand les deux échantillons les plus récents partagent le même horodatage", () => {
		const state = trackingState("y", [
			{ d: 10, t: 20 },
			{ d: 40, t: 20 },
		])
		expect(velocityAlong(state)).toBe(0)
	})

	it("ignore les échantillons plus vieux que la fenêtre de ~100 ms", () => {
		// Un tout premier échantillon lointain (t=0) ne doit PAS diluer la
		// vélocité du flick final (t=180 → t=200), sans quoi un doigt qui
		// hésite longtemps avant d'accélérer paraîtrait plus lent qu'il ne l'est.
		const state = trackingState("y", [
			{ d: 0, t: 0 },
			{ d: 5, t: 180 },
			{ d: 45, t: 200 },
		])
		// Sans la fenêtre : (45-0)/(200-0) = 0.225. Avec : (45-5)/(200-180) = 2.
		expect(velocityAlong(state)).toBeCloseTo(2, 5)
	})
})

describe("shouldCommit", () => {
	it("un offset NÉGATIF au-delà du seuil de distance rend 1 (suivant) — convention de signe", () => {
		expect(shouldCommit(-80, 0, 300)).toBe(1)
	})

	it("un offset POSITIF au-delà du seuil de distance rend -1 (précédent)", () => {
		expect(shouldCommit(80, 0, 300)).toBe(-1)
	})

	it("commit par VÉLOCITÉ seule sur un petit déplacement (sous le seuil de distance)", () => {
		// offset = -10 sur une taille de 300 (seuil 75) : la distance seule ne
		// suffit pas, mais un flick net à -0.6 px/ms l'emporte.
		expect(shouldCommit(-10, -0.6, 300)).toBe(1)
	})

	it("rend 0 quand ni la distance ni la vélocité ne franchissent leur seuil", () => {
		expect(shouldCommit(20, 0.1, 300)).toBe(0)
	})

	it("une vélocité de signe OPPOSÉ à l'offset annule un commit pourtant qualifié par la distance", () => {
		// L'utilisateur a glissé largement (100 ≥ 75), mais la dernière fraction
		// de seconde revient dans l'autre sens : ce n'est plus un swipe assumé.
		expect(shouldCommit(100, -0.6, 300)).toBe(0)
	})

	it("offset nul : la vélocité seule décide du sens", () => {
		expect(shouldCommit(0, -0.8, 300)).toBe(1)
		expect(shouldCommit(0, 0.8, 300)).toBe(-1)
	})

	it("un `fraction` personnalisé abaisse (ou relève) le seuil de distance", () => {
		// 50 ne franchit pas le seuil par défaut (75 = 25 % de 300)…
		expect(shouldCommit(50, 0, 300)).toBe(0)
		// … mais franchit un seuil élargi à 10 % (30).
		expect(shouldCommit(50, 0, 300, { fraction: 0.1 })).toBe(-1)
	})

	it("un `velocity` personnalisé relève (ou abaisse) le seuil de vélocité", () => {
		expect(shouldCommit(10, 0.3, 300)).toBe(0)
		expect(shouldCommit(10, 0.3, 300, { velocity: 0.2 })).toBe(-1)
	})

	it("une taille non positive ne commit jamais", () => {
		expect(shouldCommit(-9999, -99, 0)).toBe(0)
	})
})

describe("nextIndex", () => {
	it("clampe au bord inférieur", () => {
		expect(nextIndex(0, -1, 5)).toBe(0)
	})

	it("clampe au bord supérieur", () => {
		expect(nextIndex(4, 1, 5)).toBe(4)
	})

	it("avance normalement dans les bornes", () => {
		expect(nextIndex(2, 1, 5)).toBe(3)
		expect(nextIndex(2, -1, 5)).toBe(1)
	})

	it("direction 0 laisse l'index inchangé", () => {
		expect(nextIndex(2, 0, 5)).toBe(2)
	})

	it("une liste vide rend toujours 0", () => {
		expect(nextIndex(0, 1, 0)).toBe(0)
		expect(nextIndex(0, -1, 0)).toBe(0)
	})
})

describe("settleTarget", () => {
	it("direction 1 (suivant) termine sa course à -size", () => {
		expect(settleTarget(1, 300)).toBe(-300)
	})

	it("direction -1 (précédent) termine sa course à +size", () => {
		expect(settleTarget(-1, 300)).toBe(300)
	})

	it("direction 0 revient à 0", () => {
		expect(settleTarget(0, 300)).toBe(0)
	})
})

describe("rubberBand", () => {
	it("est l'identité hors bord", () => {
		expect(rubberBand(120, false, 300)).toBe(120)
		expect(rubberBand(-120, false, 300)).toBe(-120)
	})

	it("réduit un offset positif au bord, sans changer son signe", () => {
		const damped = rubberBand(120, true, 300)
		expect(damped).toBeGreaterThan(0)
		expect(damped).toBeLessThan(120)
	})

	it("réduit un offset négatif au bord, sans changer son signe", () => {
		const damped = rubberBand(-120, true, 300)
		expect(damped).toBeLessThan(0)
		expect(damped).toBeGreaterThan(-120)
	})

	it("un offset nul reste nul, au bord ou non", () => {
		expect(rubberBand(0, true, 300)).toBe(0)
		expect(rubberBand(0, false, 300)).toBe(0)
	})

	it("ne dépasse jamais `size`, même pour un dépassement énorme", () => {
		expect(Math.abs(rubberBand(100000, true, 300))).toBeLessThan(300)
	})
})

describe("endTrack", () => {
	it("fige la phase à `done`", () => {
		const started = beginTrack(0, 0, 0)
		const ended = endTrack(started, 500)
		expect(ended.phase).toBe("done")
	})

	it("est idempotent — un second appel ne change plus rien", () => {
		const started = beginTrack(0, 0, 0)
		const ended = endTrack(started, 500)
		const endedAgain = endTrack(ended, 900)
		expect(endedAgain).toBe(ended)
	})
})

describe("justEngaged — l'instant unique où la capture de pointeur se pose", () => {
	it("un tap (déplacement sous le seuil) n'engage jamais — aucune capture", () => {
		let state = beginTrack(0, 0, 0)
		let next = moveTrack(state, 2, 4, 16, { lockAxis: "y" })
		expect(justEngaged(state, next)).toBe(false)
		state = next
		next = moveTrack(state, 3, 6, 32, { lockAxis: "y" })
		expect(justEngaged(state, next)).toBe(false)
	})

	it("vrai EXACTEMENT à la transition pending → tracking, puis plus jamais", () => {
		const started = beginTrack(0, 0, 0)
		const engaged = moveTrack(started, 0, SWIPE_HYSTERESIS_PX + 2, 16, {
			lockAxis: "y",
		})
		expect(justEngaged(started, engaged)).toBe(true)
		const followed = moveTrack(engaged, 0, 60, 32, { lockAxis: "y" })
		// Les moves suivants restent `tracking` : la capture ne se pose qu'UNE fois.
		expect(justEngaged(engaged, followed)).toBe(false)
	})

	it("un déplacement purement horizontal sous `lockAxis: y` n'engage pas", () => {
		const started = beginTrack(0, 0, 0)
		const moved = moveTrack(started, 200, 0, 16, { lockAxis: "y" })
		expect(justEngaged(started, moved)).toBe(false)
		expect(moved.phase).toBe("pending")
	})

	it("faux sur les états `idle` et `done` — aucun geste à capturer", () => {
		const idle: SwipeState = {
			phase: "idle",
			axis: null,
			startX: 0,
			startY: 0,
			x: 0,
			y: 0,
			startedAt: 0,
			updatedAt: 0,
			samples: [],
		}
		expect(justEngaged(idle, idle)).toBe(false)
		const started = beginTrack(0, 0, 0)
		const ended = endTrack(started, 100)
		expect(justEngaged(ended, ended)).toBe(false)
	})
})
