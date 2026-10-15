// Dupliqué de socle/packages/agent-features/src/features/messagerie/VoiceRecorderButton.tsx @ ad2e7fdc2 — adaptations : libellés et message d'échec traduits (espace de noms `messagerie`, clés `voiceRecorderButton.*`) ; export et props inchangés (`VoicemailRecorder` d'iappel le monte aussi).
"use client"

/**
 * VoiceRecorderButton — le micro du composeur.
 *
 * Le composant tient `getUserMedia` / `MediaRecorder` / le flux ; TOUT ce qui
 * se décide vit dans `voice-note.ts` (module pur, testé) : quel conteneur
 * demander, quand la prise est trop courte, quel nom de fichier écrire, quelle
 * durée afficher, et l'automate de phases.
 *
 * ⚠️ `audio/mp4` en tête des candidats — ce n'est pas une préférence, c'est
 * iOS : Safari ne produit ni ne lit le `webm`. Un vocal enregistré en `webm`
 * est MUET sur l'iPhone d'en face, sans le moindre message. Cf. l'en-tête de
 * `voice-note.ts`.
 *
 * ⚠️ Le flux est FERMÉ dans tous les chemins de sortie (arrêt, annulation,
 * erreur, démontage). Un `MediaStreamTrack` laissé ouvert garde l'indicateur
 * de micro allumé sur le téléphone bien après qu'on a quitté l'écran — et
 * l'utilisateur en conclut, à raison, qu'on l'écoute.
 *
 * ⚠️ Une prise trop courte est JETÉE SANS UN MOT (`shouldDiscard`) : c'est le
 * doigt qui a effleuré le micro en visant le trombone. L'envoyer polluerait le
 * fil d'un souffle que le destinataire ne peut pas interpréter.
 */

import { Mic, Square } from "lucide-react"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
	formatVoiceDuration,
	initialRecorderState,
	pickRecorderMimeType,
	recorderReducer,
	shouldDiscard,
	voiceNoteFileName,
} from "./voice-note"

export interface VoiceNoteResult {
	file: File
	durationMs: number
	mimeType: string
}

export function VoiceRecorderButton({
	onRecorded,
	onError,
	disabled = false,
}: {
	/** La prise est prête — à l'appelant de la téléverser et de l'envoyer. */
	onRecorded: (note: VoiceNoteResult) => void
	/** L'échec, déjà traduit dans la langue de l'écran. */
	onError?: (message: string) => void
	disabled?: boolean
}) {
	const { t } = useTranslation("messagerie")
	const [state, dispatch] = useReducer(recorderReducer, undefined, initialRecorderState)
	const [supported, setSupported] = useState(false)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const startedAtRef = useRef<number>(0)
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const fermerLeFlux = useCallback(() => {
		if (tickRef.current !== null) {
			clearInterval(tickRef.current)
			tickRef.current = null
		}
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
		recorderRef.current = null
	}, [])

	useEffect(() => {
		// La prise en charge se mesure APRÈS l'hydratation : la lire au rendu
		// donnerait `false` au serveur et `true` au client, donc un désaccord.
		setSupported(
			typeof window !== "undefined" &&
				typeof navigator.mediaDevices?.getUserMedia === "function" &&
				typeof MediaRecorder !== "undefined",
		)
		return fermerLeFlux
	}, [fermerLeFlux])

	const arreter = useCallback(() => {
		dispatch({ kind: "stop" })
		const recorder = recorderRef.current
		if (recorder !== null && recorder.state !== "inactive") {
			recorder.stop()
			return
		}
		fermerLeFlux()
		dispatch({ kind: "stopped" })
	}, [fermerLeFlux])

	// Le PLAFOND est décidé par le réducteur (phase `stopping` au battement qui
	// atteint deux minutes) ; l'effet ne fait qu'obéir. Laisser la borne au
	// composant la perdrait dès qu'un onglet en arrière-plan fige ses minuteries.
	useEffect(() => {
		if (state.phase !== "stopping") return
		const recorder = recorderRef.current
		if (recorder !== null && recorder.state !== "inactive") recorder.stop()
	}, [state.phase])

	const demarrer = useCallback(async (): Promise<void> => {
		if (!supported || disabled) return
		dispatch({ kind: "request" })
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			streamRef.current = stream
			chunksRef.current = []

			const mimeType = pickRecorderMimeType((type) =>
				MediaRecorder.isTypeSupported(type),
			)
			const recorder =
				mimeType === null
					? new MediaRecorder(stream)
					: new MediaRecorder(stream, { mimeType })
			recorderRef.current = recorder

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data)
			}
			recorder.onstop = () => {
				const durationMs = Date.now() - startedAtRef.current
				// Le mime RÉEL du recorder, jamais celui qu'on a demandé : le
				// navigateur peut avoir choisi autre chose, et c'est ce mime-là qui
				// décide de l'extension et de l'acceptation par le serveur.
				const reel =
					recorder.mimeType.length > 0
						? recorder.mimeType
						: (mimeType ?? "audio/mp4")
				const blob = new Blob(chunksRef.current, { type: reel })
				chunksRef.current = []
				fermerLeFlux()
				dispatch({ kind: "stopped" })
				if (shouldDiscard(durationMs) || blob.size === 0) return
				onRecorded({
					file: new File([blob], voiceNoteFileName(reel, Date.now()), {
						type: reel,
					}),
					durationMs,
					mimeType: reel,
				})
			}

			startedAtRef.current = Date.now()
			recorder.start()
			dispatch({ kind: "started", at: startedAtRef.current })
			tickRef.current = setInterval(
				() => dispatch({ kind: "tick", at: Date.now() }),
				200,
			)
		} catch {
			fermerLeFlux()
			// Le refus de permission et l'absence de micro rendent la MÊME erreur
			// selon les navigateurs : on dit ce que l'utilisateur peut faire, pas
			// ce que l'API a répondu.
			const message = t("voiceRecorderButton.micUnavailable")
			dispatch({ kind: "error", message })
			onError?.(message)
		}
	}, [supported, disabled, fermerLeFlux, onRecorded, onError, t])

	// Sans micro, pas de bouton : un micro grisé en permanence occupe la place
	// et laisse croire à une panne passagère.
	if (!supported) return null

	const enregistre = state.phase === "recording" || state.phase === "stopping"

	return (
		<>
			{enregistre ? (
				<span className="msg-rec-row">
					<span aria-hidden="true" className="msg-rec-dot" />
					<span className="msg-rec-time">
						{formatVoiceDuration(state.elapsedMs)}
					</span>
					<span style={{ color: "var(--ink-600)", fontSize: 12 }}>
						{t("voiceRecorderButton.releaseToSend")}
					</span>
				</span>
			) : null}
			<button
				type="button"
				className="msg-icon-btn msg-rec-btn"
				data-recording={enregistre ? "true" : "false"}
				disabled={disabled || state.phase === "requesting"}
				aria-label={
					enregistre
						? t("voiceRecorderButton.stopAndSendLabel")
						: t("voiceRecorderButton.voiceMessage")
				}
				title={
					enregistre
						? t("voiceRecorderButton.stopAndSend")
						: t("voiceRecorderButton.voiceMessage")
				}
				onClick={() => (enregistre ? arreter() : void demarrer())}
			>
				{enregistre ? (
					<Square aria-hidden="true" size={15} />
				) : (
					<Mic aria-hidden="true" size={17} />
				)}
			</button>
		</>
	)
}
