// Dupliqué de socle/packages/agent-features/src/features/iappel/conference-launch-store.test.ts @ ad2e7fdc2 — adaptations : phrase de refus lue dans les locales françaises du moteur (`t` réel) ; cas retirés : les cinq décisions de poste de `planConferenceLaunch` (même administration, organisation inconnue, autre administration, carte de poste absente en mode personnel, coque verticale) — la branche personnelle et son refus restent ; adresse d'avatar du jeu d'essai rendue opaque (aucune URL absolue en dur).
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import type { CallParticipantState } from "./call-types"
import {
	CONFERENCE_CARRIED_CALL_STATES,
	conferenceInviteesFromCall,
	conferenceLaunchRefusalMessage,
	consumeConferenceLaunch,
	getConferenceLaunchRequest,
	planConferenceLaunch,
	requestConferenceLaunch,
	subscribeConferenceLaunch,
} from "./conference-launch-store"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Le magasin de la demande « Lancer une conférence ».
 *
 * Ce qui est gardé : la demande se POSE, se CONSOMME une seule fois, et deux
 * demandes identiques restent DEUX — sinon la seconde carte « Conférence »
 * cliquée après une fermeture n'ouvrirait rien, et l'écran semblerait en panne.
 */
describe("conference-launch-store", () => {
	afterEach(() => {
		consumeConferenceLaunch()
	})

	it("ne porte aucune demande au départ", () => {
		expect(getConferenceLaunchRequest()).toBeNull()
	})

	it("pose la demande avec le titre proposé, et prévient les abonnés", () => {
		const listener = vi.fn()
		const unsubscribe = subscribeConferenceLaunch(listener)
		requestConferenceLaunch({ title: "Cellule budgétaire" })
		expect(getConferenceLaunchRequest()?.title).toBe("Cellule budgétaire")
		expect(listener).toHaveBeenCalledTimes(1)
		unsubscribe()
	})

	it("un titre vide ou blanc devient null — le champ s'ouvre vide", () => {
		requestConferenceLaunch({ title: "   " })
		expect(getConferenceLaunchRequest()?.title).toBeNull()
		requestConferenceLaunch({ title: null })
		expect(getConferenceLaunchRequest()?.title).toBeNull()
		requestConferenceLaunch({})
		expect(getConferenceLaunchRequest()?.title).toBeNull()
	})

	it("le titre proposé est rogné de ses espaces", () => {
		requestConferenceLaunch({ title: "  Point RH  " })
		expect(getConferenceLaunchRequest()?.title).toBe("Point RH")
	})

	it("la consommation retire la demande, une seule fois", () => {
		const listener = vi.fn()
		const unsubscribe = subscribeConferenceLaunch(listener)
		requestConferenceLaunch({ title: "Équipe" })
		consumeConferenceLaunch()
		expect(getConferenceLaunchRequest()).toBeNull()
		// Seconde consommation : rien à retirer, aucun abonné réveillé pour rien.
		consumeConferenceLaunch()
		expect(listener).toHaveBeenCalledTimes(2)
		unsubscribe()
	})

	it("deux demandes identiques restent deux (seq)", () => {
		requestConferenceLaunch({ title: "Équipe" })
		const first = getConferenceLaunchRequest()
		requestConferenceLaunch({ title: "Équipe" })
		const second = getConferenceLaunchRequest()
		expect(first).not.toBeNull()
		expect(second).not.toBeNull()
		expect(second?.seq).toBeGreaterThan(first?.seq ?? Number.POSITIVE_INFINITY)
		// Instantané NEUF : `useSyncExternalStore` compare par identité.
		expect(second).not.toBe(first)
	})

	it("une demande après consommation reprend avec un seq plus grand", () => {
		requestConferenceLaunch({ title: "A" })
		const before = getConferenceLaunchRequest()?.seq ?? 0
		consumeConferenceLaunch()
		requestConferenceLaunch({ title: "A" })
		expect(getConferenceLaunchRequest()?.seq).toBeGreaterThan(before)
	})

	it("un désabonné n'est plus prévenu", () => {
		const listener = vi.fn()
		const unsubscribe = subscribeConferenceLaunch(listener)
		unsubscribe()
		requestConferenceLaunch({ title: "B" })
		expect(listener).not.toHaveBeenCalled()
	})
})

/**
 * ADR-0150, arbitrage I — la demande porte enfin les PERSONNES et le FIL.
 *
 * Le défaut gardé : les trois déclencheurs nommaient les personnes, et le
 * chemin ne transmettait que le titre — la conférence s'ouvrait vide, et
 * l'hôte devait retrouver à la main ceux qu'il venait de choisir.
 */
describe("conference-launch-store — les personnes et le fil voyagent", () => {
	afterEach(() => {
		consumeConferenceLaunch()
	})

	it("{ title } seul reste une demande valide : aucune personne, aucun fil", () => {
		requestConferenceLaunch({ title: "Point RH" })
		const request = getConferenceLaunchRequest()
		expect(request?.title).toBe("Point RH")
		expect(request?.userIds).toEqual([])
		expect(request?.sourceThreadId).toBeNull()
	})

	it("porte les personnes et le fil source tels que le geste les nomme", () => {
		requestConferenceLaunch({
			title: "Cellule",
			userIds: ["u1", "u2"],
			sourceThreadId: "thread-1",
		})
		const request = getConferenceLaunchRequest()
		expect(request?.userIds).toEqual(["u1", "u2"])
		expect(request?.sourceThreadId).toBe("thread-1")
	})

	it("les personnes sont nettoyées : vides écartés, doublons retirés, ordre gardé", () => {
		requestConferenceLaunch({ userIds: ["u2", " ", "u1", "u2", "", " u3 "] })
		expect(getConferenceLaunchRequest()?.userIds).toEqual(["u2", "u1", "u3"])
	})

	it("la liste portée est figée — un écran ne la mute pas derrière le dialogue", () => {
		const source = ["u1"]
		requestConferenceLaunch({ userIds: source })
		const request = getConferenceLaunchRequest()
		source.push("u2")
		expect(request?.userIds).toEqual(["u1"])
		expect(Object.isFrozen(request?.userIds)).toBe(true)
	})

	it("un fil source vide, blanc ou absent vaut null", () => {
		requestConferenceLaunch({ userIds: ["u1"], sourceThreadId: "   " })
		expect(getConferenceLaunchRequest()?.sourceThreadId).toBeNull()
		requestConferenceLaunch({ userIds: ["u1"], sourceThreadId: null })
		expect(getConferenceLaunchRequest()?.sourceThreadId).toBeNull()
		requestConferenceLaunch({ userIds: ["u1"] })
		expect(getConferenceLaunchRequest()?.sourceThreadId).toBeNull()
	})

	it("userIds null vaut une liste vide", () => {
		requestConferenceLaunch({ title: "A", userIds: null })
		expect(getConferenceLaunchRequest()?.userIds).toEqual([])
	})

	it("une nouvelle demande REMPLACE les personnes de la précédente", () => {
		requestConferenceLaunch({ userIds: ["u1", "u2"], sourceThreadId: "t1" })
		requestConferenceLaunch({ title: "Autre" })
		const request = getConferenceLaunchRequest()
		expect(request?.userIds).toEqual([])
		expect(request?.sourceThreadId).toBeNull()
		expect(request?.people).toEqual({})
	})

	it("les noms voyagent pour les SEULES personnes retenues, et un nom vide n'en est pas un", () => {
		requestConferenceLaunch({
			userIds: ["u1", "u2", "u3"],
			people: [
				{ userId: "u1", displayName: " Awa Ndong ", handle: "awa", avatarUrl: "avatar-awa" },
				{ userId: "u2", displayName: "   ", handle: "ben" },
				{ userId: "u9", displayName: "Hors liste" },
				{ userId: "u3", displayName: "Chloé", handle: " ", avatarUrl: null },
			],
		})
		const request = getConferenceLaunchRequest()
		expect(request?.people).toEqual({
			u1: { displayName: "Awa Ndong", handle: "awa", avatarUrl: "avatar-awa" },
			u3: { displayName: "Chloé", handle: null, avatarUrl: null },
		})
		expect(Object.isFrozen(request?.people)).toBe(true)
	})
})

describe("conferenceInviteesFromCall — T3 ne transmet que ceux qui sont là ou qui sonnent", () => {
	const participant = (
		userId: string,
		state: CallParticipantState,
		isMe = false,
	) => ({ userId, state, isMe })

	it("les états qui voyagent sont exactement hôte, en ligne, qui sonne", () => {
		expect([...CONFERENCE_CARRIED_CALL_STATES].sort()).toEqual(
			["connected", "host", "ringing"].sort(),
		)
	})

	it("garde l'hôte, les décrochés et ceux qui sonnent, dans l'ordre de la grille", () => {
		expect(
			conferenceInviteesFromCall([
				participant("caller", "host"),
				participant("a", "connected"),
				participant("b", "ringing"),
			]),
		).toEqual(["caller", "a", "b"])
	})

	it("écarte partis, refusés, manqués et écartés par l'admission", () => {
		expect(
			conferenceInviteesFromCall([
				participant("a", "connected"),
				participant("left", "left"),
				participant("declined", "declined"),
				participant("missed", "missed"),
				participant("unavailable", "unavailable"),
			]),
		).toEqual(["a"])
	})

	it("m'exclut, quel que soit mon état — hôte compris", () => {
		expect(
			conferenceInviteesFromCall([
				participant("me", "host", true),
				participant("a", "connected"),
			]),
		).toEqual(["a"])
		expect(
			conferenceInviteesFromCall([
				participant("caller", "host"),
				participant("me", "connected", true),
			]),
		).toEqual(["caller"])
	})

	it("ne double pas une personne et ignore un identifiant vide", () => {
		expect(
			conferenceInviteesFromCall([
				participant("a", "connected"),
				participant("a", "ringing"),
				participant("", "connected"),
			]),
		).toEqual(["a"])
	})

	it("un appel sans autre personne présente rend une liste vide", () => {
		expect(
			conferenceInviteesFromCall([
				participant("me", "host", true),
				participant("x", "declined"),
			]),
		).toEqual([])
		expect(conferenceInviteesFromCall([])).toEqual([])
	})
})

describe("planConferenceLaunch — la conférence ne s'ouvre que là où elle mène", () => {
	it("appel personnel dans un réseau : ouvert", () => {
		expect(planConferenceLaunch({ scope: "personnel", personalSpaceHere: true })).toEqual({ ok: true })
	})

	it("hors de tout réseau : refusé — la page du direct n'existe pas ici", () => {
		expect(planConferenceLaunch({ scope: "personnel", personalSpaceHere: false })).toEqual({
			ok: false,
			reason: "personal_elsewhere",
		})
	})

	it("chaque refus a sa phrase", () => {
		for (const reason of ["personal_elsewhere"] as const) {
			expect(conferenceLaunchRefusalMessage(reason, t).length).toBeGreaterThan(10)
		}
		expect(conferenceLaunchRefusalMessage("personal_elsewhere", t)).toBe(
			"La conférence se lance depuis votre réseau.",
		)
	})
})
