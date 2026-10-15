// Dupliqué de socle/convex/modules/reseauPersonnel/postWrite.ts @ ad2e7fdc2 — adaptations : réseau, visibilité et `onRoot` (lisible depuis la racine) dénormalisés à l'écriture ; portée et pays ; citations résolues parmi les profils PUBLIÉS et membres du réseau de la publication (`resolveMentionedPersonIds`) ; cloche des citations par la porte unique (`notifyPerson`) avec la règle « qui peut être sonné » (`mentionCanSeePost`) — au plus 10 citations par publication (`MENTION_MAX_PER_POST`), aucune diffusion différée nécessaire ; partage compté dans l'agrégat ; aucun compteur sur la publication ; extensions page, direct et évènement reportées avec leurs modules ; branche organisation (l. 187-198) retirée.
/**
 * L'ÉCRITURE d'une publication — le geste commun à tous les écrivains,
 * présents (`posts.publish`) et à venir (annonce d'un direct, d'un évènement,
 * publication de page).
 *
 * Ce helper NE VALIDE PAS le contenu : le corps arrive déjà jugé, les médias
 * déjà vérifiés contre le stockage, le partage déjà passé par sa garde, le
 * groupe déjà vérifié. Il tient ce qui doit rester identique pour tous :
 * l'INVARIANT de forme (groupe ⟺ audience `group`), la dénormalisation (tags,
 * texte indexé, citations, lecture depuis la racine), le décompte du partage,
 * et la cloche des citations — avec la règle de visibilité (on ne sonne jamais
 * vers un lien qui refuse).
 */
import { assertGroupAudienceShape, assertPageAudienceShape, type PersonalPostAudience } from "@antia/social-domain/content"
import type { ContentVisibility } from "@antia/social-domain/network"
import { extractHashtags } from "@antia/social-domain/richText"
import { buildSearchableText } from "@antia/social-domain/searchText"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked } from "../../lib/errors"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"
import type { StoredMedia } from "../media/media"
import { notifyPerson } from "../notifications/notify"
import { resolveMentionedPersonIds } from "../people/miniProfile"
import { isLiveThematicGroupMember } from "../thematicGroups/access"
import { recordShare } from "./counters"

export type PostWriteInput = {
  network: Doc<"networks">
  authorPersonId: Id<"persons">
  /** Le corps, DÉJÀ validé par l'appelant (`assertPostContent`). */
  body: string
  audience: PersonalPostAudience
  visibility: ContentVisibility
  /** Le groupe visé — l'appartenance vivante de l'auteur est DÉJÀ vérifiée. */
  groupId?: Id<"thematicGroups">
  /** Médias DÉJÀ vérifiés contre le stockage (métadonnées réelles). */
  media?: StoredMedia[]
  /** Partage DÉJÀ passé par la garde de visibilité et `assertShareable`. */
  sharedPostId?: Id<"posts">
  /** Portée et pays DÉJÀ jugés contre le réseau (`assertPostReach`). */
  reach?: string
  country?: string
  idempotencyKey?: string
}

/** Lisible depuis la racine : née à la racine, ou `root`. */
export function isOnRoot(network: Pick<Doc<"networks">, "kind">, visibility: ContentVisibility): boolean {
  return network.kind === "root" || visibility === "root"
}

/**
 * La personne citée voit-elle cette publication ? La règle de la lecture,
 * appliquée AVANT de sonner : `public` pour tous les membres, `connections`
 * pour les connexions de l'auteur dans le réseau, `group` pour les membres
 * vivants non bloqués du groupe. Le blocage et l'adhésion sont, en plus,
 * refusés par la porte (`notifyPerson`). Partagée par l'écriture et l'édition.
 */
export async function mentionCanSeePost(
  ctx: Pick<MutationCtx, "db">,
  post: { networkId: Id<"networks">; authorPersonId: Id<"persons">; audience: PersonalPostAudience; groupId?: Id<"thematicGroups"> },
  mentionedPersonId: Id<"persons">,
): Promise<boolean> {
  if (mentionedPersonId === post.authorPersonId) return true
  if (post.audience === "public") return true
  if (post.audience === "group") {
    if (post.groupId === undefined) return false
    const [isMember, isBlocked] = await Promise.all([
      isLiveThematicGroupMember(ctx, post.groupId, mentionedPersonId),
      isBlockedBetween(ctx, mentionedPersonId, post.authorPersonId),
    ])
    return isMember && !isBlocked
  }
  return await isConnectedTo(ctx, post.networkId, mentionedPersonId, post.authorPersonId)
}

/** Sonne les personnes citées qui VOIENT la publication. */
export async function notifyMentions(
  ctx: MutationCtx,
  post: { _id: Id<"posts">; networkId: Id<"networks">; authorPersonId: Id<"persons">; audience: PersonalPostAudience; groupId?: Id<"thematicGroups"> },
  personIds: readonly Id<"persons">[],
): Promise<void> {
  for (const personId of personIds) {
    if (!(await mentionCanSeePost(ctx, post, personId))) continue
    await notifyPerson(ctx, { networkId: post.networkId, recipientPersonId: personId, actorPersonId: post.authorPersonId, kind: "mention", subject: { post: post._id } })
  }
}

/**
 * Insère la publication, compte le partage, prévient les personnes citées.
 *
 * ⚠️ Un partage sans corps n'indexe RIEN — surtout pas le texte de l'original :
 * chaîne VIDE, jamais `undefined` (une chaîne vide n'apparie aucun terme).
 */
export async function writePost(ctx: MutationCtx, input: PostWriteInput): Promise<{ postId: Id<"posts"> }> {
  checked(() => assertGroupAudienceShape({ audience: input.audience, hasGroup: input.groupId !== undefined }))
  checked(() =>
    assertPageAudienceShape({ audience: input.audience, hasPage: false, hasGroup: input.groupId !== undefined, hasShare: input.sharedPostId !== undefined }),
  )

  // Dénormalisés à l'ÉCRITURE : le filtre du fil reste une comparaison de tableau.
  const tags = extractHashtags(input.body)
  const mentionedPersonIds = (await resolveMentionedPersonIds(ctx, input.network._id, input.body)).filter((id) => id !== input.authorPersonId)

  const now = Date.now()
  const doc = {
    networkId: input.network._id,
    authorPersonId: input.authorPersonId,
    body: input.body,
    audience: input.audience,
    visibility: input.visibility,
    onRoot: isOnRoot(input.network, input.visibility),
    status: "published" as const,
    ...(input.media && input.media.length > 0 ? { media: input.media } : {}),
    ...(input.sharedPostId ? { sharedPostId: input.sharedPostId } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    ...(input.reach !== undefined ? { reach: input.reach } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(mentionedPersonIds.length > 0 ? { mentionedPersonIds } : {}),
    searchText: buildSearchableText(input.body, tags.join(" ")),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const postId = await ctx.db.insert("posts", doc)
  await recordShare(ctx, { _id: postId, ...(input.sharedPostId ? { sharedPostId: input.sharedPostId } : {}), publishedAt: now })
  await notifyMentions(ctx, { _id: postId, ...doc }, mentionedPersonIds)
  return { postId }
}
