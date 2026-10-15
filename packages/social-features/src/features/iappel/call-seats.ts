// Dupliqué de socle/packages/agent-features/src/features/iappel/call-seats.ts @ ad2e7fdc2 — adaptations : règle des places importée du contrat du moteur (`reservesSeat` de `@antia/social-contracts/callGroup`) ; phrase de l'en-tête traduite par i18n avec ses pluriels (`t` ajouté en dernier paramètre de `describeCallSeats`, clés `iappel:callSeats.…`).
/**
 * call-seats — LES PLACES D'UN APPEL, EN UNE SEULE PROJECTION (IC-03 / IC-04,
 * Lot 01 du plan espace agent, 2026-09-06).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deux compteurs indépendants étaient ADDITIONNÉS : l'hôte comptait les
 * conviés « non partis » du serveur, le panneau soustrayait encore son Set
 * optimiste — jamais acquitté quand le serveur intégrait l'ajout. Trois
 * personnes, D puis E ajoutés et synchronisés : l'hôte disait 7−5 = 2, le
 * panneau 2−2 = 0, « Plafond atteint » sur un appel qui avait deux places.
 * Et « non parti » valait « occupe une place » : un refus, un manqué, un
 * « ne pas déranger » bloquaient la capacité et n'étaient plus réinvitables.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE — la MÊME que le serveur
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · réservent : `host`, `connected`, `ringing` (`reservesSeat`, contrat
 *    `@antia/social-contracts/callGroup` — importé, jamais recopié) ;
 *  · un optimisme local ne compte que tant que le serveur ne dit pas AUTRE
 *    CHOSE que ce qu'il disait au moment du clic — absent ⇒ présent, ou
 *    « declined » ⇒ « ringing » pour une réinvitation. Quel que soit l'état
 *    nouveau (« ringing » ⇒ réservée par le serveur, « declined » ⇒ libre),
 *    c'est l'ACQUITTEMENT ; le panneau retire de son optimisme ce qui est
 *    acquitté. ⚠️ Acquitter « dès que le serveur porte la personne » ne
 *    suffit pas : un refusé qu'on réinvite est DÉJÀ porté, en « declined »,
 *    par une projection qui n'a pas encore vu la réinvitation ;
 *  · union par identité : une personne, une place, jamais deux ;
 *  · sans projection (tête-à-tête non promu), on présume `fallbackOccupied`
 *    places prises — deux, l'appelant et son correspondant.
 *
 * Module PUR : aucun React, testé en `node`.
 */

import { reservesSeat } from "@antia/social-contracts/callGroup"
import type { TFunction } from "i18next"

import type { CallParticipantState, CallParticipantView } from "./call-types"

/** Ce que la projection lit d'un participant — l'identité et l'état. */
export type SeatParticipant = Pick<CallParticipantView, "state"> & { userId: unknown }

/**
 * L'optimisme du panneau : les personnes ajoutées PENDANT cette ouverture et
 * pas encore acquittées. En Map, la valeur est l'état que le serveur leur
 * donnait AU MOMENT DU CLIC (`null` : absente) — c'est ce qui permet de
 * distinguer une projection périmée d'un acquittement. Un Set vaut « absente
 * au clic » pour chacune.
 */
export type OptimisticSeats =
	| ReadonlySet<string>
	| ReadonlyMap<string, CallParticipantState | null>

export interface CallSeatsInput {
	/** La projection serveur des conviés — `undefined` tant qu'il n'y en a pas. */
	participants?: readonly SeatParticipant[]
	/** Les personnes ajoutées PENDANT cette ouverture du panneau, non acquittées. */
	optimistic: OptimisticSeats
	/** Le plafond lu du serveur pour cet appel, appelant compris. */
	max: number
	/** Places présumées occupées SANS projection (2 : un tête-à-tête). */
	fallbackOccupied?: number
}

export interface CallSeatCounts {
	/** En ligne, hôte compris. */
	connected: number
	/** Téléphones qui sonnent encore (serveur). */
	ringing: number
	/** Refus, indisponibles, manqués, partis. */
	unreachable: number
}

export interface CallSeatsProjection {
	/** Une projection serveur a-t-elle été fournie ? */
	hasProjection: boolean
	max: number
	/** Les identités qui OCCUPENT une place — serveur ∪ optimismes non acquittés. */
	reservedIds: ReadonlySet<string>
	reserved: number
	remaining: number
	/** Optimismes que le serveur ne porte pas encore. */
	pendingOptimistic: string[]
	/** Optimismes désormais portés par le serveur — à retirer du Set local. */
	acknowledged: string[]
	counts: CallSeatCounts
}

const EMPTY_COUNTS: CallSeatCounts = { connected: 0, ringing: 0, unreachable: 0 }

function countState(counts: CallSeatCounts, state: CallParticipantState): void {
	if (state === "host" || state === "connected") counts.connected += 1
	else if (state === "ringing") counts.ringing += 1
	else counts.unreachable += 1
}

/** Le résumé de l'en-tête (« 3 en ligne · 2 sonnent ») — même projection. */
export function summarizeCallParticipants(
	participants: readonly SeatParticipant[],
): CallSeatCounts {
	const counts: CallSeatCounts = { ...EMPTY_COUNTS }
	const seen = new Set<string>()
	for (const participant of participants) {
		const id = String(participant.userId)
		if (seen.has(id)) continue
		seen.add(id)
		countState(counts, participant.state)
	}
	return counts
}

/** Les optimismes, sous une seule forme : `[id, état connu au clic]`. */
function optimisticEntries(
	optimistic: OptimisticSeats,
): Array<[string, CallParticipantState | null]> {
	if (optimistic instanceof Map) return [...optimistic.entries()]
	return [...(optimistic as ReadonlySet<string>)].map((id) => [id, null])
}

export function projectCallSeats(input: CallSeatsInput): CallSeatsProjection {
	const max = Number.isFinite(input.max) ? Math.max(0, Math.floor(input.max)) : 0
	const reservedIds = new Set<string>()
	const acknowledged: string[] = []
	const pendingOptimistic: string[] = []
	const optimistic = optimisticEntries(input.optimistic)

	if (input.participants === undefined) {
		for (const [id] of optimistic) pendingOptimistic.push(id)
		const reserved = (input.fallbackOccupied ?? 2) + pendingOptimistic.length
		return {
			hasProjection: false,
			max,
			reservedIds: new Set(pendingOptimistic),
			reserved,
			remaining: Math.max(0, max - reserved),
			pendingOptimistic,
			acknowledged,
			counts: { ...EMPTY_COUNTS },
		}
	}

	const known = new Map<string, CallParticipantState>()
	const counts: CallSeatCounts = { ...EMPTY_COUNTS }
	for (const participant of input.participants) {
		const id = String(participant.userId)
		if (known.has(id)) continue
		known.set(id, participant.state)
		countState(counts, participant.state)
		if (reservesSeat(participant.state)) reservedIds.add(id)
	}
	for (const [id, priorState] of optimistic) {
		const current = known.get(id)
		// Acquitté dès que le serveur dit autre chose qu'au moment du clic :
		// une personne absente qui apparaît, un refusé qui repasse « sonne ».
		// Tant qu'il répète l'état d'avant, la projection est périmée et
		// l'optimisme tient la place.
		if (current !== undefined && current !== priorState) {
			acknowledged.push(id)
			continue
		}
		pendingOptimistic.push(id)
		reservedIds.add(id)
	}

	return {
		hasProjection: true,
		max,
		reservedIds,
		reserved: reservedIds.size,
		remaining: Math.max(0, max - reservedIds.size),
		pendingOptimistic,
		acknowledged,
		counts,
	}
}

/**
 * « 4 personnes · 2 invitations en attente · 1 place disponible » — le
 * contrat d'expérience du plan, expliqué par les mêmes chiffres que ceux que
 * le serveur compare. Sans projection, la phrase ne prétend pas savoir qui
 * est en ligne. Chaque morceau est une clé à pluriel (`count`).
 */
export function describeCallSeats(seats: CallSeatsProjection, t: TFunction): string {
	const parts: string[] = []
	if (seats.hasProjection) {
		parts.push(t("iappel:callSeats.people", { count: seats.counts.connected }))
	}
	const pending = seats.counts.ringing + seats.pendingOptimistic.length
	if (pending > 0) {
		parts.push(t("iappel:callSeats.pendingInvites", { count: pending }))
	}
	if (seats.remaining > 0) {
		parts.push(t("iappel:callSeats.seatsLeft", { count: seats.remaining }))
	} else {
		parts.push(t("iappel:callSeats.full", { max: seats.max }))
	}
	return parts.join(" · ")
}
