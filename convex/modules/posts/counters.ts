// Dupliqué de socle/convex/modules/reseauPersonnel/counters.ts @ ad2e7fdc2 — adaptations : lit et écrit des FRAGMENTS (`postReactionShards`) au lieu des champs dénormalisés sur la publication (dette D01 du document 02) ; une personne retombe toujours sur le même fragment, si bien que deux personnes qui réagissent en même temps n'écrivent presque jamais le même document.
import type { PersonalReactionKind } from "@antia/social-domain/content"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"

/** Nombre de fragments d'un compteur de réactions. */
export const REACTION_SHARDS = 8

export type ReactionCounts = Record<PersonalReactionKind, number>

export const EMPTY_REACTION_COUNTS: ReactionCounts = { like: 0, bravo: 0, soutien: 0, instructif: 0 }

/** Le fragment d'une personne : stable (hachage FNV-1a de son identifiant). */
export function shardOf(personId: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < personId.length; index += 1) {
    hash ^= personId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % REACTION_SHARDS
}

/** Somme des fragments d'une publication. */
export async function readReactionCounts(ctx: QueryCtx, postId: Id<"posts">): Promise<{ counts: ReactionCounts; total: number }> {
  const shards = await ctx.db
    .query("postReactionShards")
    .withIndex("by_post_and_shard", (q) => q.eq("postId", postId))
    .take(REACTION_SHARDS)
  const counts = { ...EMPTY_REACTION_COUNTS }
  for (const shard of shards) {
    counts.like += shard.like
    counts.bravo += shard.bravo
    counts.soutien += shard.soutien
    counts.instructif += shard.instructif
  }
  return { counts, total: counts.like + counts.bravo + counts.soutien + counts.instructif }
}

/** Ajoute (+1) ou retire (−1) une réaction du genre donné dans le fragment de la personne. */
export async function applyReactionDelta(
  ctx: MutationCtx,
  postId: Id<"posts">,
  personId: Id<"persons">,
  kind: PersonalReactionKind,
  delta: 1 | -1,
): Promise<void> {
  const shard = shardOf(personId)
  const row = await ctx.db
    .query("postReactionShards")
    .withIndex("by_post_and_shard", (q) => q.eq("postId", postId).eq("shard", shard))
    .unique()
  if (row) {
    await ctx.db.patch(row._id, { [kind]: Math.max(0, row[kind] + delta) })
    return
  }
  if (delta < 0) return
  await ctx.db.insert("postReactionShards", { postId, shard, ...EMPTY_REACTION_COUNTS, [kind]: 1 })
}
