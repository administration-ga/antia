// Dupliqué de socle/packages/agent-features/src/features/iappel/use-launch-conference.ts @ ad2e7fdc2 — adaptations : branche PERSONNELLE seule — conférence de poste retirée (intention de réunion iAsted `requestMeetingInvite`, carte de poste `useOpenIcom` / `useIcomPosteHosted`, organisation de l'appel `orgId`, `activeOrgId`) ; le réseau courant remplace `OrgProvider` (`useOptionalNetwork()`) ; refus traduit (`conferenceLaunchRefusalMessage(reason, t)`) ; la demande est posée dans le magasin, que l'hôte de la conférence (direct, lot `live`) consommera.
"use client"

/**
 * useLaunchConference — LE geste « Lancer une conférence » (ADR-0149, fiche
 * « Appels de groupe de 2 à 11 » §6.2-6.3).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN GESTE, UNE CONFÉRENCE : LE DIRECT DU RÉSEAU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les cartes T1, T2 et T3 disent la même phrase partout ; elles ouvrent le
 * DIRECT du réseau. Un direct a des INVITÉS nominatifs, combinables avec son
 * audience (ADR-0150) : on pose le TITRE du fil, les PERSONNES et le FIL
 * SOURCE (`requestConferenceLaunch`), et l'hôte monté une fois rend le
 * dialogue pré-rempli — « invités seulement », l'interlocuteur unique en
 * intervenant. ⚠️ Cet hôte arrive avec le lot `live` : d'ici là, la demande
 * est posée dans le magasin et attend.
 *
 * (Le socle ouvrait aussi, au POSTE, une réunion iRéunion dans la carte du
 * poste : ni l'une ni l'autre n'existe dans le moteur.)
 *
 * ⚠️ Jusqu'au 2026-09-14 ce chemin ne transmettait que le titre : les trois
 * déclencheurs nommaient les personnes, et la conférence s'ouvrait sans elles.
 * Le fil source n'est pas un confort : c'est lui qui prouve au serveur qu'un
 * membre du groupe peut être convié sans être une connexion de l'hôte
 * (ADR-0150, éligibilité B).
 *
 * ⚠️ D'abord RÉDUIRE l'appel en cours. Lancer une conférence ne convertit pas
 * l'appel (fiche §6.3) : il CONTINUE, en bande dans la carte (ADR-0148), et
 * l'écran de création a besoin du corps de la carte que la scène couvrait.
 * Raccrocher ici coûterait la conversation sans que personne ne l'ait demandé.
 *
 * ⚠️ …mais VÉRIFIER AVANT DE RÉDUIRE (`planConferenceLaunch`) : hors de tout
 * réseau, la page du direct n'existe pas. Le geste refuse alors EN LE DISANT,
 * sans réduire l'appel ni poser de demande qui rouvrirait plus tard un
 * formulaire à l'improviste.
 */

import { useOptionalNetwork } from "@antia/api/network"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { callStore } from "../../stores/call-store"
import type { CallScope } from "./call-types"
import {
	conferenceLaunchRefusalMessage,
	planConferenceLaunch,
	requestConferenceLaunch,
	type ConferenceLaunchPersonInput,
} from "./conference-launch-store"

export interface ConferenceLaunchRequest {
	/** La portée d'où part le geste (personnelle, dans le moteur). */
	scope: CallScope
	/**
	 * Les personnes à réunir : membres du fil, conviés présents de l'appel (moi
	 * exclu) — invitées du direct.
	 */
	userIds: readonly string[]
	/** Le titre proposé (nom du fil). */
	title?: string | null
	/**
	 * Le fil de groupe d'où part le geste, quand il existe. Le serveur y
	 * vérifie la co-appartenance de l'hôte et de chaque invité.
	 */
	sourceThreadId?: string | null
	/**
	 * Les noms que le déclencheur a déjà affichés (membres du fil, conviés de
	 * l'appel), pour que le dialogue nomme chaque invité proposé. Un affichage :
	 * le serveur rejuge chacun.
	 */
	people?: readonly ConferenceLaunchPersonInput[] | null
}

/** Le lancement est servi depuis F3a : DirectSessionHost consomme la demande dans la coque. */
export const CONFERENCE_LAUNCH_AVAILABLE: boolean = true

/** Une route réservée pour un lot futur n'est pas encore une route servie. */
export function useConferenceLaunchAvailable(): boolean {
	const network = useOptionalNetwork()
	return CONFERENCE_LAUNCH_AVAILABLE && network?.liveAvailable === true
}

export function useLaunchConference(): (request: ConferenceLaunchRequest) => void {
	const { t } = useTranslation("iappel")
	const network = useOptionalNetwork()
	// Hors de tout réseau, aucun espace personnel ici.
	const personalSpaceHere = network !== null && network.liveAvailable && network.personalSpaceIsElsewhere === false
	return useCallback(
		(request: ConferenceLaunchRequest) => {
			// ⚠️ Le refus AVANT la réduction : l'appel ne rétrécit pas pour rien.
			const plan = planConferenceLaunch({ scope: request.scope, personalSpaceHere })
			if (!plan.ok) {
				toast.info(conferenceLaunchRefusalMessage(plan.reason, t))
				return
			}

			// L'appel continue en bande : jamais raccroché, jamais couvert.
			if (callStore.getActiveSlotId() !== null) callStore.setMinimized(true)

			// Les personnes ET le fil voyagent : le dialogue en tire l'audience
			// « invités seulement » et les rôles de scène (arbitrage I).
			requestConferenceLaunch({
				title: request.title ?? null,
				userIds: request.userIds,
				sourceThreadId: request.sourceThreadId ?? null,
				people: request.people ?? null,
			})
		},
		[personalSpaceHere, t],
	)
}
