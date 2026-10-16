// Dupliqué de socle/convex/functions/meetings.ts (l. 152-184 et 2749-2862 : `endStaleCalls`, `cleanupStaleCalls`) @ ad2e7fdc2 — adaptations : lectures par l'index `by_callStatus`, bornées à cinquante appels par transaction, chaque état balayé par UNE CHAÎNE paginée déclenchée par le cron (le socle n'examinait que les cinquante plus anciens) ; composés et sonneries poursuivis même si des groupes protégés occupent la première page, à l'instant du passage, sans supposer que `startedAt` suit l'ordre de création ; `endStaleCalls` (un `.collect()` de TOUS les appels de l'appelant à chaque appel émis, D11, D27) → `reapStaleCallsOf`, lecture indexée bornée aux plus récents du réseau, qui pose enfin un `callStatus` terminal (le socle laissait `callStatus` intact) ; présence lue sur les lignes de participation ; appel de groupe qui sonne gardé tant qu'un ticket est encore dans sa fenêtre ou que quelqu'un d'autre que l'hôte est en ligne, extinction des tickets échus récupérée par le cron ; priorité et file d'appels retirées ; toute fin par `finishCall`.
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
import { CALL_CONNECTED_MAX_DURATION_MS, CALL_INITIATING_TIMEOUT_MS, CALL_RING_WINDOW_MS } from "@antsia/social-contracts/calls"
import { isLiveCallStatus } from "@antsia/social-domain/callJournal"
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
 * est conservé sans préjuger de l'âge des suivants : l'index trie par création,
 * pas par `startedAt`.
 */
async function reapIfStale(ctx: MutationCtx, call: Doc<"calls">, now: number): Promise<boolean> {
  if (call.status !== "active") return false
  const age = now - call.startedAt
  if (call.callStatus === "initiating") {
    if (age <= CALL_INITIATING_TIMEOUT_MS) return false
    await finishCall(ctx, call, { callStatus: "missed", endReason: "timeout" }, now)
    return true
  }
  if (call.callStatus === "ringing") {
    if (age <= CALL_RING_WINDOW_MS) return false
    if (call.kind === "group") {
      // Le cron récupère aussi les extinctions de tickets perdues. Seul un
      // ticket encore dans sa fenêtre peut garder l'appel ; un participant
      // présent le protège aussi, même si tous les tickets ont expiré.
      let ringing = false
      for (const ticket of await invitesOf(ctx, call._id)) {
        if (ticket.status !== "ringing") continue
        if (ticket.invitedAt + CALL_RING_WINDOW_MS > now) ringing = true
        else await ctx.db.patch(ticket._id, { status: "missed", respondedAt: now })
      }
      if (ringing) return false
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
 * Le passage périodique (toutes les 30 s) lance UNE chaîne par état. Une page
 * contenant des groupes encore protégés ne masque jamais les appels suivants ;
 * les suites n'ouvrent pas de nouveaux balayages d'appels établis.
 */
export const cleanupStaleCalls = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const now = Date.now()
    for (const callStatus of ["initiating", "ringing"] as const) {
      await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.sweepPendingCalls, { callStatus, cursor: null, now })
    }
    for (const callStatus of ["connected", "on_hold"] as const) {
      await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.sweepLiveCalls, { callStatus, cursor: null })
    }
    return null
  },
})

/**
 * Un lot d'appels composés ou qui sonnent. L'instant est figé pour la chaîne ;
 * le curseur progresse même quand aucune ligne n'est close. Une ligne qui vient
 * de rejoindre la salle est relue dans la transaction de sa page et conservée.
 */
export const sweepPendingCalls = internalMutation({
  args: { callStatus: v.union(v.literal("initiating"), v.literal("ringing")), cursor: v.union(v.string(), v.null()), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const page = await ctx.db
      .query("calls")
      .withIndex("by_callStatus", (q) => q.eq("callStatus", args.callStatus))
      .paginate({ cursor: args.cursor, numItems: CLEANUP_BATCH })
    for (const call of page.page) await reapIfStale(ctx, call, args.now)
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.modules.calls.cleanup.sweepPendingCalls, { callStatus: args.callStatus, cursor: page.continueCursor, now: args.now })
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
