// Dupliqué de socle/convex/functions/meetings.ts (l. 152-184 et 2749-2862 : `endStaleCalls`, `cleanupStaleCalls`) @ ad2e7fdc2 — adaptations : lectures par l'index `by_callStatus`, les plus anciennes d'abord, bornées par lot, et poursuivies par CHAÎNE tant qu'un lot entier a été clos (le socle lisait cinquante lignes par état et s'en remettait au passage suivant) ; appels établis balayés par pagination chaînée (le socle n'examinait que les cinquante plus anciens) ; `endStaleCalls` (un `.collect()` de TOUS les appels de l'appelant à chaque appel émis, D11, D27) → `reapStaleCallsOf`, lecture indexée bornée aux plus récents du réseau, qui pose enfin un `callStatus` terminal (le socle laissait `callStatus` intact) ; présence lue sur les lignes de participation ; appel de groupe qui sonne gardé tant qu'un ticket sonne ou que quelqu'un d'autre que l'hôte est en ligne ; priorité et file d'appels retirées ; toute fin par `finishCall`.
/**
 * Appels — le NETTOYAGE des appels périmés.
 *
 * Le départ d'un participant vient de son écran : un onglet fermé, un mobile
 * verrouillé ou un réseau coupé ne l'écrivent jamais. Sans ce filet, un appel
 * resterait « en cours » indéfiniment — chronomètre qui tourne, personne
 * affichée en ligne, place bloquée. Le vrai signal (le départ de la salle vu
 * par le serveur multimédia) n'est pas encore branché.
 *
 *  · composé (`initiating`) au-delà de 30 s : l'appelant n'a jamais rejoint sa
 *    salle → manqué ;
 *  · qui sonne au-delà de la fenêtre : filet de l'extinction programmée
 *    (`ringExpiry`) → manqué ;
 *  · établi (`connected`, `on_hold`) sans personne dans la salle → terminé ;
 *    au-delà de quatre heures → terminé EN ERREUR (un fantôme se repère).
 */
import { CALL_CONNECTED_MAX_DURATION_MS, CALL_INITIATING_TIMEOUT_MS, CALL_RING_WINDOW_MS } from "@antia/social-contracts/calls"
import { isLiveCallStatus } from "@antia/social-domain/callJournal"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { invitesOf, isPresent, participationsOf } from "./access"
import { finishCall } from "./state"

/** Appels examinés par lot et par état. */
const CLEANUP_BATCH = 50
/** Les appels récents de l'appelant examinés à chaque appel émis. */
const OWN_RECENT_SCAN = 10
/** Au-delà, un appel sans personne dans la salle est périmé (socle : `STALE_CALL_THRESHOLD_MS`). */
const STALE_CALL_MS = CALL_RING_WINDOW_MS

/**
 * Clôt un appel s'il est périmé — rend `true` s'il l'a clos. Un appel trop jeune
 * pour son état rend `"young"` : les suivants (plus jeunes encore) ne seront pas
 * examinés.
 */
async function reapIfStale(ctx: MutationCtx, call: Doc<"calls">, now: number): Promise<boolean | "young"> {
  if (call.status !== "active") return false
  const age = now - call.startedAt
  if (call.callStatus === "initiating") {
    if (age <= CALL_INITIATING_TIMEOUT_MS) return "young"
    await finishCall(ctx, call, { callStatus: "missed", endReason: "timeout" }, now)
    return true
  }
  if (call.callStatus === "ringing") {
    if (age <= CALL_RING_WINDOW_MS) return "young"
    if (call.kind === "group") {
      // Un ticket encore en fenêtre (ajout récent) garde l'appel ; quelqu'un d'autre que l'hôte en ligne aussi.
      if ((await invitesOf(ctx, call._id)).some((ticket) => ticket.status === "ringing")) return false
      if ((await participationsOf(ctx, call._id)).some((row) => isPresent(row) && row.personId !== call.createdByPersonId)) return false
    }
    await finishCall(ctx, call, { callStatus: "missed", endReason: "timeout" }, now)
    return true
  }
  if (isLiveCallStatus(call.callStatus)) {
    const present = (await participationsOf(ctx, call._id)).filter(isPresent).length
    const ghost = age > CALL_CONNECTED_MAX_DURATION_MS
    if (present > 0 && !ghost) return false
    // Un fantôme n'est pas une fin normale : le distinguer permet de le repérer.
    await finishCall(ctx, call, { callStatus: "ended", endReason: present > 0 ? "error" : "normal" }, now)
    return true
  }
  return false
}

/**
 * Le passage périodique (toutes les 30 s) : les appels composés et qui sonnent,
 * les plus anciens d'abord — dès qu'un appel est trop jeune, tous les suivants le
 * sont. Un lot entièrement clos se poursuit aussitôt ; les appels établis sont
 * balayés par une chaîne paginée.
 */
export const cleanupStaleCalls = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const now = Date.now()
    let saturated = false
    for (const callStatus of ["initiating", "ringing"] as const) {
      const calls = await ctx.db
        .query("calls")
        .withIndex("by_callStatus", (q) => q.eq("callStatus", callStatus))
        .take(CLEANUP_BATCH)
      let closed = 0
      for (const call of calls) {
        const outcome = await reapIfStale(ctx, call, now)
        if (outcome === "young") break
        if (outcome) closed += 1
      }
      // Un lot ENTIÈREMENT clos a quitté l'index : il peut en rester derrière.
      if (calls.length === CLEANUP_BATCH && closed === CLEANUP_BATCH) saturated = true
    }
    if (saturated) await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.cleanupStaleCalls, {})
    for (const callStatus of ["connected", "on_hold"] as const) {
      await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.sweepLiveCalls, { callStatus, cursor: null })
    }
    return null
  },
})

/** Un lot d'appels établis : chacun est relu (personne dans la salle ? fantôme ?), la chaîne se poursuit jusqu'au bout de l'index. */
export const sweepLiveCalls = internalMutation({
  args: { callStatus: v.union(v.literal("connected"), v.literal("on_hold")), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = Date.now()
    const page = await ctx.db
      .query("calls")
      .withIndex("by_callStatus", (q) => q.eq("callStatus", args.callStatus))
      .paginate({ cursor: args.cursor, numItems: CLEANUP_BATCH })
    for (const call of page.page) await reapIfStale(ctx, call, now)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.sweepLiveCalls, { callStatus: args.callStatus, cursor: page.continueCursor })
    return null
  },
})

/**
 * Avant de composer : clore MES appels périmés de ce réseau (une sonnerie
 * oubliée, un appel dont personne n'est plus dans la salle). Lecture indexée
 * bornée aux plus récents — le socle relisait TOUS les appels de l'appelant.
 */
export async function reapStaleCallsOf(ctx: MutationCtx, networkId: Id<"networks">, personId: Id<"persons">, now: number): Promise<void> {
  const recent = await ctx.db
    .query("calls")
    .withIndex("by_network_creator", (q) => q.eq("networkId", networkId).eq("createdByPersonId", personId))
    .order("desc")
    .take(OWN_RECENT_SCAN)
  for (const call of recent) {
    if (call.status !== "active" || now - call.startedAt < STALE_CALL_MS) continue
    const present = (await participationsOf(ctx, call._id)).some((row) => isPresent(row) && row.personId !== personId)
    if (present) continue
    await finishCall(ctx, call, isLiveCallStatus(call.callStatus) ? { callStatus: "ended", endReason: "normal" } : { callStatus: "missed", endReason: "timeout" }, now)
  }
}
