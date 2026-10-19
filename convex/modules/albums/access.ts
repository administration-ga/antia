// Dupliqué de socle/convex/modules/reseauAlbums/access.ts @ ad2e7fdc2 — adaptations : un album se lit DANS SON RÉSEAU (celui de la fonction appelée ; ailleurs, ou en cours de suppression, il est introuvable) ; connexion lue dans ce réseau, blocage sur toute la paire (helpers du graphe du moteur) ; photos servies par la garde des fichiers (`resolveFileDelivery`, D05 : plus de `getUrl` brut) — une photo retenue (analyse en cours, bloquée) est OMISE pour les autres et montrée RETENUE à son propriétaire ; refus indistinct à code (`notFound`) au lieu du message.
/**
 * LE point de passage : voir un album. Liste, détail, vignette, lien direct :
 * un seul chemin, donc une seule règle.
 *
 * ANTI-ÉNUMÉRATION : album inconnu, brouillon d'un tiers, album réservé aux
 * connexions de quelqu'un d'autre, album d'un autre réseau — le MÊME refus.
 *
 * Aucune fonction Convex ici : c'est une garde, pas une API.
 */
import { isAlbumVisibleTo } from "@antsia/social-domain/albums"

import { canReadModeratedContent } from "../moderation/policy"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { resolveFileDelivery, type WithheldCode, withheldCodeOf } from "../files/storageGuard"
import { isBlockedBetween, isConnectedTo } from "../graph/graph"

type ReadCtx = Pick<QueryCtx, "db">
type UrlCtx = Pick<QueryCtx, "db" | "storage">

/** Qui lit, et depuis quel réseau. */
export type AlbumReader = { personId: Id<"persons">; networkId: Id<"networks"> }

/**
 * Le contexte de lecture d'un album, RELU à l'acte : une connexion rompue
 * referme aussitôt la galerie qu'elle ouvrait, sans révocation. Le propriétaire
 * ne paie aucune des deux lectures.
 */
export async function albumReadContext(
  ctx: ReadCtx,
  album: Pick<Doc<"albums">, "ownerPersonId" | "networkId">,
  readerPersonId: Id<"persons">,
): Promise<{ isOwner: boolean; isConnected: boolean; isBlocked: boolean }> {
  if (album.ownerPersonId === readerPersonId) return { isOwner: true, isConnected: false, isBlocked: false }
  const [isConnected, isBlocked] = await Promise.all([
    isConnectedTo(ctx, album.networkId, readerPersonId, album.ownerPersonId),
    isBlockedBetween(ctx, readerPersonId, album.ownerPersonId),
  ])
  return { isOwner: false, isConnected, isBlocked }
}

/** Ce lecteur peut-il voir cet album MAINTENANT, depuis ce réseau ? */
export async function canSeeAlbum(ctx: ReadCtx, album: Doc<"albums">, reader: AlbumReader): Promise<boolean> {
  if (album.networkId !== reader.networkId || album.deletingAt !== undefined) return false
  if (!(await canReadModeratedContent(ctx, "album", album._id, reader.personId))) return false
  const context = await albumReadContext(ctx, album, reader.personId)
  return isAlbumVisibleTo({ audience: album.audience, status: album.status, ...context })
}

/**
 * Ce que l'écran reçoit d'une photo. ALLOWLIST : ni `storageId`, ni poids ; l'URL
 * par la garde, ou la retenue (pour le propriétaire seul).
 */
export type AlbumItemDto = {
  itemId: Id<"albumItems">
  url: string | null
  withheld: WithheldCode | null
  mimeType: string
  width: number | null
  height: number | null
  caption: string | null
  altText: string | null
  position: number
}

/**
 * Résout les photos d'un album, À N'APPELER QU'APRÈS LA GARDE. Une photo que la
 * garde retient est omise pour les autres (une galerie ne montre pas un trou),
 * et rendue RETENUE à son propriétaire (il voit « analyse en cours »).
 */
export async function resolveAlbumItemDtos(ctx: UrlCtx, items: readonly Doc<"albumItems">[], isOwner: boolean): Promise<AlbumItemDto[]> {
  const resolved: AlbumItemDto[] = []
  for (const item of items) {
    const delivery = await resolveFileDelivery(ctx, item.media.storageId)
    if (delivery.url === null && !isOwner) continue
    resolved.push({
      itemId: item._id,
      url: delivery.url,
      withheld: withheldCodeOf(delivery.scan),
      mimeType: item.media.mimeType,
      width: item.media.width ?? null,
      height: item.media.height ?? null,
      caption: item.caption ?? null,
      altText: item.altText ?? null,
      position: item.position,
    })
  }
  return resolved
}
