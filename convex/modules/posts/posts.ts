// Dupliqué de socle/convex/modules/reseauPersonnel/posts.ts (l. 392-470, 604-870 et la portée « recents » de myFeed) @ ad2e7fdc2 — adaptations : tranche verticale — publier un texte et lire le fil du réseau (portée « Récents ») ; adhésion exigée par le constructeur (`networkMutation`/`networkQuery`) ; visibilité `network`/`root` (`isVisibleTo`) avant la règle d'audience ; auteur projeté depuis `persons` avec ses badges calculés ; réactions lues dans les fragments ; limitation de débit et idempotence. Médias, partages, édition, retrait, épingle, recherche, mur et portée « Pour vous » suivent en PA3 avec le graphe.
/**
 * Publications d'un réseau : publier, lire le fil.
 */
import type { Badge } from "@antia/social-domain/badges"
import { assertPostContent, type PersonalPostAudience } from "@antia/social-domain/content"
import { effectiveVisibility } from "@antia/social-domain/network"
import { isVisibleTo } from "@antia/social-domain/visibility"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { checked } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import {
  badgeValidator,
  contentVisibilityValidator,
  postAudienceValidator,
  reachAudienceValidator,
  reactionCountsValidator,
  reactionKindValidator,
} from "../../lib/validators"
import { badgesOf } from "../people/persons"
import { readReactionCounts } from "./counters"
import { writePost } from "./postWrite"

/** Taille maximale d'une page du fil. */
export const FEED_PAGE_MAX = 30

const authorValidator = v.object({
  personId: v.id("persons"),
  handle: v.union(v.string(), v.null()),
  displayName: v.union(v.string(), v.null()),
  badges: v.array(badgeValidator),
})

const feedItemValidator = v.object({
  _id: v.id("posts"),
  body: v.string(),
  audience: postAudienceValidator,
  visibility: contentVisibilityValidator,
  publishedAt: v.number(),
  isMine: v.boolean(),
  author: authorValidator,
  reactions: v.object({
    counts: reactionCountsValidator,
    total: v.number(),
    mine: v.union(reactionKindValidator, v.null()),
  }),
})

type Author = { personId: Id<"persons">; handle: string | null; displayName: string | null; badges: Badge[] }

/** Projection publique de l'auteur : profil retiré = nom neutre (l'écran l'affiche comme tel). */
async function authorOf(ctx: QueryCtx, personId: Id<"persons">, cache: Map<string, Author>): Promise<Author> {
  const cached = cache.get(personId)
  if (cached) return cached
  const person = await ctx.db.get(personId)
  const published = person !== null && person.publishedAt !== undefined && person.withdrawnAt === undefined
  const author: Author = {
    personId,
    handle: published ? (person.handle ?? null) : null,
    displayName: published ? (person.displayName ?? null) : null,
    badges: published ? await badgesOf(ctx, personId) : [],
  }
  cache.set(personId, author)
  return author
}

/**
 * Publier un texte dans le réseau. `alsoOnRoot` est le geste explicite « publier
 * aussi sur ANTIA », qui ne vaut que pour une audience publique dans un réseau
 * fermé (`effectiveVisibility`).
 */
export const publish = networkMutation({
  minStatus: "declaree",
  args: {
    body: v.string(),
    audience: v.optional(reachAudienceValidator),
    alsoOnRoot: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  returns: v.object({ postId: v.id("posts") }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "post.publish", ctx.person._id)
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_author_and_idempotencyKey", (q) => q.eq("authorPersonId", ctx.person._id).eq("idempotencyKey", args.idempotencyKey))
        .unique()
      if (existing && existing.networkId === ctx.networkId) return { postId: existing._id }
    }
    const body = checked(() => assertPostContent({ body: args.body, mediaCount: 0, isShare: false }))
    const audience: PersonalPostAudience = args.audience ?? "public"
    const visibility = effectiveVisibility({
      networkKind: ctx.network.kind,
      audienceIsPublic: audience === "public",
      authorRequestedRoot: args.alsoOnRoot ?? false,
      ruleVisibility: ctx.network.defaultVisibility,
    })
    return await writePost(ctx, {
      networkId: ctx.networkId,
      authorPersonId: ctx.person._id,
      body,
      audience,
      visibility,
      ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
    })
  },
})

/**
 * Le fil du réseau, du plus récent au plus ancien (portée « Récents ») : tout
 * ce que le lecteur a le DROIT de voir. Chaque ligne repasse la garde
 * (`isVisibleTo`) : une page peut donc rendre moins de lignes que demandé, le
 * curseur continue. Le graphe (connexions, abonnements) arrive en PA3 : d'ici
 * là, une publication réservée aux connexions n'est lue que par son auteur.
 */
export const feed = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(feedItemValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("posts")
      .withIndex("by_network_status_publishedAt", (q) => q.eq("networkId", ctx.networkId).eq("status", "published"))
      .order("desc")
      .paginate({ ...paginationOpts, numItems: Math.min(Math.max(1, paginationOpts.numItems), FEED_PAGE_MAX) })

    const authors = new Map<string, Author>()
    const page = []
    for (const post of result.page) {
      const isMine = post.authorPersonId === ctx.person._id
      const visible = isVisibleTo({
        audience: post.audience,
        status: post.status,
        visibility: post.visibility,
        isAuthor: isMine,
        isConnected: false,
        isGroupMember: false,
        isBlockedWithAuthor: false,
        isMemberOfPostNetwork: true,
        isMemberOfRoot: true,
      })
      if (!visible) continue
      const mine = await ctx.db
        .query("postReactions")
        .withIndex("by_post_and_person", (q) => q.eq("postId", post._id).eq("personId", ctx.person._id))
        .unique()
      page.push({
        _id: post._id,
        body: post.body,
        audience: post.audience,
        visibility: post.visibility,
        publishedAt: post.publishedAt,
        isMine,
        author: await authorOf(ctx, post.authorPersonId, authors),
        reactions: { ...(await readReactionCounts(ctx, post._id)), mine: mine?.kind ?? null },
      })
    }
    return { ...result, page }
  },
})
