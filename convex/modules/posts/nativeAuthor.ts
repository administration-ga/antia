/** Les publications natives gardent leur auteur ; un reflet de page n'en invente aucun. */
import type { Doc, Id } from "../../_generated/dataModel"
import { notFound } from "../../lib/errors"

type PostAuthorship = { authorPersonId?: Id<"persons">; federationSource?: unknown }
export type NativePersonAuthoredPost = Doc<"posts"> & { authorPersonId: Id<"persons">; federationSource?: undefined }

export function hasNativePostAuthor<T extends PostAuthorship>(post: T): post is T & { authorPersonId: Id<"persons">; federationSource?: undefined } {
  return post.authorPersonId !== undefined && post.federationSource === undefined
}

/** Les gestes personnels ne peuvent jamais modifier un contenu sous autorité fédérée. */
export function requireNativePostAuthor(post: Doc<"posts">): NativePersonAuthoredPost {
  if (!hasNativePostAuthor(post)) return notFound()
  return post
}
