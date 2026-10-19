// Dupliqué de socle/packages/agent-features/src/features/iappel/use-ring-vibration.ts @ ad2e7fdc2 — adaptations : sonneries du lot W8 (`../../lib/livekit/use-ringtone`, au lieu du paquet `livekit` du socle) ; logique inchangée.
"use client"

/**
 * useRingVibration — faire vibrer l'appareil au rythme de la sonnerie.
 *
 * Un téléphone posé sur une table, écran éteint, dans un bureau bruyant : le
 * son ne suffit pas toujours. La vibration suit la CADENCE du profil sonore
 * (`vibrationPatternFor`) pour que les deux se sentent comme un seul signal.
 *
 * ⚠️ `navigator.vibrate` n'existe PAS sur iOS — aucun navigateur de l'iPhone
 * ne l'expose. Le hook ne fait alors simplement rien : c'est un renfort, pas
 * un mécanisme dont dépend la sonnerie. L'écran ne promet donc jamais une
 * vibration là où elle est impossible (cf. l'aide des réglages).
 */

import type { RingtoneVariant } from "../../lib/livekit/use-ringtone"
import { RINGTONE_PROFILES } from "../../lib/livekit/use-ringtone"
import { useEffect } from "react"
import { vibrationPatternFor } from "./ringing-signal"

export function useRingVibration(
	active: boolean,
	variant: RingtoneVariant = "standard",
): void {
	useEffect(() => {
		if (!active) return
		if (typeof navigator === "undefined") return
		const vibrate = navigator.vibrate?.bind(navigator)
		if (!vibrate) return

		const pattern = vibrationPatternFor(variant)
		const cadence = RINGTONE_PROFILES[variant].cadenceMs
		const buzz = () => {
			// Un onglet en arrière-plan ne doit pas faire vibrer : le système
			// l'ignore le plus souvent, et quand il ne l'ignore pas, la vibration
			// survit à la fin de l'appel.
			if (document.visibilityState !== "visible") return
			vibrate(pattern)
		}
		buzz()
		const id = setInterval(buzz, cadence)
		return () => {
			clearInterval(id)
			// Couper NET : sans cela, le dernier motif se poursuit après le
			// décrochage, contre l'oreille.
			vibrate(0)
		}
	}, [active, variant])
}
