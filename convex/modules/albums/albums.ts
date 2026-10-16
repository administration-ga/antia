// Dupliqué de socle/convex/modules/reseauAlbums/albums.ts @ ad2e7fdc2 — adaptations : albums PAR RÉSEAU (créés, remplis, lus et listés dans le réseau de la fonction appelée ; ailleurs, introuvables ; une clé rejouée dans un autre réseau est refusée) ; adhésion par le constructeur au lieu d'`assertNotSuspended` (préparer : membre même en attente ; publier : membre déclaré) ; propriétaire en personne ; photos par la garde des fichiers (usage `album_image`, source `album` ; D05 : couverture et galerie servies par `resolveFileDelivery`, photo retenue montrée au seul propriétaire) ; couverture sans balayage (préférence toujours valide, sinon la première photo : une lecture au lieu de 240 par album, dette de performance de l'annexe A3) ; retirer une photo la SUPPRIME et purge son blob et sa ligne d'analyse (plus de tombe) ; supprimer un album le rend introuvable aussitôt et purge photos, blobs et lignes d'analyse PAR LOTS (D09 : zéro orphelin) ; cloche des abonnés à la PREMIÈRE publication, par la diffusion par lots, re-gardée ; débit sur les dix mutations (D14) ; refus à code (`notFound`, règles du domaine) ; `listMine`/`listForPerson` → `paginateMyAlbums`/`paginatePersonAlbums`.
/**
 * ALBUMS d'un réseau — le parcours, dans l'ordre où il se joue : `create`
 * (brouillon PRIVÉ) → `addItems` (idempotent par photo, donc reprise exacte) →
 * `setCaption` / `reorder` / `setCover` → `publish` (le seul geste qui rend
 * visible) → `withdraw` / `remove`.
 *
 * TROIS invariants :
 *  1. la propriété se vérifie dans le handler (`ownAlbum`) — l'album d'autrui
 *     rend le refus indistinct ;
 *  2. la provenance d'une photo est un dépôt NEUF de son propriétaire, relu au
 *     stockage (`verifyDeclaredMedia`) : aucun identifiant deviné n'entre ;
 *  3. aucun identifiant de stockage ne sort d'un DTO ; les URLs sont résolues
 *     APRÈS la garde, à chaque lecture, par la garde des fichiers.
 */
import {
  ALBUM_ITEMS_MAX,
  ALBUM_ITEMS_SCAN_MAX,
  ALBUM_PAGE_MAX,
  type AlbumAudience,
  type AlbumStatus,
  assertAlbumAltText,
  assertAlbumCapacity,
  assertAlbumCaption,
  assertAlbumDescription,
  assertAlbumMedia,
  assertAlbumPublishable,
  assertAlbumTitle,
  assertAlbumWithdrawable,
  nextPosition,
  reorderPositions,
} from "@antsia/social-domain/albums"
import { paginationOptsValidator, type PaginationResult } from "convex/server"
import { v } from "convex/values"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { checked, fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { reachAudienceValidator } from "../../lib/validators"
import { findScanByStorageId } from "../files/admission"
import { purgeStoredFile } from "../files/purge"
import { resolveFileDelivery, type WithheldCode, withheldCodeOf } from "../files/storageGuard"
import { isBlockedBetween } from "../graph/graph"
import { verifyDeclaredMedia } from "../media/media"
import { enqueueFanout } from "../notifications/fanout"
import { findPublishedPersonByHandle, miniProfileCache } from "../people/miniProfile"
import { type AlbumItemDto, canSeeAlbum, resolveAlbumItemDtos } from "./access"
import { albumDeclaredItemValidator } from "./validators"

type ReadCtx = Pick<QueryCtx, "db" | "storage">

/** Photos purgées par transaction quand un album est supprimé ; un lot plein planifie la suite. */
export const ALBUM_PURGE_BATCH = 30

const clampPage = (opts: { numItems: number; cursor: string | null }) => ({ ...opts, numItems: Math.min(Math.max(Math.trunc(opts.numItems), 1), ALBUM_PAGE_MAX) })

// ═══════════════════════════════════════════════════════════════
// Lectures internes bornées
// ═══════════════════════════════════════════════════════════════

/** Les photos d'un album, dans l'ordre, en UNE lecture bornée (plus de tombe : la borne n'est jamais atteinte). */
async function albumItems(ctx: Pick<QueryCtx, "db">, albumId: Id<"albums">): Promise<Doc<"albumItems">[]> {
  return await ctx.db
    .query("albumItems")
    .withIndex("by_album_position", (q) => q.eq("albumId", albumId))
    .order("asc")
    .take(ALBUM_ITEMS_SCAN_MAX)
}

/** MON album, vivant, dans ce réseau — sinon le refus indistinct (celui d'autrui comme l'inventé). */
async function ownAlbum(ctx: Pick<QueryCtx, "db">, caller: { personId: Id<"persons">; networkId: Id<"networks"> }, albumId: Id<"albums">): Promise<Doc<"albums">> {
  const album = await ctx.db.get(albumId)
  if (!album || album.ownerPersonId !== caller.personId || album.networkId !== caller.networkId || album.deletingAt !== undefined) return notFound()
  return album
}

/** MA photo, d'un de mes albums vivants de ce réseau. */
async function ownItem(ctx: Pick<QueryCtx, "db">, caller: { personId: Id<"persons">; networkId: Id<"networks"> }, itemId: Id<"albumItems">) {
  const item = await ctx.db.get(itemId)
  if (!item || item.ownerPersonId !== caller.personId) return notFound()
  const album = await ownAlbum(ctx, caller, item.albumId)
  return { item, album }
}

/** Purger le blob d'une photo — seulement si le registre dit qu'il a été admis pour un album. */
async function purgeAlbumBlob(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  const scan = await findScanByStorageId(ctx, storageId)
  if (scan?.source === "album") await purgeStoredFile(ctx, storageId)
}

export type AlbumCoverDto = { url: string | null; withheld: WithheldCode | null; altText: string | null }

/**
 * La couverture d'un album — la préférence (toujours valide), sinon la PREMIÈRE
 * photo : une lecture, jamais un balayage. Résolue APRÈS la garde ; une
 * couverture retenue n'est montrée qu'à son propriétaire.
 */
async function coverOf(ctx: ReadCtx, album: Doc<"albums">, isOwner: boolean): Promise<AlbumCoverDto | null> {
  if (album.itemCount === 0) return null
  const cover =
    (album.coverItemId !== undefined ? await ctx.db.get(album.coverItemId) : null) ??
    (await ctx.db
      .query("albumItems")
      .withIndex("by_album_position", (q) => q.eq("albumId", album._id))
      .order("asc")
      .first())
  if (!cover) return null
  const delivery = await resolveFileDelivery(ctx, cover.media.storageId)
  if (delivery.url === null && !isOwner) return null
  return { url: delivery.url, withheld: withheldCodeOf(delivery.scan), altText: cover.altText ?? null }
}

export type AlbumSummaryDto = {
  albumId: Id<"albums">
  title: string
  description: string | null
  audience: AlbumAudience
  status: AlbumStatus
  itemCount: number
  cover: AlbumCoverDto | null
  updatedAt: number
  publishedAt: number | null
  isOwner: boolean
}

async function summaryOf(ctx: ReadCtx, album: Doc<"albums">, isOwner: boolean): Promise<AlbumSummaryDto> {
  return {
    albumId: album._id,
    title: album.title,
    description: album.description ?? null,
    audience: album.audience,
    status: album.status,
    itemCount: album.itemCount,
    cover: await coverOf(ctx, album, isOwner),
    updatedAt: album.updatedAt,
    publishedAt: album.publishedAt ?? null,
    isOwner,
  }
}

const callerOf = (ctx: { person: Doc<"persons">; networkId: Id<"networks"> }) => ({ personId: ctx.person._id, networkId: ctx.networkId })

// ═══════════════════════════════════════════════════════════════
// Préparer — création et forme
// ═══════════════════════════════════════════════════════════════

/**
 * Créer un album — en BROUILLON, donc privé, quelle que soit l'audience
 * choisie. Préparer n'est un acte envers personne : un membre en attente le
 * peut. Le rejeu de la clé rend l'album EXISTANT sans rien revalider ; rejouée
 * dans un autre réseau, elle est refusée.
 */
export const create = networkMutation({
  minStatus: "en_attente",
  args: { title: v.string(), description: v.optional(v.string()), audience: reachAudienceValidator, idempotencyKey: v.optional(v.string()) },
  returns: v.object({ albumId: v.id("albums"), created: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.create", ctx.person._id)
    if (args.idempotencyKey !== undefined) {
      const replay = await ctx.db
        .query("albums")
        .withIndex("by_owner_idempotencyKey", (q) => q.eq("ownerPersonId", ctx.person._id).eq("idempotencyKey", args.idempotencyKey))
        .unique()
      if (replay) return replay.networkId === ctx.networkId && replay.deletingAt === undefined ? { albumId: replay._id, created: false } : fail("conflict")
    }
    const title = checked(() => assertAlbumTitle(args.title))
    const description = checked(() => assertAlbumDescription(args.description))
    const now = Date.now()
    const albumId = await ctx.db.insert("albums", {
      networkId: ctx.networkId,
      ownerPersonId: ctx.person._id,
      title,
      ...(description !== undefined ? { description } : {}),
      audience: args.audience,
      status: "draft",
      itemCount: 0,
      ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
      createdAt: now,
      updatedAt: now,
    })
    return { albumId, created: true }
  },
})

/**
 * Corriger le titre, la description ou l'audience. Changer l'audience d'un album
 * déjà publié prend effet à la lecture suivante — sans rappeler aucune copie
 * déjà téléchargée (l'écran le dit, pas une promesse du serveur).
 */
export const update = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums"), title: v.optional(v.string()), description: v.optional(v.string()), audience: v.optional(reachAudienceValidator) },
  returns: v.object({ updated: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    const title = args.title === undefined ? undefined : checked(() => assertAlbumTitle(args.title ?? ""))
    const description = args.description === undefined ? null : checked(() => assertAlbumDescription(args.description))
    await ctx.db.patch(album._id, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== null ? { description } : {}),
      ...(args.audience !== undefined ? { audience: args.audience } : {}),
      updatedAt: Date.now(),
    })
    return { updated: true as const }
  },
})

// ═══════════════════════════════════════════════════════════════
// Remplir — l'ajout idempotent PAR PHOTO
// ═══════════════════════════════════════════════════════════════

/**
 * Ajouter des photos — idempotent PAR ÉLÉMENT, ce qui EST la reprise : un lot
 * de douze dont huit sont déjà passées rend `{ added: 4, skipped: 8 }`. Ordre
 * des refus : la propriété (rien n'est révélé de l'album d'autrui), la forme
 * déclarée, le plafond, puis la vérité du STOCKAGE, qui rejuge la forme sur le
 * type et le poids RÉELS.
 */
export const addItems = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums"), items: v.array(albumDeclaredItemValidator) },
  returns: v.object({ added: v.number(), skipped: v.number(), itemIds: v.array(v.id("albumItems")) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    checked(() => assertAlbumMedia(args.items.map((item) => ({ mimeType: item.mimeType, sizeBytes: item.sizeBytes }))))

    // Rejeu : les clés DÉJÀ portées par cet album, en une lecture bornée.
    const existing = await albumItems(ctx, album._id)
    const known = new Map(existing.map((row) => [row.idempotencyKey, row._id]))
    const fresh = args.items.filter((item) => !known.has(item.idempotencyKey))
    const skipped = args.items.length - fresh.length
    if (fresh.length === 0) {
      return { added: 0, skipped, itemIds: args.items.map((item) => known.get(item.idempotencyKey)).filter((id): id is Id<"albumItems"> => id !== undefined) }
    }
    checked(() => assertAlbumCapacity({ current: album.itemCount, adding: fresh.length }))

    // La VÉRITÉ DU STOCKAGE écrase le déclaré ; un dépôt qui n'est pas NEUF et de l'appelant se refuse indistinctement.
    const verified = await verifyDeclaredMedia(ctx, {
      actorPersonId: ctx.person._id,
      networkId: ctx.networkId,
      usage: "album_image",
      source: "album",
      declared: fresh.map((item) => ({
        storageId: item.storageId,
        kind: "image" as const,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        ...(item.width !== undefined ? { width: item.width } : {}),
        ...(item.height !== undefined ? { height: item.height } : {}),
      })),
    })
    checked(() => assertAlbumMedia(verified.map((item) => ({ mimeType: item.mimeType, sizeBytes: item.sizeBytes }))))

    let position = nextPosition(existing.map((row) => row.position))
    const now = Date.now()
    const itemIds: Id<"albumItems">[] = []
    for (let index = 0; index < fresh.length; index += 1) {
      const declared = fresh[index]
      const media = verified[index]
      if (!declared || !media) continue
      const caption = checked(() => assertAlbumCaption(declared.caption))
      const altText = checked(() => assertAlbumAltText(declared.altText))
      itemIds.push(
        await ctx.db.insert("albumItems", {
          networkId: album.networkId,
          albumId: album._id,
          ownerPersonId: ctx.person._id,
          media: {
            storageId: media.storageId,
            kind: "image",
            mimeType: media.mimeType,
            sizeBytes: media.sizeBytes,
            ...(declared.width !== undefined ? { width: declared.width } : {}),
            ...(declared.height !== undefined ? { height: declared.height } : {}),
          },
          position,
          ...(caption !== undefined ? { caption } : {}),
          ...(altText !== undefined ? { altText } : {}),
          addedByPersonId: ctx.person._id,
          idempotencyKey: declared.idempotencyKey,
          createdAt: now,
        }),
      )
      position += 1
    }
    await ctx.db.patch(album._id, { itemCount: album.itemCount + itemIds.length, updatedAt: now })
    return { added: itemIds.length, skipped, itemIds }
  },
})

/** Légender une photo, et lui donner son texte alternatif. */
export const setCaption = networkMutation({
  minStatus: "en_attente",
  args: { itemId: v.id("albumItems"), caption: v.optional(v.string()), altText: v.optional(v.string()) },
  returns: v.object({ updated: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const { item, album } = await ownItem(ctx, callerOf(ctx), args.itemId)
    const caption = checked(() => assertAlbumCaption(args.caption))
    const altText = checked(() => assertAlbumAltText(args.altText))
    await ctx.db.patch(item._id, { caption, altText })
    await ctx.db.patch(album._id, { updatedAt: Date.now() })
    return { updated: true as const }
  },
})

/**
 * Réordonner : la liste COMPLÈTE des photos, dans l'ordre voulu — une
 * permutation exacte, sûre à deux onglets ; seules les photos qui bougent sont
 * réécrites.
 */
export const reorder = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums"), itemIds: v.array(v.id("albumItems")) },
  returns: v.object({ moved: v.number() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    const items = await albumItems(ctx, album._id)
    const changed = checked(() =>
      reorderPositions(
        items.map((item) => ({ id: item._id, position: item.position })),
        args.itemIds,
      ),
    )
    for (const move of changed) {
      const target = items.find((item) => item._id === move.id)
      if (target) await ctx.db.patch(target._id, { position: move.position })
    }
    if (changed.length > 0) await ctx.db.patch(album._id, { updatedAt: Date.now() })
    return { moved: changed.length }
  },
})

/** Choisir la couverture parmi les photos de l'album. */
export const setCover = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums"), itemId: v.id("albumItems") },
  returns: v.object({ updated: v.literal(true) }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    const item = await ctx.db.get(args.itemId)
    if (!item || item.albumId !== album._id) return notFound()
    await ctx.db.patch(album._id, { coverItemId: item._id, updatedAt: Date.now() })
    return { updated: true as const }
  },
})

/**
 * Retirer une photo — elle est SUPPRIMÉE, son blob et sa ligne d'analyse
 * purgés (le socle laissait une tombe et le blob). Retirer la couverture la
 * rend à la première photo. Idempotent : une photo déjà partie rend `false`.
 */
export const removeItem = networkMutation({
  minStatus: "en_attente",
  args: { itemId: v.id("albumItems") },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.write", ctx.person._id)
    const item = await ctx.db.get(args.itemId)
    if (!item) return { removed: false }
    const album = await ownAlbum(ctx, callerOf(ctx), item.albumId)
    if (item.ownerPersonId !== ctx.person._id) return notFound()
    await ctx.db.delete(item._id)
    await purgeAlbumBlob(ctx, item.media.storageId)
    await ctx.db.patch(album._id, {
      itemCount: Math.max(0, album.itemCount - 1),
      ...(album.coverItemId === item._id ? { coverItemId: undefined } : {}),
      updatedAt: Date.now(),
    })
    return { removed: true }
  },
})

// ═══════════════════════════════════════════════════════════════
// Publier, retirer, supprimer
// ═══════════════════════════════════════════════════════════════

/**
 * PUBLIER — le seul geste qui rend un album visible, un acte envers autrui :
 * membre déclaré. Republier rouvre un album retiré en gardant sa date de
 * PREMIÈRE publication ; publier un album publié est un rejeu. La cloche des
 * abonnés ne sonne qu'à la première publication, par lots, chacun re-gardé.
 */
export const publish = networkMutation({
  minStatus: "declaree",
  args: { albumId: v.id("albums") },
  returns: v.object({ status: v.literal("published"), published: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.publish", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    if (album.status === "published") return { status: "published" as const, published: false }
    checked(() => assertAlbumPublishable({ status: album.status, itemCount: album.itemCount }))
    const now = Date.now()
    await ctx.db.patch(album._id, { status: "published", publishedAt: album.publishedAt ?? now, withdrawnAt: undefined, updatedAt: now })
    if (album.publishedAt === undefined) {
      await enqueueFanout(ctx, { networkId: album.networkId, actorPersonId: ctx.person._id, kind: "album_published", subject: { album: album._id }, source: { kind: "albumFollowers", albumId: album._id } })
    }
    return { status: "published" as const, published: true }
  },
})

/** RETIRER — referme sans rien détruire. Seul un album publié se retire. */
export const withdraw = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums") },
  returns: v.object({ status: v.literal("withdrawn") }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.publish", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    checked(() => assertAlbumWithdrawable(album.status))
    const now = Date.now()
    await ctx.db.patch(album._id, { status: "withdrawn", withdrawnAt: now, updatedAt: now })
    return { status: "withdrawn" as const }
  },
})

/**
 * Un lot de la purge d'un album en suppression : photos supprimées, blobs et
 * lignes d'analyse purgés ; le dernier lot supprime l'album. Un lot plein
 * planifie la suite.
 */
async function purgeAlbumBatch(ctx: MutationCtx, album: Doc<"albums">): Promise<{ done: boolean }> {
  const items = await ctx.db
    .query("albumItems")
    .withIndex("by_album_position", (q) => q.eq("albumId", album._id))
    .take(ALBUM_PURGE_BATCH)
  for (const item of items) {
    await ctx.db.delete(item._id)
    await purgeAlbumBlob(ctx, item.media.storageId)
  }
  if (items.length === ALBUM_PURGE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.modules.albums.albums.continueRemoveAlbum, { albumId: album._id })
    return { done: false }
  }
  await ctx.db.delete(album._id)
  return { done: true }
}

/** Continuation interne d'une suppression d'album — jamais une API de suppression implicite. */
export const continueRemoveAlbum = internalMutation({
  args: { albumId: v.id("albums") },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) => {
    const album = await ctx.db.get(args.albumId)
    if (!album) return { done: true }
    if (album.deletingAt === undefined) return { done: false }
    return await purgeAlbumBatch(ctx, album)
  },
})

/**
 * SUPPRIMER l'album : introuvable AUSSITÔT (lien direct, listes, cloche), puis
 * purgé — photos, blobs et lignes d'analyse — par lots (D09 : zéro orphelin).
 */
export const remove = networkMutation({
  minStatus: "en_attente",
  args: { albumId: v.id("albums") },
  returns: v.object({ removed: v.literal(true), pending: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "album.remove", ctx.person._id)
    const album = await ownAlbum(ctx, callerOf(ctx), args.albumId)
    const now = Date.now()
    await ctx.db.patch(album._id, { deletingAt: now, updatedAt: now })
    const result = await purgeAlbumBatch(ctx, { ...album, deletingAt: now })
    return { removed: true as const, pending: !result.done }
  },
})

// ═══════════════════════════════════════════════════════════════
// Lire — l'audience recontrôlée à CHAQUE lecture
// ═══════════════════════════════════════════════════════════════

export type AlbumDetailDto = {
  album: AlbumSummaryDto
  owner: { personId: Id<"persons">; handle: string | null; displayName: string | null; avatarUrl: string | null }
  items: AlbumItemDto[]
  coverItemId: Id<"albumItems"> | null
}

/**
 * UN album, avec ses photos — le détail, la vignette et le lien direct passent
 * tous par ici. Invisible d'ici : `null`, sans distinction.
 */
export const getAlbum = networkQuery({
  args: { albumId: v.id("albums") },
  handler: async (ctx, args): Promise<AlbumDetailDto | null> => {
    const album = await ctx.db.get(args.albumId)
    if (!album || !(await canSeeAlbum(ctx, album, callerOf(ctx)))) return null
    const isOwner = album.ownerPersonId === ctx.person._id
    const items = await resolveAlbumItemDtos(ctx, (await albumItems(ctx, album._id)).slice(0, ALBUM_ITEMS_MAX), isOwner)
    const owner = await miniProfileCache(ctx)(album.ownerPersonId)
    const coverItemId = album.coverItemId !== undefined && items.some((item) => item.itemId === album.coverItemId) ? album.coverItemId : (items[0]?.itemId ?? null)
    return {
      album: await summaryOf(ctx, album, isOwner),
      owner: { personId: owner.personId, handle: owner.handle, displayName: owner.displayName, avatarUrl: owner.avatarUrl },
      items,
      coverItemId,
    }
  },
})

/** MES albums de ce réseau, tous états confondus, les plus récemment touchés d'abord. */
export const paginateMyAlbums = networkQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<AlbumSummaryDto>> => {
    const result = await ctx.db
      .query("albums")
      .withIndex("by_network_owner_updatedAt", (q) => q.eq("networkId", ctx.networkId).eq("ownerPersonId", ctx.person._id))
      .order("desc")
      .paginate(clampPage(args.paginationOpts))
    const page: AlbumSummaryDto[] = []
    for (const album of result.page) if (album.deletingAt === undefined) page.push(await summaryOf(ctx, album, true))
    return { ...result, page }
  },
})

/**
 * Les albums PUBLIÉS d'une personne de ce réseau, vus par ce lecteur. Refus
 * INDISTINCT : identifiant inconnu, profil retiré, non-membre et blocage
 * rendent tous une liste VIDE. Chaque album est re-jugé un par un : l'index n'a
 * filtré que le statut, l'audience se décide à la lecture.
 */
export const paginatePersonAlbums = networkQuery({
  args: { handle: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<AlbumSummaryDto>> => {
    const empty = { page: [], isDone: true, continueCursor: "" }
    const found = await findPublishedPersonByHandle(ctx, ctx.networkId, args.handle)
    if (!found) return empty
    const isOwner = found._id === ctx.person._id
    if (!isOwner && (await isBlockedBetween(ctx, ctx.person._id, found._id))) return empty
    const result = await ctx.db
      .query("albums")
      .withIndex("by_network_owner_status_updatedAt", (q) => q.eq("networkId", ctx.networkId).eq("ownerPersonId", found._id).eq("status", "published"))
      .order("desc")
      .paginate(clampPage(args.paginationOpts))
    const page: AlbumSummaryDto[] = []
    for (const album of result.page) {
      if (!(await canSeeAlbum(ctx, album, callerOf(ctx)))) continue
      page.push(await summaryOf(ctx, album, isOwner))
    }
    return { ...result, page }
  },
})
