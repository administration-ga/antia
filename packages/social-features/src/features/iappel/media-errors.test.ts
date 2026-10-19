// Dupliqué de socle/packages/agent-features/src/features/iappel/media-errors.test.ts @ ad2e7fdc2 — adaptations : phrases lues dans les locales françaises du moteur (`t` réel) — assertions MOT POUR MOT inchangées : elles gardent désormais le texte des locales.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	describeCallMediaError,
	describeCameraError,
	describeCameraFailure,
	describeMicBlockedInCall,
	describeMicError,
	isMediaAccessError,
	isPermissionDenied,
} from "./media-errors"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Les messages sont volontairement recopiés MOT POUR MOT dans les assertions
 * (plutôt que comparés à une clé de locale) : ce test doit casser si un jour
 * quelqu'un reformule un message éprouvé en production sans s'en rendre
 * compte.
 */

describe("describeCameraError", () => {
	it("NotAllowedError : permission refusée", () => {
		expect(describeCameraError({ name: "NotAllowedError" }, t)).toBe(
			"Accès à la caméra refusé — autorisez-la dans la barre d'adresse du navigateur.",
		)
	})

	it("PermissionDeniedError : même message que NotAllowedError", () => {
		expect(describeCameraError({ name: "PermissionDeniedError" }, t)).toBe(
			"Accès à la caméra refusé — autorisez-la dans la barre d'adresse du navigateur.",
		)
	})

	it("NotFoundError (vraie DOMException) : aucun périphérique", () => {
		expect(describeCameraError(new DOMException("x", "NotFoundError"), t)).toBe(
			"Aucune caméra détectée — branchez un périphérique vidéo.",
		)
	})

	it("DevicesNotFoundError : même message que NotFoundError", () => {
		expect(describeCameraError({ name: "DevicesNotFoundError" }, t)).toBe(
			"Aucune caméra détectée — branchez un périphérique vidéo.",
		)
	})

	it("NotReadableError : périphérique déjà utilisé", () => {
		expect(describeCameraError(new DOMException("x", "NotReadableError"), t)).toBe(
			"Caméra indisponible — un autre logiciel l'utilise peut-être.",
		)
	})

	it("TrackStartError : même message que NotReadableError", () => {
		expect(describeCameraError({ name: "TrackStartError" }, t)).toBe(
			"Caméra indisponible — un autre logiciel l'utilise peut-être.",
		)
	})

	it("erreur inconnue : message par défaut", () => {
		expect(describeCameraError({ name: "AbortError" }, t)).toBe(
			"Impossible d'activer la caméra. Vérifiez les permissions du navigateur.",
		)
	})

	it("null : message par défaut", () => {
		expect(describeCameraError(null, t)).toBe(
			"Impossible d'activer la caméra. Vérifiez les permissions du navigateur.",
		)
	})

	it("undefined : message par défaut", () => {
		expect(describeCameraError(undefined, t)).toBe(
			"Impossible d'activer la caméra. Vérifiez les permissions du navigateur.",
		)
	})

	it("chaîne brute (pas un objet d'erreur) : message par défaut", () => {
		expect(describeCameraError("boom", t)).toBe(
			"Impossible d'activer la caméra. Vérifiez les permissions du navigateur.",
		)
	})
})

describe("describeMicError", () => {
	it("NotAllowedError : permission refusée, avec rappel de recharger la page", () => {
		expect(describeMicError({ name: "NotAllowedError" }, t)).toBe(
			"Accès au micro refusé — autorisez-le dans la barre d'adresse du navigateur, puis rechargez la page.",
		)
	})

	it("PermissionDeniedError : même message que NotAllowedError", () => {
		expect(describeMicError({ name: "PermissionDeniedError" }, t)).toBe(
			"Accès au micro refusé — autorisez-le dans la barre d'adresse du navigateur, puis rechargez la page.",
		)
	})

	it("NotFoundError (vraie DOMException) : aucun périphérique", () => {
		expect(describeMicError(new DOMException("x", "NotFoundError"), t)).toBe(
			"Aucun micro détecté — branchez un périphérique audio.",
		)
	})

	it("DevicesNotFoundError : même message que NotFoundError", () => {
		expect(describeMicError({ name: "DevicesNotFoundError" }, t)).toBe(
			"Aucun micro détecté — branchez un périphérique audio.",
		)
	})

	it("NotReadableError : périphérique déjà utilisé", () => {
		expect(describeMicError(new DOMException("x", "NotReadableError"), t)).toBe(
			"Micro indisponible — un autre logiciel l'utilise peut-être.",
		)
	})

	it("TrackStartError : même message que NotReadableError", () => {
		expect(describeMicError({ name: "TrackStartError" }, t)).toBe(
			"Micro indisponible — un autre logiciel l'utilise peut-être.",
		)
	})

	it("erreur inconnue : message par défaut", () => {
		expect(describeMicError({ name: "AbortError" }, t)).toBe(
			"Impossible d'activer le micro. Vérifiez les permissions du navigateur.",
		)
	})

	it("null : message par défaut", () => {
		expect(describeMicError(null, t)).toBe(
			"Impossible d'activer le micro. Vérifiez les permissions du navigateur.",
		)
	})

	it("undefined : message par défaut", () => {
		expect(describeMicError(undefined, t)).toBe(
			"Impossible d'activer le micro. Vérifiez les permissions du navigateur.",
		)
	})

	it("chaîne brute (pas un objet d'erreur) : message par défaut", () => {
		expect(describeMicError("boom", t)).toBe(
			"Impossible d'activer le micro. Vérifiez les permissions du navigateur.",
		)
	})
})

describe("isPermissionDenied — décide si le store doit revenir en arrière", () => {
	it("NotAllowedError : vrai", () => {
		expect(isPermissionDenied({ name: "NotAllowedError" })).toBe(true)
	})

	it("PermissionDeniedError : vrai", () => {
		expect(isPermissionDenied(new DOMException("x", "PermissionDeniedError"))).toBe(true)
	})

	it("NotFoundError : faux — pas de permission en cause, un nouvel essai peut réussir", () => {
		expect(isPermissionDenied({ name: "NotFoundError" })).toBe(false)
	})

	it("NotReadableError : faux", () => {
		expect(isPermissionDenied({ name: "NotReadableError" })).toBe(false)
	})

	it("null : faux", () => {
		expect(isPermissionDenied(null)).toBe(false)
	})

	it("undefined : faux", () => {
		expect(isPermissionDenied(undefined)).toBe(false)
	})

	it("chaîne brute : faux", () => {
		expect(isPermissionDenied("boom")).toBe(false)
	})
})

describe("describeCallMediaError", () => {
	// LE défaut : le pool d'appels répondait « Connexion audio impossible —
	// vérifiez votre réseau ou rechargez la page » à un micro REFUSÉ. Ni le
	// réseau ni un rechargement n'y sont pour quoi que ce soit, et la seule
	// action qui débloque — rouvrir la permission — n'était pas nommée.
	it("rend null quand l'échec n'a rien à voir avec les périphériques", () => {
		expect(describeCallMediaError(new Error("could not establish signal"), undefined, t)).toBeNull()
		expect(describeCallMediaError({ name: "ConnectionError" }, undefined, t)).toBeNull()
		expect(describeCallMediaError(null, undefined, t)).toBeNull()
	})

	it("nomme la permission refusée, et l'endroit où la rouvrir", () => {
		expect(describeCallMediaError({ name: "NotAllowedError" }, undefined, t)).toBe(
			"Accès au micro refusé — autorisez-le dans la barre d'adresse du navigateur, puis rechargez la page.",
		)
	})

	it("parle des DEUX périphériques quand l'appel demandait la vidéo", () => {
		// La promesse de publication est un `Promise.all` : on ne sait pas
		// lequel a échoué, seulement ce qui était demandé.
		expect(
			describeCallMediaError({ name: "NotAllowedError" }, { video: true }, t),
		).toBe(
			"Accès au micro ou à la caméra refusé — autorisez-les dans la barre d'adresse du navigateur, puis relancez l'appel.",
		)
		expect(describeCallMediaError({ name: "NotFoundError" }, { video: true }, t)).toBe(
			"Aucun micro ni caméra détecté — branchez un périphérique.",
		)
		expect(
			describeCallMediaError(
				new DOMException("x", "NotReadableError"),
				{
					video: true,
				},
				t,
			),
		).toBe("Micro ou caméra indisponible — un autre logiciel les utilise peut-être.")
	})

	it("reconnaît une contrainte impossible comme une erreur de périphérique", () => {
		expect(isMediaAccessError({ name: "OverconstrainedError" })).toBe(true)
		expect(isMediaAccessError({ name: "ConnectionError" })).toBe(false)
	})
})

describe("describeMicBlockedInCall — l'appel continue en écoute seule (22/09)", () => {
	it("permission refusée : ce qui se passe, et le geste qui débloque SANS recharger", () => {
		const phrase = describeMicBlockedInCall("PermissionDenied", t)
		expect(phrase).toBe(
			"Votre navigateur bloque le micro : vous entendez votre correspondant, lui ne vous entend pas. Autorisez le micro dans la barre d'adresse, puis touchez « Micro bloqué ».",
		)
		// Recharger la page couperait l'appel : la phrase ne le demande plus.
		expect(phrase).not.toContain("rechargez")
	})

	it("aucun micro, micro occupé, et le reste", () => {
		expect(describeMicBlockedInCall("NotFound", t)).toContain("Aucun micro détecté")
		expect(describeMicBlockedInCall("DeviceInUse", t)).toContain("autre logiciel")
		expect(describeMicBlockedInCall("Other", t)).toContain("n'a pas démarré")
		expect(describeMicBlockedInCall(undefined, t)).toContain("n'a pas démarré")
	})
})

describe("describeCameraFailure — les phrases éprouvées, depuis MediaDeviceFailure", () => {
	it("reprend describeCameraError sans recopier ses phrases", () => {
		expect(describeCameraFailure("PermissionDenied", t)).toBe(
			describeCameraError({ name: "NotAllowedError" }, t),
		)
		expect(describeCameraFailure("NotFound", t)).toBe(describeCameraError({ name: "NotFoundError" }, t))
		expect(describeCameraFailure("DeviceInUse", t)).toBe(
			describeCameraError({ name: "NotReadableError" }, t),
		)
		expect(describeCameraFailure("Other", t)).toBe(describeCameraError({ name: "" }, t))
	})
})
