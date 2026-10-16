// Dupliqué de socle/convex/functions/chats.ts (l. 1728-1840, `setTyping`, `clearTyping`, `listTyping`, `purgeExpiredTyping`) @ ad2e7fdc2 — adaptations : participant, réseau et blocage par la garde du fil ; les personnes qui écrivent nommées par le contrat `counterpartLabel` (plus de repli sur l'e-mail, D21) ; débit des signaux ; `listTyping` reçoit l'instant en argument (D16 : plus de `Date.now()` dans une query — le client l'arrondit à la seconde, la souscription reste cachable) ; purge poursuivie par lots chaînés de 500 (lot 17).
/**
 * « En train d'écrire » — une ligne éphémère par (fil, personne), qui expire
 * six secondes après le dernier signal ; un cron purge les lignes expirées.
 */
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalMutation } from "../../_generated/server"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { counterpartOf, requireThread } from "./participation"

/** Durée de vie d'un signal avant expiration automatique. */
const TYPING_TTL_MS = 6_000
const PURGE_BATCH = 500

/** Signaler que j'écris — un upsert par (fil, personne). Le client le rejoue toutes les ~2 s. */
export const setTyping = networkMutation({
  minStatus: "declaree",
  args: { threadId: v.id("personalThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.typing", ctx.person._id)
    const { thread } = await requireThread(ctx, ctx.networkId, args.threadId, ctx.person._id)
    const existing = await ctx.db
      .query("personalTyping")
      .withIndex("by_thread_person", (q) => q.eq("threadId", thread._id).eq("personId", ctx.person._id))
      .first()
    const expiresAt = Date.now() + TYPING_TTL_MS
    if (existing) await ctx.db.patch(existing._id, { expiresAt })
    else await ctx.db.insert("personalTyping", { threadId: thread._id, personId: ctx.person._id, expiresAt })
    return null
  },
})

/** Retirer mon signal (message envoyé, champ vidé) — optionnel, le délai s'en charge. */
export const clearTyping = networkMutation({
  writeBucket: "message.clearTyping",
  minStatus: "en_attente",
  args: { threadId: v.id("personalThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("personalTyping")
      .withIndex("by_thread_person", (q) => q.eq("threadId", args.threadId).eq("personId", ctx.person._id))
      .first()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

/**
 * Qui écrit dans ce fil, MOI EXCLU. `now` vient du client, ARRONDI à la seconde
 * (D16) : un instant lu dans la query la rendrait non déterministe et
 * incachable ; un `now` mensonger ne montre au pire qu'un signal périmé.
 */
export const listTyping = networkQuery({
  args: { threadId: v.id("personalThreads"), now: v.number() },
  handler: async (ctx, args): Promise<{ personId: Id<"persons">; label: CounterpartLabel }[]> => {
    const { thread } = await requireThread(ctx, ctx.networkId, args.threadId, ctx.person._id)
    // Un fil 1:1 n'a que deux personnes : une troisième ligne signalerait une corruption, sans justifier une lecture non bornée.
    const rows = await ctx.db
      .query("personalTyping")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(3)
    const out: { personId: Id<"persons">; label: CounterpartLabel }[] = []
    for (const row of rows) {
      if (row.expiresAt <= args.now || row.personId === ctx.person._id) continue
      out.push({ personId: row.personId, label: await counterpartOf(ctx, row.personId) })
    }
    return out
  },
})

/** Cron : purge les signaux expirés (toutes les minutes). */
export const purgeExpiredTyping = internalMutation({
  args: {},
  returns: v.object({ purged: v.number() }),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("personalTyping")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(PURGE_BATCH)
    for (const row of expired) await ctx.db.delete(row._id)
    // Les lignes retirées quittent l'index : la suite reprend les suivantes.
    if (expired.length === PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.modules.messaging.typing.purgeExpiredTyping, {})
    return { purged: expired.length }
  },
})
