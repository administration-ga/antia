// Dupliqué de socle/packages/agent-features/src/features/direct/direct-call-coexistence.test.ts @ ad2e7fdc2 — adaptations : domaine pur et tests portés ; aucune dépendance inter-produit.
import { describe, expect, it } from "vitest"
import {
	DIRECT_CALL_DUCK_VOLUME,
	directAudioVolume,
	isCallBusy,
	liveDuringCallNotice,
	planLiveDuringCall,
} from "./direct-call-coexistence"

/**
 * Doctrine du 2026-09-14 : « le live ne peut pas impacter un appel
 * téléphonique — s'il y a un appel, je coupe juste le micro du live ». Le
 * direct et l'appel sont deux salles ; ce que le direct fait DE LUI-MÊME
 * quand la ligne se prend se vérifie ici, sans salle.
 */
describe("la ligne est occupée quand quelqu'un parle, ou va parler", () => {
	it("`connecting` et `active` occupent ; parqué, entrant, terminé non", () => {
		expect(isCallBusy([{ status: "active" }])).toBe(true)
		expect(isCallBusy([{ status: "connecting" }])).toBe(true)
		expect(isCallBusy([{ status: "held" }])).toBe(false)
		expect(isCallBusy([{ status: "incoming" }])).toBe(false)
		expect(isCallBusy([{ status: "ended" }])).toBe(false)
		expect(isCallBusy([])).toBe(false)
	})

	it("un appel de la FILE compte comme un autre — c'est une voix au téléphone", () => {
		expect(isCallBusy([{ status: "active", kind: "queue" }])).toBe(true)
	})

	it("un appel tenu à côté d'un appel actif : la ligne reste prise", () => {
		expect(isCallBusy([{ status: "held" }, { status: "active" }])).toBe(true)
	})
})

describe("prendre la ligne coupe le micro du direct, et le retient", () => {
	it("micro allumé → coupé, et l'état d'avant est retenu", () => {
		expect(planLiveDuringCall({ callBusy: true, micEnabled: true, hold: null })).toEqual({
			intent: { micEnabled: false },
			hold: { micWasEnabled: true },
		})
	})

	it("micro déjà coupé → rien à couper, mais on retient qu'il l'était", () => {
		expect(planLiveDuringCall({ callBusy: true, micEnabled: false, hold: null })).toEqual({
			intent: null,
			hold: { micWasEnabled: false },
		})
	})

	it("pendant l'appel, rallumer son micro est un CHOIX — on ne le défait pas", () => {
		// La ligne est prise depuis un moment, la personne a rallumé son micro
		// (elle a décidé de parler aux deux) : aucun correctif, la retenue reste.
		expect(
			planLiveDuringCall({
				callBusy: true,
				micEnabled: true,
				hold: { micWasEnabled: true },
			}),
		).toEqual({ intent: null, hold: { micWasEnabled: true } })
	})
})

describe("raccrocher rend le micro tel qu'il était", () => {
	it("allumé avant, coupé maintenant → rallumé", () => {
		expect(
			planLiveDuringCall({
				callBusy: false,
				micEnabled: false,
				hold: { micWasEnabled: true },
			}),
		).toEqual({ intent: { micEnabled: true }, hold: null })
	})

	it("coupé avant → reste coupé (on ne rallume pas ce qu'on n'a pas coupé)", () => {
		expect(
			planLiveDuringCall({
				callBusy: false,
				micEnabled: false,
				hold: { micWasEnabled: false },
			}),
		).toEqual({ intent: null, hold: null })
	})

	it("rallumé à la main pendant l'appel → rien à faire, la retenue s'efface", () => {
		expect(
			planLiveDuringCall({
				callBusy: false,
				micEnabled: true,
				hold: { micWasEnabled: true },
			}),
		).toEqual({ intent: null, hold: null })
	})

	it("hors appel et sans retenue, rien ne bouge jamais", () => {
		for (const micEnabled of [true, false]) {
			expect(planLiveDuringCall({ callBusy: false, micEnabled, hold: null })).toEqual({
				intent: null,
				hold: null,
			})
		}
	})
})

describe("le son du direct se baisse, il ne se coupe pas", () => {
	it("baissé pendant l'appel, plein sinon", () => {
		expect(directAudioVolume(true)).toBe(DIRECT_CALL_DUCK_VOLUME)
		expect(directAudioVolume(false)).toBe(1)
		expect(DIRECT_CALL_DUCK_VOLUME).toBeGreaterThan(0)
		expect(DIRECT_CALL_DUCK_VOLUME).toBeLessThan(0.5)
	})

	it("l'écran le DIT — au publiant son micro, au spectateur son son", () => {
		expect(liveDuringCallNotice({ callBusy: true, publishes: true })).toMatch(/micro/)
		expect(liveDuringCallNotice({ callBusy: true, publishes: false })).not.toMatch(/micro/)
		expect(liveDuringCallNotice({ callBusy: true, publishes: false })).toMatch(/son/)
		expect(liveDuringCallNotice({ callBusy: false, publishes: true })).toBeNull()
	})
})
