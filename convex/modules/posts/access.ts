// Dupliqué de socle/convex/modules/reseauPersonnel/access.ts @ ad2e7fdc2 — adaptations : CONTEXTE DE LECTURE — une publication se lit dans son réseau, ou depuis la racine si elle est `root` (une publication `network` de DIASPORALE n'est rendue par aucune lecture de la racine, R4) ; garde `isVisibleTo` du moteur (réseau, blocage, audience) ; le BLOCAGE l'emporte sur toute audience (cahier §12.3) et se lit sur toute la paire ; connexion lue dans le réseau de la publication, et seulement pour l'audience qui la demande ; branches page/organisation (l. 97-106, 135-140) et `isPlatformAccount` retirées (pages au lot 13) ; refus indistinct par code.
/**
 * LE point de passage : voir une publication.
 *
 * Toute action sur une publication passe par ici — lire, réagir, commenter,
 * marquer, partager. Un seul chemin, donc une seule règle.
 *
 * ANTI-ÉNUMÉRATION. Publication inconnue, retirée, réservée, hors du réseau
 * lu, d'un auteur bloqué : toujours le MÊME refus (`notFound`).
 *
 * Aucune fonction Convex ici : c'est une garde, pas une API.
 */
import { isVisibleTo } from "@antia/social-domain/visibility"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"
import { isLiveThematicGroupMember } from "../thematicGroups/access"

type ReadCtx = Pick<QueryCtx, "db">

/**
 * Qui lit, et DEPUIS quel réseau (celui de la fonction appelée). L'appelant
 * garantit l'adhésion active du lecteur à ce réseau (constructeur borné).
 */
export type ReaderContext = { personId: Id<"persons">; network: Doc<"networks"> }

/** Une publication se lit-elle DEPUIS ce réseau ? Le sien, ou la racine pour une publication `root`. */
export function isInReadingContext(post: Doc<"posts">, network: Doc<"networks">): boolean {
  if (post.networkId === network._id) return true
  return network.kind === "root" && post.visibility === "root"
}

/**
 * LA règle, sur une ligne déjà lue. Les liens sont relus À L'ACTE, jamais mis
 * en cache sur la publication : rompre une connexion, quitter un groupe ou
 * bloquer referme aussitôt ce qu'ils ouvraient, sans rien réécrire.
 */
export async function canSeePostDoc(ctx: ReadCtx, reader: ReaderContext, post: Doc<"posts">): Promise<boolean> {
  if (!isInReadingContext(post, reader.network)) return false
  const isAuthor = post.authorPersonId === reader.personId
  const isBlockedWithAuthor = isAuthor ? false : await isBlockedBetween(ctx, reader.personId, post.authorPersonId)
  const isConnected = !isAuthor && post.audience === "connections" ? await isConnectedTo(ctx, post.networkId, reader.personId, post.authorPersonId) : false
  const isGroupMember =
    !isAuthor && post.audience === "group" && post.groupId !== undefined ? await isLiveThematicGroupMember(ctx, post.groupId, reader.personId) : false
  return isVisibleTo({
    audience: post.audience,
    status: post.status,
    visibility: post.visibility,
    isAuthor,
    isConnected,
    isGroupMember,
    isBlockedWithAuthor,
    // Le contexte de lecture est tranché ci-dessus ; la garde du réseau le reconfirme.
    isMemberOfPostNetwork: post.networkId === reader.network._id,
    isMemberOfRoot: reader.network.kind === "root",
  })
}

/** Résout une publication ET vérifie qu'on a le droit de la voir MAINTENANT ; refus indistinct sinon. */
export async function assertVisiblePost(ctx: ReadCtx, reader: ReaderContext, postId: Id<"posts">): Promise<Doc<"posts">> {
  const post = await ctx.db.get(postId)
  if (!post || !(await canSeePostDoc(ctx, reader, post))) return notFound()
  return post
}

/**
 * La MÊME règle, posée en question : on ne notifie jamais quelqu'un à propos
 * d'un contenu qu'il ne peut pas ouvrir.
 */
export async function canSeePost(ctx: ReadCtx, reader: ReaderContext, postId: Id<"posts">): Promise<boolean> {
  const post = await ctx.db.get(postId)
  return post !== null && (await canSeePostDoc(ctx, reader, post))
}
