/**
 * P05 — la machine d'états de l'appel (spécification 05 §4) quand l'appelant
 * SUIT l'établissement réel des médias : Préparation → Sonnerie → Connexion →
 * Connecté → Reconnexion → Terminé / Échec. Les libellés sont lus dans les
 * locales du moteur (`t` réel), en français et en anglais.
 */
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	isMediaEstablished,
	markCallEstablished,
	callEstablishedAt,
	forgetCallEstablishments,
	__resetCallEstablishmentsForTests,
} from "./call-establishment"
import { deriveCallPhase, type CallPhaseInput } from "./call-phase"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("en")

const ANSWERED = 1_700_000_000_000
const ESTABLISHED = ANSWERED + 4_000

function phase(over: Partial<CallPhaseInput> = {}, translate = t) {
	return deriveCallPhase(
		{
			direction: "outgoing",
			meeting: { status: "active", callStatus: "initiating" },
			connection: "connected",
			hasRemote: false,
			establishedAt: null,
			...over,
		},
		translate,
	)
}

describe("appel sortant — rien n'est affirmé avant sa preuve", () => {
	it("composé mais pas encore mis à sonner : « Appel en préparation… », jamais « Sonnerie… »", () => {
		const p = phase()
		expect(p).toMatchObject({ phase: "connecting", timerStart: null, label: "Appel en préparation…" })
		expect(phase({}, tEn).label).toBe("Setting up the call…")
		// Document pas encore lu : même prudence.
		expect(phase({ meeting: null }).phase).toBe("connecting")
	})

	it("le serveur le fait sonner : « Sonnerie… », sans chrono", () => {
		expect(phase({ meeting: { status: "active", callStatus: "ringing" } })).toMatchObject({ phase: "ringing", timerStart: null })
	})

	it("décroché côté serveur mais médias pas encore établis : « Connexion… », sans chrono", () => {
		const p = phase({ meeting: { status: "active", callStatus: "connected", answeredAt: ANSWERED }, hasRemote: true })
		expect(p).toMatchObject({ phase: "connecting", timerStart: null, label: "Connexion…" })
	})

	it("médias établis : « En communication », la durée part de l'ÉTABLISSEMENT, pas du décrochage", () => {
		const p = phase({ meeting: { status: "active", callStatus: "connected", answeredAt: ANSWERED }, establishedAt: ESTABLISHED })
		expect(p).toMatchObject({ phase: "active", timerStart: ESTABLISHED, label: "En communication" })
	})

	it("établi mais salle pas (encore) connectée sur cet appareil : pas « En communication »", () => {
		expect(phase({ meeting: { status: "active", callStatus: "connected" }, establishedAt: ESTABLISHED, connection: "connecting" }).phase).toBe("connecting")
	})
})

describe("appel entrant décroché", () => {
	it("le temps que la salle arrive : « Connexion… » — jamais « Sonnerie… » une fois décroché", () => {
		const p = phase({ direction: "incoming", meeting: { status: "active", callStatus: "ringing" }, answeredAtLocal: ANSWERED })
		expect(p).toMatchObject({ phase: "connecting", timerStart: null })
	})

	it("établi : la durée part de l'établissement", () => {
		expect(phase({ direction: "incoming", meeting: { status: "active", callStatus: "connected", answeredAt: ANSWERED }, establishedAt: ESTABLISHED })).toMatchObject({ phase: "active", timerStart: ESTABLISHED })
	})
})

describe("reconnexion, attente, fin et échec", () => {
	it("une reconnexion garde la durée (même origine), l'appel n'est pas un nouvel appel", () => {
		const p = phase({ meeting: { status: "active", callStatus: "connected", answeredAt: ANSWERED }, establishedAt: ESTABLISHED, connection: "reconnecting" })
		expect(p).toMatchObject({ phase: "reconnecting", timerStart: ESTABLISHED, label: "Reconnexion…" })
	})

	it("mis en attente avant tout établissement : aucune durée inventée", () => {
		expect(phase({ meeting: { status: "active", callStatus: "connected" }, isHeld: true })).toMatchObject({ phase: "held", timerStart: null })
	})

	it("un appel TERMINÉ reste terminé, même si la salle signale encore des médias (événement tardif)", () => {
		const p = phase({ meeting: { status: "ended", callStatus: "ended", endReason: "normal", answeredAt: ANSWERED }, establishedAt: ESTABLISHED, hasRemote: true })
		expect(p).toMatchObject({ phase: "ended", endKind: "ended", timerStart: null })
	})

	it("occupé à l'admission : l'écran de fin dit « Occupé »", () => {
		expect(phase({ meeting: { status: "ended", callStatus: "ended", endReason: "busy" } })).toMatchObject({ phase: "ended", endKind: "busy" })
	})

	it("échec de jeton ou de salle : « Connexion impossible », sans sonnerie", () => {
		expect(phase({ hasError: true })).toMatchObject({ phase: "failed", timerStart: null })
		expect(phase({ connection: "disconnected", meeting: { status: "active", callStatus: "ringing" } }).phase).toBe("failed")
	})
})

describe("règle d'origine gardée quand l'établissement n'est pas suivi", () => {
	it("sans `establishedAt`, le décrochage serveur fait foi (hôtes qui ne suivent pas l'établissement)", () => {
		const p = deriveCallPhase({ direction: "outgoing", meeting: { status: "active", callStatus: "connected", answeredAt: ANSWERED }, connection: "connected", hasRemote: true }, t)
		expect(p).toMatchObject({ phase: "active", timerStart: ANSWERED })
		expect(deriveCallPhase({ direction: "outgoing", meeting: { status: "active", callStatus: "initiating" }, connection: "connected", hasRemote: false }, t).phase).toBe("ringing")
	})
})

describe("call-establishment — un fait observé, consigné une fois", () => {
	it("établi = salle connectée ET un autre participant", () => {
		expect(isMediaEstablished({ connected: true, remoteParticipants: 1 })).toBe(true)
		expect(isMediaEstablished({ connected: true, remoteParticipants: 0 })).toBe(false)
		expect(isMediaEstablished({ connected: false, remoteParticipants: 2 })).toBe(false)
	})

	it("la première observation fait foi ; une reconnexion ne la réécrit pas ; l'oubli suit la ligne", () => {
		__resetCallEstablishmentsForTests()
		expect(markCallEstablished("call-1", ESTABLISHED)).toBe(true)
		expect(markCallEstablished("call-1", ESTABLISHED + 9_000)).toBe(false)
		expect(callEstablishedAt("call-1")).toBe(ESTABLISHED)
		expect(callEstablishedAt(null)).toBeNull()
		forgetCallEstablishments(new Set(["call-2"]))
		expect(callEstablishedAt("call-1")).toBeNull()
	})
})
