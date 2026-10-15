/**
 * Graine SOCIALE de développement — hors production seulement (même double garde
 * que les fondations : argument de confirmation ET déploiement local ou
 * `ANTIA_SEEDS_ALLOWED=true`).
 *
 * Pose une personne de DÉMONSTRATION (profil publié, membre déclarée d'un
 * réseau) et, sur demande, sa relation ACCEPTÉE avec une personne existante
 * désignée par son identifiant public : de quoi éprouver iCom sur un poste de
 * développement sans second compte (conversation, groupe, appel refusé « hors
 * ligne »). La personne de démonstration n'a aucune session : elle ne se
 * connecte jamais, elle reçoit.
 *
 * Idempotente (« chercher puis créer ») : rejouée, elle ne double rien.
 */
import { v } from "convex/values"

import type { Id } from "../_generated/dataModel"
import { internalMutation } from "../_generated/server"
import { assertSeedsAllowed } from "./foundations"

/** Préfixe du sujet d'authentification d'une personne de démonstration (aucune session ne le porte). */
export const DEMO_AUTH_PREFIX = "demo:"

export const demoPerson = internalMutation({
  args: {
    confirmNonProduction: v.string(),
    networkSlug: v.string(),
    handle: v.string(),
    displayName: v.string(),
    connectToHandle: v.optional(v.string()),
  },
  returns: v.object({ personId: v.id("persons"), created: v.boolean(), connected: v.boolean() }),
  handler: async (ctx, args) => {
    assertSeedsAllowed(args.confirmNonProduction)
    const now = Date.now()
    const network = await ctx.db
      .query("networks")
      .withIndex("by_slug", (q) => q.eq("slug", args.networkSlug))
      .unique()
    if (!network) throw new Error(`Graine refusée : réseau « ${args.networkSlug} » introuvable (jouer d'abord seeds/foundations:run).`)

    const existing = await ctx.db
      .query("persons")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique()
    if (existing && !existing.authUserId.startsWith(DEMO_AUTH_PREFIX)) {
      throw new Error(`Graine refusée : l'identifiant « ${args.handle} » appartient à une vraie personne.`)
    }
    const personId: Id<"persons"> =
      existing?._id ??
      (await ctx.db.insert("persons", {
        authUserId: `${DEMO_AUTH_PREFIX}${args.handle}`,
        handle: args.handle,
        displayName: args.displayName,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }))

    const membership = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", network._id).eq("personId", personId))
      .unique()
    if (!membership) {
      await ctx.db.insert("networkMemberships", { networkId: network._id, personId, status: "declaree", role: "member", joinedAt: now, statusChangedAt: now })
    }

    let connected = false
    if (args.connectToHandle !== undefined) {
      const other = await ctx.db
        .query("persons")
        .withIndex("by_handle", (q) => q.eq("handle", args.connectToHandle))
        .unique()
      if (!other) throw new Error(`Graine refusée : « ${args.connectToHandle} » introuvable.`)
      const [low, high] = personId < other._id ? [personId, other._id] : [other._id, personId]
      const pair = await ctx.db
        .query("connections")
        .withIndex("by_network_pair", (q) => q.eq("networkId", network._id).eq("personIdLow", low).eq("personIdHigh", high))
        .unique()
      if (!pair) {
        await ctx.db.insert("connections", {
          networkId: network._id,
          personIdLow: low,
          personIdHigh: high,
          requestedByPersonId: personId,
          recipientPersonId: other._id,
          status: "accepted",
          requestedAt: now,
          respondedAt: now,
          updatedAt: now,
        })
      }
      connected = true
    }
    return { personId, created: existing === null, connected }
  },
})
