// Dupliqué de socle/packages/agent-features/src/features/stories/story-video-policy.test.ts @ ad2e7fdc2 — adaptations : borne unique du moteur (`STORY_VIDEO_LIMITS` de `@antsia/social-domain/stories`, cinq minutes et cinquante mégaoctets) au lieu des bornes par destination — cas « neuf minutes sur iRéseau », « au-delà de dix minutes », « huit minutes sans conversion » ramenés à cette borne, cas « sans destination connue » retiré (aucune destination à choisir) ; refus lus par l'i18n du moteur (`t` français, mêmes fragments attendus) ; cas ajouté : refus en anglais.
import { describe, expect, it } from "vitest"

import { STORY_VIDEO_LIMITS } from "@antsia/social-domain/stories"

import { createAppI18n } from "../../i18n"
import {
	STORY_TRANSCODE_MAX_DURATION_MS,
	STORY_TRANSCODE_TARGETS,
	storyVideoPlan,
	transcodeVideoBitrate,
} from "./story-video-policy"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "stories" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

const NOM = "instant.mov"

describe("storyVideoPlan — upload, conversion ou refus", () => {
	it("un MP4 décodable et court part TEL QUEL, durée arrondie", () => {
		const plan = storyVideoPlan({
			fileName: "clip.mp4",
			mimeType: "video/mp4",
			probe: { decodable: true, durationMs: 12_400.6 },
			recorderTargets: [...STORY_TRANSCODE_TARGETS],
		}, t)
		expect(plan).toEqual({ action: "upload", durationMs: 12_401 })
	})

	it("un WebM à paramètres de codec reste un WebM — le conteneur NU décide", () => {
		const plan = storyVideoPlan({
			fileName: "clip.webm",
			mimeType: "video/webm;codecs=vp9,opus",
			probe: { decodable: true, durationMs: 8_000 },
			recorderTargets: [...STORY_TRANSCODE_TARGETS],
		}, t)
		expect(plan.action).toBe("upload")
	})

	it("un .mov DÉCODABLE se convertit vers la première cible supportée", () => {
		const plan = storyVideoPlan({
			fileName: NOM,
			mimeType: "video/quicktime",
			probe: { decodable: true, durationMs: 9_000 },
			recorderTargets: ["video/webm;codecs=vp9", "video/webm"],
		}, t)
		expect(plan.action).toBe("transcode")
		if (plan.action === "transcode") {
			expect(plan.targetMime).toBe("video/webm;codecs=vp9")
			expect(plan.durationMs).toBe(9_000)
			expect(plan.videoBitsPerSecond).toBeGreaterThan(0)
			expect(plan.hardStopMs).toBeGreaterThan(0)
		}
	})

	it("un .mov INDÉCODABLE se refuse en guidant — on ne convertit pas ce qu'on ne sait pas lire", () => {
		const plan = storyVideoPlan({
			fileName: NOM,
			mimeType: "video/quicktime",
			probe: { decodable: false, durationMs: null },
			recorderTargets: [...STORY_TRANSCODE_TARGETS],
		}, t)
		expect(plan.action).toBe("refuse")
		if (plan.action === "refuse") {
			expect(plan.error).toContain(NOM)
			expect(plan.error).toContain("MP4")
		}
	})

	it("une durée NON MESURABLE passe — la borne serveur reste l'arbitre", () => {
		const plan = storyVideoPlan({
			fileName: "clip.mp4",
			mimeType: "video/mp4",
			probe: { decodable: true, durationMs: null },
			recorderTargets: [...STORY_TRANSCODE_TARGETS],
		}, t)
		expect(plan).toEqual({ action: "upload", durationMs: undefined })
	})

	it("aucun encodeur disponible → refus explicite, jamais un envoi illisible", () => {
		const plan = storyVideoPlan({
			fileName: NOM,
			mimeType: "video/quicktime",
			probe: { decodable: true, durationMs: 5_000 },
			recorderTargets: [],
		}, t)
		expect(plan.action).toBe("refuse")
		if (plan.action === "refuse") {
			expect(plan.error).toContain("convertir")
		}
	})
})

describe("la borne de durée est celle du moteur — cinq minutes", () => {
	const longClip = (durationMs: number, translate = t) =>
		storyVideoPlan(
			{
				fileName: "long.mp4",
				mimeType: "video/mp4",
				probe: { decodable: true, durationMs },
				recorderTargets: [...STORY_TRANSCODE_TARGETS],
			},
			translate,
		)

	it("laisse passer quatre minutes", () => {
		expect(STORY_VIDEO_LIMITS.maxDurationMs).toBe(5 * 60_000)
		expect(longClip(4 * 60_000).action).toBe("upload")
	})

	it("refuse au-delà de cinq minutes", () => {
		const plan = longClip(5 * 60_000 + 1)
		expect(plan.action).toBe("refuse")
		if (plan.action === "refuse") {
			expect(plan.error).toContain("5 minutes")
			expect(plan.error).toContain("long.mp4")
		}
	})

	it("dit la borne entière dans la phrase de refus", () => {
		const plan = longClip(6 * 60_000)
		expect(plan.action).toBe("refuse")
		if (plan.action === "refuse") {
			expect(plan.error).toBe(
				"« long.mp4 » est trop longue. Une vidéo dure au plus 5 minutes.",
			)
		}
	})

	it("parle la langue de l'écran", () => {
		const plan = longClip(6 * 60_000, tEn)
		expect(plan.action === "refuse" && plan.error).toBe(
			"“long.mp4” is too long. A video lasts at most 5 minutes.",
		)
	})
})

describe("le budget de CONVERSION est propre au composeur", () => {
	const mov = (durationMs: number) =>
		storyVideoPlan(
			{
				fileName: NOM,
				mimeType: "video/quicktime",
				probe: { decodable: true, durationMs },
				recorderTargets: [...STORY_TRANSCODE_TARGETS],
			},
			t,
		)

	it("convertit jusqu'à trois minutes", () => {
		expect(mov(STORY_TRANSCODE_MAX_DURATION_MS).action).toBe(
			"transcode",
		)
	})

	it("refuse de convertir au-delà, en disant quoi faire", () => {
		const plan = mov(STORY_TRANSCODE_MAX_DURATION_MS + 1)
		expect(plan.action).toBe("refuse")
		if (plan.action === "refuse") {
			expect(plan.error).toContain("3 minutes")
			expect(plan.error).toContain("MP4")
		}
	})

	it("ne rétrécit PAS l'actu : le même MP4 de quatre minutes part sans conversion", () => {
		// Le budget borne le TRAVAIL du navigateur, pas ce qu'une actu a le
		// droit de durer. Confondre les deux ferait passer la conversion pour
		// une borne produit.
		const plan = storyVideoPlan(
			{
				fileName: "long.mp4",
				mimeType: "video/mp4",
				probe: { decodable: true, durationMs: 4 * 60_000 },
				recorderTargets: [...STORY_TRANSCODE_TARGETS],
			},
			t,
		)
		expect(4 * 60_000).toBeGreaterThan(STORY_TRANSCODE_MAX_DURATION_MS)
		expect(plan.action).toBe("upload")
	})

	it("arrête la conversion au budget, jamais aux cinq minutes de l'actu", () => {
		const plan = mov(60_000)
		expect(plan.action).toBe("transcode")
		if (plan.action === "transcode") {
			expect(plan.hardStopMs).toBeLessThanOrEqual(
				STORY_TRANSCODE_MAX_DURATION_MS + 2_000,
			)
		}
	})
})

describe("transcodeVideoBitrate — tenir dans le budget d'octets", () => {
	const { maxBytes, maxDurationMs } = STORY_VIDEO_LIMITS

	it("reste sous le plafond de qualité pour un clip court", () => {
		expect(
			transcodeVideoBitrate({ durationMs: 10_000, maxBytes, maxDurationMs }),
		).toBe(2_500_000)
	})

	it("descend le débit quand la vidéo s'allonge, pour que le fichier tienne", () => {
		const bps = transcodeVideoBitrate({
			durationMs: 3 * 60_000,
			maxBytes,
			maxDurationMs,
		})
		expect(bps).toBeLessThan(2_500_000)
		// La preuve qui compte : le fichier visé PASSE la borne d'octets.
		const projectedBytes = ((bps + 128_000) * 180) / 8
		expect(projectedBytes).toBeLessThan(maxBytes)
	})

	it("calcule au PIRE cas quand la durée est inconnue", () => {
		// Sans durée, la ceinture laisse aller jusqu'à la borne : un débit
		// calculé sur une durée optimiste produirait un fichier refusé APRÈS
		// l'attente de la conversion.
		expect(
			transcodeVideoBitrate({ durationMs: null, maxBytes, maxDurationMs }),
		).toBe(
			transcodeVideoBitrate({
				durationMs: maxDurationMs,
				maxBytes,
				maxDurationMs,
			}),
		)
	})

	it("ne descend jamais sous un plancher d'image regardable", () => {
		expect(
			transcodeVideoBitrate({
				durationMs: 60 * 60_000,
				maxBytes: 1_024,
				maxDurationMs,
			}),
		).toBe(400_000)
	})
})
