// Dupliqué de socle/packages/livekit/src/room-options.ts @ ad2e7fdc2 — adaptations : code tel quel ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces ; commentaire du profil multi-publieurs recadré sur le direct (iRéunion et entretiens ne sont pas repris).
/**
 * LiveKit — options partagées des rooms d'appel.
 *
 * DEUX profils, et les confondre coûte l'image :
 *
 *  · `LIVEKIT_CALL_ROOM_OPTIONS` — les salles à PLUSIEURS publieurs (le direct).
 *    Plusieurs publieurs, plusieurs abonnés, tuiles de tailles très diverses :
 *    VP9 y gagne en bitrate/qualité et son SVC sert bien des tuiles inégales.
 *  · `LIVEKIT_DIRECT_CALL_ROOM_OPTIONS` — l'appel 1:1 (iAppel).
 *
 * ⚠️ Pourquoi VP8 pour le 1:1, alors que VP9 est « meilleur » : demander
 * `videoCodec: "vp9"` fait basculer livekit-client en **SVC** — il REMPLACE
 * alors les `videoSimulcastLayers` déclarées par un `scalabilityMode`
 * (`L3T3_KEY`), et emprunte sur Safari/iOS un chemin « legacy SVC » distinct.
 * Les trois couches qu'on croit publier ne sont donc jamais publiées telles
 * quelles, et le rendu dépend du couple exact (version de Safari, version du
 * serveur auto-hébergé). Sur un tête-à-tête, la qualité gagnée par VP9 est
 * marginale — deux flux, deux plein-cadres — tandis que le risque d'un cadre
 * noir chez le pair, lui, ne l'est pas. VP8 honore le simulcast tel qu'il est
 * écrit, sur tous les navigateurs cibles.
 *
 * Le reste est commun aux deux profils et vaut d'être rappelé :
 *  - adaptiveStream : le serveur ajuste la qualité envoyée à chaque abonné
 *    selon la taille de rendu (pas de 720p pour une vignette 120×180) ;
 *  - dynacast : met en pause les couches que personne ne consomme ;
 *  - videoCaptureDefaults : capture locale en 720p ;
 *  - audioCaptureDefaults : améliorations standards + mono 48 kHz (Opus) ;
 *  - stopLocalTrackOnUnpublish : libère la caméra, pas d'icône résiduelle ;
 *  - reconnectPolicy : reconnexion agressive avec jitter (4G ↔ WiFi, VPN).
 *
 * ⚠️ Ces objets sont des CONSTANTES DE MODULE, et doivent le rester :
 * `useLiveKitRoom` recrée la `Room` dès que `JSON.stringify(options)` change.
 * Un littéral écrit dans le JSX reconstruirait la room à chaque rendu.
 */

import type { AudioCaptureOptions, RoomOptions } from "livekit-client";
import { VideoPresets } from "livekit-client";

/** Capture audio — identique pour les deux profils, déclarée une seule fois. */
const CALL_AUDIO_CAPTURE: AudioCaptureOptions = {
	autoGainControl: true,
	echoCancellation: true,
	noiseSuppression: true,
	channelCount: 1,
	sampleRate: 48_000,
};

/** Trois couches simulcast — 180p pour une vignette, 720p pour un plein cadre. */
const CALL_SIMULCAST_LAYERS = [
	VideoPresets.h180,
	VideoPresets.h360,
	VideoPresets.h720,
];

/** Reconnexion exponentielle bornée, avec jitter pour ne pas synchroniser les pairs. */
const CALL_RECONNECT_POLICY: RoomOptions["reconnectPolicy"] = {
	nextRetryDelayInMs: (context) => {
		if (context.retryCount > 10) return null;
		const base = Math.min(1000 * 2 ** context.retryCount, 15_000);
		return base + Math.random() * 500;
	},
};

/** PLUSIEURS PUBLIEURS (le direct) — tuiles inégales : VP9/SVC, repli VP8. */
export const LIVEKIT_CALL_ROOM_OPTIONS: RoomOptions = {
	adaptiveStream: true,
	dynacast: true,
	stopLocalTrackOnUnpublish: true,
	videoCaptureDefaults: {
		resolution: VideoPresets.h720.resolution,
	},
	audioCaptureDefaults: CALL_AUDIO_CAPTURE,
	publishDefaults: {
		videoCodec: "vp9",
		videoSimulcastLayers: CALL_SIMULCAST_LAYERS,
		backupCodec: { codec: "vp8" },
		dtx: true,
		red: true,
		simulcast: true,
		stopMicTrackOnMute: false,
	},
	reconnectPolicy: CALL_RECONNECT_POLICY,
};

/**
 * APPEL 1:1 (iAppel) — VP8 simulcast, pour que les trois couches déclarées
 * soient celles réellement publiées, sur Safari iOS comme ailleurs.
 *
 * Pas de `backupCodec` : il n'a de sens qu'avec un codec principal que
 * certains pairs ne décodent pas, et il force `dynacast` en poussant un
 * second `SimulcastCodec` — deux encodages pour un tête-à-tête.
 */
export const LIVEKIT_DIRECT_CALL_ROOM_OPTIONS: RoomOptions = {
	adaptiveStream: true,
	dynacast: true,
	stopLocalTrackOnUnpublish: true,
	videoCaptureDefaults: {
		resolution: VideoPresets.h720.resolution,
	},
	audioCaptureDefaults: CALL_AUDIO_CAPTURE,
	publishDefaults: {
		videoCodec: "vp8",
		videoSimulcastLayers: CALL_SIMULCAST_LAYERS,
		dtx: true,
		red: true,
		simulcast: true,
		stopMicTrackOnMute: false,
	},
	reconnectPolicy: CALL_RECONNECT_POLICY,
};
