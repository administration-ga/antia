// Dupliqué de socle/packages/agent-features/src/features/iappel/call-timer.test.ts @ ad2e7fdc2 — adaptations : heure relative lue dans les locales françaises du moteur (`t` réel, langue `fr` passée à `Intl`) — attendus inchangés ; cas ajouté : la même heure en anglais.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { elapsedSince, formatClockTime as formatClockTimeIn, formatElapsed } from "./call-timer"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" })
const t = i18n.getFixedT("fr")
/** La forme d'appel des écrans français : langue courante et traduction. */
const formatClockTime = (at: number, now: number) => formatClockTimeIn(at, now, "fr", t)

/**
 * Ce que ces cas gardent : un chrono d'appel qui recule ou qui affiche
 * `NaN` — et un journal d'appels qui redit l'heure ET la date sur chaque
 * ligne au lieu de choisir le repère le plus lisible.
 */

describe("formatElapsed — MM:SS, puis H:MM:SS au-delà d'une heure", () => {
	it("0 ms : début de chrono", () => {
		expect(formatElapsed(0)).toBe("00:00")
	})

	it("valeur négative : une horloge d'appel ne recule pas", () => {
		expect(formatElapsed(-5_000)).toBe("00:00")
	})

	it("NaN : jamais d'artefact de calcul affiché", () => {
		expect(formatElapsed(Number.NaN)).toBe("00:00")
	})

	it("Infinity : non fini, même repli que NaN", () => {
		expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe("00:00")
	})

	it("59 secondes : encore dans la minute", () => {
		expect(formatElapsed(59_000)).toBe("00:59")
	})

	it("60 secondes pile : bascule à la minute suivante", () => {
		expect(formatElapsed(60_000)).toBe("01:00")
	})

	it("1 heure pile : une heure affichée, minutes et secondes à zéro", () => {
		expect(formatElapsed(3_600_000)).toBe("1:00:00")
	})

	it("1 h 2 min 5 s : les minutes ne débordent plus au-delà de l'heure", () => {
		expect(formatElapsed(3_725_000)).toBe("1:02:05")
	})

	it("plusieurs heures : l'heure n'est jamais tronquée à un chiffre", () => {
		expect(formatElapsed(36_000_000)).toBe("10:00:00")
	})
})

describe("elapsedSince — jamais négatif, 0 si rien n'a démarré", () => {
	const NOW = 1_700_000_000_000

	it("startedAt absent (null) : rien n'a démarré", () => {
		expect(elapsedSince(null, NOW)).toBe(0)
	})

	it("startedAt absent (undefined) : même repli", () => {
		expect(elapsedSince(undefined, NOW)).toBe(0)
	})

	it("startedAt dans le futur : ne devient pas une durée négative", () => {
		expect(elapsedSince(NOW + 10_000, NOW)).toBe(0)
	})

	it("cas normal : l'écart exact", () => {
		expect(elapsedSince(NOW - 5_000, NOW)).toBe(5_000)
	})
})

describe("formatClockTime — repères relatifs puis calendaires, en français", () => {
	// Dates construites en heure LOCALE (mois 0-indexé), comme demandé : le
	// test ne dépend ainsi jamais du fuseau de la machine qui l'exécute.
	const NOW = new Date(2026, 7, 18, 14, 32).getTime()

	it("moins d'une minute : à l'instant", () => {
		expect(formatClockTime(NOW - 30_000, NOW)).toBe("à l'instant")
	})

	it("pile une minute : bascule sur le compte en minutes", () => {
		expect(formatClockTime(NOW - 60_000, NOW)).toBe("il y a 1 min")
	})

	it("12 minutes plus tôt", () => {
		expect(formatClockTime(NOW - 12 * 60_000, NOW)).toBe("il y a 12 min")
	})

	it("moins d'une heure, en bord haut : encore en minutes", () => {
		expect(formatClockTime(NOW - 59 * 60_000, NOW)).toBe("il y a 59 min")
	})

	it("aujourd'hui mais plus d'une heure plus tôt : l'heure exacte", () => {
		const at = new Date(2026, 7, 18, 9, 5).getTime()
		expect(formatClockTime(at, NOW)).toBe("09:05")
	})

	it("hier", () => {
		const at = new Date(2026, 7, 17, 20, 0).getTime()
		expect(formatClockTime(at, NOW)).toBe("hier")
	})

	it("avant-hier, même année : jour et mois en toutes lettres, sans année", () => {
		const at = new Date(2026, 7, 10, 8, 0).getTime()
		expect(formatClockTime(at, NOW)).toBe("10 août")
	})

	it("année précédente : jour, mois ET année", () => {
		const at = new Date(2025, 7, 18, 8, 0).getTime()
		expect(formatClockTime(at, NOW)).toBe("18 août 2025")
	})

	it("un horodatage futur (dérive d'horloge) ne produit pas de durée négative absurde", () => {
		expect(formatClockTime(NOW + 5_000, NOW)).toBe("à l'instant")
	})

	it("en anglais, les mêmes repères dans la langue de l'écran", () => {
		const en = i18n.getFixedT("en")
		expect(formatClockTimeIn(NOW - 12 * 60_000, NOW, "en", en)).toBe("12 min ago")
		expect(formatClockTimeIn(new Date(2026, 7, 17, 20, 0).getTime(), NOW, "en", en)).toBe("yesterday")
		expect(formatClockTimeIn(new Date(2026, 7, 10, 8, 0).getTime(), NOW, "en", en)).toBe("August 10")
	})
})
