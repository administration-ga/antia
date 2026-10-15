// Dupliqué de socle/packages/agent-features/src/features/iappel/RemoteVideoStage.tsx @ ad2e7fdc2 — adaptations : messages de scène traduits (i18n `iappel`, prénom interpolé).
"use client"

/**
 * RemoteVideoStage — la scène : la vidéo du correspondant, ou ce qui la
 * remplace, selon le `RemoteVideoState` calculé par `./remote-video`.
 *
 * ⚠️ En `connecting`, `<VideoTrack>` est monté QUAND MÊME, sous une
 * superposition « Connexion vidéo… ». Ce n'est pas un oubli de nettoyage :
 * `remote-video.ts` documente que sous `adaptiveStream`, LiveKit décide
 * d'ENVOYER la vidéo ou non selon la visibilité de l'élément qui lui est
 * attaché. Ne monter le `<video>` qu'à la réception de la première image
 * verrouillerait une boucle où elle n'arrive jamais, faute d'élément à qui
 * l'envoyer.
 */

import { VideoTrack, type TrackReference } from "@livekit/components-react"
import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { RemoteVideoState } from "./remote-video"

export interface RemoteVideoStageProps {
	/** `null` en `off` / `none` : rien à afficher, cf. `remote-video.ts`. */
	trackRef: TrackReference | null
	state: RemoteVideoState
	/** Nom du correspondant — sert au message « Caméra coupée par X ». */
	peerName: string | null
	/** Vignette locale, puces, superpositions — posées PAR-DESSUS la scène. */
	children?: ReactNode
}

const OVERLAY_TEXT_STYLE: CSSProperties = {
	fontSize: "13.5px",
	color: "var(--esp-immersive-on-ink)",
	opacity: 0.7,
}

/** Un message centré, posé sur la scène — factorisé : deux états le portent. */
function StageMessage({ children }: { children: ReactNode }) {
	return (
		<div
			// ⚠️ `pointer-events-none` n'est pas décoratif. Ce voile est
			// `absolute inset-0` : sans lui, il mangeait le clic sur TOUTE la
			// scène dans les états `connecting` et `off` — donc sur la puce
			// « Prendre » d'un second appel, seule affordance pour le décrocher.
			className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center"
			style={OVERLAY_TEXT_STYLE}
		>
			{children}
		</div>
	)
}

export function RemoteVideoStage({ trackRef, state, peerName, children }: RemoteVideoStageProps) {
	const { t } = useTranslation("iappel")
	// Le PREMIER mot seulement — « Caméra coupée par Berny », jamais le nom
	// complet — cohérent avec le reste de l'écran d'appel (cf. DirectCallView,
	// « {{name}} parle… » sur le seul prénom). Un `peerName` absent ou vide
	// (falsy) retombe sur le message générique, sans nom à afficher.
	const firstName = peerName ? peerName.trim().split(/\s+/)[0] : undefined
	const offMessage = firstName ? t("remoteVideoStage.cameraOffBy", { name: firstName }) : t("remoteVideoStage.cameraOff")

	return (
		<div className="iappel-stage">
			{(state === "live" || state === "connecting") && (
				// `trackRef` est non nul dans CES DEUX états par construction de
				// `pickRemoteCameraTrack` (cf. remote-video.ts) — `?? undefined`
				// ne fait que satisfaire le type de `VideoTrack`, qui accepte
				// `undefined` mais pas `null`.
				<VideoTrack trackRef={trackRef ?? undefined} className="iappel-video" />
			)}
			{state === "connecting" && <StageMessage>{t("remoteVideoStage.connecting")}</StageMessage>}
			{state === "off" && <StageMessage>{offMessage}</StageMessage>}
			{/* Toujours rendu, quel que soit l'état : en `none`, c'est la SEULE
			    chose que cette scène affiche — l'appelant y pose son avatar. */}
			{children}
		</div>
	)
}
