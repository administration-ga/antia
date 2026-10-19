/** DG-023 : garde vivante de galerie, indépendante des écrivains et de posts/access. */
import { isAssociationEventGalleryOpen } from "../diaspora/associationEventRules"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { isDiasporaNetwork } from "../diaspora/facts"
import { readablePageOrNull } from "../pages/access"
import { pageEventAccess } from "./pageEventAccess"

type ReadCtx = Pick<QueryCtx, "db">
export interface ReadableGalleryEvent {
  readonly event: Doc<"events">
  readonly page: Doc<"pages">
  readonly canManage: boolean
}

/** La fin peut être future pour afficher l'entrée ; l'annulation est réservée au nettoyage. */
export async function readableGalleryEvent(ctx: ReadCtx, networkId: Id<"networks">, eventId: Id<"events">, personId: Id<"persons">, options: { readonly allowCancelled?: boolean } = {}): Promise<ReadableGalleryEvent | null> {
  const network = await ctx.db.get(networkId)
  if (!isDiasporaNetwork(network) || !(await isActiveMember(ctx, networkId, personId))) return null
  const person = await ctx.db.get(personId)
  if (!person || person.erasedAt !== undefined || person.deletionRequestedAt !== undefined) return null
  const event = await ctx.db.get(eventId)
  if (!event || event.networkId !== networkId || !event.organizerPageId || event.organizerPersonId !== undefined || (!options.allowCancelled && event.status !== "scheduled")) return null
  // La page doit être globalement lisible, sans exception de signataire pour un masque collectif.
  const page = await readablePageOrNull(ctx, network, event.organizerPageId)
  if (!page || page.networkId !== networkId || page.ownerKind !== "association") return null
  const access = await pageEventAccess(ctx, event, personId)
  return access?.moderation === "published" ? { event, page, canManage: access.canManage } : null
}

export type PageEventGalleryPost = {
  readonly networkId: Id<"networks">
  readonly pageId?: Id<"pages">
  readonly pageEventGalleryId?: Id<"events">
  readonly visibility?: string
  readonly onRoot?: boolean
  readonly audience?: string
  readonly groupId?: Id<"thematicGroups">
  readonly sharedPostId?: Id<"posts">
}

/** Les lignes historiques sans rattachement gardent exactement leur garde existante. */
export async function canReadPageEventGalleryPost(ctx: ReadCtx, post: PageEventGalleryPost, personId: Id<"persons">, readingNetworkId: Id<"networks">): Promise<boolean> {
  if (post.pageEventGalleryId === undefined) return true
  if (readingNetworkId !== post.networkId || post.visibility !== "network" || post.onRoot === true || !post.pageId || post.audience !== "public" || post.groupId !== undefined || post.sharedPostId !== undefined) return false
  const found = await readableGalleryEvent(ctx, post.networkId, post.pageEventGalleryId, personId)
  return found !== null && found.page._id === post.pageId && isAssociationEventGalleryOpen(found.event, Date.now())
}
