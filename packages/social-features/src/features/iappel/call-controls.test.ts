// Dupliqué de socle/packages/agent-features/src/features/iappel/call-controls.test.ts @ ad2e7fdc2 — adaptations : libellés de qualité lus dans les locales françaises du moteur (`t` réel) — attendus inchangés ; refus serveur nommé par sa règle du moteur.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	availableCallControls,
	nextCameraDevice,
	qualityLabel,
	speakerControlAvailable,
	type CallControlsInput,
} from "./call-controls"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Ce que ces cas gardent : un bouton « Haut-parleur » désactivé EN DUR, qui ne
 * réagissait à aucun clic et se lisait comme une panne. Chaque `it` vérifie
 * qu'une commande indisponible DISPARAÎT au lieu de se rendre inerte.
 */

function input(over: Partial<CallControlsInput> = {}): CallControlsInput {
	return {
		phase: "active",
		isMobile: false,
		videoInputs: 1,
		audioOutputs: 1,
		supportsSetSinkId: false,
		...over,
	}
}

describe("micro et caméra — jamais affichés avant que le flux existe", () => {
	it("absents en `connecting` : le flux LiveKit n'existe pas encore", () => {
		const c = availableCallControls(input({ phase: "connecting" }))
		expect(c.mic).toBe(false)
		expect(c.camera).toBe(false)
	})

	it("absents en `ringing` : ça sonne, personne n'a encore décroché", () => {
		const c = availableCallControls(input({ phase: "ringing" }))
		expect(c.mic).toBe(false)
		expect(c.camera).toBe(false)
	})

	it("présents en `active`", () => {
		const c = availableCallControls(input({ phase: "active" }))
		expect(c.mic).toBe(true)
		expect(c.camera).toBe(true)
	})

	it("présents en `held` : on peut couper son micro même en attente", () => {
		const c = availableCallControls(input({ phase: "held" }))
		expect(c.mic).toBe(true)
		expect(c.camera).toBe(true)
	})

	it("présents en `reconnecting` : ce n'est pas un appel mort, juste un réseau qui bascule", () => {
		const c = availableCallControls(input({ phase: "reconnecting" }))
		expect(c.mic).toBe(true)
		expect(c.camera).toBe(true)
	})

	it("absents en `ended` et en `failed`", () => {
		expect(availableCallControls(input({ phase: "ended" })).mic).toBe(false)
		expect(availableCallControls(input({ phase: "failed" })).camera).toBe(false)
	})
})

describe("flip — bascule caméra avant/arrière", () => {
	it("absent au bureau, même avec deux caméras : un ordinateur n'a pas de dos", () => {
		const c = availableCallControls(input({ isMobile: false, videoInputs: 2 }))
		expect(c.flip).toBe(false)
	})

	it("absent au téléphone avec une seule caméra : rien à basculer", () => {
		const c = availableCallControls(input({ isMobile: true, videoInputs: 1 }))
		expect(c.flip).toBe(false)
	})

	it("présent au téléphone avec deux caméras", () => {
		const c = availableCallControls(input({ isMobile: true, videoInputs: 2 }))
		expect(c.flip).toBe(true)
	})
})

describe("speaker — choisir la sortie audio", () => {
	it("absent sans `setSinkId` : le navigateur ne sait pas router l'audio", () => {
		expect(speakerControlAvailable({ supportsSetSinkId: false, audioOutputs: 2 })).toBe(
			false,
		)
	})

	it("absent avec un seul périphérique de sortie : rien à choisir", () => {
		expect(speakerControlAvailable({ supportsSetSinkId: true, audioOutputs: 1 })).toBe(
			false,
		)
	})

	it("présent avec `setSinkId` ET au moins deux périphériques", () => {
		expect(speakerControlAvailable({ supportsSetSinkId: true, audioOutputs: 2 })).toBe(
			true,
		)
	})

	it("le même calcul s'applique à travers `availableCallControls`", () => {
		const c = availableCallControls(input({ supportsSetSinkId: true, audioOutputs: 2 }))
		expect(c.speaker).toBe(true)
	})

	it("au téléphone la commande existe TOUJOURS — son état dit si elle route", () => {
		// Constat du propriétaire (22/09) : « activer / couper le haut-parleur
		// ne change rien ». Le bouton n'existait même pas — `setSinkId` est
		// absent de Safari et la plupart des Android n'énumèrent qu'une
		// sortie. La commande la plus cherchée d'un appel ne disparaît pas :
		// elle s'affiche et DIT pourquoi elle ne route pas.
		for (const platform of ["ios", "android"] as const) {
			expect(
				speakerControlAvailable({
					supportsSetSinkId: false,
					audioOutputs: 1,
					platform,
				}),
				platform,
			).toBe(true)
		}
		// Et le bureau reste strictement inchangé.
		expect(
			speakerControlAvailable({
				supportsSetSinkId: false,
				audioOutputs: 1,
				platform: "desktop",
			}),
		).toBe(false)
	})
})

describe("hold — mettre en attente", () => {
	it("absent en `held` : on ne remet pas en attente ce qui l'est déjà", () => {
		expect(availableCallControls(input({ phase: "held" })).hold).toBe(false)
	})

	it("présent en `active`", () => {
		expect(availableCallControls(input({ phase: "active" })).hold).toBe(true)
	})

	it("absent avant que l'appel soit établi", () => {
		expect(availableCallControls(input({ phase: "ringing" })).hold).toBe(false)
	})
})

describe("minimize — réduire la fenêtre d'appel", () => {
	it("absent en `ended` : l'écran de fin va se refermer de lui-même", () => {
		expect(availableCallControls(input({ phase: "ended" })).minimize).toBe(false)
	})

	it("absent en `failed`", () => {
		expect(availableCallControls(input({ phase: "failed" })).minimize).toBe(false)
	})

	it("présent à tous les autres stades", () => {
		const livePhases = ["connecting", "ringing", "active", "held", "reconnecting"] as const
		for (const phase of livePhases) {
			expect(availableCallControls(input({ phase })).minimize).toBe(true)
		}
	})
})

describe("nextCameraDevice — par libellé, puis par cyclage", () => {
	it("libellé français : « Caméra arrière » identifie la direction environment", () => {
		const devices = [
			{ deviceId: "front", label: "Caméra avant" },
			{ deviceId: "back", label: "Caméra arrière" },
		]
		expect(nextCameraDevice(devices, "front", "environment")).toBe("back")
	})

	it("libellé anglais : « Back Camera » aussi", () => {
		const devices = [
			{ deviceId: "front", label: "Front Camera" },
			{ deviceId: "back", label: "Back Camera" },
		]
		expect(nextCameraDevice(devices, "front", "environment")).toBe("back")
	})

	it("insensible à la casse et aux accents", () => {
		const devices = [
			{ deviceId: "front", label: "CAMERA AVANT" },
			{ deviceId: "back", label: "CAMÉRA ARRIÈRE" },
		]
		expect(nextCameraDevice(devices, "back", "user")).toBe("front")
	})

	it("cyclage quand les libellés sont vides — la permission caméra n'a pas encore été accordée", () => {
		const devices = [
			{ deviceId: "a", label: "" },
			{ deviceId: "b", label: "" },
		]
		expect(nextCameraDevice(devices, "a", "environment")).toBe("b")
		expect(nextCameraDevice(devices, "b", "environment")).toBe("a")
	})

	it("cyclage aussi quand `currentId` est inconnu ou `null` : on part du premier", () => {
		const devices = [
			{ deviceId: "a", label: "" },
			{ deviceId: "b", label: "" },
		]
		expect(nextCameraDevice(devices, null, "user")).toBe("a")
		expect(nextCameraDevice(devices, "inconnu", "user")).toBe("a")
	})

	it("`null` sur liste vide", () => {
		expect(nextCameraDevice([], null, "environment")).toBeNull()
	})

	it("`null` quand l'unique caméra est déjà active", () => {
		const devices = [{ deviceId: "only", label: "" }]
		expect(nextCameraDevice(devices, "only", "user")).toBeNull()
	})

	it("`null` quand le seul libellé correspondant à la direction est déjà actif", () => {
		const devices = [
			{ deviceId: "front", label: "Front Camera" },
			{ deviceId: "back", label: "Back Camera" },
		]
		expect(nextCameraDevice(devices, "back", "environment")).toBeNull()
	})
})

describe("qualityLabel — cinq niveaux, et quand les montrer", () => {
	it("excellent : trois barres, non dégradé", () => {
		expect(qualityLabel("excellent", t)).toEqual({
			bars: 3,
			text: "Bonne qualité",
			degraded: false,
		})
	})

	it("good : deux barres, non dégradé", () => {
		expect(qualityLabel("good", t)).toEqual({
			bars: 2,
			text: "Qualité correcte",
			degraded: false,
		})
	})

	it("poor : une barre, DÉGRADÉ — c'est ce qui doit inquiéter", () => {
		expect(qualityLabel("poor", t)).toEqual({
			bars: 1,
			text: "Réseau faible",
			degraded: true,
		})
	})

	it("lost : zéro barre, dégradé", () => {
		expect(qualityLabel("lost", t)).toEqual({
			bars: 0,
			text: "Connexion perdue",
			degraded: true,
		})
	})

	it("unknown : zéro barre, mais PAS dégradé — on ne sait pas encore, on n'alarme pas", () => {
		expect(qualityLabel("unknown", t)).toEqual({
			bars: 0,
			text: "Qualité inconnue",
			degraded: false,
		})
	})
})

describe("mettre en attente et reprendre", () => {
	// Ces deux commandes ont longtemps été des fantômes : `hold` était calculé
	// et lu par personne, `resume` n'existait pas. Un appel parqué — même le
	// seul de la ligne — n'avait aucune sortie à l'écran.
	const base = {
		isMobile: false,
		videoInputs: 1,
		audioOutputs: 1,
		supportsSetSinkId: false,
	}

	it("un appel EN COURS se met en attente, et ne se reprend pas", () => {
		const c = availableCallControls({ ...base, phase: "active" })
		expect(c.hold).toBe(true)
		expect(c.resume).toBe(false)
	})

	it("un appel PARQUÉ se reprend, et ne se reparque pas", () => {
		const c = availableCallControls({ ...base, phase: "held" })
		expect(c.hold).toBe(false)
		expect(c.resume).toBe(true)
	})

	it("aucune des deux avant que l'appel soit établi, ni après sa fin", () => {
		for (const phase of ["ringing", "connecting", "ended", "failed"] as const) {
			const c = availableCallControls({ ...base, phase })
			expect(c.hold, phase).toBe(false)
			expect(c.resume, phase).toBe(false)
		}
	})

	it("l'attente du correspondant garde micro, caméra et réduire, et se parque à son tour — ni reprendre, ni ajouter", () => {
		// `peer_held` : c'est LUI qui a suspendu, et la reprise est son geste.
		// Mon micro et ma caméra restent les miens — je les règle en
		// patientant, et ils seront dans l'état voulu à la reprise. « En
		// attente » reste offert : le serveur tient l'attente croisée, et les
		// deux rangées ont ainsi la même forme (recette du 22/09).
		const c = availableCallControls({ ...base, phase: "peer_held" })
		expect(c.mic).toBe(true)
		expect(c.camera).toBe(true)
		expect(c.minimize).toBe(true)
		expect(c.hold).toBe(true)
		expect(c.resume).toBe(false)
		expect(c.addParticipant).toBe(false)
	})

	it("un GROUPE ne se parque pas, pas plus en attente qu'en conversation", () => {
		expect(
			availableCallControls({ ...base, phase: "peer_held", isGroup: true }).hold,
		).toBe(false)
	})

	it("un appel de GROUPE ne se parque pas", () => {
		// Le serveur le refuse (`CALL_GROUP_NO_HOLD`) : offrir le bouton
		// donnerait une commande qui lève. À N, on quitte ou on coupe son micro.
		const c = availableCallControls({ ...base, phase: "active", isGroup: true })
		expect(c.hold).toBe(false)
		// … et un 1:1 garde la commande, `isGroup` absent valant tête-à-tête.
		expect(availableCallControls({ ...base, phase: "active" }).hold).toBe(true)
		expect(
			availableCallControls({ ...base, phase: "active", isGroup: false }).hold,
		).toBe(true)
	})

	it("elles ne sont JAMAIS offertes ensemble", () => {
		for (const phase of [
			"ringing",
			"connecting",
			"active",
			"held",
			"peer_held",
			"reconnecting",
			"ended",
			"failed",
		] as const) {
			const c = availableCallControls({ ...base, phase })
			expect(c.hold && c.resume, phase).toBe(false)
		}
	})
})

describe("ajouter une personne (ADR-0099)", () => {
	const socle = {
		isMobile: false,
		videoInputs: 1,
		audioOutputs: 1,
		supportsSetSinkId: false,
	}

	it("offerte sur un appel VIVANT seulement — jamais parqué, terminé ou échoué", () => {
		const vivants = ["active", "ringing", "reconnecting"] as const
		const morts = ["connecting", "held", "ended", "failed"] as const
		for (const phase of vivants) {
			expect(availableCallControls({ ...socle, phase }).addParticipant, phase).toBe(true)
		}
		for (const phase of morts) {
			expect(availableCallControls({ ...socle, phase }).addParticipant, phase).toBe(false)
		}
	})
})
