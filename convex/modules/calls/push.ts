// Dupliqué de socle/convex/modules/iappel/push.ts @ ad2e7fdc2 — adaptations : la DÉCISION seule (préférence `pushIncoming`, défaut ouvert, et les trois moments où un téléphone se met à sonner) — le canal d'envoi (Web Push, abonnements, VAPID) arrive avec PA5, aucun envoi n'est donc programmé avant lui ; appel prioritaire retiré ; titre et corps ne sont plus composés ici (D20 : un push d'appel ne porte aucun contenu — le service worker titre l'avis dans la langue de l'appareil) ; adresse « / » retirée (le lien sera celui du réseau).
/**
 * Appels — la sonnerie POUSSÉE hors de l'onglet.
 *
 * Point UNIQUE, appelé aux trois moments où un téléphone se met à sonner :
 *   · `lifecycle.setCallRinging` — le tête-à-tête passe `initiating → ringing` ;
 *   · `groupCalls` — un ticket `ringing` par invité ADMIS au lancement ;
 *   · `groupCalls.addInvitee` — l'ajout en cours d'appel.
 *
 * Rend `true` quand une sonnerie doit partir. Le canal d'envoi est posé par
 * PA5 (notifications poussées du moteur) DANS cette fonction : aucun appelant
 * n'aura à changer quand il arrivera. Jusque-là, un appel ne sonne que là où
 * une application du réseau est ouverte — c'est ce que constate « hors ligne ».
 */
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"

export async function scheduleIncomingCallPush(ctx: Pick<MutationCtx, "db">, args: { networkId: Id<"networks">; calleePersonId: Id<"persons">; callId: Id<"calls"> }): Promise<boolean> {
  const prefs = await ctx.db
    .query("callPreferences")
    .withIndex("by_person", (q) => q.eq("personId", args.calleePersonId))
    .unique()
  // Défaut OUVERT : seule une désactivation explicite ferme le canal — le contrat de `preferences.getMine`.
  return prefs?.pushIncoming !== false
}
