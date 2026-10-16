// Dupliqué de socle/convex/modules/iappel/push.ts @ ad2e7fdc2 — adaptations : préférence `pushIncoming`, trois points de sonnerie ; admission dans la file sociale PA5 (consentement, réseau, budget et appareil), reprise immédiate si scheduler disponible ; aucun contenu ni priorité de poste, destination par configuration du réseau.
/**
 * Appels — la sonnerie POUSSÉE hors de l'onglet.
 *
 * Point UNIQUE, appelé aux trois moments où un téléphone se met à sonner :
 *   · `lifecycle.setCallRinging` — le tête-à-tête passe `initiating → ringing` ;
 *   · `groupCalls` — un ticket `ringing` par invité ADMIS au lancement ;
 *   · `groupCalls.addInvitee` — l'ajout en cours d'appel.
 *
 * Rend la décision de préférence héritée ; les appareils/consentements et le
 * budget sont jugés dans la file PA5. Ce booléen ne prouve aucune livraison.
 */
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { enqueueIncomingCallPush } from "../notifications/deliveries"

export async function scheduleIncomingCallPush(ctx: Pick<MutationCtx, "db"> & Partial<Pick<MutationCtx, "runQuery">>, args: { networkId: Id<"networks">; calleePersonId: Id<"persons">; callId: Id<"calls"> }): Promise<boolean> {
  const prefs = await ctx.db
    .query("callPreferences")
    .withIndex("by_person", (q) => q.eq("personId", args.calleePersonId))
    .unique()
  // Défaut OUVERT : seule une désactivation explicite ferme le canal — le contrat de `preferences.getMine`.
  if (prefs?.pushIncoming === false) return false
  if (ctx.runQuery) await enqueueIncomingCallPush({ db: ctx.db, runQuery: ctx.runQuery }, args.networkId, args.calleePersonId, args.callId)
  return true
}
