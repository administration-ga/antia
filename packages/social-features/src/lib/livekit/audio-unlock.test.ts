// Dupliqué de socle/packages/agent-features/src/features/iappel/audio-unlock.test.ts @ ad2e7fdc2 — adaptations : test placé à côté de sa source (`lib/livekit/`, ex-paquet `livekit` du socle), imports relatifs au lieu de `@workspace/livekit/*`.
/**
 * La chaîne du DÉVERROUILLAGE AUDIO (S1/S7) et le bip d'attente (S6) —
 * testés ici, en environnement node, via la fabrique injectable du module
 * partagé `./audio-unlock` (précédent d'import :
 * `ringing-signal.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	__resetSharedAudioForTests,
	getSharedAudioContext,
	installAudioUnlock,
	isRingtoneAudioBlocked,
	subscribeAudioBlocked,
	type AudioUnlockTarget,
} from "./audio-unlock"
import { shouldReplayWaitingBeep } from "./use-waiting-beep"

/** Un AudioContext minimal : état, resume(), statechange. */
class FakeAudioContext {
	state: "suspended" | "running" | "closed" = "suspended"
	resumeCalls = 0
	private listeners = new Set<() => void>()

	addEventListener(_type: string, listener: () => void) {
		this.listeners.add(listener)
	}
	removeEventListener(_type: string, listener: () => void) {
		this.listeners.delete(listener)
	}
	async resume() {
		this.resumeCalls += 1
		this.state = "running"
		for (const listener of this.listeners) listener()
	}
}

/** Une cible d'écouteurs façon window, pilotable à la main. */
class FakeTarget implements AudioUnlockTarget {
	private handlers = new Map<string, Set<() => void>>()

	addEventListener(type: string, listener: unknown) {
		const set = this.handlers.get(type) ?? new Set()
		set.add(listener as () => void)
		this.handlers.set(type, set)
	}
	removeEventListener(type: string, listener: unknown) {
		this.handlers.get(type)?.delete(listener as () => void)
	}
	count(type: string): number {
		return this.handlers.get(type)?.size ?? 0
	}
	fire(type: string) {
		for (const listener of this.handlers.get(type) ?? []) listener()
	}
}

let created: FakeAudioContext[] = []

beforeEach(() => {
	created = []
	__resetSharedAudioForTests(() => {
		const context = new FakeAudioContext()
		created.push(context)
		return context as unknown as AudioContext
	})
})

afterEach(() => {
	__resetSharedAudioForTests(null)
})

describe("getSharedAudioContext — un seul contexte, jamais fermé", () => {
	it("crée UNE fois et rend toujours la même instance", () => {
		const first = getSharedAudioContext()
		const second = getSharedAudioContext()
		expect(first).toBe(second)
		expect(created).toHaveLength(1)
	})

	it("sans fabrique (node nu), rend null sans lever", () => {
		__resetSharedAudioForTests(null)
		expect(getSharedAudioContext()).toBeNull()
	})
})

describe("isRingtoneAudioBlocked — dire le blocage, jamais l'inventer", () => {
	it("rien à signaler tant qu'aucun contexte n'existe", () => {
		expect(isRingtoneAudioBlocked()).toBe(false)
	})

	it("suspended ⇒ bloqué ; running ⇒ débloqué, abonnés prévenus", async () => {
		let notified = 0
		const unsubscribe = subscribeAudioBlocked(() => {
			notified += 1
		})
		const context = getSharedAudioContext()
		expect(isRingtoneAudioBlocked()).toBe(true)
		await context?.resume()
		expect(isRingtoneAudioBlocked()).toBe(false)
		expect(notified).toBeGreaterThan(0)
		unsubscribe()
	})
})

describe("installAudioUnlock — le premier geste arme l'audio", () => {
	it("pose pointerdown + keydown, et le geste déclenche resume()", () => {
		const target = new FakeTarget()
		const uninstall = installAudioUnlock(target)
		expect(target.count("pointerdown")).toBe(1)
		expect(target.count("keydown")).toBe(1)

		getSharedAudioContext() // le contexte existe, suspendu
		target.fire("pointerdown")
		expect(created[0]?.resumeCalls).toBeGreaterThan(0)
		expect(created[0]?.state).toBe("running")
		uninstall()
	})

	it("compté par référence : le dernier désinstallateur retire les écouteurs", () => {
		const target = new FakeTarget()
		const first = installAudioUnlock(target)
		const second = installAudioUnlock(target)
		first()
		expect(target.count("pointerdown")).toBe(1)
		second()
		expect(target.count("pointerdown")).toBe(0)
	})

	it("désinstallateur idempotent — le rappeler ne décompte pas deux fois", () => {
		const target = new FakeTarget()
		const first = installAudioUnlock(target)
		first()
		first()
		const again = installAudioUnlock(target)
		expect(target.count("pointerdown")).toBe(1)
		again()
	})
})

describe("shouldReplayWaitingBeep — un bip par IDENTITÉ d'appel, jamais plus", () => {
	it("front montant : null → id joue", () => {
		expect(shouldReplayWaitingBeep(null, "a")).toBe(true)
	})
	it("re-render : même id ne rejoue pas", () => {
		expect(shouldReplayWaitingBeep("a", "a")).toBe(false)
	})
	it("changement d'appel en attente : rejoue", () => {
		expect(shouldReplayWaitingBeep("a", "b")).toBe(true)
	})
	it("extinction : id → null ne joue pas", () => {
		expect(shouldReplayWaitingBeep("a", null)).toBe(false)
	})
})
