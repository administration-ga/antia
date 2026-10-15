// Dupliqué de socle/packages/agent-features/src/features/iappel/ringing-signal.ts @ ad2e7fdc2 — adaptations : seule la vibration reste (`vibrationPatternFor`) — le repli `ringingFromListMine` (dérivé de `meetings.listMine`, utilisé nulle part), sa portée poste par `orgId`, sa fenêtre de réunion et ses types sont retirés ; motif propre au profil « poste » retiré (un profil sans motif propre suit la cadence du sien) ; fenêtre de sonnerie lue dans le contrat du moteur (`CALL_RING_WINDOW_MS`, réexportée) ; sonneries du lot W8 (`../../lib/livekit`).
/**
 * ringing-signal — la vibration de la sonnerie.
 *
 * La vibration suit la CADENCE du son : les deux doivent se sentir comme un
 * seul signal, pas comme deux appareils qui se répondent.
 */

import { RINGTONE_PROFILES, type RingtoneVariant } from "../../lib/livekit/use-ringtone"

/** Fenêtre de sonnerie d'un appel — la MÊME que le serveur (contrat du moteur). */
export { CALL_RING_WINDOW_MS } from "@antia/social-contracts/calls"

/**
 * Motif `[vibre, pause, vibre, …]` en millisecondes, dont la durée totale
 * remplit un cycle du profil sonore.
 */
export function vibrationPatternFor(variant: RingtoneVariant): number[] {
	const cadence = RINGTONE_PROFILES[variant].cadenceMs
	if (variant === "urgent") {
		// Trois impulsions courtes : on doit le distinguer même dans une poche.
		return [200, 100, 200, 100, 200, Math.max(200, cadence - 1000)]
	}
	// Une longue, comme un téléphone — la pause finale suit la cadence du
	// profil, si bien que deux profils de cadences différentes ne vibrent pas
	// pareil.
	return [400, 200, 400, Math.max(200, cadence - 1000)]
}
