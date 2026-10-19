// Dupliqué de socle/packages/agent-features/src/features/iappel/audio-route.ts @ ad2e7fdc2 — adaptations : raisons et libellés traduits par i18n (`t` ajouté en dernier paramètre de `planSpeakerControl`, `audioDeviceLabel` et `speakerButtonLabel` ; les constantes `*_REASON` portent désormais la CLÉ qualifiée `iappel:audioRoute.…`, traduite par le plan) ; accès indexés gardés (`noUncheckedIndexedAccess`).
/**
 * audio-route — ÉCOUTEUR ou HAUT-PARLEUR : ce que le web sait faire, et ce
 * qu'il ne sait pas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA LIMITE DE PLATEFORME, DITE UNE FOIS POUR TOUTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le propriétaire demande un comportement WhatsApp : haut-parleur coupé =
 * la voix dans l'oreille, haut-parleur actif = la voix dans le haut-parleur
 * du téléphone. Cette application est un PWA, sans enveloppe native. Or le
 * web ne sait choisir qu'un PÉRIPHÉRIQUE DE SORTIE ÉNUMÉRÉ (`setSinkId`) :
 *
 *  · au BUREAU, c'est exactement ce qu'il faut — casque, enceintes, écran :
 *    un vrai sélecteur ;
 *  · sur certains ANDROID, l'écouteur et le haut-parleur SONT deux
 *    périphériques `audiooutput` distincts : la bascule est alors réelle ;
 *  · sur iOS, `setSinkId` n'existe pas (Safari, donc tout iPhone) et
 *    `Room.switchActiveDevice("audiooutput")` LÈVE. La sortie se choisit
 *    dans le Centre de contrôle, et l'appel suit le réglage du téléphone.
 *
 * D'où la règle de ce module : une commande soit ROUTE, soit DIT POURQUOI
 * elle ne route pas. Jamais un bouton muet, jamais une bascule qui ne
 * bascule rien.
 *
 * Aucun import LiveKit ni React : module PUR, testable en environnement
 * `node`. La capacité du navigateur (`supportsAudioOutputSelection()` de
 * `livekit-client`) et l'énumération des périphériques sont passées en
 * ENTRÉE — ce module ne les mesure pas, il en décide. Les phrases passent par
 * la fonction de traduction REÇUE (`t`, clés qualifiées `iappel:audioRoute.…`).
 */

import type { TFunction } from "i18next"

import type { AudioRouteIntent } from "./call-types"

/** Une sortie (ou une entrée) audio, réduite à ce dont la décision a besoin. */
export interface AudioDeviceInfo {
	deviceId: string
	label: string
}

/** Les trois familles d'appareil qui n'ont pas les mêmes capacités audio. */
export type AudioPlatform = "ios" | "android" | "desktop"

/**
 * La bascule Android par le PÉRIPHÉRIQUE D'ENTRÉE — désarmée.
 *
 * Sur une partie du parc Android, choisir l'entrée « haut-parleur » du
 * téléphone fait suivre la SORTIE. Le procédé n'est pas spécifié, dépend du
 * constructeur, et n'a été prouvé sur AUCUN appareil de la flotte : tant
 * qu'il ne l'est pas, une bascule qui ne bascule rien vaut moins qu'une
 * commande qui dit honnêtement pourquoi elle ne peut pas.
 *
 * ⚠️ Typé `boolean` et non `false` : sans cela, le `=== true` du plan serait
 * refusé par TypeScript (« comparaison sans recouvrement ») et le drapeau ne
 * pourrait plus s'armer sans changer sa forme.
 */
export const ANDROID_INPUT_ROUTE_TRICK: boolean = false

/** Les libellés qui désignent le haut-parleur, quelle que soit la langue de l'OS. */
const SPEAKER_LABEL = /speaker|haut-parleur|loud/i

/** Les identifiants que le navigateur réserve à la sortie « normale ». */
const EARPIECE_DEVICE_IDS = new Set(["default", "communications"])

/**
 * Ce que l'écran doit rendre pour la sortie audio. Une seule valeur, décidée
 * ici, pour que le bouton, son état et son libellé ne puissent pas diverger.
 */
export type SpeakerControlPlan =
	/**
	 * Rien à proposer : PAS DE SALLE, et rien d'autre. Depuis la recette du
	 * 22/09, un bureau sans choix possible rend `unavailable` avec sa raison :
	 * les deux côtés d'un appel voient la même rangée de commandes.
	 */
	| { kind: "hidden" }
	/** Bureau : un vrai sélecteur de périphérique. */
	| {
			kind: "picker"
			options: readonly SpeakerPickerOption[]
			/** Le périphérique actif, tel qu'on l'écrit sous le bouton. */
			activeLabel: string | null
	  }
	/** Téléphone : une bascule à deux états, avec la stratégie qui la porte. */
	| {
			kind: "toggle"
			strategy: "sink"
			onSpeaker: boolean
			earpieceId: string
			speakerId: string
	  }
	| {
			kind: "toggle"
			strategy: "input-route"
			onSpeaker: boolean
			inputId: string
	  }
	/** La commande existe, elle ne route pas — et elle DIT pourquoi (phrase traduite). */
	| { kind: "unavailable"; reason: string }

export interface SpeakerPickerOption {
	deviceId: string
	label: string
	active: boolean
}

export interface SpeakerControlInput {
	platform: AudioPlatform
	/** `supportsAudioOutputSelection()` de `livekit-client` — jamais un test maison. */
	canSelectOutput: boolean
	outputs: readonly AudioDeviceInfo[]
	inputs: readonly AudioDeviceInfo[]
	/** L'intention mémorisée (magasin), qui prime sur le périphérique actif. */
	route: AudioRouteIntent | null
	/** Ce que la salle dit router en ce moment (`room.getActiveDevice`). */
	activeDeviceId: string | null
	/** Sans salle, aucune commande : elle n'aurait rien à piloter. */
	hasRoom: boolean
}

/*
 * Les RAISONS d'une commande indisponible — des clés de traduction
 * qualifiées : `planSpeakerControl` les traduit avec le `t` qu'il reçoit.
 */

/** Sur iPhone, la sortie appartient au système — on le dit, on ne le cache pas. */
export const IOS_AUDIO_ROUTE_REASON = "iappel:audioRoute.reason.ios"

/** Android sans deux sorties énumérées et sans stratégie de repli. */
export const ANDROID_NO_STRATEGY_REASON = "iappel:audioRoute.reason.androidNoStrategy"

/*
 * BUREAU — trois raisons. La commande reste à sa place, atténuée, et le tap
 * dit pourquoi (recette du propriétaire, 22/09 : « il y a un côté qui n'a pas
 * tous les boutons »). Masquée, elle donnait aux deux correspondants d'un même
 * appel deux rangées qui ne se ressemblaient pas.
 */

/** Safari, Firefox : `setSinkId` absent, ou non honoré sur l'audio WebRTC. */
export const DESKTOP_NO_SELECTION_REASON = "iappel:audioRoute.reason.desktopNoSelection"

/** Chrome tait les périphériques tant que le micro n'est pas autorisé. */
export const DESKTOP_OUTPUTS_HIDDEN_REASON = "iappel:audioRoute.reason.desktopOutputsHidden"

/** Une seule sortie : rien à choisir. */
export const DESKTOP_SINGLE_OUTPUT_REASON = "iappel:audioRoute.reason.desktopSingleOutput"

/**
 * Quelle famille d'appareil ?
 *
 * ⚠️ iPadOS se déclare « Macintosh » depuis iOS 13 : seul le nombre de points
 * de contact le trahit. Le ranger dans `desktop` proposerait un sélecteur de
 * périphériques que Safari refuse d'honorer — exactement le bouton mort que
 * ce lot supprime.
 */
export function detectAudioPlatform(input: {
	userAgent: string
	maxTouchPoints: number
}): AudioPlatform {
	const ua = input.userAgent
	if (/iPhone|iPod|iPad/i.test(ua)) return "ios"
	// Android avant Macintosh : certains navigateurs Android citent les deux.
	if (/Android/i.test(ua)) return "android"
	if (/Macintosh/i.test(ua) && input.maxTouchPoints > 1) return "ios"
	return "desktop"
}

/** Le libellé d'un périphérique, ou un repli lisible quand il est vide. */
export function audioDeviceLabel(device: AudioDeviceInfo, t: TFunction): string {
	const trimmed = device.label.trim()
	if (trimmed.length > 0) return trimmed
	// Les libellés restent vides tant que la permission micro n'est pas
	// accordée : un identifiant opaque à l'écran ne dit rien à personne.
	if (device.deviceId === "default") return t("iappel:audioRoute.device.default")
	if (device.deviceId === "communications") return t("iappel:audioRoute.device.communications")
	return t("iappel:audioRoute.device.generic")
}

/** Le périphérique que le libellé désigne comme haut-parleur, s'il existe. */
function findSpeaker(outputs: readonly AudioDeviceInfo[]): AudioDeviceInfo | null {
	return outputs.find((device) => SPEAKER_LABEL.test(device.label)) ?? null
}

/** L'écouteur : `default`/`communications` d'abord, sinon la première autre sortie. */
function findEarpiece(
	outputs: readonly AudioDeviceInfo[],
	speakerId: string,
): AudioDeviceInfo | null {
	const reserved = outputs.find(
		(device) => EARPIECE_DEVICE_IDS.has(device.deviceId) && device.deviceId !== speakerId,
	)
	if (reserved) return reserved
	return outputs.find((device) => device.deviceId !== speakerId) ?? null
}

/**
 * Suis-je sur le haut-parleur ? L'INTENTION prime — c'est elle que l'usager a
 * posée —, le périphérique actif ne sert que de repli au premier affichage.
 */
function resolveOnSpeaker(
	route: AudioRouteIntent | null,
	activeDeviceId: string | null,
	speakerId: string,
): boolean {
	if (route !== null) {
		if (route.kind === "speaker") return true
		if (route.kind === "earpiece") return false
		return route.deviceId === speakerId
	}
	return activeDeviceId !== null && activeDeviceId === speakerId
}

/**
 * LE point de décision de la commande « Sortie audio ».
 *
 * L'ordre des paliers n'est pas décoratif : `hasRoom` d'abord (rien à
 * piloter), puis la plateforme, puis la capacité, puis le nombre de sorties.
 * Chaque palier a son rendu, et `unavailable` porte TOUJOURS sa raison.
 */
export function planSpeakerControl(input: SpeakerControlInput, t: TFunction): SpeakerControlPlan {
	// Pas de salle : la commande n'aurait rien à router, et un bouton mort se
	// lit comme une panne de l'application.
	if (!input.hasRoom) return { kind: "hidden" }

	if (input.platform === "ios") {
		// `switchActiveDevice("audiooutput")` LÈVE sur tout Safari. La commande
		// reste VISIBLE — tout le monde la cherche — et dit où aller.
		return { kind: "unavailable", reason: t(IOS_AUDIO_ROUTE_REASON) }
	}

	if (input.platform === "android") {
		if (input.canSelectOutput && input.outputs.length >= 2) {
			// Le libellé d'abord ; à défaut, la première sortie qui n'est PAS
			// l'une des deux réservées par le navigateur — sur un Android qui
			// expose deux sorties, c'est le haut-parleur.
			const speakerDevice =
				findSpeaker(input.outputs) ??
				input.outputs.find((device) => !EARPIECE_DEVICE_IDS.has(device.deviceId)) ??
				input.outputs[1]
			// Deux sorties au moins (vérifié juste au-dessus) : la garde ne sert
			// que le typage.
			const earpiece =
				speakerDevice === undefined ? null : findEarpiece(input.outputs, speakerDevice.deviceId)
			if (speakerDevice !== undefined && earpiece !== null) {
				return {
					kind: "toggle",
					strategy: "sink",
					onSpeaker: resolveOnSpeaker(
						input.route,
						input.activeDeviceId,
						speakerDevice.deviceId,
					),
					earpieceId: earpiece.deviceId,
					speakerId: speakerDevice.deviceId,
				}
			}
		}
		if (ANDROID_INPUT_ROUTE_TRICK === true && input.inputs.length > 0) {
			const named = input.inputs.find((device) => SPEAKER_LABEL.test(device.label))
			const chosen = named ?? input.inputs[0]
			if (chosen !== undefined) {
				return {
					kind: "toggle",
					strategy: "input-route",
					onSpeaker: input.route !== null && input.route.kind === "speaker",
					inputId: chosen.deviceId,
				}
			}
		}
		return { kind: "unavailable", reason: t(ANDROID_NO_STRATEGY_REASON) }
	}

	// BUREAU. Sans `setSinkId`, sans périphériques nommés ou avec une seule
	// sortie, il n'y a rien à choisir — mais la commande RESTE, atténuée, et
	// dit pourquoi : masquée, elle donnait deux rangées différentes aux deux
	// correspondants d'un même appel (recette du 22/09).
	if (!input.canSelectOutput) {
		return { kind: "unavailable", reason: t(DESKTOP_NO_SELECTION_REASON) }
	}
	if (
		input.outputs.length > 0 &&
		input.outputs.every((device) => device.label.trim() === "")
	) {
		return { kind: "unavailable", reason: t(DESKTOP_OUTPUTS_HIDDEN_REASON) }
	}
	if (input.outputs.length < 2) {
		return { kind: "unavailable", reason: t(DESKTOP_SINGLE_OUTPUT_REASON) }
	}

	const resolvedId =
		input.route !== null && input.route.kind === "device"
			? input.route.deviceId
			: input.activeDeviceId
	const options = input.outputs.map((device) => ({
		deviceId: device.deviceId,
		label: audioDeviceLabel(device, t),
		active: device.deviceId === resolvedId,
	}))
	const activeOption = options.find((option) => option.active) ?? null
	return { kind: "picker", options, activeLabel: activeOption?.label ?? null }
}

/**
 * La sortie SUIVANTE — le geste du bouton unique (`cycle`), et le correctif du
 * « premier appui à vide ».
 *
 * ⚠️ `currentId` vaut `null` tant que rien n'a été choisi : la version
 * antérieure cherchait alors l'index de `null` (`-1`), ajoutait 1, et
 * proposait `devices[0]` — LE périphérique déjà actif. Le premier appui ne
 * faisait donc rien, et l'usager concluait à une panne. Ici, `null` vaut
 * `default` quand il existe, sinon le premier de la liste : le premier appui
 * change réellement de sortie.
 */
export function nextOutputDevice(
	devices: readonly AudioDeviceInfo[],
	currentId: string | null,
): string | null {
	const first = devices[0]
	if (first === undefined) return null
	const fallback =
		devices.find((device) => device.deviceId === "default")?.deviceId ??
		first.deviceId
	const resolved = currentId ?? fallback
	const index = devices.findIndex((device) => device.deviceId === resolved)
	// Un identifiant qui n'est plus dans la liste (casque débranché) : on
	// repart du début plutôt que de ne rien proposer.
	if (index === -1) return first.deviceId
	for (let step = 1; step <= devices.length; step += 1) {
		const candidate = devices[(index + step) % devices.length]
		if (candidate !== undefined && candidate.deviceId !== resolved) return candidate.deviceId
	}
	// Une liste d'un seul élément, déjà actif : cycler reviendrait sur lui-même.
	return null
}

/** Ce qui s'écrit SOUS le bouton — une seule formule, quel que soit le palier. */
export function speakerButtonLabel(plan: SpeakerControlPlan, t: TFunction): string {
	if (plan.kind === "toggle") {
		return plan.onSpeaker ? t("iappel:audioRoute.button.speaker") : t("iappel:audioRoute.button.earpiece")
	}
	// Le sélecteur dit ce qu'il EST, jamais le périphérique choisi : un libellé
	// d'OS (« Par défaut - Haut-parleurs MacBook Air (Built-in) ») sous un rond
	// de 56 px élargissait la colonne et cassait la symétrie de la rangée. Le
	// périphérique actif se lit dans le panneau, coché (`activeLabel`).
	return t("iappel:audioRoute.button.output")
}
