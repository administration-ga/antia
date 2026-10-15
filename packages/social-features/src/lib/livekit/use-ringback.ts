// Dupliqué de socle/packages/livekit/src/use-ringback.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
"use client";

/**
 * useRingback — la TONALITÉ DE RETOUR côté APPELANT.
 *
 * Pendant que l'appel sort (« Sonnerie… »), l'appelant doit ENTENDRE que ça
 * sonne chez l'autre : un ton long unique, cadencé comme une ligne
 * téléphonique (440 Hz, ~1,5 s de ton, ~3,5 s de silence), distinct à
 * l'oreille de la sonnerie ENTRANTE (motif de bips brefs en dual-tone,
 * `use-ringtone.ts`).
 *
 * Hook SÉPARÉ de `useRingtone`, par FORME du signal : la sonnerie entrante
 * est un motif de bips en boucle, la tonalité de retour un ton long —
 * partager le moteur imposerait un profil « à motif paramétrable » pour deux
 * signaux qui ne se ressemblent pas. Même contexte audio PARTAGÉ
 * (`getSharedAudioContext`), jamais fermé ici, reprise tentée à chaque cycle
 * (politique autoplay). Cas nominal favorable : la tonalité démarre dans la
 * foulée du clic « Appeler », donc APRÈS un geste — le contexte est déjà
 * déverrouillé.
 */

import { useEffect } from "react";
import { getSharedAudioContext } from "./audio-unlock";

/** Exporté pour que les tests décrivent le signal réel, pas des nombres recopiés. */
export const RINGBACK_TONE = {
	freqHz: 440,
	toneMs: 1500,
	cadenceMs: 5000,
	/** Plus discret que la sonnerie entrante la plus douce (standard : 0.15). */
	gain: 0.08,
} as const;

/**
 * Joue la tonalité de retour en boucle tant que `isRinging === true`.
 * S'éteint d'elle-même à toute transition de phase (décroché, refus, fin).
 */
export function useRingback(isRinging: boolean): void {
	useEffect(() => {
		if (!isRinging) return;

		const audioContext = getSharedAudioContext();
		if (!audioContext) return;

		const playTone = () => {
			if (audioContext.state === "closed") return;
			// Politique autoplay : sans geste utilisateur récent le contexte reste
			// « suspended » et l'oscillateur est muet — on tente la reprise à
			// chaque cycle, comme la sonnerie entrante.
			if (audioContext.state === "suspended") {
				void audioContext.resume().catch(() => {});
			}

			const start = audioContext.currentTime + 0.02;
			const end = start + RINGBACK_TONE.toneMs / 1000;

			const gainNode = audioContext.createGain();
			gainNode.connect(audioContext.destination);

			const osc = audioContext.createOscillator();
			osc.type = "sine";
			osc.frequency.setValueAtTime(RINGBACK_TONE.freqHz, start);
			osc.connect(gainNode);
			osc.start(start);
			osc.stop(end);

			// Enveloppe douce : le ton s'installe et s'éteint sans claquement.
			gainNode.gain.setValueAtTime(0, start);
			gainNode.gain.linearRampToValueAtTime(RINGBACK_TONE.gain, start + 0.03);
			gainNode.gain.setValueAtTime(RINGBACK_TONE.gain, end - 0.05);
			gainNode.gain.linearRampToValueAtTime(0, end);
		};

		playTone();
		const interval = setInterval(playTone, RINGBACK_TONE.cadenceMs);

		return () => {
			clearInterval(interval);
			// PAS de `close()` : le contexte est partagé avec la sonnerie et le
			// bip d'attente (cf. use-ringtone.ts) — la prochaine tonalité le
			// réutilise, déjà déverrouillé.
		};
	}, [isRinging]);
}
