// Dupliqué de socle/packages/agent-features/src/features/iappel/presence-dot.tsx @ ad2e7fdc2 — adaptations : présence des RELATIONS du réseau seule (`calls.presence.forMyConnections` et `offlineHints`, réseau courant et instant arrondi passés par l'écran, statuts du pas précédent gardés pendant le réabonnement) ; présences d'organisation retirées (`useOrgContactsPresence`, `useOrgMembersPresence`, `useOrgPresence`) ; réponses du moteur lues dans leur forme (`statuses`, liste `offline`) ; libellés traduits (i18n `iappel`) : `PRESENCE_LABEL` (phrases) devient `PRESENCE_LABEL_KEY` (clés qualifiées) et `presenceLabel(state, t)`.
"use client"

/**
 * La pastille de présence PARTAGÉE — quatre états, un seul vocabulaire
 * (2026-09-01, modèle WhatsApp arbitré par l'utilisateur) :
 *
 *   · « En ligne »          → vert   (`--success`)
 *   · « Occupé »            → orange (`--warning`)  — en communication
 *   · « Ne pas déranger »   → orange (`--warning`)  — silence déclaré
 *   · « Hors ligne »        → rouge  (`--destructive`)
 *   · `null`                → RIEN : « on ne sait pas » n'invente pas de
 *     pastille (relation qui ne partage pas sa présence, inconnu).
 *
 * Née dans `IcomRelationsPanel` (trois états, dnd en gris) ; extraite ici pour
 * servir aussi la liste des conversations, le profil et l'en-tête de
 * conversation. Les couleurs sont des JETONS (`var(--…)`) et rien d'autre : le
 * cliquet de couleurs refuse toute classe Tailwind de palette dans ce paquet.
 *
 * DEUX sources, deux cadences, fusionnées par les hooks ci-dessous :
 *  · `forMyConnections` (réactive) — available / in_call / dnd, jamais
 *    offline : c'est elle qui prime toujours. Elle reçoit un instant ARRONDI
 *    à la minute (le moteur ne lit pas l'horloge dans une requête) : stable
 *    d'un rendu à l'autre, il ne relance la souscription qu'une fois par
 *    minute — la précision d'échéance d'un « ne pas déranger » ;
 *  · `offlineHints` (one-shot + intervalle) — le CONSTAT « hors ligne »,
 *    volontairement hors abonnement : mettre les heartbeats (30 s × chaque
 *    relation) dans un read-set réactif ré-exécuterait la query sans arrêt.
 *    La fraîcheur perçue (≤ ~75 s) est déjà celle du seuil serveur (90 s).
 */

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useNetwork } from "@antia/api/network"
import type { RelationPresenceStatus } from "@antia/social-contracts/calls"
import { useConvex } from "convex/react"
import type { TFunction } from "i18next"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export type PresenceState = "available" | "in_call" | "dnd" | "offline" | null

/** Les libellés de la pastille — des clés QUALIFIÉES, que n'importe quel `t` résout. */
export const PRESENCE_LABEL_KEY: Record<Exclude<PresenceState, null>, string> = {
	available: "iappel:presenceDot.available",
	in_call: "iappel:presenceDot.inCall",
	dnd: "iappel:presenceDot.dnd",
	offline: "iappel:presenceDot.offline",
}

/** Le libellé d'un état, dans la langue de l'écran. */
export function presenceLabel(state: Exclude<PresenceState, null>, t: TFunction): string {
	return t(PRESENCE_LABEL_KEY[state])
}

export const PRESENCE_COLOR: Record<Exclude<PresenceState, null>, string> = {
	available: "var(--success)",
	in_call: "var(--warning)",
	// Orange comme « Occupé » : les deux disent « joignable mais pas
	// maintenant » — c'est la famille de la pastille, le LIBELLÉ distingue.
	dnd: "var(--warning)",
	offline: "var(--destructive)",
}

/**
 * La pastille elle-même.
 *
 * ⚠️ Elle n'est JAMAIS seule à porter l'information : un point coloré ne dit
 * rien à qui ne distingue pas les nuances, ni à un lecteur d'écran. Le libellé
 * l'accompagne en `title` et en texte masqué.
 */
export function PresenceDot({ state }: { state: PresenceState }) {
	const { t } = useTranslation("iappel")
	if (state === null) return null
	const label = presenceLabel(state, t)
	return (
		<>
			<span
				aria-hidden="true"
				title={label}
				style={{
					display: "inline-block",
					width: 7,
					height: 7,
					marginLeft: 6,
					borderRadius: 999,
					verticalAlign: "middle",
					background: PRESENCE_COLOR[state],
				}}
			/>
			<span className="sr-only"> — {label}</span>
		</>
	)
}

/** Cadence du rafraîchissement des constats « hors ligne » (cf. en-tête). */
const OFFLINE_HINTS_INTERVAL_MS = 75_000

/** Pas de l'instant passé à la source réactive : une minute. */
const PRESENCE_NOW_STEP_MS = 60_000

/** Fréquence à laquelle on regarde si la minute a tourné (un état identique ne re-rend pas). */
const PRESENCE_NOW_CHECK_MS = 15_000

/** L'instant arrondi au pas — un nombre stable entre deux rendus. */
function roundedNow(stepMs: number): number {
	return Math.floor(Date.now() / stepMs) * stepMs
}

/**
 * La présence de MES RELATIONS du réseau, fusionnée — à monter dans toute
 * surface du réseau. Rend `presenceOf(personId)` (le paramètre garde son nom
 * historique, `userId`).
 *
 * Règle de fusion : la source réactive PRIME (un appel en cours ne se lit que
 * sur elle) ; le constat « hors ligne » ne s'applique qu'à une relation
 * qu'elle dit simplement « en ligne ».
 */
export function useConnectionsPresence(): {
	presenceOf: (userId: string | null | undefined) => PresenceState
} {
	const { networkId } = useNetwork()
	const [now, setNow] = useState(() => roundedNow(PRESENCE_NOW_STEP_MS))
	useEffect(() => {
		const id = setInterval(() => setNow(roundedNow(PRESENCE_NOW_STEP_MS)), PRESENCE_NOW_CHECK_MS)
		return () => clearInterval(id)
	}, [])

	const live = useAuthenticatedConvexQuery(api.modules.calls.presence.forMyConnections, {
		networkId,
		now,
	})
	const convex = useConvex()
	const [hints, setHints] = useState<Record<string, "offline">>({})

	useEffect(() => {
		let cancelled = false
		const tick = async () => {
			try {
				const next = await convex.query(api.modules.calls.presence.offlineHints, {
					networkId,
					// Une lecture ponctuelle : l'instant du moment, à la seconde.
					now: roundedNow(1000),
				})
				if (cancelled) return
				const offline: Record<string, "offline"> = {}
				for (const personId of next.offline) offline[personId] = "offline"
				setHints(offline)
			} catch {
				// Un constat qui manque n'est pas une panne : la pastille reste
				// simplement sur la source réactive.
			}
		}
		void tick()
		const interval = setInterval(() => void tick(), OFFLINE_HINTS_INTERVAL_MS)
		return () => {
			cancelled = true
			clearInterval(interval)
		}
	}, [convex, networkId])

	// Les statuts du pas PRÉCÉDENT, gardés pendant que l'instant suivant
	// s'abonne — la pastille ne clignote pas à chaque minute — et jamais ceux
	// d'un AUTRE réseau, si l'application change de réseau sans démonter.
	const [settled, setSettled] = useState<{
		networkId: string
		statuses: Record<string, RelationPresenceStatus>
	} | null>(null)
	useEffect(() => {
		if (live.data !== undefined) setSettled({ networkId, statuses: live.data.statuses })
	}, [live.data, networkId])
	const liveMap =
		live.data?.statuses ??
		(settled !== null && settled.networkId === networkId ? settled.statuses : undefined)

	const presenceOf = useCallback(
		(userId: string | null | undefined): PresenceState => {
			if (userId === null || userId === undefined) return null
			const value = liveMap?.[userId]
			if (value === "in_call" || value === "dnd") return value
			if (hints[userId] === "offline") return "offline"
			if (value === "available") return "available"
			return null
		},
		[liveMap, hints],
	)

	return { presenceOf }
}
