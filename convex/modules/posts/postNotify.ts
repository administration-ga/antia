/**
 * La cloche À PROPOS d'une publication — on ne sonne jamais vers un lien qui
 * refuse.
 *
 * Le réseau de la cloche est celui DEPUIS lequel la personne peut ouvrir la
 * publication : son réseau d'origine si elle en est membre active, sinon la
 * racine pour une publication lisible de la racine. La garde de lecture est
 * rejouée pour CE lecteur, au moment de sonner ; la porte (`notifyPerson`)
 * refuse encore soi-même, le non-membre et le blocage.
 *
 * Aucune fonction Convex ici.
 */
import type { NotificationKind } from "@antsia/social-domain/notifications"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { getRootNetwork, isActiveMember } from "../../lib/access"
import { notifyPerson } from "../notifications/notify"
import { canSeePostDoc } from "./access"

/** Le réseau depuis lequel cette personne peut ouvrir la publication, ou `null`. */
export async function openingNetworkFor(ctx: Pick<QueryCtx, "db">, post: Doc<"posts">, personId: Id<"persons">): Promise<Doc<"networks"> | null> {
  const home = await ctx.db.get(post.networkId)
  if (home && (await isActiveMember(ctx, home._id, personId))) return home
  if (post.onRoot !== true) return null
  const root = await getRootNetwork(ctx)
  return root && root._id !== post.networkId && (await isActiveMember(ctx, root._id, personId)) ? root : null
}

/** Sonne une personne à propos d'une publication — seulement si elle peut l'ouvrir, d'où elle peut l'ouvrir. */
export async function notifyAboutPost(
  ctx: MutationCtx,
  post: Doc<"posts">,
  args: { recipientPersonId: Id<"persons">; actorPersonId: Id<"persons">; kind: NotificationKind },
): Promise<void> {
  if (args.recipientPersonId === args.actorPersonId) return
  const network = await openingNetworkFor(ctx, post, args.recipientPersonId)
  if (!network || !(await canSeePostDoc(ctx, { personId: args.recipientPersonId, network }, post))) return
  await notifyPerson(ctx, { networkId: network._id, recipientPersonId: args.recipientPersonId, actorPersonId: args.actorPersonId, kind: args.kind, subject: { post: post._id } })
}
