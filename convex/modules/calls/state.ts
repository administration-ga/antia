// Dupliqué de socle/convex/modules/iappel/groupCalls.ts (avec socle/convex/modules/reseauPersonnel/groupes.ts, l. 470-500 ; socle/convex/functions/meetings.ts, l. 1090-1230) @ ad2e7fdc2 — adaptations : l. 171-225 et 1241-1270 (`endGroupCallIfDeserted`, `markGroupInviteJoined`, `declineGroupInvite`) sur les tables du moteur ; UNE porte de fin d'appel (`finishCall`) que partagent le raccrochage, le refus, l'expiration, le nettoyage et la suppression d'un fil — elle pose le départ de TOUTES les lignes de participation (invariant : une ligne sans départ appartient à un appel vivant) et rend MANQUÉS les tickets qui sonnaient encore ; `revokeActiveGroupCallParticipation` → `revokeThreadCallParticipation` (le ticket qui sonnait devient manqué, un appel déserté finit aussitôt) ; la suppression d'un fil termine son appel (`endThreadCall`) au lieu de laisser une salle sans garde jusqu'au nettoyage.
/**
 * Appels — les ÉCRITURES d'état que tous les chemins partagent.
 *
 * Aucune fonction Convex ici : des aides appelées dans la transaction du geste
 * (raccrocher, refuser, expirer, nettoyer, quitter un fil). Une fin d'appel
 * écrite à deux endroits divergerait au premier oubli.
 */
import { groupCallShouldEnd } from "@antsia/social-contracts/callGroup"
import type { CallEndReason } from "@antsia/social-domain/callJournal"
import { makeFunctionReference } from "convex/server"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { inviteOf, invitesOf, liveThreadCall, loadGroupParticipants, participationOf, participationsOf } from "./access"
import { isConversationCall } from "./conversation"

/** La salle d'un appel de CONVERSATION (P10 ou contextuelle) est fermée par le serveur multimédia à la fin : un jeton émis ne la garde pas ouverte. */
const closeConversationRoom = makeFunctionReference<"action", { roomName: string }, null>("modules/live/livekitActions:closeDirectRoom")

/** Comment un appel finit : l'état terminal, la raison, et le mot laissé à l'appelant le cas échéant. */
export type CallEnd = { callStatus: "ended" | "missed" | "declined"; endReason: CallEndReason; declineNote?: string }

/**
 * FIN d'un appel — la seule écriture qui le termine. Le document passe `ended`
 * avec sa fin ; TOUTES ses lignes de participation reçoivent leur départ ; les
 * tickets qui sonnaient encore deviennent MANQUÉS (personne n'a refusé : il n'y
 * avait plus d'appel). Bornée : au plus une ligne et un ticket par personne conviée.
 */
export async function finishCall(ctx: MutationCtx, call: Doc<"calls">, end: CallEnd, at: number): Promise<void> {
  await ctx.db.patch(call._id, {
    status: "ended",
    callStatus: end.callStatus,
    endReason: end.endReason,
    endedAt: at,
    ...(end.declineNote !== undefined ? { declineNote: end.declineNote } : {}),
  })
  for (const row of await participationsOf(ctx, call._id)) {
    if (row.leftAt === undefined) await ctx.db.patch(row._id, { leftAt: at })
  }
  for (const invite of await invitesOf(ctx, call._id)) {
    if (invite.status === "ringing") await ctx.db.patch(invite._id, { status: "missed", respondedAt: at })
  }
  // CC-4 : le sélecteur unique — toute conversation (P10, contextuelle, ou incohérente) ferme sa salle.
  if (isConversationCall(call)) await ctx.scheduler.runAfter(0, closeConversationRoom, { roomName: call.roomName })
}

/**
 * Termine l'appel de GROUPE s'il ne reste plus personne pour l'entendre. Le
 * tête-à-tête finit dès que quiconque part ; appliquer cette règle à un groupe
 * couperait la parole à tous les autres au premier départ (`groupCallShouldEnd`).
 */
export async function endGroupCallIfDeserted(ctx: MutationCtx, callId: Id<"calls">): Promise<boolean> {
  const call = await ctx.db.get(callId)
  if (!call || call.kind !== "group" || call.status !== "active") return false
  if (!groupCallShouldEnd(await loadGroupParticipants(ctx, call))) return false
  await finishCall(ctx, call, { callStatus: "ended", endReason: "normal" }, Date.now())
  return true
}

/** Le ticket de l'invité qui vient de DÉCROCHER — sans quoi son téléphone continuerait de figurer parmi « ce qui sonne ». Idempotent. */
export async function markGroupInviteJoined(ctx: MutationCtx, callId: Id<"calls">, personId: Id<"persons">, at: number): Promise<void> {
  const invite = await inviteOf(ctx, callId, personId)
  if (!invite || invite.status === "joined") return
  await ctx.db.patch(invite._id, { status: "joined", respondedAt: at })
}

/**
 * REFUSER un appel de groupe — sans le terminer pour les autres : seul MON
 * ticket change, et l'appel ne finit que s'il ne restait plus personne en
 * ligne. Idempotent : refuser deux fois ne réécrit rien. Sans ticket : le refus
 * indistinct (un identifiant tiers ou inventé n'apprend rien).
 */
export async function declineGroupInvite(ctx: MutationCtx, callId: Id<"calls">, personId: Id<"persons">, at: number): Promise<{ ended: boolean }> {
  const invite = await inviteOf(ctx, callId, personId)
  if (!invite) return notFound()
  if (invite.status !== "ringing") return { ended: false }
  await ctx.db.patch(invite._id, { status: "declined", respondedAt: at })
  return { ended: await endGroupCallIfDeserted(ctx, callId) }
}

// ═══════════════════════════════════════════════════════════════
// Accroches du module des groupes — le fil décide du droit d'être dans son appel
// ═══════════════════════════════════════════════════════════════

/**
 * Un membre QUITTE le fil, ou en est RETIRÉ : il cesse d'entendre l'appel en
 * cours, pas seulement de lire le fil. Son départ de la salle s'écrit DANS la
 * transaction de départ ; son téléphone, s'il sonnait, se tait (manqué) ; un
 * appel qui n'a plus personne en ligne finit.
 */
export async function revokeThreadCallParticipation(ctx: MutationCtx, threadId: Id<"groupThreads">, personId: Id<"persons">, at: number): Promise<void> {
  const call = await liveThreadCall(ctx, threadId)
  if (!call) return
  const row = await participationOf(ctx, call._id, personId)
  if (row && row.leftAt === undefined) await ctx.db.patch(row._id, { leftAt: at })
  const ticket = await inviteOf(ctx, call._id, personId)
  if (ticket?.status === "ringing") await ctx.db.patch(ticket._id, { status: "missed", respondedAt: at })
  await endGroupCallIfDeserted(ctx, call._id)
}

/**
 * Le fil est SUPPRIMÉ : son appel finit AVANT que le fil ne disparaisse — sans
 * fil, la garde vivante ne trouverait plus rien et la salle resterait ouverte.
 */
export async function endThreadCall(ctx: MutationCtx, threadId: Id<"groupThreads">, at: number): Promise<void> {
  const call = await liveThreadCall(ctx, threadId)
  if (!call) return
  await finishCall(ctx, call, { callStatus: "ended", endReason: "normal" }, at)
}
