// Dupliqué de socle/packages/agent-features/src/lib/call-errors.test.ts @ ad2e7fdc2 — adaptations : erreurs du moteur (`{ code, rule?, params? }` dans `data`) au lieu des codes `LIVEKIT_*`/`NOT_*` ; phrases lues dans les locales françaises du moteur (`t` réel) ; le refus définitif porté par une phrase du serveur devient une RÈGLE du domaine (`CALL_ENDED`), même garantie (jamais « Réessayez ») ; cas retiré : code cherché dans le message brut d'un déploiement de développement (le moteur porte toujours son code dans `data`) ; cas ajoutés : code du moteur sans phrase d'appel, règle avec ses bornes.
import { describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	callErrorMessage,
	convexErrorCode,
	isCallConfigurationError,
	livekitRoomErrorMessage,
} from "./call-errors"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Reproduit une `ConvexError` telle qu'elle arrive au client : le message est
 * masqué en production, seul `data` porte l'information.
 */
function convexErrorLike(data: unknown, message = "Server Error"): Error {
	return Object.assign(new Error(message), { data })
}

describe("convexErrorCode", () => {
	it("lit le code dans un data chaîne", () => {
		expect(convexErrorCode(convexErrorLike("mediaServerNotConfigured"))).toBe(
			"mediaServerNotConfigured",
		)
	})

	it("lit le code dans un data objet — la forme du moteur", () => {
		expect(convexErrorCode(convexErrorLike({ code: "unauthenticated" }))).toBe("unauthenticated")
	})

	it("ne renvoie rien pour une erreur ordinaire ou une valeur non-objet", () => {
		expect(convexErrorCode(new Error("boom"))).toBeUndefined()
		expect(convexErrorCode("boom")).toBeUndefined()
		expect(convexErrorCode(null)).toBeUndefined()
	})
})

describe("callErrorMessage", () => {
	it("traduit mediaServerNotConfigured alors que le message est masqué en prod", () => {
		// C'est LE cas de la panne : en production le client ne voyait que
		// « Server Error » et l'UI tournait indéfiniment sur « Connexion… ».
		const err = convexErrorLike({ code: "mediaServerNotConfigured" })
		expect(callErrorMessage(err, t)).toContain("n'est pas configurée")
		expect(callErrorMessage(err, t)).not.toContain("Server Error")
	})

	it("privilégie le code applicatif sur le contenu du message", () => {
		const err = convexErrorLike({ code: "notFound" }, "unauthenticated quelque part dans le texte")
		expect(callErrorMessage(err, t)).toContain("n'est plus disponible")
	})

	it("n'expose jamais le « Server Error » brut à l'usager", () => {
		const message = callErrorMessage(convexErrorLike(undefined), t)
		expect(message).not.toContain("Server Error")
		expect(message).toContain("Réessayez")
	})

	it("répond aussi pour une valeur jetée qui n'est pas une Error", () => {
		expect(callErrorMessage("panne réseau", t)).toContain("impossible")
	})

	it("un refus DÉFINITIF (règle du domaine) se dit, jamais « Réessayez »", () => {
		// `calls.lifecycle.join` sur un appel déjà fini lève la règle
		// `CALL_ENDED` : un refus définitif ne doit JAMAIS devenir « Réessayez
		// dans un instant ».
		const message = callErrorMessage(convexErrorLike({ code: "invalidArgument", rule: "CALL_ENDED" }), t)
		expect(message).toBe("Cet appel est terminé.")
		expect(message).not.toContain("Réessayez")
	})

	it("une règle porte ses bornes jusqu'à la phrase", () => {
		const err = convexErrorLike({ code: "invalidArgument", rule: "GROUP_CALL_FULL", params: { max: 11 } })
		expect(callErrorMessage(err, t)).toBe("Un appel de groupe est plafonné à 11 participants, vous compris.")
	})

	it("un code du moteur sans phrase propre à l'appel prend celle du moteur", () => {
		expect(callErrorMessage(convexErrorLike({ code: "rateLimited" }), t)).toContain("Trop de tentatives")
	})

	it("un CODE inconnu retombe sur le générique, jamais affiché brut", () => {
		const message = callErrorMessage(convexErrorLike({ code: "UNKNOWN_NEW_CODE" }), t)
		expect(message).toContain("impossible")
		expect(message).not.toContain("UNKNOWN_NEW_CODE")
	})
})

describe("callErrorMessage — serveur temps réel injoignable", () => {
	it("traduit mediaServerUnavailable en invitation à réessayer", () => {
		// Le serveur des appels s'éteint après une période sans session :
		// l'échec est transitoire, le message doit dire d'attendre puis de
		// réessayer — contrairement à mediaServerNotConfigured qui, lui, ne
		// guérit pas seul.
		const message = callErrorMessage(convexErrorLike({ code: "mediaServerUnavailable" }), t)
		expect(message).toContain("démarre")
		expect(message).not.toContain("Server Error")
	})

	it("ne le classe PAS en défaut de configuration : réessayer a du sens", () => {
		expect(isCallConfigurationError(convexErrorLike({ code: "mediaServerUnavailable" }))).toBe(false)
	})

	it("mediaServerNoCapacity ne promet pas un démarrage en une minute", () => {
		// Pénurie de capacité (15/09/2026, 17 min) : le serveur ne démarre
		// pas, il ne PEUT pas. « Patientez une minute » faisait réessayer en
		// boucle ; on annonce quelques minutes, sans « Server Error ».
		const message = callErrorMessage(convexErrorLike({ code: "mediaServerNoCapacity" }), t)
		expect(message).toContain("quelques minutes")
		expect(message).not.toContain("Patientez une minute")
		expect(message).not.toContain("Server Error")
		expect(isCallConfigurationError(convexErrorLike({ code: "mediaServerNoCapacity" }))).toBe(false)
	})
})

describe("livekitRoomErrorMessage", () => {
	it("rend un message d'usager là où la cause technique reste en console", () => {
		// Cas réel : le CSP de l'app ne portait pas l'origine du serveur
		// LiveKit. La room échouait, mais l'UI affichait « Appel en cours… »
		// micro coupé, sans fin et sans explication.
		const spy = vi.spyOn(console, "error").mockImplementation(() => {})
		const message = livekitRoomErrorMessage(
			new Error("could not establish signal connection: Failed to fetch"),
			t,
		)

		expect(message).toContain("Connexion au serveur d'appel impossible")
		expect(message).not.toContain("signal connection")
		expect(spy).toHaveBeenCalledWith(
			"[call] connexion LiveKit échouée :",
			"could not establish signal connection: Failed to fetch",
		)
		spy.mockRestore()
	})

	it("reste affichable quand la valeur jetée n'est pas une Error", () => {
		expect(livekitRoomErrorMessage(null, t)).toContain("réessayez")
	})
})

describe("isCallConfigurationError", () => {
	it("distingue un défaut de configuration d'un échec réessayable", () => {
		expect(isCallConfigurationError(convexErrorLike({ code: "mediaServerNotConfigured" }))).toBe(true)
		expect(isCallConfigurationError(convexErrorLike({ code: "unauthenticated" }))).toBe(false)
		expect(isCallConfigurationError(new Error("réseau"))).toBe(false)
	})
})
