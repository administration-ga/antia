// Dupliqué de socle/packages/agent-features/src/components/direct/DirectCallCoexistence.tsx @ ad2e7fdc2 — adaptations : références du moteur, réseau courant, dépendances LiveKit locales et libellés traduits ; structure de salle persistante conservée.
"use client"

/**
 * DirectCallCoexistence — quand un APPEL prend la ligne pendant un direct.
 *
 * Effet pur, sans rendu : il lit le magasin des appels (la ligne est-elle
 * occupée ?) et celui du direct (le micro voulu, la retenue), applique la
 * décision de `direct-call-coexistence.ts` et ne fait rien d'autre. Deux
 * salles LiveKit distinctes coexistent — celle du direct, celle de l'appel —
 * et c'est ce qui rend la chose possible : on ne bascule rien, on règle
 * seulement ce que le direct publie et ce qu'il fait entendre.
 *
 * Monté par `DirectSessionHost`, UNE fois, à côté du propriétaire de la
 * salle : le baisser de son (`RoomAudioRenderer volume`) vit dans
 * `DirectRoomMount`, qui lit la même ligne.
 */

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useCallStore } from "../../stores/call-store"
import {
	directSessionStore,
	useDirectSessionStore,
} from "../../stores/direct-session-store"
import {
	isCallBusy,
	planLiveDuringCall,
} from "../../features/direct/direct-call-coexistence"

export function DirectCallCoexistence() {
	const { t } = useTranslation("direct")
	const { slots } = useCallStore()
	const { sessionId, credentials, intent, callHold } = useDirectSessionStore()
	const busy = isCallBusy(slots)
	const micEnabled = credentials?.role === "speaker" && intent.micEnabled
	// Un seul avis par prise de ligne : l'effet peut se rejouer plusieurs fois
	// pendant le même appel (micro, magasin), l'usager n'a pas à le relire.
	const announced = useRef(false)

	useEffect(() => {
		if (sessionId === null) return
		const plan = planLiveDuringCall({ callBusy: busy, micEnabled, hold: callHold })
		if (plan.intent !== null) directSessionStore.setIntent(plan.intent)
		directSessionStore.setCallHold(plan.hold)
		if (busy && !announced.current) {
			announced.current = true
			toast.info(
				plan.intent?.micEnabled === false
					? t("coexistence.microphoneMuted")
					: t("coexistence.volumeReduced"),
			)
		}
		if (!busy) announced.current = false
	}, [busy, micEnabled, callHold, sessionId, t])

	return null
}
