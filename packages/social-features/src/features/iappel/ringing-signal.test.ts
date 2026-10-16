// Dupliqué de socle/packages/agent-features/src/features/iappel/ringing-signal.test.ts @ ad2e7fdc2 — adaptations : profils parcourus depuis `RINGTONE_PROFILES` (ceux que le lot des sonneries garde) au lieu d'une liste écrite avec « poste » ; cas retirés : les douze cas du repli `ringingFromListMine` (retiré : jamais utilisé, il dérivait la sonnerie de `meetings.listMine` et présumait la portée poste sur `orgId`) ; cas ajouté : la fenêtre de sonnerie est celle du contrat du moteur.
import { describe, expect, it } from "vitest"

import { CALL_RING_WINDOW_MS as CONTRACT_RING_WINDOW_MS } from "@antsia/social-contracts/calls"

import { RINGTONE_PROFILES, type RingtoneVariant } from "../../lib/livekit/use-ringtone"
import { CALL_RING_WINDOW_MS, vibrationPatternFor } from "./ringing-signal"

const VARIANTS = Object.keys(RINGTONE_PROFILES) as RingtoneVariant[]

describe("vibrationPatternFor — la vibration suit le son", () => {
	it("un motif par profil, tous distincts", () => {
		const patterns = VARIANTS.map((variant) => JSON.stringify(vibrationPatternFor(variant)))
		expect(new Set(patterns).size).toBe(VARIANTS.length)
	})

	it("l'urgence vibre plus souvent et plus court", () => {
		expect(vibrationPatternFor("urgent").length).toBeGreaterThan(
			vibrationPatternFor("standard").length,
		)
	})

	it("aucune pause négative ou nulle — un moteur haptique n'accepte pas ça", () => {
		for (const variant of VARIANTS) {
			for (const step of vibrationPatternFor(variant)) {
				expect(step).toBeGreaterThan(0)
			}
		}
	})
})

describe("CALL_RING_WINDOW_MS", () => {
	it("est la fenêtre de sonnerie du moteur — deux minutes, une seule source", () => {
		expect(CALL_RING_WINDOW_MS).toBe(CONTRACT_RING_WINDOW_MS)
		expect(CALL_RING_WINDOW_MS).toBe(120_000)
	})
})
