// Dupliqué de socle/convex/modules/iappel/ringExpiry.ts @ ad2e7fdc2 — adaptations : tickets du moteur (`callInvites`) ; fenêtre lue au contrat (`CALL_RING_WINDOW_MS`, une seule source au lieu de quatre) ; extinction PRÉCISE du tête-à-tête ajoutée (`expireDirectRing`, programmée à la création de l'appel, fin par `finishCall`) — au socle, un appel direct sans réponse attendait le nettoyage périodique (jusqu'à trente secondes de trop) pendant que `listRinging` le cachait en lisant l'horloge dans une query (D16).
/**
 * Appels — la FIN d'une sonnerie, au terme de SA fenêtre.
 *
 * Un ticket de groupe ne devenait « manqué » qu'à la fin de l'appel : chez
 * l'APPELANT, la grille disait « Sonne… » tant que durait l'appel et la place
 * restait réservée. Chaque ticket qui se met à sonner programme donc sa propre
 * extinction ; un tête-à-tête aussi. La sonnerie est un ÉTAT tenu par le
 * serveur, lu par l'écran — jamais une heure de téléphone.
 *
 * Module à part : un fichier qui se replanifie lui-même dégrade le typage de
 * toute l'API générée.
 */
import { CALL_RING_WINDOW_MS } from "@antsia/social-contracts/calls"
import { isRingingCallStatus } from "@antsia/social-domain/callJournal"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { finishCall } from "./state"

/**
 * Programme l'extinction d'un ticket qui SONNE. `invitedAt` voyage avec le job :
 * un ticket re-sonné entre-temps (ajout en cours d'appel, fenêtre neuve) porte
 * une autre date, et le job ancien ne l'éteint pas. Une fenêtre déjà écoulée
 * (ticket promu d'un tête-à-tête, daté du début de l'appel) s'éteint aussitôt.
 */
export async function scheduleRingingExpiry(ctx: MutationCtx, args: { inviteId: Id<"callInvites">; invitedAt: number; now: number }): Promise<void> {
  const delay = Math.max(0, args.invitedAt + CALL_RING_WINDOW_MS - args.now)
  await ctx.scheduler.runAfter(delay, internal.modules.calls.ringExpiry.expireRingingTicket, { inviteId: args.inviteId, invitedAt: args.invitedAt })
}

/**
 * Éteint UN ticket resté `ringing` : l'invité n'a pas refusé, il a MANQUÉ
 * l'appel — la grille le dit « sans réponse » et sa place se libère. Idempotent,
 * et sans effet sur un ticket décroché, refusé ou re-sonné.
 */
export const expireRingingTicket = internalMutation({
  args: { inviteId: v.id("callInvites"), invitedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const invite = await ctx.db.get(args.inviteId)
    if (invite === null || invite.status !== "ringing" || invite.invitedAt !== args.invitedAt) return null
    await ctx.db.patch(invite._id, { status: "missed", respondedAt: Date.now() })
    return null
  },
})

/** Programme la fin de la sonnerie d'un tête-à-tête, au terme de sa fenêtre. */
export async function scheduleDirectRingExpiry(ctx: MutationCtx, args: { callId: Id<"calls">; startedAt: number; now: number }): Promise<void> {
  const delay = Math.max(0, args.startedAt + CALL_RING_WINDOW_MS - args.now)
  await ctx.scheduler.runAfter(delay, internal.modules.calls.ringExpiry.expireDirectRing, { callId: args.callId })
}

/**
 * Un tête-à-tête qui sonne encore au terme de sa fenêtre est MANQUÉ. Sans effet
 * sur un appel décroché, refusé, terminé, ou devenu appel de groupe (ses tickets
 * portent alors leurs propres fenêtres).
 */
export const expireDirectRing = internalMutation({
  args: { callId: v.id("calls") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const call = await ctx.db.get(args.callId)
    if (call === null || call.status !== "active" || call.kind !== "direct" || !isRingingCallStatus(call.callStatus)) return null
    await finishCall(ctx, call, { callStatus: "missed", endReason: "timeout" }, Date.now())
    return null
  },
})
