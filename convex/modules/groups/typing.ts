// Dupliqué de socle/convex/modules/reseauPersonnel/groupes.ts (l. 1997-2087 : `setGroupTyping`, `clearGroupTyping`, `listGroupTyping`, `purgeExpiredGroupTyping`) @ ad2e7fdc2 — adaptations : garde du fil par réseau ; les personnes qui écrivent nommées par le contrat `counterpartLabel` (jamais d'e-mail) ; `listGroupTyping` reçoit l'instant en argument (D16 : plus de `Date.now()` dans une query) ; débit des signaux ; purge poursuivie par lots chaînés de 500 (lot 17).
/**
 * « En train d'écrire » dans un groupe — une ligne éphémère par (fil,
 * personne), qui expire six secondes après le dernier signal ; un cron purge.
 */
import type { CounterpartLabel } from "@antsia/social-contracts/counterpart"
import { GROUP_MEMBERS_MAX } from "@antsia/social-contracts/groupCapacity"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalMutation } from "../../_generated/server"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { miniProfileCache } from "../people/miniProfile"
import { counterpartOf } from "../messaging/participation"
import { blockedCache, requireLiveMembership } from "./access"

/** Durée de vie d'un signal. */
const GROUP_TYPING_TTL_MS = 6_000
/** Signaux expirés purgés par passage. */
const PURGE_BATCH = 500

/** Signaler que j'écris — un upsert par (fil, personne). */
export const setGroupTyping = networkMutation({
  minStatus: "declaree",
  args: { threadId: v.id("groupThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "message.typing", ctx.person._id)
    await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    const existing = await ctx.db
      .query("groupTyping")
      .withIndex("by_thread_person", (q) => q.eq("threadId", args.threadId).eq("personId", ctx.person._id))
      .unique()
    const expiresAt = Date.now() + GROUP_TYPING_TTL_MS
    if (existing) await ctx.db.patch(existing._id, { expiresAt })
    else await ctx.db.insert("groupTyping", { threadId: args.threadId, personId: ctx.person._id, expiresAt })
    return null
  },
})

/** Retirer MON signal (envoi, champ vidé) — le délai s'en charge sinon. */
export const clearGroupTyping = networkMutation({
  writeBucket: "message.clearTyping",
  minStatus: "en_attente",
  args: { threadId: v.id("groupThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("groupTyping")
      .withIndex("by_thread_person", (q) => q.eq("threadId", args.threadId).eq("personId", ctx.person._id))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

/**
 * Qui écrit, MOI EXCLU, et sans les personnes bloquées. `now` vient du client,
 * arrondi à la seconde (D16) : un `now` mensonger ne montre qu'un signal périmé.
 */
export const listGroupTyping = networkQuery({
  args: { threadId: v.id("groupThreads"), now: v.number() },
  handler: async (ctx, args): Promise<{ personId: Id<"persons">; label: CounterpartLabel }[]> => {
    await requireLiveMembership(ctx, ctx.networkId, args.threadId, ctx.person._id)
    // borné : une ligne au plus par membre, et un fil a au plus le plafond de membres.
    const rows = await ctx.db
      .query("groupTyping")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(GROUP_MEMBERS_MAX)
    const isBlockedWith = blockedCache(ctx, ctx.person._id)
    const profileOf = miniProfileCache(ctx)
    const out: { personId: Id<"persons">; label: CounterpartLabel }[] = []
    for (const row of rows) {
      if (row.expiresAt <= args.now || row.personId === ctx.person._id) continue
      if (await isBlockedWith(row.personId)) continue
      out.push({ personId: row.personId, label: await counterpartOf(ctx, row.personId, profileOf) })
    }
    return out
  },
})

/** Cron : purge les signaux expirés. */
export const purgeExpiredGroupTyping = internalMutation({
  args: {},
  returns: v.object({ purged: v.number() }),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("groupTyping")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(PURGE_BATCH)
    for (const row of expired) await ctx.db.delete(row._id)
    if (expired.length === PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.modules.groups.typing.purgeExpiredGroupTyping, {})
    return { purged: expired.length }
  },
})
