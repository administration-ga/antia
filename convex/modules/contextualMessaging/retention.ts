/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §6.5, §6.6) — purge bornée d'une conversation, et
 * RÉTENTION INACTIVE.
 *
 * D7 : aucune durée de conservation n'est inventée (`CONTEXTUAL_RETENTION = null`) : aucune purge
 * temporelle ne s'exécute et aucune tâche planifiée de CONSERVATION n'existe (la tâche CC-4
 * `contextual-revalidate-calls` n'efface rien : elle arrête des appels).
 * La purge ne part que d'un geste explicite : la tranche qui supprime un objet hors effacement
 * (`purgeContextualConversation`), ou la cascade d'effacement (parents déclarés). Le jour où une
 * durée sera décidée avec un conseil compétent : poser `purgeAt` à la fermeture, ajouter une tâche
 * planifiée à identifiant ASCII, mettre à jour `crons-contract`.
 *
 * CC-4 — revalidation des appels contextuels VIVANTS (`revalidateCalls`, §5.8, §10.2) : ce n'est PAS
 * une conservation (D7 inchangé, aucune purge temporelle). Les pertes de droit qui naissent hors du
 * module (adhésion, suspension, signataire retiré, blocage, consentement `social_profile`, profil
 * retiré, page désactivée) ferment déjà toute porte d'appel à la requête suivante ; ce passage paginé
 * arrête aussi la salle déjà établie (`finishCall`). Il est planifié par la politique fermée
 * (`operator.setPolicy`) et, comme P10, par une tâche à la minute (`contextual-revalidate-calls`).
 * Les gestes du module (retrait d'accord, clôture, synchronisation, purge) arrêtent leurs appels dans
 * leur propre transaction.
 */
import { CONTEXTUAL_MODERATION_SURFACE, CONTEXTUAL_PURGE_SLICE } from "@antsia/social-domain/contextualMessaging"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { rateLimiter } from "../../lib/rateLimit"
import { finishCall } from "../calls/state"
import { purgeStoredFile } from "../files/purge"
import { canParticipateContextualCall, stopContextualThreadCalls } from "./callAccess"
import { withContextualMemo } from "./access"

const purgeNext = makeFunctionReference<"mutation", { threadId: Id<"contextualThreads"> }, boolean>("modules/contextualMessaging/retention:purgeSlice")
const revalidateNext = makeFunctionReference<"mutation", { cursor?: string }, number>("modules/contextualMessaging/retention:revalidateCalls")

/** Appels relus par page de revalidation (§10.2 : pages de vingt), et le poids lu au plus. */
const REVALIDATION_PAGE = 20
const REVALIDATION_BYTES_MAX = 256 * 1024

/**
 * Une tranche de purge : vingt messages au plus (leurs blobs et leurs états de modération), puis
 * les états personnels, puis le fil et son budget de débit. Rend `true` quand le fil a disparu.
 */
export async function purgeContextualThreadSlice(ctx: MutationCtx, threadId: Id<"contextualThreads">): Promise<boolean> {
  const thread = await ctx.db.get(threadId)
  if (thread === null) return true
  // CC-4 : arrêter d'abord les appels du fil (`finishCall`, salle fermée), avant toute suppression (idempotent).
  await stopContextualThreadCalls(ctx, threadId)
  const messages = await ctx.db.query("contextualMessages").withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId)).take(CONTEXTUAL_PURGE_SLICE)
  for (const message of messages) {
    for (const file of message.attachmentFiles ?? []) await purgeStoredFile(ctx, file.storageId)
    const moderation = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", CONTEXTUAL_MODERATION_SURFACE).eq("targetId", message._id)).first()
    if (moderation !== null) await ctx.db.delete(moderation._id)
    await ctx.db.delete(message._id)
  }
  if (messages.length === CONTEXTUAL_PURGE_SLICE) return false
  const states = await ctx.db.query("contextualPersonStates").withIndex("by_thread", (q) => q.eq("threadId", threadId)).take(CONTEXTUAL_PURGE_SLICE + 1)
  for (const state of states.slice(0, CONTEXTUAL_PURGE_SLICE)) await ctx.db.delete(state._id)
  if (states.length > CONTEXTUAL_PURGE_SLICE) return false
  // Le budget du fil n'a plus d'objet : sa clé disparaît avec lui.
  await rateLimiter.reset(ctx, "contextual.thread", { key: threadId })
  await ctx.db.delete(threadId)
  return true
}

/** Purge par tranches enchaînées ; idempotente (un fil déjà disparu est une purge acquise). */
export const purgeSlice = internalMutation({
  args: { threadId: v.id("contextualThreads") },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const done = await purgeContextualThreadSlice(ctx, args.threadId)
    if (!done) await ctx.scheduler.runAfter(0, purgeNext, { threadId: args.threadId })
    return done
  },
})

/**
 * CC-4 — une page de revalidation des appels contextuels VIVANTS : chaque appel dont la paire n'est
 * plus admise (accord, autorité, phase, politique, adhésion, signataire, blocage, vivacité) est
 * terminé, sa salle fermée ; la chaîne se poursuit par curseur. Rend le nombre d'appels arrêtés.
 */
export const revalidateCalls = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const window = await ctx.db
      .query("calls")
      .withIndex("by_status_contextual_thread", (q) => q.eq("status", "active").gt("contextualThreadId", undefined))
      .paginate({ cursor: args.cursor ?? null, numItems: REVALIDATION_PAGE, maximumRowsRead: REVALIDATION_PAGE, maximumBytesRead: REVALIDATION_BYTES_MAX })
    const memo = withContextualMemo(ctx)
    let ended = 0
    for (const call of window.page) {
      if (await canParticipateContextualCall(memo, call, call.createdByPersonId)) continue
      await finishCall(ctx, call, { callStatus: "ended", endReason: "normal" }, Date.now())
      ended += 1
    }
    if (!window.isDone) await ctx.scheduler.runAfter(0, revalidateNext, { cursor: window.continueCursor })
    return ended
  },
})
