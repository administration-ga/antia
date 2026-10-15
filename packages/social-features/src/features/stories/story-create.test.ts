// Dupliqué de socle/packages/agent-features/src/features/stories/story-create.test.ts @ ad2e7fdc2 — adaptations : bornes lues dans `@antia/social-domain/stories` ; destinations (ADR-0079 du socle) retirées avec le moteur — cas des cases, de l'origine, de l'invite croisée, des refus et indices par surface supprimés, cas du plafond vidéo ramenés à la borne unique du moteur (cinquante mégaoctets) ; phrases lues par l'i18n du moteur (`t` français, mêmes fragments attendus) ; cas ajoutés : unités traduites, refus en anglais, texte des refus du moteur par leur code.
import { describe, expect, it } from "vitest"

import {
	STORY_CAPTION_MAX_LENGTH,
	STORY_IMAGE_MAX_BYTES,
	STORY_VIDEO_LIMITS,
} from "@antia/social-domain/stories"

import { createAppI18n } from "../../i18n"
import {
	canPublishStory,
	evaluateStoryCaption,
	isStoryDraftReady,
	STORY_ACCEPT,
	storyBytesLabel,
	storyComposePose,
	storyDraftFrom,
	storyDurationLabel,
	storyEngineErrorText,
} from "./story-create"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "stories" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

const file = (type: string, size: number, name = "instant") => ({
	name,
	type,
	size,
})

describe("STORY_ACCEPT", () => {
	it("reste large pour ne pas désactiver la capture caméra", () => {
		expect(STORY_ACCEPT).toBe("image/*,video/*")
	})
})

describe("storyDraftFrom", () => {
	it("accepte une image", () => {
		expect(storyDraftFrom(file("image/jpeg", 1_024), t)).toEqual({ kind: "image" })
	})

	it("accepte une vidéo", () => {
		expect(storyDraftFrom(file("video/mp4", 1_024), t)).toEqual({ kind: "video" })
	})

	it("refuse un type que le domaine n'accepte pas", () => {
		const draft = storyDraftFrom(file("application/pdf", 1_024, "note.pdf"), t)
		expect(draft).toHaveProperty("error")
		expect("error" in draft && draft.error).toContain("note.pdf")
	})

	it("refuse le TYPE avant le POIDS — ne pas envoyer compresser pour rien", () => {
		const draft = storyDraftFrom(file("application/zip", 900 * 1024 * 1024), t)
		expect("error" in draft && draft.error).toContain(
			"ni une image acceptée (JPEG, PNG, WebP ou GIF), ni une vidéo",
		)
	})

	it("refuse un fichier vide", () => {
		const draft = storyDraftFrom(file("image/png", 0), t)
		expect("error" in draft && draft.error).toContain("est vide")
	})

	it("applique le plafond d'image du domaine", () => {
		expect(storyDraftFrom(file("image/png", STORY_IMAGE_MAX_BYTES), t)).toEqual({
			kind: "image",
		})
		const refused = storyDraftFrom(file("image/png", STORY_IMAGE_MAX_BYTES + 1), t)
		expect("error" in refused && refused.error).toContain("20 Mo")
	})

	it("applique le plafond VIDÉO du moteur — cinquante mégaoctets, la borne unique", () => {
		const max = STORY_VIDEO_LIMITS.maxBytes
		expect(storyDraftFrom(file("video/webm", max), t)).toEqual({
			kind: "video",
		})
		const refused = storyDraftFrom(file("video/webm", max + 1, "long.webm"), t)
		expect("error" in refused && refused.error).toBe(
			"« long.webm » est trop lourde. Une vidéo est limitée à 50 Mo.",
		)
	})

	it("accepte les quatre formats d'image et les trois formats vidéo", () => {
		for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
			expect(storyDraftFrom(file(mime, 512), t)).toEqual({ kind: "image" })
		}
		for (const mime of ["video/mp4", "video/webm", "video/quicktime"]) {
			expect(storyDraftFrom(file(mime, 512), t)).toEqual({ kind: "video" })
		}
	})

	it("dit le refus dans la langue de l'écran", () => {
		const refused = storyDraftFrom(file("image/png", 0, "vide.png"), tEn)
		expect("error" in refused && refused.error).toBe("“vide.png” is empty.")
	})
})

describe("isStoryDraftReady", () => {
	it("reconnaît un brouillon accepté", () => {
		expect(isStoryDraftReady({ kind: "image" })).toBe(true)
	})

	it("écarte un refus et l'absence de brouillon", () => {
		expect(isStoryDraftReady({ error: "non" })).toBe(false)
		expect(isStoryDraftReady(null)).toBe(false)
	})
})

describe("evaluateStoryCaption", () => {
	it("décompte les caractères restants", () => {
		expect(evaluateStoryCaption("bonjour").remaining).toBe(
			STORY_CAPTION_MAX_LENGTH - 7,
		)
	})

	it("ignore les blancs de bordure", () => {
		expect(evaluateStoryCaption("   ").remaining).toBe(
			STORY_CAPTION_MAX_LENGTH,
		)
	})

	it("descend sous zéro plutôt que de se figer", () => {
		const state = evaluateStoryCaption("x".repeat(STORY_CAPTION_MAX_LENGTH + 18))
		expect(state.remaining).toBe(-18)
		expect(state.tooLong).toBe(true)
	})

	it("tient la borne exacte du domaine", () => {
		expect(
			evaluateStoryCaption("x".repeat(STORY_CAPTION_MAX_LENGTH)).tooLong,
		).toBe(false)
	})
})

describe("canPublishStory", () => {
	it("allume le bouton avec un média accepté et une audience", () => {
		expect(canPublishStory({ kind: "image" }, "connections")).toBe(true)
	})

	it("exige le MÉDIA — une story sans média n'est rien", () => {
		expect(canPublishStory(null, "public")).toBe(false)
		expect(canPublishStory({ error: "refusé" }, "public")).toBe(false)
	})

	it("exige une audience choisie", () => {
		expect(canPublishStory({ kind: "video" }, null)).toBe(false)
	})

	it("reste éteint pendant un envoi en cours", () => {
		expect(
			canPublishStory({ kind: "image" }, "public", { submitting: true }),
		).toBe(false)
	})

	it("refuse une légende trop longue", () => {
		expect(
			canPublishStory({ kind: "image" }, "public", {
				caption: "x".repeat(STORY_CAPTION_MAX_LENGTH + 1),
			}),
		).toBe(false)
	})

	it("accepte une légende vide — elle est facultative", () => {
		expect(
			canPublishStory({ kind: "image" }, "public", { caption: "" }),
		).toBe(true)
	})
})

describe("storyComposePose", () => {
	it("carte compacte au bureau, plein écran partout ailleurs", () => {
		expect(storyComposePose(false)).toBe("card")
		expect(storyComposePose(true)).toBe("fullscreen")
		// `null` = SSR/premier rendu : se tromper vers la carte ferait
		// clignoter deux géométries au téléphone.
		expect(storyComposePose(null)).toBe("fullscreen")
	})
})

describe("les unités des refus — dites, jamais recopiées", () => {
	it("dit les mégaoctets d'une borne", () => {
		expect(storyBytesLabel(STORY_VIDEO_LIMITS.maxBytes, t)).toBe("50 Mo")
		expect(storyBytesLabel(STORY_IMAGE_MAX_BYTES, tEn)).toBe("20 MB")
	})

	it("dit les minutes rondes, accordées, et les secondes sinon", () => {
		expect(storyDurationLabel(STORY_VIDEO_LIMITS.maxDurationMs, t)).toBe("5 minutes")
		expect(storyDurationLabel(60_000, t)).toBe("1 minute")
		expect(storyDurationLabel(45_000, t)).toBe("45 secondes")
		expect(storyDurationLabel(3 * 60_000, tEn)).toBe("3 minutes")
	})
})

describe("storyEngineErrorText — le refus du moteur, dit par son code", () => {
	const FALLBACK = "stories:storyCreateSheet.publishFailed"

	it("dit la règle du domaine enfreinte, avec ses bornes", () => {
		const error = { data: { code: "invalidArgument", rule: "STORY_ACTIVE_LIMIT", params: { max: 20 } } }
		expect(storyEngineErrorText(error, FALLBACK, t)).toBe(
			"Vous avez déjà 20 stories en cours : attendez qu'une expire, ou retirez-en une.",
		)
	})

	it("dit le code du moteur quand aucune règle n'est nommée", () => {
		expect(storyEngineErrorText({ data: { code: "rateLimited" } }, FALLBACK, t)).toBe(
			"Trop de tentatives. Réessayez dans quelques instants.",
		)
	})

	it("retombe sur la phrase générique de l'écran, jamais sur le texte brut du serveur", () => {
		expect(storyEngineErrorText(new Error("Server Error: boom"), FALLBACK, t)).toBe(
			"La publication n'a pas abouti.",
		)
		expect(storyEngineErrorText({ data: { code: "inconnu" } }, FALLBACK, tEn)).toBe(
			"The story could not be posted.",
		)
	})
})
