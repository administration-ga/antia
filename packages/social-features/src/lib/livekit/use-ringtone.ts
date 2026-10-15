// Dupliqué de socle/packages/livekit/src/use-ringtone.ts @ ad2e7fdc2 — adaptations : variante de sonnerie « poste » retirée (type `RingtoneVariant`, profil et documentation : aucun appel reçu au titre d'un poste dans le moteur) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
"use client";

import { useEffect } from "react";
import { getSharedAudioContext } from "./audio-unlock";

/**
 * Profils de sonnerie.
 * - "standard" : tonalité téléphonique classique 440/480 Hz, cadence 2 s —
 *                un appel PERSONNEL, de personne à personne ;
 * - "urgent"   : tonalité aiguë 660/720 Hz, cadence 1,2 s — appel prioritaire.
 *
 * Les deux profils restent distinguables à l'oreille SANS être stridents :
 * une sonnerie se déclenche des dizaines de fois par jour.
 */
export type RingtoneVariant = "standard" | "urgent";

export interface RingtoneProfile {
	freqs: [number, number];
	cadenceMs: number;
	gain: number;
}

/**
 * Exporté pour que la vibration puisse suivre la MÊME cadence que le son
 * (`vibrationPatternFor`) et pour que les tests décrivent des profils réels
 * plutôt que des nombres recopiés.
 */
export const RINGTONE_PROFILES: Record<RingtoneVariant, RingtoneProfile> = {
	standard: { freqs: [440, 480], cadenceMs: 2000, gain: 0.15 },
	urgent: { freqs: [660, 720], cadenceMs: 1200, gain: 0.2 },
};

/**
 * useRingtone — joue une sonnerie en boucle tant que `isRinging === true`.
 * Utilise Web Audio API pour générer le dual-tone téléphonique classique, pas
 * d'asset à servir.
 *
 * Le contexte audio est PARTAGÉ (`getSharedAudioContext`) et n'est JAMAIS
 * fermé ici : le fermer au changement de profil produisait une micro-coupure
 * et consommait le quota navigateur (~6 contextes par page) ; et le recréer à
 * chaque sonnerie le faisait naître `suspended` sans geste utilisateur —
 * sonnerie muette. Le déverrouillage vit dans `audio-unlock.ts`
 * (`installAudioUnlock`, posé par l'hôte de la surface d'appel) ; la reprise
 * par cycle ci-dessous reste en ceinture-bretelles.
 *
 * @param isRinging - indique si la sonnerie doit jouer
 * @param variant   - "standard" (défaut) ou "urgent"
 */
export function useRingtone(
	isRinging: boolean,
	variant: RingtoneVariant = "standard",
) {
	useEffect(() => {
		if (!isRinging) return;

		const audioContext = getSharedAudioContext();
		if (!audioContext) return;

		const profile = RINGTONE_PROFILES[variant];

		const playRingTone = () => {
			if (audioContext.state === "closed") return;
			// Politique autoplay : sans geste utilisateur récent, le contexte
			// démarre « suspended » et les oscillateurs restent MUETS (sonnerie
			// silencieuse côté destinataire). On tente la reprise à chaque cycle —
			// dès que le navigateur l'autorise, la sonnerie devient audible.
			if (audioContext.state === "suspended") {
				void audioContext.resume().catch(() => {});
			}

			const now = audioContext.currentTime;
			const gainNode = audioContext.createGain();
			gainNode.connect(audioContext.destination);

			for (let beep = 0; beep < 2; beep++) {
				const startTime = now + beep * 0.25;
				const endTime = startTime + 0.15;

				for (const freq of profile.freqs) {
					const osc = audioContext.createOscillator();
					osc.type = "sine";
					osc.frequency.setValueAtTime(freq, startTime);
					osc.connect(gainNode);
					osc.start(startTime);
					osc.stop(endTime);
				}

				// Envelope fade in/out pour chaque bip
				gainNode.gain.setValueAtTime(0, startTime);
				gainNode.gain.linearRampToValueAtTime(profile.gain, startTime + 0.02);
				gainNode.gain.setValueAtTime(profile.gain, endTime - 0.02);
				gainNode.gain.linearRampToValueAtTime(0, endTime);
			}
		};

		playRingTone();
		const interval = setInterval(playRingTone, profile.cadenceMs);

		return () => {
			clearInterval(interval);
			// PAS de `close()` : le contexte est partagé — la prochaine sonnerie
			// (ou le bip d'attente) le réutilise, déjà déverrouillé.
		};
	}, [isRinging, variant]);
}
