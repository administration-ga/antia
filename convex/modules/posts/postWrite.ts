// Dupliqué de socle/convex/modules/reseauPersonnel/postWrite.ts @ ad2e7fdc2 — adaptations : réseau et visibilité sur chaque publication ; citations résolues parmi les profils PUBLIÉS et membres actifs du même réseau ; aucun compteur initialisé sur la publication (fragments) ; la cloche des citations arrive avec le module notifications (PA3) ; extensions groupe, page, direct et évènement reportées avec leurs modules.
/**
 * Point d'écriture UNIQUE d'une publication : les invariants de forme y sont
 * tenus pour tous les écrivains, présents et à venir.
 */
import {
  assertGroupAudienceShape,
  assertPageAudienceShape,
  isProfilePublished,
  type PersonalPostAudience,
} from "@antia/social-domain/content"
import type { ContentVisibility } from "@antia/social-domain/network"
import { extractHashtags, extractMentionHandles } from "@antia/social-domain/richText"
import { buildSearchableText } from "@antia/social-domain/searchText"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { getMembership } from "../../lib/access"
import { checked } from "../../lib/errors"

export type PostWriteInput = {
  networkId: Id<"networks">
  authorPersonId: Id<"persons">
  /** Le corps, DÉJÀ validé par l'appelant (`assertPostContent`). */
  body: string
  audience: PersonalPostAudience
  visibility: ContentVisibility
  idempotencyKey?: string
}

/**
 * Les personnes citées, résolues : profil publié, et membre actif du réseau de
 * la publication. Citer quelqu'un ne lui ouvre jamais une porte.
 */
async function resolveMentionedPersonIds(ctx: MutationCtx, networkId: Id<"networks">, body: string): Promise<Id<"persons">[]> {
  const ids: Id<"persons">[] = []
  for (const handle of extractMentionHandles(body)) {
    const person = await ctx.db
      .query("persons")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique()
    if (!person || person.publishedAt === undefined || !isProfilePublished(person)) continue
    const membership = await getMembership(ctx, networkId, person._id)
    if (!membership || membership.status === "suspendue" || membership.status === "partie") continue
    ids.push(person._id)
  }
  return ids
}

export async function writePost(ctx: MutationCtx, input: PostWriteInput): Promise<{ postId: Id<"posts"> }> {
  checked(() => assertGroupAudienceShape({ audience: input.audience, hasGroup: false }))
  checked(() => assertPageAudienceShape({ audience: input.audience, hasPage: false, hasGroup: false, hasShare: false }))

  // Dénormalisés à l'ÉCRITURE : le filtre du fil reste une comparaison de tableau.
  const tags = extractHashtags(input.body)
  const mentionedPersonIds = await resolveMentionedPersonIds(ctx, input.networkId, input.body)

  const now = Date.now()
  const postId = await ctx.db.insert("posts", {
    networkId: input.networkId,
    authorPersonId: input.authorPersonId,
    body: input.body,
    audience: input.audience,
    visibility: input.visibility,
    status: "published",
    ...(tags.length > 0 ? { tags } : {}),
    ...(mentionedPersonIds.length > 0 ? { mentionedPersonIds } : {}),
    searchText: buildSearchableText(input.body, tags.join(" ")),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  return { postId }
}
