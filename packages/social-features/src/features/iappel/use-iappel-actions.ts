// Dupliqué de socle/packages/agent-features/src/features/iappel/use-iappel-actions.ts @ ad2e7fdc2 — adaptations : gestes du moteur (`calls.lifecycle.leave` / `declineCall`, `calls.groupCalls.decline` ; fonctions de réseau : `networkId` de `useNetwork()`, appel désigné par `callId`) ; file du centre d'appels retirée (`useCallCenter`, `hangupQueueCall`, `slot.kind === "queue"`) ; environnement back-office retiré (`callEnvironmentArgs`) ; identifiants `Id<"calls">` (noms des paramètres `meetingId` gardés) ; toasts traduits (espace de noms `iappel`, clés `useIappelActions.…`).
"use client"

/**
 * useIappelActions — les gestes d'un appel, au même endroit.
 *
 * Répondre, refuser, raccrocher, mettre en attente, reprendre, basculer.
 * Chacun tient le store ET le serveur d'accord : le store pour que l'écran
 * réagisse immédiatement, le serveur pour que l'autre bout le sache.
 *
 * Une seule famille d'appels dans le moteur : l'appel de personne à personne
 * (tête-à-tête ou groupe) → `calls.lifecycle.*`, et la ligne (attente,
 * reprise) par `useCallLineSync`. La FILE du centre d'appels du socle, qui
 * avait ses propres mutations, n'existe pas ici.
 */

import { api } from "@antia/api/engine"
import type { Id } from "@antia/api/engine"
import { useConvexMutationQuery } from "@antia/api/hooks"
import { useNetwork } from "@antia/api/network"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { callStore } from "../../stores/call-store"
import type {
	CallGroupIdentity,
	CallKind,
	CallPeerIdentity,
	CallScope,
} from "./call-types"

export interface IappelActions {
	answer: (input: {
		meetingId: Id<"calls">
		mediaType: "audio" | "video"
		peer?: CallPeerIdentity
		scope?: CallScope
		/**
		 * `group` quand on décroche un appel à plusieurs.
		 *
		 * ⚠️ Sans lui, le slot naît `direct` et la surface montre la scène 1:1 :
		 * un seul correspondant, les autres invisibles. L'appel FONCTIONNERAIT
		 * (la salle est la même) — c'est l'écran qui mentirait.
		 */
		callKind?: CallKind
		group?: CallGroupIdentity | null
	}) => void
	decline: (meetingId: Id<"calls">, note?: string) => Promise<void>
	hangUp: (meetingId: Id<"calls">) => Promise<void>
	hold: (meetingId: Id<"calls">) => Promise<void>
	resume: (meetingId: Id<"calls">) => Promise<void>
	/** Prendre un appel en attente en mettant l'actuel de côté. */
	swap: (meetingId: Id<"calls">) => Promise<void>
	minimize: () => void
	restore: () => void
}

export function useIappelActions(): IappelActions {
	const { networkId } = useNetwork()
	const { t } = useTranslation("iappel")
	const { mutateAsync: leaveCall } = useConvexMutationQuery(
		api.modules.calls.lifecycle.leave,
	)
	const { mutateAsync: declineCall } = useConvexMutationQuery(
		api.modules.calls.lifecycle.declineCall,
	)
	const { mutateAsync: declineGroupCall } = useConvexMutationQuery(
		api.modules.calls.groupCalls.decline,
	)

	const answer = useCallback<IappelActions["answer"]>((input) => {
		// Le slot naît ici ; `useCallSlotConnector` lui trouvera sa salle.
		callStore.acceptIncoming(input)
	}, [])

	const decline = useCallback<IappelActions["decline"]>(
		async (meetingId, note) => {
			// Retirer le slot AVANT le serveur : la sonnerie doit s'arrêter au
			// doigt levé, pas à la fin d'un aller-retour réseau.
			const slot = callStore.getSlots().find((s) => s.meetingId === meetingId)
			callStore.removeSlot(meetingId)
			try {
				if (slot?.callKind === "group") {
					// ⚠️ Refuser un appel de GROUPE ne le termine pas : mon refus
					// ne regarde que moi. Le serveur tient d'ailleurs la même
					// garde (`declineCall` passe par mon ticket), mais passer par
					// la bonne porte rend le geste lisible.
					await declineGroupCall({ networkId, callId: meetingId })
					return
				}
				await declineCall({
					networkId,
					callId: meetingId,
					...(note === undefined ? {} : { note }),
				})
			} catch {
				toast.error(t("useIappelActions.declineFailed"))
			}
		},
		[declineCall, declineGroupCall, networkId, t],
	)

	const hangUp = useCallback<IappelActions["hangUp"]>(
		async (meetingId) => {
			callStore.removeSlot(meetingId)
			try {
				await leaveCall({ networkId, callId: meetingId, intentional: true })
			} catch {
				toast.error(t("useIappelActions.hangUpFailed"))
			}
		},
		[leaveCall, networkId, t],
	)

	/**
	 * ⚠️ Les trois gestes de LIGNE ne parlent plus au serveur, et c'est le
	 * cœur du correctif.
	 *
	 * Ils écrivent dans le magasin, rien d'autre. `useCallLineSync` observe le
	 * magasin et met le serveur d'accord — pour les CINQ chemins qui parquent
	 * un appel, pas seulement pour ces trois-là.
	 *
	 * Ce qu'il y avait avant : un aller-retour réseau ici, et un `catch` qui
	 * « remettait l'écran d'accord » avec un refus. Comme le serveur ignorait
	 * les parquages faits ailleurs, il refusait TOUJOURS la reprise ; le
	 * `catch` reparquait alors le slot, ce qui blanchissait l'actif, ce qui
	 * faisait disparaître la surface d'appel entière. Un écran ne se
	 * réorganise pas sur une réponse réseau.
	 */
	const hold = useCallback<IappelActions["hold"]>(async (meetingId) => {
		callStore.holdSlot(meetingId)
	}, [])

	const resume = useCallback<IappelActions["resume"]>(async (meetingId) => {
		callStore.resumeSlot(meetingId)
	}, [])

	const swap = useCallback<IappelActions["swap"]>(async (meetingId) => {
		// `resumeSlot` parque déjà l'actif précédent : il n'y a rien à
		// enchaîner, et surtout rien à envoyer d'ici.
		callStore.resumeSlot(meetingId)
	}, [])

	return {
		answer,
		decline,
		hangUp,
		hold,
		resume,
		swap,
		minimize: () => callStore.setMinimized(true),
		restore: () => callStore.setMinimized(false),
	}
}
