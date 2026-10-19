// Dupliqué de socle/packages/agent-features/src/features/iappel/use-speaker-output.ts @ ad2e7fdc2 — adaptations : plan et libellés traduits (`planSpeakerControl(…, t)`, `audioDeviceLabel(…, t)`) ; toasts traduits (espace de noms `iappel`, clés `useSpeakerOutput.…`).
"use client"

/**
 * useSpeakerOutput — la PLOMBERIE de la sortie audio.
 *
 * Il énumère les périphériques, lit la capacité du navigateur, demande la
 * bascule à LiveKit — et ne décide RIEN. Tout ce qui se décide (quel palier
 * rendre, quel est le haut-parleur, quel libellé écrire) vit dans
 * `audio-route.ts`, module pur et testé.
 *
 * ⚠️ LA CAPACITÉ VIENT DE `supportsAudioOutputSelection()` (livekit-client),
 * jamais d'un test maison `"setSinkId" in HTMLMediaElement.prototype` — c'est
 * exactement ce que faisait ce fichier, et c'était faux : Safari 26 EXPOSE
 * `setSinkId` sans l'honorer pour l'audio WebRTC, si bien que le test maison
 * répondait « oui » et que `switchActiveDevice("audiooutput")` levait
 * « cannot switch audio output » un clic plus tard. La fonction de LiveKit,
 * elle, répond `false` sur tout Safari — c'est la même condition que celle
 * qui garde le `switchActiveDevice` à l'intérieur de la bibliothèque.
 *
 * ⚠️ Elle lit `document` : elle ne peut PAS être appelée pendant un rendu
 * serveur. D'où la mesure dans un effet, avec un défaut fermé.
 *
 * ⚠️ La salle est OPTIONNELLE : `useMaybeRoomContext`, jamais
 * `useRoomContext`. Ce hook est appelé depuis l'écran d'appel, qui s'ouvre
 * AVANT que la salle n'existe (le jeton se négocie derrière) ; la variante qui
 * lève emportait le rendu entier.
 *
 * ⚠️ Le magasin s'écrit APRÈS la résolution de `switchActiveDevice`, jamais
 * avant : mémoriser une sortie que la salle vient de refuser (casque
 * débranché entre l'énumération et le clic) la ferait ré-appliquer à chaque
 * appel suivant. Et un échec se DIT — le `catch {}` vide d'avant laissait
 * l'usager devant un bouton qui n'avait rien fait.
 */

import { useMaybeRoomContext } from "@livekit/components-react"
import { RoomEvent, supportsAudioOutputSelection } from "livekit-client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { callStore, useAudioRoute } from "../../stores/call-store"
import {
	audioDeviceLabel,
	detectAudioPlatform,
	nextOutputDevice,
	planSpeakerControl,
	type AudioDeviceInfo,
	type AudioPlatform,
	type SpeakerControlPlan,
} from "./audio-route"
import type { AudioRouteIntent } from "./call-types"

export interface SpeakerOutput {
	/**
	 * La sortie peut-elle être CHANGÉE ici ? (sélecteur ou bascule). Depuis le
	 * 22/09, une commande `unavailable` reste sur l'écran d'appel — mais la vue
	 * ancienne qui n'a qu'un bouton « suivant » (`DirectCallView`) ne doit
	 * l'offrir que quand il route vraiment.
	 */
	available: boolean
	/** Sorties détectées, dans l'ordre rendu par le navigateur. */
	devices: MediaDeviceInfo[]
	/** Périphérique actif selon la salle, `null` tant qu'elle n'en dit rien. */
	activeDeviceId: string | null
	/** CE QUE L'ÉCRAN REND — l'unique décision, prise dans `audio-route.ts`. */
	plan: SpeakerControlPlan
	/** L'intention mémorisée par le magasin (survit à l'appel). */
	route: AudioRouteIntent | null
	/** Passe à la sortie suivante — un bouton, pas un menu. */
	cycle: () => Promise<void>
	/** Choisit une sortie précise (sélecteur du bureau). */
	select: (deviceId: string) => Promise<void>
	/** Bascule écouteur ↔ haut-parleur (téléphone). */
	toggle: () => Promise<void>
}

/** L'environnement, mesuré une fois côté navigateur — jamais au rendu serveur. */
interface AudioEnvironment {
	canSelectOutput: boolean
	platform: AudioPlatform
}

const CLOSED_ENVIRONMENT: AudioEnvironment = {
	canSelectOutput: false,
	platform: "desktop",
}

function toInfo(device: MediaDeviceInfo): AudioDeviceInfo {
	return { deviceId: device.deviceId, label: device.label }
}

export function useSpeakerOutput(): SpeakerOutput {
	const { t } = useTranslation("iappel")
	const room = useMaybeRoomContext()
	const route = useAudioRoute()
	const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
	const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
	const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)
	const [environment, setEnvironment] = useState<AudioEnvironment>(CLOSED_ENVIRONMENT)

	// La capacité et l'appareil : mesurés au montage, côté navigateur. Le
	// défaut FERMÉ (`canSelectOutput: false`) ne rend aucune commande tant que
	// la mesure n'a pas eu lieu — on n'affiche jamais un bouton par défaut.
	useEffect(() => {
		if (typeof navigator === "undefined") return
		setEnvironment({
			canSelectOutput: supportsAudioOutputSelection(),
			platform: detectAudioPlatform({
				userAgent: navigator.userAgent,
				maxTouchPoints: navigator.maxTouchPoints ?? 0,
			}),
		})
	}, [])

	// SORTIES **ET** ENTRÉES : la bascule Android par l'entrée (désarmée, mais
	// décidée dans le module pur) a besoin des secondes, et le plan les exige
	// pour trancher entre « pas de stratégie » et « stratégie d'entrée ».
	useEffect(() => {
		if (typeof navigator === "undefined" || !navigator.mediaDevices) return
		let cancelled = false
		const refresh = () => {
			void navigator.mediaDevices
				.enumerateDevices()
				.then((all) => {
					if (cancelled) return
					setOutputs(all.filter((d) => d.kind === "audiooutput"))
					setInputs(all.filter((d) => d.kind === "audioinput"))
				})
				// Énumérer peut échouer (permissions, contexte non sécurisé) :
				// la commande se replie alors, ce qui est le bon comportement.
				.catch(() => {
					if (cancelled) return
					setOutputs([])
					setInputs([])
				})
		}
		refresh()
		// Un casque branché ou retiré en cours d'appel change la donne.
		navigator.mediaDevices.addEventListener("devicechange", refresh)
		return () => {
			cancelled = true
			navigator.mediaDevices.removeEventListener("devicechange", refresh)
		}
	}, [])

	/**
	 * Ce que la SALLE route en ce moment.
	 *
	 * ⚠️ L'état initial venait à `null` et n'était mis à jour que par nos
	 * propres clics : le premier appui du cycle repartait donc d'un actif
	 * inconnu. `room.getActiveDevice` le donne d'emblée, et
	 * `ActiveDeviceChanged` le suit — y compris quand c'est le pool
	 * (`AudioRouteController`) qui a posé la route, sans passer par l'écran.
	 */
	useEffect(() => {
		if (!room) {
			setActiveDeviceId(null)
			return
		}
		setActiveDeviceId(room.getActiveDevice("audiooutput") ?? null)
		const onChanged = (kind: MediaDeviceKind, deviceId: string) => {
			if (kind === "audiooutput") setActiveDeviceId(deviceId)
		}
		room.on(RoomEvent.ActiveDeviceChanged, onChanged)
		return () => {
			room.off(RoomEvent.ActiveDeviceChanged, onChanged)
		}
	}, [room])

	const outputInfos = useMemo(() => outputs.map(toInfo), [outputs])
	const inputInfos = useMemo(() => inputs.map(toInfo), [inputs])

	const plan = useMemo(
		() =>
			planSpeakerControl(
				{
					platform: environment.platform,
					canSelectOutput: environment.canSelectOutput,
					outputs: outputInfos,
					inputs: inputInfos,
					route,
					activeDeviceId,
					hasRoom: Boolean(room),
				},
				t,
			),
		[environment, outputInfos, inputInfos, route, activeDeviceId, room, t],
	)

	/** Demande la bascule à la salle, puis — et seulement alors — mémorise. */
	const apply = useCallback(
		async (
			kind: "audiooutput" | "audioinput",
			deviceId: string,
			intent: AudioRouteIntent,
		): Promise<boolean> => {
			if (!room) return false
			try {
				await room.switchActiveDevice(kind, deviceId)
			} catch {
				// Périphérique débranché, ou navigateur qui refuse de router :
				// on le DIT, et le magasin reste sur l'intention précédente.
				toast.error(t("useSpeakerOutput.switchFailed"))
				return false
			}
			if (kind === "audiooutput") setActiveDeviceId(deviceId)
			callStore.setAudioRoute(intent)
			return true
		},
		[room, t],
	)

	const select = useCallback(
		async (deviceId: string) => {
			const found = outputInfos.find((device) => device.deviceId === deviceId)
			const label = found ? audioDeviceLabel(found, t) : null
			const done = await apply("audiooutput", deviceId, {
				kind: "device",
				deviceId,
				label,
			})
			// Un geste explicite mérite sa confirmation : sans elle, choisir une
			// sortie qui n'émet pas encore de son ne se distingue pas d'un échec.
			if (done) {
				toast.success(
					t("useSpeakerOutput.selected", { label: label ?? t("useSpeakerOutput.chosenDevice") }),
				)
			}
		},
		[apply, outputInfos, t],
	)

	const toggle = useCallback(async () => {
		if (plan.kind !== "toggle") return
		if (plan.strategy === "sink") {
			const target = plan.onSpeaker ? plan.earpieceId : plan.speakerId
			await apply("audiooutput", target, {
				kind: plan.onSpeaker ? "earpiece" : "speaker",
			})
			return
		}
		// Stratégie d'ENTRÉE (Android, derrière `ANDROID_INPUT_ROUTE_TRICK`) :
		// sur une partie du parc, changer l'entrée fait suivre la sortie.
		await apply("audioinput", plan.inputId, {
			kind: plan.onSpeaker ? "earpiece" : "speaker",
		})
	}, [plan, apply])

	const cycle = useCallback(async () => {
		const next = nextOutputDevice(outputInfos, activeDeviceId)
		if (next === null) return
		await select(next)
	}, [outputInfos, activeDeviceId, select])

	return {
		available: plan.kind === "picker" || plan.kind === "toggle",
		devices: outputs,
		activeDeviceId,
		plan,
		route,
		cycle,
		select,
		toggle,
	}
}
