// Dupliqué de socle/packages/agent-features/src/features/iappel/use-call-slot-connector.ts @ ad2e7fdc2 — adaptations : décrochage et jeton du moteur (`calls.lifecycle.join` et `calls.livekitActions.requestToken`, fonctions de réseau : `networkId` de `useNetwork()`, appel désigné par `callId`) ; environnement back-office retiré (`callEnvironmentArgs`, `./call-environment`) ; message d'échec traduit (`callErrorMessage(error, t)`, espace de noms `iappel`).
"use client"

/**
 * useCallSlotConnector — donne à chaque appel sa salle.
 *
 * Tout slot posé dans le store arrive SANS jeton : l'écran s'ouvre
 * immédiatement (« Connexion… »), et la négociation se fait derrière. Ce hook
 * est cette négociation : pour chaque slot en attente de salle, il rejoint
 * l'appel puis demande son jeton LiveKit, et repose le résultat dans le store
 * — d'où le pool le lira.
 *
 * ⚠️ Une garde de déduplication est indispensable. Les deux appels sont
 * asynchrones, le store émet à chaque écriture, et le hook se ré-exécute à
 * chaque émission : sans mémoire des slots déjà en cours de connexion, on
 * demanderait plusieurs jetons pour le même appel — donc plusieurs salles,
 * dont une seule serait branchée.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import {
	useConvexActionQuery,
	useConvexMutationQuery,
} from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { callStore, useCallStore } from "../../stores/call-store"
import { callErrorMessage } from "./call-errors"

export function useCallSlotConnector(): void {
	const { networkId } = useNetwork()
	const { t } = useTranslation("iappel")
	const { slots } = useCallStore()
	const { mutateAsync: joinCall } = useConvexMutationQuery(
		api.modules.calls.lifecycle.join,
	)
	const { mutateAsync: requestToken } = useConvexActionQuery(
		api.modules.calls.livekitActions.requestToken,
	)
	const inFlight = useRef(new Set<string>())

	useEffect(() => {
		for (const slot of slots) {
			const key = slot.meetingId as string
			// Déjà pourvu, déjà en cours, ou déjà en échec : rien à faire. On ne
			// réessaie PAS automatiquement après un échec — l'écran d'erreur
			// propose « Réessayer », et une boucle silencieuse rejouerait la
			// même erreur toutes les secondes.
			if (slot.token && slot.wsUrl) continue
			if (slot.status === "ended") continue
			if (slot.connectError || slot.roomError) continue
			if (inFlight.current.has(key)) continue

			inFlight.current.add(key)
			const callId = slot.meetingId as Id<"calls">
			void (async () => {
				try {
					await joinCall({ networkId, callId })
					const token = await requestToken({ networkId, callId })
					// `hydrateSlot` et non `upsertSlot` : `slot.status` est lu dans
					// une closure vieille de plusieurs secondes. Le réécrire ici
					// défaisait une bascule d'appel faite pendant la négociation.
					callStore.hydrateSlot(slot.meetingId, {
						token: token.token,
						wsUrl: token.wsUrl,
						roomName: token.roomName,
						joinedAt: Date.now(),
						// Le média RETENU par le serveur, pas celui demandé : c'est
						// lui qui décide si la caméra publie au démarrage.
						mediaType: token.mediaType,
					})
				} catch (error) {
					callStore.setSlotError(slot.meetingId, {
						connectError: callErrorMessage(error, t),
					})
				} finally {
					inFlight.current.delete(key)
				}
			})()
		}
	}, [slots, joinCall, requestToken, networkId, t])
}

/**
 * Purge la mémoire de déduplication pour un appel — utile après un
 * « Réessayer », qui doit pouvoir relancer une connexion abandonnée.
 */
export function clearConnectorMemory(
	inFlight: Set<string>,
	meetingId: Id<"calls">,
): void {
	inFlight.delete(meetingId as string)
}
