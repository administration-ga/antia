/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §3.2) — l'état d'UNE personne dans UN fil : sa
 * dernière lecture et, en CC-4, son accord d'appel. Une ligne créée au premier geste ; elle ne
 * confère AUCUN droit (l'accès est relu à chaque geste) et disparaît avec le fil ou avec
 * l'effacement de la personne. Aucune fonction Convex ici.
 */
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"

export async function personStateOf(ctx: Pick<QueryCtx, "db">, threadId: Id<"contextualThreads">, personId: Id<"persons">): Promise<Doc<"contextualPersonStates"> | null> {
  return await ctx.db.query("contextualPersonStates").withIndex("by_thread_person", (q) => q.eq("threadId", threadId).eq("personId", personId)).first()
}

/** Pose la lecture d'une personne (création au premier geste, sinon mise à jour). */
export async function markPersonRead(ctx: Pick<MutationCtx, "db">, thread: Pick<Doc<"contextualThreads">, "_id" | "networkId">, personId: Id<"persons">, readAt: number): Promise<void> {
  const existing = await personStateOf(ctx, thread._id, personId)
  if (existing !== null) {
    if (existing.readAt === undefined || existing.readAt < readAt) await ctx.db.patch(existing._id, { readAt, updatedAt: readAt })
    return
  }
  await ctx.db.insert("contextualPersonStates", { networkId: thread.networkId, threadId: thread._id, personId, readAt, updatedAt: readAt })
}

/** Un accord d'appel posé porte la clé de l'autorité qui l'a permis (§5.8) ; un retrait n'en porte aucune. */
export type PersonCallConsent = { readonly allowed: true; readonly authorityKey: string } | { readonly allowed: false }

/**
 * CC-4 — pose ou retire l'accord d'appel EXPLICITE d'une personne dans un fil. Jamais prérempli : seul
 * ce geste l'écrit. Un retrait efface la clé d'autorité ; un retrait sans ligne n'en crée pas (l'absence
 * vaut déjà « pas d'accord »). La ligne ne confère aucun droit : l'appel relit tout.
 */
export async function setPersonCallConsent(ctx: Pick<MutationCtx, "db">, thread: Pick<Doc<"contextualThreads">, "_id" | "networkId">, personId: Id<"persons">, consent: PersonCallConsent, at: number): Promise<void> {
  const existing = await personStateOf(ctx, thread._id, personId)
  if (existing !== null) {
    await ctx.db.patch(existing._id, consent.allowed ? { callsAllowed: true, callAuthorityKey: consent.authorityKey, updatedAt: at } : { callsAllowed: false, callAuthorityKey: undefined, updatedAt: at })
    return
  }
  if (!consent.allowed) return
  await ctx.db.insert("contextualPersonStates", { networkId: thread.networkId, threadId: thread._id, personId, callsAllowed: true, callAuthorityKey: consent.authorityKey, updatedAt: at })
}
