// Dupliqué de socle/packages/agent-features/src/features/iappel/audio-route.test.ts @ ad2e7fdc2 — adaptations : raisons et libellés lus dans les locales françaises du moteur (`t` réel) ; les constantes `*_REASON` sont des clés, comparées une fois traduites — attendus inchangés ; cas ajouté : le libellé de repli d'un périphérique sans nom.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	ANDROID_INPUT_ROUTE_TRICK,
	ANDROID_NO_STRATEGY_REASON,
	DESKTOP_NO_SELECTION_REASON,
	DESKTOP_OUTPUTS_HIDDEN_REASON,
	DESKTOP_SINGLE_OUTPUT_REASON,
	IOS_AUDIO_ROUTE_REASON,
	audioDeviceLabel,
	detectAudioPlatform,
	nextOutputDevice,
	planSpeakerControl,
	speakerButtonLabel,
	type AudioDeviceInfo,
	type SpeakerControlInput,
} from "./audio-route"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Ce que ces cas gardent : le bouton « Haut-parleur » ne faisait RIEN sur
 * téléphone (constat du propriétaire, 22/09/2026) et son premier appui ne
 * faisait rien non plus au bureau. Les deux défauts sont ici, sous forme de
 * paliers : chaque plateforme a son rendu, et `unavailable` porte toujours sa
 * raison — une commande muette se lit comme une panne.
 */

const DEFAUT: AudioDeviceInfo = { deviceId: "default", label: "Par défaut" }
const HAUT_PARLEUR: AudioDeviceInfo = { deviceId: "hp-1", label: "Speaker phone" }
const CASQUE: AudioDeviceInfo = { deviceId: "casque-1", label: "Casque USB" }

function input(over: Partial<SpeakerControlInput> = {}): SpeakerControlInput {
	return {
		platform: "desktop",
		canSelectOutput: true,
		outputs: [DEFAUT, CASQUE],
		inputs: [],
		route: null,
		activeDeviceId: null,
		hasRoom: true,
		...over,
	}
}

describe("detectAudioPlatform — l'appareil, pas la largeur d'écran", () => {
	it("un iPhone est un iOS", () => {
		expect(
			detectAudioPlatform({
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
				maxTouchPoints: 5,
			}),
		).toBe("ios")
	})

	it("un Android est un Android", () => {
		expect(
			detectAudioPlatform({
				userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
				maxTouchPoints: 5,
			}),
		).toBe("android")
	})

	it("un Mac est un bureau", () => {
		expect(
			detectAudioPlatform({
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
				maxTouchPoints: 0,
			}),
		).toBe("desktop")
	})

	it("⚠️ un iPad se déclare « Macintosh » — le toucher le trahit", () => {
		// Depuis iPadOS 13, l'agent utilisateur est celui d'un Mac. Le ranger
		// dans `desktop` proposerait un sélecteur que Safari refuse d'honorer.
		expect(
			detectAudioPlatform({
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
				maxTouchPoints: 5,
			}),
		).toBe("ios")
	})
})

describe("planSpeakerControl — un palier par situation", () => {
	it("sans salle, rien : la commande n'aurait rien à piloter", () => {
		expect(planSpeakerControl(input({ hasRoom: false }), t).kind).toBe("hidden")
		// Même sur iPhone : c'est l'absence de salle qui décide en premier.
		expect(
			planSpeakerControl(input({ hasRoom: false, platform: "ios" }), t).kind,
		).toBe("hidden")
	})

	it("bureau sans sélection de sortie : la commande RESTE et dit pourquoi", () => {
		// Recette du 22/09 : masquée, elle donnait aux deux correspondants d'un
		// même appel deux rangées de commandes différentes.
		expect(planSpeakerControl(input({ canSelectOutput: false }), t)).toEqual({
			kind: "unavailable",
			reason: t(DESKTOP_NO_SELECTION_REASON),
		})
	})

	it("bureau avec une seule sortie : rien à choisir, et on le dit", () => {
		expect(planSpeakerControl(input({ outputs: [DEFAUT] }), t)).toEqual({
			kind: "unavailable",
			reason: t(DESKTOP_SINGLE_OUTPUT_REASON),
		})
	})

	it("bureau sans périphériques nommés (micro pas encore autorisé) : on dit pourquoi", () => {
		// Chrome tait les noms — et souvent le nombre — des sorties tant que le
		// micro n'est pas autorisé : « une seule sortie » serait faux.
		expect(
			planSpeakerControl(input({ outputs: [{ deviceId: "", label: "" }] }), t),
		).toEqual({ kind: "unavailable", reason: t(DESKTOP_OUTPUTS_HIDDEN_REASON) })
	})

	it("au bureau, la commande n'est masquée QUE sans salle", () => {
		for (const over of [
			{ canSelectOutput: false },
			{ outputs: [DEFAUT] },
			{ outputs: [] },
		] satisfies Partial<SpeakerControlInput>[]) {
			expect(planSpeakerControl(input(over), t).kind).not.toBe("hidden")
		}
	})

	it("bureau avec deux sorties : un VRAI sélecteur, l'actif marqué", () => {
		const plan = planSpeakerControl(input({ activeDeviceId: "casque-1" }), t)
		expect(plan.kind).toBe("picker")
		if (plan.kind !== "picker") return
		expect(plan.options.map((o) => o.deviceId)).toEqual(["default", "casque-1"])
		expect(plan.options.find((o) => o.active)?.deviceId).toBe("casque-1")
		expect(plan.activeLabel).toBe("Casque USB")
	})

	it("l'INTENTION du magasin prime sur le périphérique actif", () => {
		const plan = planSpeakerControl(
			input({
				activeDeviceId: "default",
				route: { kind: "device", deviceId: "casque-1", label: "Casque USB" },
			}), t,
		)
		expect(plan.kind === "picker" && plan.activeLabel).toBe("Casque USB")
	})

	it("aucun actif connu : aucune option cochée, et le libellé se replie", () => {
		const plan = planSpeakerControl(input(), t)
		expect(plan.kind === "picker" && plan.options.every((o) => !o.active)).toBe(true)
		expect(plan.kind === "picker" && plan.activeLabel).toBeNull()
		expect(speakerButtonLabel(plan, t)).toBe("Sortie audio")
	})

	it("iPhone : TOUJOURS indisponible, et la raison dit où aller", () => {
		// `switchActiveDevice("audiooutput")` lève sur tout Safari. Masquer la
		// commande ferait chercher une panne ; la rendre inerte aussi.
		const plan = planSpeakerControl(
			input({ platform: "ios", canSelectOutput: false, outputs: [DEFAUT, HAUT_PARLEUR] }), t,
		)
		expect(plan).toEqual({ kind: "unavailable", reason: t(IOS_AUDIO_ROUTE_REASON) })
		expect(t(IOS_AUDIO_ROUTE_REASON)).toContain("Centre de contrôle")
	})

	it("Android à deux sorties : une bascule par le PÉRIPHÉRIQUE", () => {
		const plan = planSpeakerControl(
			input({ platform: "android", outputs: [DEFAUT, HAUT_PARLEUR] }), t,
		)
		expect(plan.kind).toBe("toggle")
		if (plan.kind !== "toggle" || plan.strategy !== "sink") return
		expect(plan.speakerId).toBe("hp-1")
		expect(plan.earpieceId).toBe("default")
		// Rien de choisi et rien d'actif : on est dans l'oreille, pas dehors.
		expect(plan.onSpeaker).toBe(false)
		expect(speakerButtonLabel(plan, t)).toBe("Écouteur")
	})

	it("…et l'intention « speaker » allume la bascule", () => {
		const plan = planSpeakerControl(
			input({
				platform: "android",
				outputs: [DEFAUT, HAUT_PARLEUR],
				route: { kind: "speaker" },
			}), t,
		)
		expect(plan.kind === "toggle" && plan.onSpeaker).toBe(true)
		expect(speakerButtonLabel(plan, t)).toBe("Haut-parleur")
	})

	it("Android sans seconde sortie : indisponible, avec SA raison", () => {
		const plan = planSpeakerControl(
			input({ platform: "android", outputs: [DEFAUT], inputs: [HAUT_PARLEUR] }), t,
		)
		expect(plan).toEqual({ kind: "unavailable", reason: t(ANDROID_NO_STRATEGY_REASON) })
	})

	it("la bascule par l'ENTRÉE reste désarmée tant qu'elle n'est pas prouvée", () => {
		// Le procédé dépend du constructeur et n'a été vérifié sur aucun
		// appareil de la flotte : une bascule qui ne bascule rien vaut moins
		// qu'une commande honnête.
		expect(ANDROID_INPUT_ROUTE_TRICK).toBe(false)
		const plan = planSpeakerControl(
			input({
				platform: "android",
				canSelectOutput: false,
				outputs: [DEFAUT],
				inputs: [HAUT_PARLEUR],
			}), t,
		)
		expect(plan.kind).toBe("unavailable")
	})
})

describe("nextOutputDevice — le premier appui ne doit pas tomber à vide", () => {
	it("⚠️ sans actif connu, `null` vaut `default` : le premier appui CHANGE", () => {
		// Le défaut d'origine : `findIndex(null)` rendait -1, +1 proposait
		// `devices[0]` — le périphérique déjà actif. Rien ne se passait.
		expect(nextOutputDevice([DEFAUT, CASQUE], null)).toBe("casque-1")
	})

	it("sans `default`, `null` vaut le premier de la liste", () => {
		expect(nextOutputDevice([CASQUE, HAUT_PARLEUR], null)).toBe("hp-1")
	})

	it("il rend toujours un périphérique DIFFÉRENT, et boucle", () => {
		expect(nextOutputDevice([DEFAUT, CASQUE], "casque-1")).toBe("default")
	})

	it("un seul périphérique : rien à proposer", () => {
		expect(nextOutputDevice([DEFAUT], "default")).toBeNull()
		expect(nextOutputDevice([DEFAUT], null)).toBeNull()
	})

	it("aucun périphérique : rien non plus", () => {
		expect(nextOutputDevice([], null)).toBeNull()
	})

	it("un actif disparu (casque débranché) repart du début", () => {
		expect(nextOutputDevice([DEFAUT, CASQUE], "fantome")).toBe("default")
	})
})

describe("audioDeviceLabel — jamais un identifiant opaque", () => {
	it("le nom du périphérique, sinon un repli lisible", () => {
		expect(audioDeviceLabel(CASQUE, t)).toBe("Casque USB")
		expect(audioDeviceLabel({ deviceId: "default", label: " " }, t)).toBe("Sortie par défaut")
		expect(audioDeviceLabel({ deviceId: "communications", label: "" }, t)).toBe("Sortie de communication")
		expect(audioDeviceLabel({ deviceId: "a1b2c3", label: "" }, t)).toBe("Sortie audio")
	})
})

describe("speakerButtonLabel — une seule formule pour les quatre paliers", () => {
	it("masqué et indisponible se disent pareil", () => {
		expect(speakerButtonLabel({ kind: "hidden" }, t)).toBe("Sortie audio")
		expect(speakerButtonLabel({ kind: "unavailable", reason: "x" }, t)).toBe("Sortie audio")
	})

	it("le sélecteur ne porte JAMAIS le nom du périphérique — il se lit dans le panneau", () => {
		// « Par défaut - Haut-parleurs MacBook Air (Built-in) » sous un rond de
		// 56 px élargissait la colonne à 330 px et décalait la rangée (22/09).
		expect(
			speakerButtonLabel({
				kind: "picker",
				options: [{ deviceId: "casque-1", label: "Casque USB", active: true }],
				activeLabel: "Casque USB",
			}, t),
		).toBe("Sortie audio")
	})
})
