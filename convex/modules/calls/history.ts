// Dupliqué de socle/convex/functions/meetings.ts (l. 2441-2645, `listCallHistory`) @ ad2e7fdc2 — adaptations : journal par RÉSEAU, trois sources indexées (ce que j'ai lancé, ce qui m'était adressé, les appels de groupe où l'on m'a convié) fusionnées puis bornées à cinquante avec signal de lacune (D19) ; appels de FILE d'organisation, portée, poste, routage du secrétariat et environnement retirés ; `.collect()` des rattachements retiré (D11) ; DTO allowlisté au lieu du document entier et d'une table de noms d'état civil (personnes nommées par le contrat `counterpartLabel`, D21) ; un appel de groupe se classe d'après MON ticket (manqué, refusé, écarté par mes réglages) au lieu du seul état de l'appel, qui disait « entrant » à l'invité qui ne l'avait jamais entendu sonner.
/**
 * Appels — le JOURNAL de celui qui lit.
 *
 * « Entrant » ou « sortant » se décide sur un seul critère : qui a composé le
 * numéro. Un refus AUTOMATIQUE se lit « écarté par vos réglages », jamais
 * « refusé » : personne n'a vu l'appel. Une durée n'existe qu'à partir du
 * DÉCROCHAGE — la compter depuis le début ajouterait la sonnerie d'un appel que
 * personne n'a pris.
 */
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { type CallAdmissionReason, type CallCategory, categorizeCall } from "@antsia/social-domain/callJournal"

import type { Doc, Id } from "../../_generated/dataModel"
import { networkQuery } from "../../lib/functions"
import { counterpartOf } from "../messaging/participation"
import { miniProfileCache } from "../people/miniProfile"
import { isLiveMemberOfThreadCall } from "./access"

/** Lignes lues par source — trois sources de cent couvrent les cinquante appels les plus récents. */
const SOURCE_SCAN = 100
/** Ce qui m'est adressé et qui vit encore : quelques appels au plus. */
const ACTIVE_SCAN = 20
/** Ce que le journal rend. */
const JOURNAL_MAX = 50

export type CallHistoryItemDto = {
  callId: Id<"calls">
  kind: "direct" | "group"
  category: CallCategory
  /** Raison d'un refus AUTOMATIQUE — `null` pour tous les autres. */
  reason: CallAdmissionReason | null
  mediaType: "audio" | "video"
  startedAt: number
  /** Du décrochage à la fin ; `null` pour un appel jamais décroché ou encore en cours. */
  durationMs: number | null
  /** Le mot laissé par l'appelé en refusant. */
  declineNote: string | null
  /** L'AUTRE bout du fil d'un tête-à-tête — celui dont on veut voir le nom (et qu'on rappelle). */
  counterpart: { personId: Id<"persons">; label: CounterpartLabel } | null
  /** Un appel de groupe : qui l'a lancé, et le fil d'où il part quand j'en suis membre vivant. */
  group: { caller: { personId: Id<"persons">; label: CounterpartLabel }; threadId: Id<"groupThreads"> | null } | null
  createdByMe: boolean
}

/** Le classement d'un appel où l'on m'a CONVIÉ, d'après mon ticket. */
function ticketCategory(ticket: Doc<"callInvites">): { category: CallCategory; reason: CallAdmissionReason | null } {
  if (ticket.status === "missed") return { category: "missed", reason: null }
  if (ticket.status === "declined") return ticket.reason !== undefined ? { category: "auto_declined", reason: ticket.reason } : { category: "declined", reason: null }
  return { category: "incoming", reason: null }
}

export const listCallHistory = networkQuery({
  args: {},
  handler: async (ctx): Promise<{ calls: CallHistoryItemDto[]; truncated: boolean }> => {
    const me = ctx.person._id
    const [created, receivedEnded, receivedActive, tickets] = await Promise.all([
      ctx.db
        .query("calls")
        .withIndex("by_network_creator", (q) => q.eq("networkId", ctx.networkId).eq("createdByPersonId", me))
        .order("desc")
        .take(SOURCE_SCAN),
      ctx.db
        .query("calls")
        .withIndex("by_network_callee_status", (q) => q.eq("networkId", ctx.networkId).eq("calleePersonId", me).eq("status", "ended"))
        .order("desc")
        .take(SOURCE_SCAN),
      ctx.db
        .query("calls")
        .withIndex("by_network_callee_status", (q) => q.eq("networkId", ctx.networkId).eq("calleePersonId", me).eq("status", "active"))
        .order("desc")
        .take(ACTIVE_SCAN),
      ctx.db
        .query("callInvites")
        .withIndex("by_network_person_invitedAt", (q) => q.eq("networkId", ctx.networkId).eq("personId", me))
        .order("desc")
        .take(SOURCE_SCAN),
    ])

    const merged = new Map<string, Doc<"calls">>()
    for (const call of [...created, ...receivedEnded, ...receivedActive]) merged.set(call._id, call)
    const ticketOf = new Map<string, Doc<"callInvites">>()
    for (const ticket of tickets) {
      ticketOf.set(ticket.callId, ticket)
      if (merged.has(ticket.callId)) continue
      const call = await ctx.db.get(ticket.callId)
      if (call) merged.set(call._id, call)
    }
    const ordered = [...merged.values()].sort((a, b) => b.startedAt - a.startedAt || b._creationTime - a._creationTime)

    const profileOf = miniProfileCache(ctx)
    const labelOf = async (personId: Id<"persons">) => ({ personId, label: await counterpartOf(ctx, personId, profileOf) })
    const calls: CallHistoryItemDto[] = []
    for (const call of ordered.slice(0, JOURNAL_MAX)) {
      const createdByMe = call.createdByPersonId === me
      const ticket = ticketOf.get(call._id)
      // Convié par un ticket (appel de groupe, ou ajout écarté sur un tête-à-tête) : c'est MON ticket qui dit ce qui m'est arrivé.
      const { category, reason } =
        !createdByMe && ticket !== undefined ? ticketCategory(ticket) : categorizeCall({ createdBy: call.createdByPersonId, callStatus: call.callStatus, endReason: call.endReason ?? null }, me)
      const otherId = call.kind === "direct" ? (createdByMe ? (call.calleePersonId ?? null) : call.createdByPersonId) : null
      const threadMember = call.kind === "group" ? await isLiveMemberOfThreadCall(ctx, call, me) : null
      calls.push({
        callId: call._id,
        kind: call.kind,
        category,
        reason,
        mediaType: call.mediaType,
        startedAt: call.startedAt,
        durationMs: call.answeredAt !== undefined && call.endedAt !== undefined ? call.endedAt - call.answeredAt : null,
        declineNote: call.declineNote ?? null,
        counterpart: otherId === null ? null : await labelOf(otherId),
        group: call.kind === "group" ? { caller: await labelOf(call.createdByPersonId), threadId: threadMember === true ? (call.groupThreadId ?? null) : null } : null,
        createdByMe,
      })
    }
    return { calls, truncated: ordered.length > JOURNAL_MAX }
  },
})
