// Dupliqué de socle/packages/agent-features/src/features/iappel/media-watchdog.test.ts @ ad2e7fdc2 — adaptations : la phrase vient de `cameraStartTimeoutMessage(t)`, lue dans les locales françaises du moteur (`t` réel) — mêmes attendus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	CAMERA_START_TIMEOUT_MS,
	cameraStartTimeoutMessage,
	raceMediaStart,
} from "./media-watchdog"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * `setCameraEnabled(true)` qui ne répond jamais laissait le bouton allumé et
 * la vignette en avatar, sans un mot (recette du 2026-09-13). Le chien de
 * garde ne juge que le silence : une erreur reste l'affaire de l'appelant.
 */
describe("raceMediaStart", () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it("une promesse qui aboutit est « réglée », avant l'horloge", async () => {
		const outcome = raceMediaStart(Promise.resolve(undefined), 1_000)
		await expect(outcome).resolves.toBe("settled")
	})

	it("une promesse qui ÉCHOUE est réglée aussi — l'erreur est traitée ailleurs", async () => {
		const attempt = Promise.reject(new Error("NotReadableError"))
		attempt.catch(() => {})
		await expect(raceMediaStart(attempt, 1_000)).resolves.toBe("settled")
	})

	it("une promesse muette est déclarée en dépassement à l'échéance, pas avant", async () => {
		const jamais = new Promise<never>(() => {})
		let outcome: string | null = null
		void raceMediaStart(jamais, CAMERA_START_TIMEOUT_MS).then((o) => {
			outcome = o
		})
		await vi.advanceTimersByTimeAsync(CAMERA_START_TIMEOUT_MS - 1)
		expect(outcome).toBeNull()
		await vi.advanceTimersByTimeAsync(1)
		expect(outcome).toBe("timeout")
	})

	it("parle APRÈS livekit-client (10 s d'attente d'une publication en cours), jamais avant", () => {
		expect(CAMERA_START_TIMEOUT_MS).toBeGreaterThan(10_000)
	})

	it("la phrase dit quoi faire : autorisation dans la barre d'adresse, puis rechargement", () => {
		expect(cameraStartTimeoutMessage(t)).toMatch(/barre d'adresse/)
		expect(cameraStartTimeoutMessage(t)).toMatch(/rechargez/)
	})
})
