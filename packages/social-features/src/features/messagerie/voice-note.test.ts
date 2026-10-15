// Dupliqué de socle/packages/agent-features/src/features/messagerie/voice-note.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
	formatVoiceDuration,
	initialRecorderState,
	pickRecorderMimeType,
	RECORDER_MIME_CANDIDATES,
	recorderReducer,
	shouldDiscard,
	voiceNoteFileName,
	VOICE_NOTE_MAX_MS,
	VOICE_NOTE_MIN_MS,
} from "./voice-note"

describe("RECORDER_MIME_CANDIDATES — l'ordre est la décision", () => {
	it("met `audio/mp4` en TÊTE : iOS ne produit ni ne lit le webm", () => {
		expect(RECORDER_MIME_CANDIDATES[0]).toBe("audio/mp4")
	})

	it("place tout mp4 avant tout webm", () => {
		const premierWebm = RECORDER_MIME_CANDIDATES.findIndex((mime) =>
			mime.startsWith("audio/webm"),
		)
		const dernierMp4 = RECORDER_MIME_CANDIDATES.reduce(
			(acc, mime, index) => (mime.startsWith("audio/mp4") ? index : acc),
			-1,
		)
		expect(dernierMp4).toBeLessThan(premierWebm)
	})
})

describe("pickRecorderMimeType", () => {
	it("choisit mp4 quand le navigateur le prend en charge (Safari)", () => {
		expect(pickRecorderMimeType((mime) => mime === "audio/mp4")).toBe(
			"audio/mp4",
		)
	})

	it("choisit mp4 AUSSI quand tout est pris en charge (Chrome)", () => {
		expect(pickRecorderMimeType(() => true)).toBe("audio/mp4")
	})

	it("retombe sur webm quand mp4 manque", () => {
		expect(
			pickRecorderMimeType((mime) => mime.startsWith("audio/webm")),
		).toBe("audio/webm;codecs=opus")
	})

	it("rend `null` quand rien n'est pris en charge — au navigateur de décider", () => {
		expect(pickRecorderMimeType(() => false)).toBeNull()
	})

	it("poursuit le parcours quand `isTypeSupported` lève", () => {
		expect(
			pickRecorderMimeType((mime) => {
				if (mime.startsWith("audio/mp4")) throw new Error("legacy")
				return mime === "audio/webm"
			}),
		).toBe("audio/webm")
	})
})

describe("voiceNoteFileName", () => {
	const AT = Date.UTC(2026, 7, 18, 9, 12, 33)

	it("donne l'extension m4a à un conteneur mp4", () => {
		expect(voiceNoteFileName("audio/mp4", AT)).toBe(
			"message-vocal-2026-08-18-09-12-33.m4a",
		)
	})

	it("ignore les paramètres de codec pour choisir l'extension", () => {
		expect(voiceNoteFileName("audio/webm;codecs=opus", AT)).toContain(".webm")
	})

	it("donne une extension NEUTRE à un conteneur inconnu, jamais une fausse", () => {
		expect(voiceNoteFileName("audio/x-inconnu", AT)).toContain(".bin")
	})

	it("horodate en UTC — le nom ne dépend pas du fuseau de la machine", () => {
		expect(voiceNoteFileName("audio/mp4", AT)).toContain("2026-08-18-09-12-33")
	})

	it("tolère un instant non fini sans fabriquer une date de 1970", () => {
		expect(voiceNoteFileName("audio/mp4", Number.NaN)).toBe(
			"message-vocal-sans-date.m4a",
		)
	})
})

describe("formatVoiceDuration", () => {
	it("formate les secondes sur deux chiffres", () => {
		expect(formatVoiceDuration(7_000)).toBe("0:07")
	})

	it("formate les minutes", () => {
		expect(formatVoiceDuration(83_000)).toBe("1:23")
	})

	it("formate le plafond de deux minutes", () => {
		expect(formatVoiceDuration(VOICE_NOTE_MAX_MS)).toBe("2:00")
	})

	it("ajoute les heures au-delà de soixante minutes", () => {
		expect(formatVoiceDuration(3_723_000)).toBe("1:02:03")
	})

	it("rend `0:00` sur une durée absente, négative ou non finie", () => {
		expect(formatVoiceDuration(null)).toBe("0:00")
		expect(formatVoiceDuration(undefined)).toBe("0:00")
		expect(formatVoiceDuration(-5)).toBe("0:00")
		expect(formatVoiceDuration(Number.NaN)).toBe("0:00")
	})
})

describe("recorderReducer", () => {
	it("part au repos", () => {
		expect(initialRecorderState()).toEqual({
			phase: "idle",
			startedAt: null,
			elapsedMs: 0,
			error: null,
		})
	})

	it("passe par `requesting` — la permission n'est pas instantanée", () => {
		const state = recorderReducer(initialRecorderState(), { kind: "request" })
		expect(state.phase).toBe("requesting")
	})

	it("ignore un second appui pendant la demande ou l'enregistrement", () => {
		const demande = recorderReducer(initialRecorderState(), { kind: "request" })
		expect(recorderReducer(demande, { kind: "request" })).toBe(demande)
		const enCours = recorderReducer(demande, { kind: "started", at: 1_000 })
		expect(recorderReducer(enCours, { kind: "request" })).toBe(enCours)
	})

	it("enregistre à l'ouverture du flux", () => {
		const state = recorderReducer(
			recorderReducer(initialRecorderState(), { kind: "request" }),
			{ kind: "started", at: 5_000 },
		)
		expect(state).toMatchObject({ phase: "recording", startedAt: 5_000 })
	})

	it("ignore un `started` tardif arrivé après un abandon", () => {
		const abandonne = initialRecorderState()
		expect(recorderReducer(abandonne, { kind: "started", at: 5_000 })).toBe(
			abandonne,
		)
	})

	it("avance la durée au battement d'horloge", () => {
		let state = recorderReducer(initialRecorderState(), { kind: "request" })
		state = recorderReducer(state, { kind: "started", at: 1_000 })
		state = recorderReducer(state, { kind: "tick", at: 4_500 })
		expect(state.elapsedMs).toBe(3_500)
	})

	it("PLAFONNE la durée et s'arrête de lui-même", () => {
		let state = recorderReducer(initialRecorderState(), { kind: "request" })
		state = recorderReducer(state, { kind: "started", at: 0 })
		state = recorderReducer(state, { kind: "tick", at: VOICE_NOTE_MAX_MS + 9_000 })
		expect(state.elapsedMs).toBe(VOICE_NOTE_MAX_MS)
		expect(state.phase).toBe("stopping")
	})

	it("ignore un battement hors enregistrement", () => {
		const repos = initialRecorderState()
		expect(recorderReducer(repos, { kind: "tick", at: 9_000 })).toBe(repos)
	})

	it("passe à `stopping` au relâchement, et pas autrement", () => {
		let state = recorderReducer(initialRecorderState(), { kind: "request" })
		expect(recorderReducer(state, { kind: "stop" })).toBe(state)
		state = recorderReducer(state, { kind: "started", at: 0 })
		expect(recorderReducer(state, { kind: "stop" }).phase).toBe("stopping")
	})

	it("revient au repos quand le blob est prêt", () => {
		let state = recorderReducer(initialRecorderState(), { kind: "request" })
		state = recorderReducer(state, { kind: "started", at: 0 })
		state = recorderReducer(state, { kind: "stopped" })
		expect(state).toEqual(initialRecorderState())
	})

	it("retient le message d'échec", () => {
		const state = recorderReducer(initialRecorderState(), {
			kind: "error",
			message: "Micro refusé",
		})
		expect(state).toMatchObject({ phase: "error", error: "Micro refusé" })
	})

	it("l'annulation efface l'échec", () => {
		const enErreur = recorderReducer(initialRecorderState(), {
			kind: "error",
			message: "x",
		})
		expect(recorderReducer(enErreur, { kind: "reset" })).toEqual(
			initialRecorderState(),
		)
	})

	it("l'annulation au repos rend LA MÊME référence", () => {
		const repos = initialRecorderState()
		expect(recorderReducer(repos, { kind: "reset" })).toBe(repos)
	})
})

describe("shouldDiscard", () => {
	it("jette l'effleurement", () => {
		expect(shouldDiscard(300)).toBe(true)
		expect(shouldDiscard(VOICE_NOTE_MIN_MS - 1)).toBe(true)
	})

	it("garde une prise qui atteint le plancher", () => {
		expect(shouldDiscard(VOICE_NOTE_MIN_MS)).toBe(false)
		expect(shouldDiscard(9_000)).toBe(false)
	})

	it("jette une durée non finie — on ne devine pas ce qu'on n'a pas mesuré", () => {
		expect(shouldDiscard(Number.NaN)).toBe(true)
	})
})
