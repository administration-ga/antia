// Dupliqué de socle/packages/livekit/src/use-busy-tone.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
"use client";

/**
 * useBusyTone — la TONALITÉ « OCCUPÉ » côté APPELANT.
 *
 * Le second signal de la téléphonie : quand l'appelé est injoignable (hors
 * ligne, ne pas déranger, déjà en communication…), l'appelant entend le bip
 * cadencé « occupé » — 440 Hz, 0,5 s de ton / 0,5 s de silence, la cadence
 * des lignes françaises — au lieu de la tonalité de retour longue
 * (`use-ringback.ts`) ou du silence.
 *
 * Deux usages, un seul moteur :
 *  · EN CONTINU pendant la sonnerie d'un appelé déjà en communication (l'appel
 *    sonne quand même — appel en attente — mais l'appelant sait qu'il
 *    patiente) ;
 *  · EN RAFALE BORNÉE (`maxCycles`) sur l'écran de refus d'admission — trois
 *    bips disent « occupé » sans transformer un écran statique en alarme.
 *
 * Hook SÉPARÉ de `useRingback`, par FORME du signal (doctrine des hooks audio
 * de ce package : un hook par forme, jamais un moteur paramétrable). Même
 * contexte audio PARTAGÉ (`getSharedAudioContext`), jamais fermé ici, reprise
 * tentée à chaque cycle (politique autoplay).
 */

import { useEffect } from "react";
import { getSharedAudioContext } from "./audio-unlock";

/** Exporté pour que les tests décrivent le signal réel, pas des nombres recopiés. */
export const BUSY_TONE = {
	freqHz: 440,
	toneMs: 500,
	silenceMs: 500,
	/** Même discrétion que la tonalité de retour. */
	gain: 0.08,
} as const;

export interface BusyToneOptions {
	/**
	 * Nombre de bips puis silence — pour l'écran de refus. Absent = en boucle
	 * tant que `isActive` reste vrai (cas « ça sonne chez un occupé »).
	 */
	maxCycles?: number;
}

/**
 * Joue la tonalité « occupé » tant que `isActive === true` (bornée à
 * `maxCycles` bips quand l'option est posée). S'éteint d'elle-même à toute
 * transition de phase.
 */
export function useBusyTone(isActive: boolean, options?: BusyToneOptions): void {
	const maxCycles = options?.maxCycles;

	useEffect(() => {
		if (!isActive) return;

		const audioContext = getSharedAudioContext();
		if (!audioContext) return;

		let cycles = 0;
		const playBeep = () => {
			if (audioContext.state === "closed") return;
			if (maxCycles !== undefined && cycles >= maxCycles) return;
			cycles += 1;
			// Politique autoplay : reprise tentée à chaque cycle, comme les
			// autres signaux du package.
			if (audioContext.state === "suspended") {
				void audioContext.resume().catch(() => {});
			}

			const start = audioContext.currentTime + 0.02;
			const end = start + BUSY_TONE.toneMs / 1000;

			const gainNode = audioContext.createGain();
			gainNode.connect(audioContext.destination);

			const osc = audioContext.createOscillator();
			osc.type = "sine";
			osc.frequency.setValueAtTime(BUSY_TONE.freqHz, start);
			osc.connect(gainNode);
			osc.start(start);
			osc.stop(end);

			// Enveloppe douce : pas de claquement à l'attaque ni à la coupure.
			gainNode.gain.setValueAtTime(0, start);
			gainNode.gain.linearRampToValueAtTime(BUSY_TONE.gain, start + 0.02);
			gainNode.gain.setValueAtTime(BUSY_TONE.gain, end - 0.03);
			gainNode.gain.linearRampToValueAtTime(0, end);
		};

		playBeep();
		const interval = setInterval(
			playBeep,
			BUSY_TONE.toneMs + BUSY_TONE.silenceMs,
		);

		return () => {
			clearInterval(interval);
			// PAS de `close()` : le contexte est partagé avec la sonnerie, la
			// tonalité de retour et le bip d'attente — le prochain signal le
			// réutilise, déjà déverrouillé.
		};
	}, [isActive, maxCycles]);
}
