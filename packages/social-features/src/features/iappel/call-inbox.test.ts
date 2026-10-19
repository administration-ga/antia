// Dupliqué de socle/packages/agent-features/src/features/iappel/call-inbox.test.ts @ ad2e7fdc2 — adaptations : appels du moteur (`Id<"calls">`, sans portée poste ni priorité) ; cas retirés : le poste avant le personnel (2), l'urgence à portée égale (1), la sonnerie « poste » (1) et « urgent » (1) — ni poste ni priorité dans le moteur ; l'ordre total et la sonnerie unique se vérifient sur l'ancienneté.
import { describe, expect, it } from "vitest"

import {
	compareIncoming,
	planIncomingCalls,
	ringtoneVariantFor,
	type InboxSlotView,
} from "./call-inbox"
import type { RingingCall } from "./call-types"

const NOW = 1_700_000_000_000

function call(id: string, over: Partial<{ since: number }> = {}): RingingCall {
	return {
		meetingId: id as RingingCall["meetingId"],
		scope: "personnel",
		caller: { name: `Appelant ${id}` },
		mediaType: "audio",
		ringingSince: over.since ?? NOW - 1_000,
	}
}

const busySlot: InboxSlotView = { meetingId: "en-cours", status: "active" }

function plan(over: Partial<Parameters<typeof planIncomingCalls>[0]> = {}) {
	return planIncomingCalls({
		ringing: [],
		slots: [],
		now: NOW,
		ringtoneMuted: false,
		...over,
	})
}

describe("l'ordre de présentation", () => {
	it("le plus ancien d'abord — c'est lui qu'on va manquer", () => {
		const recent = call("recent", { since: NOW - 1_000 })
		const ancien = call("ancien", { since: NOW - 40_000 })
		const p = plan({ ringing: [recent, ancien] })
		expect(p.primary?.meetingId).toBe("ancien")
		expect(p.secondary.map((c) => c.meetingId)).toEqual(["recent"])
	})

	it("compareIncoming est un ordre total utilisable par sort()", () => {
		expect(compareIncoming(call("a", { since: NOW - 5_000 }), call("b"))).toBeLessThan(0)
		expect(compareIncoming(call("a"), call("a"))).toBe(0)
	})
})

describe("ce qu'on écarte", () => {
	it("un appel déjà décroché ne sonne plus", () => {
		const p = plan({
			ringing: [call("x")],
			slots: [{ meetingId: "x", status: "active" }],
		})
		expect(p.primary).toBeNull()
		expect(p.audible).toBeNull()
	})

	it("un appel refusé localement disparaît sans attendre le serveur", () => {
		const p = plan({ ringing: [call("x")], dismissed: new Set(["x"]) })
		expect(p.primary).toBeNull()
	})

	it("hors fenêtre de sonnerie, on cesse d'annoncer : décrocher serait vain", () => {
		const p = plan({ ringing: [call("vieux", { since: NOW - 130_000 })] })
		expect(p.primary).toBeNull()
	})

	it("la fenêtre est paramétrable et inclusive à la borne", () => {
		const pile = plan({
			ringing: [call("pile", { since: NOW - 120_000 })],
		})
		expect(pile.primary?.meetingId).toBe("pile")
	})
})

describe("le son", () => {
	it("appel personnel : profil standard", () => {
		expect(plan({ ringing: [call("x")] }).audible).toEqual({
			meetingId: "x",
			profile: "standard",
			mode: "ring",
		})
		expect(ringtoneVariantFor({ scope: "personnel" })).toBe("standard")
	})

	it("sonnerie coupée : l'écran reste, le son part", () => {
		const p = plan({ ringing: [call("x")], ringtoneMuted: true })
		expect(p.primary).not.toBeNull()
		expect(p.audible).toBeNull()
		expect(p.vibrate).toBe(false)
	})

	it("ne pas déranger : silence, ceinture et bretelles avec le serveur", () => {
		expect(plan({ ringing: [call("x")], dnd: true }).audible).toBeNull()
	})

	it("UNE seule sonnerie pour deux entrants — celle du principal", () => {
		const p = plan({
			ringing: [call("recent", { since: NOW - 1_000 }), call("ancien", { since: NOW - 9_000 })],
		})
		expect(p.audible?.meetingId).toBe("ancien")
	})
})

describe("appel en attente (je suis déjà en ligne)", () => {
	it("le signal devient discret au lieu de couvrir la conversation", () => {
		const p = plan({ ringing: [call("x")], slots: [busySlot] })
		expect(p.callWaiting).toBe(true)
		expect(p.audible?.mode).toBe("waiting")
	})

	it("et l'appareil ne vibre pas contre l'oreille", () => {
		const p = plan({ ringing: [call("x")], slots: [busySlot], isMobile: true })
		expect(p.vibrate).toBe(false)
	})

	it("un slot en ATTENTE occupe aussi la ligne", () => {
		const p = plan({
			ringing: [call("x")],
			slots: [{ meetingId: "parque", status: "held" }],
		})
		expect(p.callWaiting).toBe(true)
	})

	it("un slot terminé ne compte plus : la ligne est libre", () => {
		const p = plan({
			ringing: [call("x")],
			slots: [{ meetingId: "fini", status: "ended" }],
		})
		expect(p.callWaiting).toBe(false)
		expect(p.audible?.mode).toBe("ring")
	})
})

describe("la vibration", () => {
	it("au téléphone seulement", () => {
		expect(plan({ ringing: [call("x")], isMobile: true }).vibrate).toBe(true)
		expect(plan({ ringing: [call("x")], isMobile: false }).vibrate).toBe(false)
		expect(plan({ ringing: [call("x")] }).vibrate).toBe(false)
	})

	it("obéit à la préférence « Vibrer » (S3) — elle RESTREINT seulement", () => {
		// Coupée : pas de vibration, même mobile + sonnerie pleine.
		expect(
			plan({ ringing: [call("x")], isMobile: true, vibrateEnabled: false })
				.vibrate,
		).toBe(false)
		// Posée : ne suffit pas à vibrer hors mobile.
		expect(
			plan({ ringing: [call("x")], isMobile: false, vibrateEnabled: true })
				.vibrate,
		).toBe(false)
		// Absente : défaut vrai — même défaut que preferences.getMine.
		expect(plan({ ringing: [call("x")], isMobile: true }).vibrate).toBe(true)
	})
})

describe("rien à annoncer", () => {
	it("aucun appel : plan vide, sans null-safety à écrire côté écran", () => {
		const p = plan()
		expect(p).toEqual({
			primary: null,
			secondary: [],
			audible: null,
			callWaiting: false,
			vibrate: false,
		})
	})
})
