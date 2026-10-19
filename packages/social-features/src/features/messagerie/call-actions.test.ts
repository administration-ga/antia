// Dupliqué de socle/packages/agent-features/src/features/messagerie/call-actions.test.ts @ ad2e7fdc2 — adaptations : `callActionsFor` reçoit la traduction française du moteur (`t` en dernier paramètre) — les libellés attendus restent le texte exact du socle ; doctrine `callByHandle` → `calls.direct.callMember` dans les commentaires ; un cas ajouté : les libellés suivent la langue (anglais).
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import { callActionsFor as callActionsForT, type CallActionsContext } from "./call-actions"

const fr = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")
const en = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("en")

/** Le module tel que l'écran français l'appelle. */
function callActionsFor(context: CallActionsContext) {
	return callActionsForT(context, fr)
}

describe("callActionsFor — un brouillon n'appelle personne", () => {
	it("n'offre AUCUN bouton", () => {
		const actions = callActionsFor({
			kind: "draft",
			counterpartHandle: "nzoghe",
			hasActiveCall: false,
		})
		expect(actions.audio.available).toBe(false)
		expect(actions.video.available).toBe(false)
		expect(actions.group.available).toBe(false)
	})
})

describe("callActionsFor — un fil 1:1", () => {
	it("offre l'audio ET la vidéo quand le handle est connu", () => {
		const actions = callActionsFor({
			kind: "chat",
			counterpartHandle: "nzoghe",
			hasActiveCall: false,
		})
		expect(actions.audio).toMatchObject({ available: true, disabled: false })
		expect(actions.video).toMatchObject({ available: true, disabled: false })
	})

	it("n'offre pas le bouton de GROUPE", () => {
		expect(
			callActionsFor({
				kind: "chat",
				counterpartHandle: "nzoghe",
				hasActiveCall: false,
			}).group.available,
		).toBe(false)
	})

	it("retire les boutons quand le handle manque — personne n'est joignable sans profil publié", () => {
		for (const handle of [null, undefined, "", "   "]) {
			const actions = callActionsFor({
				kind: "chat",
				counterpartHandle: handle,
				hasActiveCall: false,
			})
			expect(actions.audio.available).toBe(false)
			expect(actions.video.available).toBe(false)
		}
	})

	it("nomme chaque bouton — un pictogramme nu n'apprend rien", () => {
		const actions = callActionsFor({
			kind: "chat",
			counterpartHandle: "nzoghe",
			hasActiveCall: false,
		})
		expect(actions.audio.label).toBe("Appel audio")
		expect(actions.video.label).toBe("Appel vidéo")
	})
})

describe("callActionsFor — un appel EN COURS désactive tout", () => {
	it("laisse les boutons du 1:1 visibles mais inertes", () => {
		const actions = callActionsFor({
			kind: "chat",
			counterpartHandle: "nzoghe",
			hasActiveCall: true,
		})
		expect(actions.audio).toMatchObject({ available: true, disabled: true })
		expect(actions.video).toMatchObject({ available: true, disabled: true })
	})

	it("désactive AUSSI le bouton de groupe", () => {
		expect(
			callActionsFor({ kind: "groupe", hasActiveCall: true }).group.disabled,
		).toBe(true)
	})
})

describe("callActionsFor — un groupe", () => {
	it("offre audio ET vidéo, comme un tête-à-tête", () => {
		// ⚠️ Ce test attendait l'inverse (« n'offre QUE le bouton de groupe »)
		// jusqu'au 2026-08-22. Le bouton unique était la conséquence d'un canal
		// mal choisi : l'appel de groupe partait sur iRÉUNION, où « la caméra
		// s'allume ou non une fois entré ». Devenu un APPEL, il se demande
		// comme tout appel — sans quoi on reconduirait le défaut corrigé sur le
		// 1:1 : un « Appel vidéo » qui ouvre un appel audio, sans rien dire.
		const actions = callActionsFor({ kind: "groupe", hasActiveCall: false })
		expect(actions.audio.available).toBe(true)
		expect(actions.video.available).toBe(true)
		// `group` n'est plus un bouton : il reste le marqueur « ce fil est un
		// groupe », que l'en-tête lit pour sa signalétique d'appel vivant.
		expect(actions.group.available).toBe(false)
	})

	it("dit « Démarrer » quand aucun appel n'est en cours dans le groupe", () => {
		expect(
			callActionsFor({ kind: "groupe", hasActiveCall: false }).group.label,
		).toBe("Démarrer un appel de groupe")
	})

	it("dit « Rejoindre » quand le groupe a un appel vivant", () => {
		expect(
			callActionsFor({
				kind: "groupe",
				hasActiveCall: false,
				groupCallLive: true,
			}).group.label,
		).toBe("Rejoindre l'appel en cours")
	})

	it("garde le bouton ACTIF pour rejoindre — c'est là qu'il sert le plus", () => {
		expect(
			callActionsFor({
				kind: "groupe",
				hasActiveCall: false,
				groupCallLive: true,
			}).group.disabled,
		).toBe(false)
	})

	it("ignore le handle, qui n'adresse pas un groupe", () => {
		// Un fil 1:1 sans handle publié perd ses boutons (le moteur ne joint
		// qu'un profil publié) ; un groupe s'adresse par son `threadId` et
		// reste joignable quoi qu'il arrive aux profils de ses membres.
		const actions = callActionsFor({
			kind: "groupe",
			counterpartHandle: null,
			hasActiveCall: false,
		})
		expect(actions.audio.available).toBe(true)
		expect(actions.video.available).toBe(true)
	})

	it("désactive les DEUX boutons quand je suis déjà en ligne", () => {
		const actions = callActionsFor({ kind: "groupe", hasActiveCall: true })
		expect(actions.audio.disabled).toBe(true)
		expect(actions.video.disabled).toBe(true)
	})

	it("les libellés disent « Rejoindre » quand le groupe a un appel vivant", () => {
		const actions = callActionsFor({
			kind: "groupe",
			hasActiveCall: false,
			groupCallLive: true,
		})
		expect(actions.audio.label).toBe("Rejoindre l'appel en cours")
		expect(actions.video.label).toBe("Rejoindre en vidéo")
	})
})

describe("callActionsFor — la langue de l'écran", () => {
	it("nomme les boutons dans la langue courante", () => {
		const actions = callActionsForT(
			{ kind: "chat", counterpartHandle: "nzoghe", hasActiveCall: false },
			en,
		)
		expect(actions.audio.label).toBe("Audio call")
		expect(actions.video.label).toBe("Video call")
	})
})
