// Dupliqué de socle/packages/agent-features/src/features/iappel/use-call-line-sync.ts @ ad2e7fdc2 — adaptations : mise en attente et reprise du moteur (`calls.ringing.hold` / `resume`, fonctions de réseau : `networkId` de `useNetwork()`, appel désigné par `callId`) ; réponse du moteur traduite pour le réconciliateur — une attente différée y est TOUJOURS notée (`holdOnAnswer` posé côté serveur, que la réponse ne répète plus) ; le marqueur de refus voyage dans `error.data` (code du moteur), toujours sans lecture du message.
"use client"

/**
 * useCallLineSync — le seul endroit où « le serveur suit ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE CARDINALE : CE HOOK N'ÉCRIT JAMAIS DANS LE MAGASIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Il lit l'état voulu, envoie ce qu'il faut au serveur, et note ce qui a été
 * confirmé. Il ne réorganise rien à l'écran, quoi que réponde le réseau.
 *
 * Ce n'est pas une précaution de style. C'est le remède exact au défaut :
 * `useIappelActions.resume` faisait `callStore.holdSlot(...)` dans son `catch`,
 * `holdSlot` blanchissait `activeSlotId`, et la surface d'appel entière
 * disparaissait — pendant que les conversations LiveKit vivaient toujours dans
 * le pool. Un écran ne se réorganise pas sur une réponse réseau ; il se
 * réorganise sur un geste de l'usager.
 *
 * ── Pourquoi une seule opération à la fois ────────────────────────────────
 * L'ordre compte (tous les `hold` avant tous les `resume`, cf.
 * `call-line-sync.ts`). Les envoyer en parallèle rendrait cet ordre au hasard
 * de la latence, et ouvrirait la fenêtre pendant laquelle deux correspondants
 * entendent la même conversation.
 *
 * ── Pourquoi un plafond d'essais, et pas une lecture du message d'erreur ──
 * En production, `err.message` est caviardé : les codes ne voyagent que dans
 * `error.data`. Classer une erreur en « définitive » ou « passagère » en
 * lisant sa phrase marche en développement et échoue en production, en
 * silence. On s'en passe : trois essais, puis on abandonne cette opération.
 * `hold` et `resume` sont idempotents et ne lèvent plus que sur un état
 * vraiment terminal — un échec est donc presque toujours définitif de toute
 * façon.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useConvexMutationQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { useEffect, useRef } from "react"
import { useCallStore } from "../../stores/call-store"
import {
	forgottenLines,
	lineAckFor,
	planLineSync,
	seedConnectedLines,
	type LineSlotView,
	type LineWant,
} from "./call-line-sync"

/** Au-delà, on cesse de rejouer cette opération-là. */
const MAX_ESSAIS = 3

export function useCallLineSync(): void {
	const { networkId } = useNetwork()
	const { slots, activeSlotId } = useCallStore()
	const { mutateAsync: holdCall } = useConvexMutationQuery(
		api.modules.calls.ringing.hold,
	)
	const { mutateAsync: resumeCall } = useConvexMutationQuery(
		api.modules.calls.ringing.resume,
	)

	/** Ce que le serveur a confirmé, par appel. */
	const acquitte = useRef(new Map<string, LineWant>())
	/** Essais consommés, par (appel, état voulu). */
	const essais = useRef(new Map<string, number>())
	/** Une opération à la fois. */
	const enCours = useRef(false)

	useEffect(() => {
		const vues: LineSlotView[] = slots.map((slot) => ({
			meetingId: slot.meetingId as string,
			status: slot.status,
			// Un appel de GROUPE n'a pas de ligne à piloter : le serveur refuse
			// `hold` sur lui, et le pousser dans le plan coûterait trois essais
			// perdus par appel à plusieurs.
			callKind: slot.callKind,
			hasToken: Boolean(slot.token && slot.wsUrl),
		}))

		// Un appel disparu du magasin ne doit pas laisser son accusé derrière
		// lui : un rappel immédiat sur le même identifiant en hériterait, et son
		// opération ne partirait jamais.
		for (const oublie of forgottenLines(vues, acquitte.current)) {
			acquitte.current.delete(oublie)
			essais.current.delete(`${oublie}:on_hold`)
			essais.current.delete(`${oublie}:connected`)
		}
		// Une ligne NAÎT connectée : son accusé initial se sème sans rien
		// envoyer, sinon chaque appel sortant demandait « reprendre » à un appel
		// qui sonne encore, et le serveur refusait trois fois (2026-09-13).
		for (const naissant of seedConnectedLines(vues, acquitte.current)) {
			acquitte.current.set(naissant, "connected")
		}

		if (enCours.current) return
		let annule = false

		const vider = async (): Promise<void> => {
			enCours.current = true
			try {
				// On recalcule le plan à CHAQUE tour : le magasin a pu bouger
				// pendant l'aller-retour, et rejouer un plan périmé enverrait des
				// ordres que l'usager vient d'annuler.
				for (;;) {
					if (annule) return
					const plan = planLineSync({
						slots: vues,
						activeSlotId: activeSlotId as string | null,
						acknowledged: acquitte.current,
					})
					const op = plan[0]
					if (!op) return

					const vouloir: LineWant = op.op === "hold" ? "on_hold" : "connected"
					const cle = `${op.meetingId}:${vouloir}`
					if ((essais.current.get(cle) ?? 0) >= MAX_ESSAIS) {
						// Abandon : on note l'état comme acquitté pour ne plus le
						// reproposer. L'écran, lui, n'a pas bougé d'un pixel.
						acquitte.current.set(op.meetingId, vouloir)
						continue
					}

					try {
						const callId = op.meetingId as Id<"calls">
						// ⚠️ Le RETOUR de la mutation décide, pas le simple fait
						// qu'elle n'ait pas levé. Un `hold` différé sans promesse
						// (`deferred` sans `holdOnAnswer`) n'a rien retenu côté
						// serveur : l'acquitter le rendait définitif et la base
						// restait `ringing` — « mettre en attente » n'atteignait
						// jamais le serveur.
						const resultat: { noop?: boolean; deferred?: boolean; holdOnAnswer?: boolean } =
							op.op === "hold"
								? await holdCall({ networkId, callId }).then((reponse) => ({
										noop: reponse.noop,
										deferred: reponse.deferred,
										// Le moteur NOTE toute attente différée (`holdOnAnswer`
										// posé sur l'appel, honoré au décrochage) sans le
										// répéter dans sa réponse : un différé y est donc
										// toujours un différé AVEC promesse.
										holdOnAnswer: reponse.deferred === true,
									}))
								: await resumeCall({ networkId, callId })
						const ack = lineAckFor(op.op, resultat)
						if (ack === null) {
							// À rejouer : on consomme un essai et on rend la main.
							// La prochaine émission du magasin reproposera — et il
							// y en aura une, le décrochage en produit.
							essais.current.set(cle, (essais.current.get(cle) ?? 0) + 1)
							return
						}
						acquitte.current.set(op.meetingId, ack)
						essais.current.delete(cle)
					} catch {
						essais.current.set(cle, (essais.current.get(cle) ?? 0) + 1)
						// On s'arrête là pour ce tour. La prochaine émission du
						// magasin rejouera — et il y en aura une, tout geste
						// d'appel en produit. Aucun message d'erreur n'est montré :
						// l'usager n'a rien demandé, c'est de la plomberie.
						return
					}
				}
			} finally {
				enCours.current = false
			}
		}

		void vider()
		return () => {
			annule = true
		}
	}, [slots, activeSlotId, holdCall, resumeCall, networkId])
}
