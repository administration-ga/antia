// Dupliqué de socle/packages/livekit/src/use-hold-tone.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
"use client";

/**
 * useHoldTone — la TONALITÉ D'ATTENTE, côté correspondant TENU.
 *
 * La troisième tonalité de la téléphonie, après le retour (`use-ringback.ts`)
 * et l'occupé (`use-busy-tone.ts`). Quand l'autre bout met l'appel en attente,
 * le silence est ambigu : il se confond avec une ligne coupée, un micro
 * défaillant ou un correspondant parti. Un double bip discret, espacé, dit
 * « la ligne est vivante, elle attend » — et se fait oublier entre deux
 * cycles.
 *
 * Choix du signal :
 *  · DOUBLE bip court (2 × 80 ms), pour ne se confondre ni avec le ton long
 *    du retour ni avec la cadence régulière de l'occupé ;
 *  · les fréquences du profil de sonnerie STANDARD (`RINGTONE_PROFILES`) —
 *    c'est la même ligne, elle ne change pas de timbre ;
 *  · gain 0,06, sous les deux autres signaux : on patiente, on n'est pas
 *    alerté ;
 *  · une répétition toutes les 4 s. Plus souvent, le bip devient une alarme ;
 *    plus rarement, on croit la ligne morte.
 *
 * Hook SÉPARÉ par FORME du signal (doctrine des hooks audio de ce package :
 * jamais un moteur paramétrable). Même contexte audio PARTAGÉ
 * (`getSharedAudioContext`), JAMAIS fermé ici, reprise tentée à chaque cycle
 * (politique autoplay).
 */

import { useEffect } from "react";
import { getSharedAudioContext } from "./audio-unlock";
import { RINGTONE_PROFILES } from "./use-ringtone";

/** Exporté pour que les tests décrivent le signal réel, pas des nombres recopiés. */
export const HOLD_TONE = {
	/** Les deux fréquences de la sonnerie standard : c'est la même ligne. */
	freqs: RINGTONE_PROFILES.standard.freqs,
	/** Durée d'UN bip. */
	toneMs: 80,
	/** Silence entre les deux bips d'un même cycle. */
	gapMs: 120,
	/** Période du double bip — assez espacée pour se faire oublier. */
	cycleMs: 4000,
	/** Plus discret que la tonalité de retour et que l'occupé : on patiente. */
	gain: 0.06,
} as const;

/**
 * Joue le double bip d'attente tant que `isOnHold === true`. S'éteint d'elle-
 * même à toute transition de phase — la reprise, la fin de l'appel, un
 * raccrochage.
 */
export function useHoldTone(isOnHold: boolean): void {
	useEffect(() => {
		if (!isOnHold) return;

		const audioContext = getSharedAudioContext();
		if (!audioContext) return;

		const playDoubleBeep = () => {
			if (audioContext.state === "closed") return;
			// Politique autoplay : reprise tentée à chaque cycle, comme les
			// autres signaux du package.
			if (audioContext.state === "suspended") {
				void audioContext.resume().catch(() => {});
			}

			const base = audioContext.currentTime + 0.02;
			for (let beep = 0; beep < 2; beep++) {
				const start = base + beep * ((HOLD_TONE.toneMs + HOLD_TONE.gapMs) / 1000);
				const end = start + HOLD_TONE.toneMs / 1000;

				const gainNode = audioContext.createGain();
				gainNode.connect(audioContext.destination);

				for (const freq of HOLD_TONE.freqs) {
					const osc = audioContext.createOscillator();
					osc.type = "sine";
					osc.frequency.setValueAtTime(freq, start);
					osc.connect(gainNode);
					osc.start(start);
					osc.stop(end);
				}

				// Enveloppe douce : pas de claquement à l'attaque ni à la coupure.
				gainNode.gain.setValueAtTime(0, start);
				gainNode.gain.linearRampToValueAtTime(HOLD_TONE.gain, start + 0.015);
				gainNode.gain.setValueAtTime(HOLD_TONE.gain, end - 0.015);
				gainNode.gain.linearRampToValueAtTime(0, end);
			}
		};

		playDoubleBeep();
		const interval = setInterval(playDoubleBeep, HOLD_TONE.cycleMs);

		return () => {
			clearInterval(interval);
			// PAS de `close()` : le contexte est partagé avec la sonnerie, la
			// tonalité de retour, l'occupé et le bip d'attente — le prochain
			// signal le réutilise, déjà déverrouillé.
		};
	}, [isOnHold]);
}
