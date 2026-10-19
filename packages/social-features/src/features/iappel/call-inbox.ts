// Dupliqué de socle/packages/agent-features/src/features/iappel/call-inbox.ts @ ad2e7fdc2 — adaptations : branche poste élaguée (« le poste avant le personnel », sonnerie « poste ») et priorité d'appel retirée (ADR-0217, absente du moteur) — l'ordre est l'ancienneté seule, la sonnerie est le profil standard ; fenêtre de sonnerie lue dans le contrat du moteur (`CALL_RING_WINDOW_MS`) ; sonneries du lot W8 (`../../lib/livekit`).
/**
 * call-inbox — QUE FAIRE quand plusieurs appels arrivent en même temps.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE MODULE DÉCIDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'écran d'appel entrant prenait le PREMIER appel trouvé (`.find`) et
 * supprimait purement l'alerte dès qu'un appel était en cours. Conséquence
 * vécue : un second appelant était invisible — il sonnait dans le vide sans
 * que personne ne le sache.
 *
 * Une règle d'ordre : **le plus ancien avant le plus récent** — celui qui
 * attend depuis le plus longtemps est le plus près d'être manqué. (Le socle
 * faisait passer avant lui l'appel de POSTE puis l'appel urgent : ni l'un ni
 * l'autre n'existe dans le moteur, où tout appel est de personne à personne.)
 *
 * Le perdant n'est pas jeté : il devient `secondary`, reste affiché en
 * compact, et continue de sonner côté serveur jusqu'à son délai (2 min).
 *
 * UNE SEULE sonnerie, toujours — celle de l'appel principal. Deux sonneries
 * simultanées ne se distinguent pas ; elles s'additionnent en bruit.
 *
 * Aucun import React : module pur, testable en environnement `node`.
 */

import { CALL_RING_WINDOW_MS } from "@antsia/social-contracts/calls"

import type { RingtoneVariant } from "../../lib/livekit/use-ringtone"
import type { CallScope, RingingCall } from "./call-types"

/** Un slot d'appel, vu d'ici : on ne lit que ce qui décide. */
export interface InboxSlotView {
	meetingId: string
	status: "incoming" | "connecting" | "active" | "held" | "ended"
}

export interface IncomingPlanInput {
	/** Ce qui sonne, tel que le serveur le décrit. */
	ringing: readonly RingingCall[]
	/** Les appels que je tiens déjà — un appel décroché ne sonne plus. */
	slots: readonly InboxSlotView[]
	now: number
	/** Préférence locale « couper la sonnerie » (elle n'éteint pas l'écran). */
	ringtoneMuted: boolean
	/** Ne pas déranger actif — le serveur filtre déjà, ceinture et bretelles. */
	dnd?: boolean
	/** La vibration n'a de sens qu'au téléphone. */
	isMobile?: boolean
	/**
	 * Préférence « Vibrer » (serveur, `callPreferences.ringtone.vibrate`).
	 * Absente = vrai — même défaut que `calls.preferences.getMine`. Elle
	 * RESTREINT seulement : mobile ET sonnerie pleine restent requis.
	 */
	vibrateEnabled?: boolean
	/** Appels déjà traités localement, le temps que le serveur rattrape. */
	dismissed?: ReadonlySet<string>
	/** Fenêtre de sonnerie — au-delà, l'appel est manqué (défaut : celle du moteur, 2 min). */
	ringWindowMs?: number
}

/**
 * Ce qu'il faut jouer, et comment.
 *
 * `mode` distingue deux situations que le même son desservirait :
 *  · `ring`    — je suis libre : la sonnerie, franche ;
 *  · `waiting` — je suis DÉJÀ en communication : un signal discret, qui
 *    s'entend sans couvrir la voix de celui à qui je parle.
 */
export interface AudibleSignal {
	meetingId: string
	profile: RingtoneVariant
	mode: "ring" | "waiting"
}

export interface IncomingPlan {
	/** L'appel mis en avant — grande carte, sonnerie. */
	primary: RingingCall | null
	/** Les autres, en compact, dans l'ordre. */
	secondary: RingingCall[]
	/** Ce qui doit sonner, ou `null` pour le silence. */
	audible: AudibleSignal | null
	/** Suis-je déjà en communication ? (change la présentation ET le son) */
	callWaiting: boolean
	/** Faire vibrer l'appareil. */
	vibrate: boolean
}

/**
 * Le profil de sonnerie que mérite un appel. Dans le moteur, un seul : le
 * profil standard (aucun appel de poste, aucune priorité). La fonction reste
 * le point unique où ce choix se fait.
 */
export function ringtoneVariantFor(call: { scope: CallScope }): RingtoneVariant {
	void call
	return "standard"
}

/** L'ordre de présentation — extrait pour être lisible et testable seul. */
export function compareIncoming(a: RingingCall, b: RingingCall): number {
	return a.ringingSince - b.ringingSince
}

/** Un slot qui occupe la ligne — décroché, en cours d'établissement, ou tenu. */
function isLiveSlot(slot: InboxSlotView): boolean {
	return (
		slot.status === "connecting" ||
		slot.status === "active" ||
		slot.status === "held"
	)
}

export function planIncomingCalls(input: IncomingPlanInput): IncomingPlan {
	const window = input.ringWindowMs ?? CALL_RING_WINDOW_MS
	const held = new Set(input.slots.map((s) => s.meetingId))
	const dismissed = input.dismissed ?? new Set<string>()

	const candidates = input.ringing
		.filter((call) => {
			// Déjà décroché (ou déjà refusé localement) : plus rien à annoncer.
			if (held.has(call.meetingId as string)) return false
			if (dismissed.has(call.meetingId as string)) return false
			// Hors fenêtre : le serveur va le passer « manqué ». Continuer à le
			// montrer ferait décrocher dans le vide.
			if (input.now - call.ringingSince > window) return false
			return true
		})
		.slice()
		.sort(compareIncoming)

	const primary = candidates[0] ?? null
	const secondary = candidates.slice(1)
	const busy = input.slots.some(isLiveSlot)

	const silent = input.ringtoneMuted === true || input.dnd === true
	const audible: AudibleSignal | null =
		primary === null || silent
			? null
			: {
					meetingId: primary.meetingId as string,
					profile: ringtoneVariantFor(primary),
					mode: busy ? "waiting" : "ring",
				}

	return {
		primary,
		secondary,
		audible,
		callWaiting: primary !== null && busy,
		// On ne vibre QUE pour une vraie sonnerie : vibrer pendant qu'on parle
		// se sent dans la main qui tient le téléphone contre l'oreille — et
		// jamais contre la préférence « Vibrer » de la personne (S3).
		vibrate:
			audible !== null &&
			audible.mode === "ring" &&
			input.isMobile === true &&
			input.vibrateEnabled !== false,
	}
}
