// Dupliqué de socle/convex/modules/reseauPersonnel/follows.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (abonnement PAR RÉSEAU) ; garde d'adhésion par le constructeur, débit sur s'abonner et se désabonner ; `listMyFollows` paginé (D19, il tronquait à 500) ; `myFollowerCount` lu dans un AGRÉGAT (`followerCounts`) au lieu de compter des lignes (R8 : 5 000 abonnés) ; `suggestions` puisées dans l'annuaire DU RÉSEAU (membres découvrables) au lieu de tous les profils (D17), refusées pour un réseau gouverné (annuaire opt-in de la tranche) ; avatar par la garde des fichiers (D05) ; blocage lu sur toute la paire.
/**
 * Abonnements — suivre quelqu'un sans lui demander son accord.
 *
 * ⚠️ Un abonnement N'EST PAS une connexion : asymétrique, unilatéral, il n'ouvre
 * RIEN de plus que ce qui est déjà `public`. Le défaut classique est d'écrire
 * `isConnected || isFollowing` quelque part : l'abonné devient alors un proche.
 * La garde d'audience reste la connexion, évaluée ailleurs.
 */
import type { Badge } from "@antsia/social-domain/badges"
import { TableAggregate } from "@convex-dev/aggregate"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { components } from "../../_generated/api"
import type { DataModel, Id } from "../../_generated/dataModel"
import { fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { badgeValidator } from "../../lib/validators"
import { servableUrl } from "../files/storageGuard"
import { badgesOf } from "../people/persons"
import { notifyPerson } from "../notifications/notify"
import { findPublishedPersonByHandle, isDiscoverablePerson, miniProfileCache } from "../people/miniProfile"
import { acceptedCounterpartIds, isBlockedBetween, isFollowingPerson } from "./graph"

/**
 * Les abonnés d'une personne dans un réseau, comptés par l'agrégat : écrire un
 * abonnement met l'agrégat à jour dans la même transaction, lire le décompte ne
 * balaie rien.
 */
export const followerCounts = new TableAggregate<{ Namespace: string; Key: number; DataModel: DataModel; TableName: "follows" }>(components.followerCounts, {
  namespace: (doc) => `${doc.networkId}:${doc.targetPersonId}`,
  sortKey: (doc) => doc.createdAt,
})

/**
 * S'abonner à une personne du réseau, désignée par son IDENTIFIANT. S'abonner
 * noue un lien : même exigence de découvrabilité qu'une demande de connexion,
 * et le même refus qu'une personne inconnue — blocage compris. Idempotent.
 */
export const follow = networkMutation({
  args: { handle: v.string() },
  returns: v.object({ targetPersonId: v.id("persons"), following: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "follow.toggle", ctx.person._id)
    const target = await findPublishedPersonByHandle(ctx, ctx.networkId, args.handle, { requireDiscoverable: true })
    if (!target) return notFound()
    // On ne s'abonne pas à soi-même : un compteur d'abonnés qui se compte lui-même ment.
    if (target._id === ctx.person._id) return fail("invalidArgument", { field: "handle" })
    if (await isBlockedBetween(ctx, ctx.person._id, target._id)) return notFound()
    if (await isFollowingPerson(ctx, ctx.networkId, ctx.person._id, target._id)) return { targetPersonId: target._id, following: true as const }
    const followId = await ctx.db.insert("follows", { networkId: ctx.networkId, followerPersonId: ctx.person._id, targetPersonId: target._id, createdAt: Date.now() })
    const row = await ctx.db.get(followId)
    if (row) await followerCounts.insert(ctx, row)
    // Un abonnement se dit — il n'engage à rien et n'appelle aucune décision.
    await notifyPerson(ctx, { networkId: ctx.networkId, recipientPersonId: target._id, actorPersonId: ctx.person._id, kind: "new_follower" })
    return { targetPersonId: target._id, following: true as const }
  },
})

/** Se désabonner. Idempotent : ne plus suivre qui l'on ne suit pas est un fait. */
export const unfollow = networkMutation({
  minStatus: "en_attente",
  args: { targetPersonId: v.id("persons") },
  returns: v.object({ following: v.literal(false) }),
  handler: async (ctx, { targetPersonId }) => {
    await enforceRateLimit(ctx, "follow.toggle", ctx.person._id)
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_network_follower_target", (q) => q.eq("networkId", ctx.networkId).eq("followerPersonId", ctx.person._id).eq("targetPersonId", targetPersonId))
      .unique()
    if (existing) {
      await followerCounts.delete(ctx, existing)
      await ctx.db.delete(existing._id)
    }
    return { following: false as const }
  },
})

export type FollowDto = {
  targetPersonId: Id<"persons">
  displayName: string | null
  handle: string | null
  headline: string | null
  avatarUrl: string | null
  badges: Badge[]
  since: number
}

/** Les personnes que JE suis dans le réseau, les plus récentes d'abord (paginé). */
export const paginateMyFollows = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<FollowDto>> => {
    const result = await ctx.db
      .query("follows")
      .withIndex("by_network_follower_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("followerPersonId", ctx.person._id))
      .order("desc")
      .paginate(args.paginationOpts)
    const profileOf = miniProfileCache(ctx)
    const page: FollowDto[] = []
    for (const row of result.page) {
      const person = await profileOf(row.targetPersonId)
      page.push({
        targetPersonId: row.targetPersonId,
        displayName: person.displayName,
        handle: person.handle,
        headline: person.headline,
        avatarUrl: person.avatarUrl,
        badges: person.badges,
        since: row.createdAt,
      })
    }
    return { ...result, page }
  },
})

/**
 * Combien de personnes me suivent dans le réseau. ⚠️ La LISTE de mes abonnés
 * n'est pas exposée : savoir qui suit qui dessine un réseau d'intérêt, ce que
 * le décompte seul ne fait pas.
 */
export const myFollowerCount = networkQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => await followerCounts.count(ctx, { namespace: `${ctx.networkId}:${ctx.person._id}` }),
})

/** Est-ce que je suis cette personne ? — le strict nécessaire au bouton. */
export const isFollowing = networkQuery({
  args: { targetPersonId: v.id("persons") },
  returns: v.boolean(),
  handler: async (ctx, { targetPersonId }) => await isFollowingPerson(ctx, ctx.networkId, ctx.person._id, targetPersonId),
})

/** Peu de suggestions, bien choisies — jamais une page d'annuaire déguisée. */
const SUGGESTIONS_MAX = 5
/** Fenêtre de candidats lue avant filtrage. */
const SUGGESTIONS_SCAN = 40

/**
 * Qui suivre — puisé dans l'annuaire DU RÉSEAU (membres découvrables), et nulle
 * part ailleurs : suggérer quelqu'un qui ne s'est pas exposé serait l'exposer à
 * sa place. Sont écartés : soi, les personnes déjà suivies, les connexions, les
 * blocages. Aucun classement « intelligent » : les arrivées les plus récentes
 * d'abord — un score d'affinité demanderait de mesurer qui fréquente qui.
 * Un réseau GOUVERNÉ par une tranche sert ses propres suggestions (annuaire
 * opt-in) : le chemin générique le refuse.
 */
export const suggestions = networkQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      personId: v.id("persons"),
      handle: v.string(),
      displayName: v.string(),
      headline: v.union(v.string(), v.null()),
      avatarUrl: v.union(v.string(), v.null()),
      badges: v.array(badgeValidator),
    }),
  ),
  handler: async (ctx, args) => {
    if (ctx.network.managedBy !== undefined) return fail("policyRefused")
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? SUGGESTIONS_MAX), 1), SUGGESTIONS_MAX)
    const [candidates, connections] = await Promise.all([
      ctx.db
        .query("peopleDirectory")
        .withIndex("by_network_listed", (q) => q.eq("networkId", ctx.networkId).eq("listed", true))
        .order("desc")
        .take(SUGGESTIONS_SCAN),
      acceptedCounterpartIds(ctx, ctx.networkId, ctx.person._id),
    ])
    const out = []
    for (const row of candidates) {
      if (out.length >= limit) break
      if (row.personId === ctx.person._id || connections.ids.has(row.personId)) continue
      if (await isFollowingPerson(ctx, ctx.networkId, ctx.person._id, row.personId)) continue
      if (await isBlockedBetween(ctx, ctx.person._id, row.personId)) continue
      const person = await ctx.db.get(row.personId)
      if (!person || !isDiscoverablePerson(person) || !person.handle || !person.displayName) continue
      out.push({
        personId: person._id,
        handle: person.handle,
        displayName: person.displayName,
        headline: person.headline ?? null,
        avatarUrl: person.avatarStorageId ? await servableUrl(ctx, person.avatarStorageId) : null,
        badges: await badgesOf(ctx, person._id),
      })
    }
    return out
  },
})
