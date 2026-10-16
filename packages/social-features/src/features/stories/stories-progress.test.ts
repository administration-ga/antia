// Dupliqué de socle/packages/agent-features/src/features/stories/stories-progress.test.ts @ ad2e7fdc2 — adaptations : plafond absolu ramené à la borne unique du moteur (cinq minutes au lieu de dix, vérifié contre `STORY_VIDEO_MAX_DURATION_MS` du domaine ; la vidéo légitime sous le plafond passe de neuf à quatre minutes) ; aucun cas retiré.
import { describe, expect, it } from "vitest"

import { STORY_VIDEO_MAX_DURATION_MS } from "@antsia/social-domain/stories"

import {
	initialStoryIndex,
	isMediaHalted,
	isPlaybackHalted,
	pressLostToSwipe,
	progressAt,
	segmentDuration,
	STORY_IMAGE_MS,
	STORY_TIMER_ZERO,
	STORY_VIDEO_CAP_MS,
	storyMediaErrorPlan,
	tapZone,
	tickTimer,
} from "./stories-progress"

describe("segmentDuration", () => {
	it("donne cinq secondes à une image", () => {
		expect(segmentDuration({ media: { kind: "image" } })).toBe(STORY_IMAGE_MS)
	})

	it("donne sa durée à une vidéo", () => {
		expect(
			segmentDuration({ media: { kind: "video", durationMs: 8_400 } }),
		).toBe(8_400)
	})

	it("borne une vidéo au plafond absolu — cinq minutes, celui du domaine", () => {
		expect(STORY_VIDEO_CAP_MS).toBe(5 * 60 * 1_000)
		expect(STORY_VIDEO_CAP_MS).toBe(STORY_VIDEO_MAX_DURATION_MS)
		// Une actu de quatre minutes est LÉGITIME : elle ne doit pas se faire
		// couper. Seule une durée aberrante rencontre le plafond.
		expect(
			segmentDuration({ media: { kind: "video", durationMs: 4 * 60_000 } }),
		).toBe(4 * 60_000)
		expect(
			segmentDuration({ media: { kind: "video", durationMs: 3_600_000 } }),
		).toBe(STORY_VIDEO_CAP_MS)
	})

	it("retombe sur la durée d'image quand la vidéo n'annonce rien", () => {
		expect(segmentDuration({ media: { kind: "video" } })).toBe(STORY_IMAGE_MS)
	})

	it("refuse une durée nulle ou négative plutôt que de passer sans rien montrer", () => {
		expect(segmentDuration({ media: { kind: "video", durationMs: 0 } })).toBe(
			STORY_IMAGE_MS,
		)
		expect(segmentDuration({ media: { kind: "video", durationMs: -3 } })).toBe(
			STORY_IMAGE_MS,
		)
	})

	it("écarte une durée non finie", () => {
		expect(
			segmentDuration({ media: { kind: "video", durationMs: Number.NaN } }),
		).toBe(STORY_IMAGE_MS)
	})
})

describe("progressAt", () => {
	it("part de zéro", () => {
		expect(progressAt(0, 5_000)).toBe(0)
	})

	it("rend la fraction au milieu", () => {
		expect(progressAt(2_500, 5_000)).toBe(0.5)
	})

	it("ne dépasse jamais un", () => {
		expect(progressAt(9_000, 5_000)).toBe(1)
	})

	it("ne descend jamais sous zéro", () => {
		expect(progressAt(-500, 5_000)).toBe(0)
	})

	it("rend un segment de durée nulle TERMINÉ, jamais NaN", () => {
		expect(progressAt(120, 0)).toBe(1)
	})
})

describe("tapZone", () => {
	it("recule sur le tiers gauche", () => {
		expect(tapZone(40, 375)).toBe("prev")
	})

	it("avance ailleurs", () => {
		expect(tapZone(200, 375)).toBe("next")
	})

	it("place la frontière à 30 % de la largeur", () => {
		expect(tapZone(112, 375)).toBe("prev")
		expect(tapZone(113, 375)).toBe("next")
	})

	it("avance quand la largeur est inconnue", () => {
		expect(tapZone(10, 0)).toBe("next")
	})
})

describe("pressLostToSwipe", () => {
	const HYSTERESIS = 10

	it("abandonne l'appui EXACTEMENT au seuil — borne inclusive, miroir de moveTrack", () => {
		expect(pressLostToSwipe({ x: 0, y: 0 }, 0, HYSTERESIS, HYSTERESIS)).toBe(
			true,
		)
		expect(pressLostToSwipe({ x: 0, y: 100 }, 0, 100 - HYSTERESIS, HYSTERESIS)).toBe(
			true,
		)
	})

	it("tient l'appui juste sous le seuil", () => {
		expect(
			pressLostToSwipe({ x: 0, y: 0 }, 0, HYSTERESIS - 1, HYSTERESIS),
		).toBe(false)
	})

	it("ignore le déplacement HORIZONTAL — le pager est verrouillé sur y", () => {
		expect(pressLostToSwipe({ x: 0, y: 0 }, 500, 0, HYSTERESIS)).toBe(false)
	})

	it("compte le vertical dans les deux sens", () => {
		expect(pressLostToSwipe({ x: 0, y: 50 }, 0, 50 + HYSTERESIS, HYSTERESIS)).toBe(
			true,
		)
		expect(pressLostToSwipe({ x: 0, y: 50 }, 0, 50 - HYSTERESIS, HYSTERESIS)).toBe(
			true,
		)
	})

	it("un doigt immobile ne perd jamais son appui", () => {
		expect(pressLostToSwipe({ x: 12, y: 34 }, 12, 34, HYSTERESIS)).toBe(false)
	})
})

describe("isPlaybackHalted — chaque raison seule suffit", () => {
	const RUNNING = {
		active: true,
		paused: false,
		stalled: false,
		viewersOpen: false,
		needsTap: false,
		failed: false,
	}

	it("aucune raison → l'horloge court", () => {
		expect(isPlaybackHalted(RUNNING)).toBe(false)
	})

	it("chaque raison, seule, arrête l'horloge", () => {
		expect(isPlaybackHalted({ ...RUNNING, active: false })).toBe(true)
		expect(isPlaybackHalted({ ...RUNNING, paused: true })).toBe(true)
		expect(isPlaybackHalted({ ...RUNNING, stalled: true })).toBe(true)
		expect(isPlaybackHalted({ ...RUNNING, viewersOpen: true })).toBe(true)
		expect(isPlaybackHalted({ ...RUNNING, needsTap: true })).toBe(true)
		expect(isPlaybackHalted({ ...RUNNING, failed: true })).toBe(true)
	})

	describe("isMediaHalted — le média ignore son propre tampon", () => {
		it("`stalled` seul ne met JAMAIS le média en pause", () => {
			// LE test du gel du 2026-08-20 : `waiting` tire à la milliseconde une
			// (tampon vide, c'est normal), et pauser le média sur cet état
			// l'empêchait à jamais d'émettre le `playing` qui l'aurait levé.
			// Vidéo chargée à 100 %, prête, en pause éternelle — écran noir.
			expect(isMediaHalted({ ...RUNNING, stalled: true })).toBe(false)
		})

		it("toute raison d'INTENTION, seule, met le média en pause", () => {
			expect(isMediaHalted(RUNNING)).toBe(false)
			expect(isMediaHalted({ ...RUNNING, active: false })).toBe(true)
			expect(isMediaHalted({ ...RUNNING, paused: true })).toBe(true)
			expect(isMediaHalted({ ...RUNNING, viewersOpen: true })).toBe(true)
			expect(isMediaHalted({ ...RUNNING, needsTap: true })).toBe(true)
			expect(isMediaHalted({ ...RUNNING, failed: true })).toBe(true)
		})

		it("le tampon n'annule pas une intention : doigt posé + stall = pause", () => {
			expect(isMediaHalted({ ...RUNNING, paused: true, stalled: true })).toBe(
				true,
			)
		})
	})
})

describe("storyMediaErrorPlan — sauter ou tenir", () => {
	it("tient l'écran sur une série d'une seule story — sauter refermerait le lecteur", () => {
		expect(storyMediaErrorPlan(1)).toBe("hold")
		expect(storyMediaErrorPlan(0)).toBe("hold")
	})

	it("saute quand la série a d'autres stories", () => {
		expect(storyMediaErrorPlan(2)).toBe("skip")
		expect(storyMediaErrorPlan(20)).toBe("skip")
	})
})

describe("initialStoryIndex", () => {
	it("ouvre sur la première non vue", () => {
		expect(
			initialStoryIndex([{ seen: true }, { seen: true }, { seen: false }]),
		).toBe(2)
	})

	it("ouvre au début quand tout a été vu", () => {
		expect(initialStoryIndex([{ seen: true }, { seen: true }])).toBe(0)
	})

	it("ouvre au début sur une série intacte", () => {
		expect(initialStoryIndex([{ seen: false }, { seen: false }])).toBe(0)
	})

	it("rend zéro sur une série vide", () => {
		expect(initialStoryIndex([])).toBe(0)
	})
})

describe("tickTimer", () => {
	it("pose l'ancre sans rien facturer au premier tour", () => {
		expect(tickTimer(STORY_TIMER_ZERO, 1_000, false)).toEqual({
			elapsed: 0,
			pausedAt: 1_000,
		})
	})

	it("facture l'intervalle entre deux échantillons", () => {
		const first = tickTimer(STORY_TIMER_ZERO, 1_000, false)
		expect(tickTimer(first, 1_250, false)).toEqual({
			elapsed: 250,
			pausedAt: 1_250,
		})
	})

	it("ne facture jamais deux fois le même intervalle", () => {
		let timer = tickTimer(STORY_TIMER_ZERO, 0, false)
		timer = tickTimer(timer, 100, false)
		timer = tickTimer(timer, 200, false)
		expect(timer.elapsed).toBe(200)
	})

	it("ne facture pas le temps du doigt posé", () => {
		let timer = tickTimer(STORY_TIMER_ZERO, 0, false)
		timer = tickTimer(timer, 1_000, false)
		timer = tickTimer(timer, 1_000, true)
		timer = tickTimer(timer, 9_000, true)
		timer = tickTimer(timer, 9_000, false)
		timer = tickTimer(timer, 9_500, false)
		expect(timer.elapsed).toBe(1_500)
	})

	it("laisse l'horloge intacte tant que la pause dure", () => {
		const paused = { elapsed: 800, pausedAt: null }
		expect(tickTimer(paused, 5_000, true)).toBe(paused)
	})

	it("ne fait jamais reculer l'écoulé quand l'horloge est remise à l'heure", () => {
		const running = { elapsed: 900, pausedAt: 5_000 }
		expect(tickTimer(running, 4_000, false)).toEqual({
			elapsed: 900,
			pausedAt: 4_000,
		})
	})
})
