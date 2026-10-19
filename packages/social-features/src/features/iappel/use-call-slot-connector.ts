// Dupliqué de socle/packages/agent-features/src/features/iappel/use-call-slot-connector.ts @ ad2e7fdc2 — adaptations : décrochage et jeton du moteur (`calls.lifecycle.join` et `calls.livekitActions.requestToken`, fonctions de réseau : `networkId` de `useNetwork()`, appel désigné par `callId`) ; environnement back-office retiré (`callEnvironmentArgs`, `./call-environment`) ; message d'échec traduit (`callErrorMessage(error, t)`, espace de noms `iappel`) ; P05 (18/10/2026) : JETON TARDIF — l'appel est relu dans le magasin après le décrochage et après le jeton : raccroché, terminé ou purgé entre-temps, aucun jeton n'est demandé ni posé, aucune erreur n'est consignée.
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

import { callStore, useCallStore, type CallSlot } from "../../stores/call-store"
import { callErrorMessage } from "./call-errors"

export function useCallSlotConnector(): void {
	const { networkId, personId } = useNetwork()
	const { t } = useTranslation("iappel")
	const { slots } = useCallStore()
	const { mutateAsync: joinCall } = useConvexMutationQuery(
		api.modules.calls.lifecycle.join,
	)
	const { mutateAsync: requestToken } = useConvexActionQuery(
		api.modules.calls.livekitActions.requestToken,
	)
	const inFlight = useRef(new Map<string, { slot: CallSlot }>())

	// Une réponse de l'ancienne couche/session ne s'applique jamais au montage
	// suivant, même si le magasin contient de nouveau le même appel de groupe.
	useEffect(() => {
		const pending = inFlight.current
		return () => pending.clear()
	}, [networkId, personId])

	useEffect(() => {
		for (const [key, attempt] of inFlight.current) {
			if (!slotStillWaitsForRoom(attempt.slot.meetingId, attempt.slot)) inFlight.current.delete(key)
		}
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

			const attempt = { slot }
			inFlight.current.set(key, attempt)
			const callId = slot.meetingId as Id<"calls">
			const stillWaiting = () => inFlight.current.get(key) === attempt && slotStillWaitsForRoom(callId, slot)
			void (async () => {
				try {
					await joinCall({ networkId, callId })
					// P05 — raccroché ou terminé PENDANT le décrochage : pas de jeton
					// pour un appel que plus personne n'attend.
					if (!stillWaiting()) return
					const token = await requestToken({ networkId, callId })
					// Un jeton TARDIF n'ouvre aucune salle : l'appel a fini, ou la
					// couche d'appel a été vidée (déconnexion) pendant l'aller-retour.
					if (!stillWaiting()) return
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
					// Un échec qui revient après la fin n'a plus d'écran à qui parler.
					if (!stillWaiting()) return
					callStore.setSlotError(slot.meetingId, {
						connectError: callErrorMessage(error, t),
					})
				} finally {
					if (inFlight.current.get(key) === attempt) inFlight.current.delete(key)
				}
			})()
		}
	}, [slots, joinCall, requestToken, networkId, personId, t])
}

/**
 * L'appel attend-il ENCORE sa salle ? Relu dans le magasin à l'instant — jamais
 * dans la photographie du rendu, vieille de plusieurs secondes quand la réponse
 * revient. Un slot retiré (raccroché, couche purgée) ou terminé n'attend plus.
 */
export function slotStillWaitsForRoom(meetingId: Id<"calls">, attempt?: CallSlot): boolean {
	const slot = callStore.getSlots().find((candidate) => candidate.meetingId === meetingId)
	return slot !== undefined && slot.status !== "ended" && !(slot.token && slot.wsUrl)
		&& (attempt === undefined || (
			slot.direction === attempt.direction
			&& slot.answeredAt === attempt.answeredAt
			&& slot.ringingSince === attempt.ringingSince
		))
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
