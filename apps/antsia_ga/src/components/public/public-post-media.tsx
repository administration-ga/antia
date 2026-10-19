"use client"

import type { PostMediaDto } from "@antsia/social-contracts/media"
// P18b (F03) : le lecteur seul, par son point d'entrée étroit — jamais le
// barillet `reseau-personnel` (page réseau, profils, groupes, composeur…).
import { PostMedia } from "@antsia/social-features/features/reseau-personnel/post-media-entry"

/** Même lecteur que le fil, alimenté uniquement par la projection publique autorisée. */
export function PublicPostMedia({ media }: { media: readonly PostMediaDto[] }) {
  return <PostMedia media={media} presentation="media" />
}
