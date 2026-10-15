// Dupliqué de socle/packages/livekit/src/use-waiting-beep.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
"use client";

/**
 * useWaitingBeep — le signal BREF d'un appel en attente (S6).
 *
 * Quand je suis DÉJÀ en communication et qu'un second appel arrive
 * (`mode: "waiting"` de `call-inbox`), la sonnerie pleine couvrirait la voix
 * de mon interlocuteur : on joue UNE fois deux bips discrets, puis silence —
 * la puce `CallWaitingChip` porte le reste.
 *
 * Hook SÉPARÉ de `useRingtone`, par cycle de vie : une boucle se joue tant
 * qu'une condition dure, un one-shot se joue au FRONT MONTANT d'une identité
 * (`shouldReplayWaitingBeep`, pure et testée) — jamais sur un simple
 * re-render, jamais deux fois pour le même appel.
 *
 * Le mute est respecté PAR CONSTRUCTION : `call-inbox` rend `audible: null`
 * quand la sonnerie est coupée, donc `trigger` vaut `null` et rien ne joue.
 */

import { useEffect, useRef } from "react";
import {
	getSharedAudioContext,
	resumeSharedAudioContext,
} from "./audio-unlock";
import { RINGTONE_PROFILES } from "./use-ringtone";

/**
 * Rejouer quand l'IDENTITÉ de l'appel en attente change (null → id, ou
 * id → autre id). Jamais sur un re-render (même id), jamais à l'extinction.
 */
export function shouldReplayWaitingBeep(
	prev: string | null,
	next: string | null,
): boolean {
	return next !== null && next !== prev;
}

/** Plus discret que la sonnerie la plus douce (standard : 0.15). */
const WAITING_BEEP_GAIN = 0.1;

export function useWaitingBeep(trigger: string | null): void {
	const prevRef = useRef<string | null>(null);

	useEffect(() => {
		const prev = prevRef.current;
		prevRef.current = trigger;
		if (!shouldReplayWaitingBeep(prev, trigger)) return;

		const audioContext = getSharedAudioContext();
		if (!audioContext || audioContext.state === "closed") return;
		resumeSharedAudioContext();

		const now = audioContext.currentTime;
		const gainNode = audioContext.createGain();
		gainNode.connect(audioContext.destination);

		// Deux bips de 100 ms, fréquences du profil standard, enveloppe douce.
		for (let beep = 0; beep < 2; beep++) {
			const startTime = now + beep * 0.2;
			const endTime = startTime + 0.1;

			for (const freq of RINGTONE_PROFILES.standard.freqs) {
				const osc = audioContext.createOscillator();
				osc.type = "sine";
				osc.frequency.setValueAtTime(freq, startTime);
				osc.connect(gainNode);
				osc.start(startTime);
				osc.stop(endTime);
			}

			gainNode.gain.setValueAtTime(0, startTime);
			gainNode.gain.linearRampToValueAtTime(
				WAITING_BEEP_GAIN,
				startTime + 0.02,
			);
			gainNode.gain.setValueAtTime(WAITING_BEEP_GAIN, endTime - 0.02);
			gainNode.gain.linearRampToValueAtTime(0, endTime);
		}
	}, [trigger]);
}
