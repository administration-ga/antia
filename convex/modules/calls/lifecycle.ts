// Dupliqué de socle/convex/functions/meetings.ts (l. 829-1230 et 2293-2439 : `join`, `leave`, `setCallRinging`, `declineCall`) @ ad2e7fdc2 — adaptations : appels SEULEMENT (réunions, file d'organisation et sa tâche `meetings.join`, politique d'entrée `joinPolicy`, iRéunion, enregistrement, priorité, appels manqués de file et environnement back-office retirés) ; la garde commune (`requireCallParticipant`) : appel du réseau, ligne de participation, fil d'origine relu — on n'entre plus dans un appel dont on n'a pas de ligne ; présence écrite sur la ligne de participation (D27) au lieu du tableau `participants` réécrit ; plafond d'un appel de groupe lu sur la projection des états (IC-04) et sur le plafond photographié borné ; toute fin par `finishCall` ; raccrocher est sans réponse observable pour un appel inconnu (le socle répondait « introuvable » pour l'un, rien pour l'autre) ; refuser un appel de groupe passe par son ticket QUEL QUE SOIT l'état de l'appel ; refus à code ; débit.
/**
 * Appels — le CYCLE DE VIE : faire sonner, décrocher, raccrocher, refuser.
 *
 * Trois règles du tête-à-tête cessent d'être vraies à plusieurs (`callGroup`) :
 * un refus ne termine pas un appel de groupe, un départ non plus, et chaque
 * invité décroche quand il veut.
 */
import { MAX_DECLINE_NOTE_LENGTH } from "@antia/social-contracts/calls"
import { countReservedSeats } from "@antia/social-contracts/callGroup"
import { isLiveCallStatus, isRingingCallStatus, isTerminalCallStatus } from "@antia/social-domain/callJournal"
import { v } from "convex/values"

import type { Doc } from "../../_generated/dataModel"
import { failRule, notFound } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { loadGroupParticipants, participationOf, requireCallParticipant } from "./access"
import { photographedGroupCallCapacity } from "./capacity"
import { scheduleIncomingCallPush } from "./push"
import { declineGroupInvite, endGroupCallIfDeserted, finishCall, markGroupInviteJoined } from "./state"
import { callMediaTypeValidator, callStatusValidator } from "./validators"

/**
 * Un départ dans les cinq secondes qui suivent la création ne termine pas un
 * tête-à-tête — sauf geste explicite (`intentional`) : un double montage d'écran
 * ou une navigation rapide raccrochaient sinon l'appel qu'ils venaient d'ouvrir.
 */
const LEAVE_FRESH_PROTECTION_MS = 5_000

/**
 * L'appelant a rejoint sa salle : le téléphone de l'appelé se met à sonner
 * (`initiating → ringing`), une seule fois par appel. Réservé à l'appelant.
 */
export const setCallRinging = networkMutation({
  args: { callId: v.id("calls") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "call.respond", me)
    const { call } = await requireCallParticipant(ctx, ctx.networkId, args.callId, me)
    if (call.createdByPersonId !== me) return notFound()
    if (call.status !== "active" || call.callStatus !== "initiating") return null
    await ctx.db.patch(call._id, { callStatus: "ringing" })
    if (call.calleePersonId !== undefined) await scheduleIncomingCallPush(ctx, { networkId: ctx.networkId, calleePersonId: call.calleePersonId, callId: call._id })
    return null
  },
})

/**
 * DÉCROCHER, ou rejoindre — l'appelant entre dans sa propre salle, l'appelé
 * décroche, un invité de groupe entre quand il veut (y compris après un refus,
 * si une place s'est libérée). L'appel ne passe « en communication » que quand
 * un autre que l'appelant entre ; une attente demandée pendant la sonnerie fait
 * atterrir l'appel parqué.
 */
export const join = networkMutation({
  args: { callId: v.id("calls") },
  returns: v.object({ roomName: v.string(), mediaType: callMediaTypeValidator, callStatus: callStatusValidator }),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "call.respond", me)
    const { call, participation } = await requireCallParticipant(ctx, ctx.networkId, args.callId, me)
    if (call.status !== "active" || isTerminalCallStatus(call.callStatus)) return failRule("CALL_ENDED")

    if (call.kind === "group") {
      // La capacité se lit sur la PROJECTION des états (IC-04) : un refus, un manqué
      // ou un départ ont rendu leur place. L'arrivant est exclu du compte — s'il
      // sonne, sa place est déjà la sienne ; s'il avait refusé, elle a pu être donnée.
      const others = (await loadGroupParticipants(ctx, call)).filter((participant) => participant.personId !== me)
      const capacity = photographedGroupCallCapacity(call.maxParticipants)
      if (countReservedSeats(others) + 1 > capacity) return failRule("GROUP_CALL_FULL", { max: capacity })
    }

    const now = Date.now()
    await ctx.db.patch(participation._id, { joinedAt: now, leftAt: undefined })

    let callStatus: Doc<"calls">["callStatus"] = call.callStatus
    if (call.createdByPersonId !== me && isRingingCallStatus(call.callStatus)) {
      const patch: Partial<Doc<"calls">> =
        call.holdOnAnswer === true
          ? { callStatus: "on_hold", parkedAt: now, holdOnAnswer: undefined, heldBy: [call.createdByPersonId] }
          : { callStatus: "connected" }
      if (call.answeredByPersonId === undefined) Object.assign(patch, { answeredByPersonId: me, answeredAt: now })
      await ctx.db.patch(call._id, patch)
      callStatus = patch.callStatus ?? callStatus
    }
    if (call.kind === "group") await markGroupInviteJoined(ctx, call._id, me, now)
    return { roomName: call.roomName, mediaType: call.mediaType, callStatus }
  },
})

/**
 * RACCROCHER. Un tête-à-tête finit dès que quiconque part (il ne reste plus
 * d'interlocuteur) ; un appel de groupe ne finit que lorsqu'il ne reste plus
 * personne en ligne. Sans effet — et sans réponse qui distingue — pour un appel
 * inconnu ou dont je n'ai pas de ligne.
 */
export const leave = networkMutation({
  args: { callId: v.id("calls"), intentional: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "call.leave", me)
    const call = await ctx.db.get(args.callId)
    if (!call || call.networkId !== ctx.networkId) return null
    const participation = await participationOf(ctx, call._id, me)
    if (!participation) return null

    const now = Date.now()
    if (participation.leftAt === undefined) await ctx.db.patch(participation._id, { leftAt: now })
    if (call.status !== "active") return null

    if (call.kind === "group") {
      await endGroupCallIfDeserted(ctx, call._id)
      return null
    }
    if (now - call._creationTime < LEAVE_FRESH_PROTECTION_MS && args.intentional !== true) return null
    // Parqué compte comme ÉTABLI : quitter pendant l'attente termine normalement.
    if (isLiveCallStatus(call.callStatus)) await finishCall(ctx, call, { callStatus: "ended", endReason: "normal" }, now)
    else if (isRingingCallStatus(call.callStatus)) await finishCall(ctx, call, { callStatus: "ended", endReason: "cancelled" }, now)
    return null
  },
})

/**
 * REFUSER un appel qui sonne. En tête-à-tête, le refus termine l'appel et peut
 * porter un mot pour l'appelant (« je vous rappelle dans dix minutes ») ; en
 * groupe, il ne touche QUE mon ticket — l'appel continue pour les autres.
 * L'appelant ne refuse pas son propre appel : il l'annule en raccrochant.
 */
export const declineCall = networkMutation({
  args: { callId: v.id("calls"), note: v.optional(v.string()) },
  returns: v.object({ ended: v.boolean() }),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    await enforceRateLimit(ctx, "call.respond", me)
    const { call } = await requireCallParticipant(ctx, ctx.networkId, args.callId, me)
    if (call.status !== "active") return { ended: false }
    if (call.kind === "group") return await declineGroupInvite(ctx, call._id, me, Date.now())
    if (!isRingingCallStatus(call.callStatus)) return { ended: false }
    if (call.createdByPersonId === me) return notFound()
    const note = args.note?.trim()
    if (note !== undefined && note.length > MAX_DECLINE_NOTE_LENGTH) return failRule("CALL_DECLINE_NOTE_TOO_LONG", { max: MAX_DECLINE_NOTE_LENGTH })
    await finishCall(ctx, call, { callStatus: "declined", endReason: "declined", ...(note ? { declineNote: note } : {}) }, Date.now())
    return { ended: true }
  },
})
