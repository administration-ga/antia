/** P09 : fichiers PRO copiés, frais, admis et délivrés sous garde ; pas d'URL distante. */
import { type CommerceMedia, parseCommercePublicBody } from "@antsia/social-domain/commerce/projection"
import { makeFunctionReference, paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { admitStoredUpload, assertFreshUpload, findScanByStorageId } from "../files/admission"
import { purgeStoredFile } from "../files/purge"
import { getScanStatus, isServableStorage, withheldCodeOf } from "../files/storageGuard"
import { canReadModeratedContent, contentState } from "../moderation/policy"
import { publicContext } from "../public/access"
import { headBelongsToCurrentCatalog, readableCatalogMapping } from "../shops/catalogAccess"

export type CatalogMediaJobArgs = { networkId: Id<"networks">; headId: Id<"commerceCatalogHeads">; revision: number; digest: string }
export type CatalogMediaLeaseArgs = CatalogMediaJobArgs & { leaseToken: string }
export type CatalogMediaFailure = "configuration" | "download" | "obsolete" | "admission"
export type CatalogMediaSnapshot = { shopRef: string; offerRef: string; linkRef: string; subjectRef: string; revision: number; media: CommerceMedia[] }
const jobArgs = { networkId: v.id("networks"), headId: v.id("commerceCatalogHeads"), revision: v.number(), digest: v.string() }
const leaseArgs = { ...jobArgs, leaseToken: v.string() }
const failureValidator = v.union(v.literal("configuration"), v.literal("download"), v.literal("obsolete"), v.literal("admission"))
const mediaValidator = v.object({ altText: v.optional(v.string()), byteSize: v.number(), height: v.optional(v.number()), mimeType: v.union(v.literal("image/jpeg"), v.literal("image/png"), v.literal("image/webp")), sha256: v.string(), width: v.optional(v.number()) })
const run = makeFunctionReference<"action", CatalogMediaJobArgs, null>("modules/federation/commerceCatalogMediaActions:run")
const watchdogRef = makeFunctionReference<"mutation", CatalogMediaLeaseArgs, null>("modules/federation/commerceCatalogMedia:watchdog")
type WithdrawalArgs = { networkId: Id<"networks">; shopId: Id<"shops">; activationRevision: number; paginationOpts: { cursor: string | null; numItems: number } }
const withdrawRef = makeFunctionReference<"mutation", WithdrawalArgs, null>("modules/federation/commerceCatalogMedia:withdrawShopMedia")
const LEASE_MS = 120_000, MAX_ATTEMPTS = 3

function sameRevision(head: Doc<"commerceCatalogHeads">, args: CatalogMediaJobArgs): boolean { return head.networkId === args.networkId && head.revision === args.revision && head.digest === args.digest }
function sameLease(head: Doc<"commerceCatalogHeads">, args: CatalogMediaLeaseArgs): boolean { return sameRevision(head, args) && head.mediaState === "running" && head.mediaLeaseToken === args.leaseToken }
async function rootNetwork(ctx: Pick<QueryCtx, "db">) { return await ctx.db.query("networks").withIndex("by_kind_and_status", (q) => q.eq("kind", "root").eq("status", "active")).unique() }

async function mediaTarget(ctx: Pick<QueryCtx, "db">, head: Doc<"commerceCatalogHeads">) {
  if (head.objectKind !== "offer" || head.sequence !== "catalog" || head.state !== "active") return null
  const root = await rootNetwork(ctx)
  if (!root) return null
  const live = await readableCatalogMapping(ctx, root, head.shopId)
  if (!live || !headBelongsToCurrentCatalog(head, live)) return null
  const moderation = await contentState(ctx, "commerceOffer", head._id)
  if (!moderation || moderation.status !== "published" || !await canReadModeratedContent(ctx, "commerceOffer", head._id)) return null
  const parsed = parseCommercePublicBody(head.body, Date.now())
  return parsed.ok && (parsed.value.payload.type === "offer.published" || parsed.value.payload.type === "offer.updated") ? { live, offer: parsed.value.payload } : null
}

async function purgeProvisional(ctx: MutationCtx, storageIds: readonly Id<"_storage">[]) {
  for (const id of new Set(storageIds.slice(0, 6))) if (!await findScanByStorageId(ctx, id)) await purgeStoredFile(ctx, id)
}

export async function purgeCatalogHeadMedia(ctx: MutationCtx, head: Doc<"commerceCatalogHeads">): Promise<void> {
  await purgeProvisional(ctx, head.mediaStaged ?? [])
  const assets = await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_head", (q) => q.eq("headId", head._id)).take(7)
  if (assets.length > 6) throw new Error("Invalid catalogue media cardinality")
  for (const asset of assets) { await purgeStoredFile(ctx, asset.storageId); await ctx.db.delete(asset._id) }
  await ctx.db.patch(head._id, { mediaState: undefined, mediaStaged: undefined, mediaLeaseToken: undefined, mediaLeaseUntil: undefined, mediaError: undefined })
}

export async function queueCatalogMedia(ctx: MutationCtx, headId: Id<"commerceCatalogHeads">): Promise<void> {
  const head = await ctx.db.get(headId)
  if (!head || head.sequence !== "catalog" || head.objectKind !== "offer" || head.state !== "active" || head.mediaState === "attached" || head.mediaState === "running" || (head.mediaAttempts ?? 0) >= MAX_ATTEMPTS) return
  const parsed = parseCommercePublicBody(head.body, Date.now())
  if (!parsed.ok || (parsed.value.payload.type !== "offer.published" && parsed.value.payload.type !== "offer.updated")) return
  const media = parsed.value.payload.media
  await ctx.db.patch(head._id, { mediaState: media.length ? "pending" : "attached" })
  if (media.length) await ctx.scheduler.runAfter(0, run, { networkId: head.networkId, headId, revision: head.revision, digest: head.digest })
}

export async function queueShopCatalogMediaWithdrawal(ctx: MutationCtx, networkId: Id<"networks">, shopId: Id<"shops">, activationRevision: number): Promise<void> {
  await ctx.scheduler.runAfter(0, withdrawRef, { networkId, shopId, activationRevision, paginationOpts: { cursor: null, numItems: 5 } })
}

export const claim = internalMutation({
  args: { ...jobArgs, leaseToken: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.leaseToken.length < 32 || args.leaseToken.length > 128 || /[^A-Za-z0-9_-]/u.test(args.leaseToken)) return false
    const head = await ctx.db.get(args.headId)
    if (!head || !sameRevision(head, args) || head.mediaState === "attached" || (head.mediaAttempts ?? 0) >= MAX_ATTEMPTS || head.mediaState === "running" && (head.mediaLeaseUntil ?? 0) > Date.now() || !await mediaTarget(ctx, head)) return false
    const running = await ctx.db.query("commerceCatalogHeads").withIndex("by_media_state", (q) => q.eq("mediaState", "running")).take(3)
    for (const row of running) if (row._id !== head._id && (row.mediaLeaseUntil ?? 0) <= Date.now()) await failLease(ctx, row, "download")
    if (running.filter((row) => row._id !== head._id && (row.mediaLeaseUntil ?? 0) > Date.now()).length >= 2) {
      await ctx.scheduler.runAfter(30_000, run, { networkId: args.networkId, headId: args.headId, revision: args.revision, digest: args.digest })
      return false
    }
    await purgeProvisional(ctx, head.mediaStaged ?? [])
    await ctx.db.patch(head._id, { mediaState: "running", mediaStaged: [], mediaLeaseToken: args.leaseToken, mediaLeaseUntil: Date.now() + LEASE_MS, mediaAttempts: (head.mediaAttempts ?? 0) + 1, mediaError: undefined })
    await ctx.scheduler.runAfter(LEASE_MS, watchdogRef, args)
    return true
  },
})

export const snapshot = internalQuery({
  args: leaseArgs, returns: v.union(v.null(), v.object({ shopRef: v.string(), offerRef: v.string(), linkRef: v.string(), subjectRef: v.string(), revision: v.number(), media: v.array(mediaValidator) })),
  handler: async (ctx, args): Promise<CatalogMediaSnapshot | null> => {
    const head = await ctx.db.get(args.headId)
    if (!head || !sameLease(head, args) || (head.mediaLeaseUntil ?? 0) <= Date.now()) return null
    const current = await mediaTarget(ctx, head)
    return current ? { shopRef: current.live.link.shopRef, offerRef: current.offer.offerRef, linkRef: current.live.link.linkRef, subjectRef: current.live.link.subjectRef, revision: head.revision, media: [...current.offer.media] } : null
  },
})

export const stage = internalMutation({
  args: { ...leaseArgs, index: v.number(), storageId: v.id("_storage"), publicToken: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const head = await ctx.db.get(args.headId)
    if (!head || !sameLease(head, args) || (head.mediaLeaseUntil ?? 0) <= Date.now() || !await mediaTarget(ctx, head)) { await purgeProvisional(ctx, [args.storageId]); return false }
    const current = await mediaTarget(ctx, head), stored = head.mediaStaged ?? []
    if (!current || !Number.isInteger(args.index) || args.index < 0 || args.index >= current.offer.media.length || args.index >= 6 || args.publicToken.length < 32 || args.publicToken.length > 64 || /[^a-f0-9]/u.test(args.publicToken)) { await purgeProvisional(ctx, [args.storageId]); return false }
    const existing = await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_head", (q) => q.eq("headId", head._id)).take(7)
    if (stored[args.index] === args.storageId) return existing.some((asset) => asset.index === args.index && asset.storageId === args.storageId && asset.publicToken === args.publicToken)
    if (args.index !== stored.length || stored.includes(args.storageId) || await findScanByStorageId(ctx, args.storageId) || await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_public_token", (q) => q.eq("publicToken", args.publicToken)).first()) { await purgeProvisional(ctx, [args.storageId]); return false }
    await ctx.db.insert("commerceCatalogMediaAssets", { networkId: args.networkId, headId: head._id, revision: args.revision, digest: args.digest, index: args.index, publicToken: args.publicToken, storageId: args.storageId, createdAt: Date.now() })
    await ctx.db.patch(head._id, { mediaStaged: [...stored, args.storageId] })
    return true
  },
})

export const complete = internalMutation({
  args: leaseArgs, returns: v.boolean(),
  handler: async (ctx, args) => {
    const head = await ctx.db.get(args.headId)
    if (!head || !sameLease(head, args) || (head.mediaLeaseUntil ?? 0) <= Date.now()) return false
    const current = await mediaTarget(ctx, head), ids = head.mediaStaged ?? []
    if (!current || ids.length !== current.offer.media.length || ids.length > 6 || new Set(ids).size !== ids.length) return false
    for (let index = 0; index < ids.length; index++) {
      const descriptor = current.offer.media[index]!, storageId = ids[index]!
      await assertFreshUpload(ctx, null, storageId)
      const admitted = await admitStoredUpload(ctx, { storageId, usage: "media_social", mimeType: descriptor.mimeType, sizeBytes: descriptor.byteSize, sha256: descriptor.sha256 }, { source: "post_media", networkId: head.networkId })
      await ctx.db.patch(admitted.scanId, { requiresFullScan: true })
    }
    await ctx.db.patch(head._id, { mediaState: "attached", mediaLeaseToken: undefined, mediaLeaseUntil: undefined, mediaStaged: undefined, mediaError: undefined })
    return true
  },
})

async function failLease(ctx: MutationCtx, head: Doc<"commerceCatalogHeads">, error: CatalogMediaFailure) {
  await purgeCatalogHeadMedia(ctx, head)
  await ctx.db.patch(head._id, { mediaState: "failed", mediaError: error })
  if ((head.mediaAttempts ?? 0) < MAX_ATTEMPTS && error !== "obsolete") await ctx.scheduler.runAfter(30_000, run, { networkId: head.networkId, headId: head._id, revision: head.revision, digest: head.digest })
}

export const cleanup = internalMutation({
  args: { ...leaseArgs, storageIds: v.array(v.id("_storage")), error: failureValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    if (args.storageIds.length > 6) throw new Error("Invalid catalogue cleanup batch")
    await purgeProvisional(ctx, args.storageIds)
    const head = await ctx.db.get(args.headId)
    if (head && sameLease(head, args)) await failLease(ctx, head, args.error)
    return null
  },
})
export const watchdog = internalMutation({
  args: leaseArgs, returns: v.null(), handler: async (ctx, args) => {
    const head = await ctx.db.get(args.headId)
    if (head && sameLease(head, args) && (head.mediaLeaseUntil ?? 0) <= Date.now()) await failLease(ctx, head, "download")
    return null
  },
})
export const withdrawShopMedia = internalMutation({
  args: { networkId: v.id("networks"), shopId: v.id("shops"), activationRevision: v.number(), paginationOpts: paginationOptsValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("commerceCatalogHeads").withIndex("by_network_shop_kind_state_changedAt", (q) => q.eq("networkId", args.networkId).eq("shopId", args.shopId).eq("objectKind", "offer").eq("sequence", "catalog")).paginate({ ...args.paginationOpts, numItems: 5, maximumBytesRead: 1024 * 1024 })
    for (const head of page.page) if (head.parentActivationRevision <= args.activationRevision) await purgeCatalogHeadMedia(ctx, head)
    if (!page.isDone) await ctx.scheduler.runAfter(0, withdrawRef, { networkId: args.networkId, shopId: args.shopId, activationRevision: args.activationRevision, paginationOpts: { numItems: 5, cursor: page.continueCursor } })
    return null
  },
})

export function catalogMediaOrigin(): string | null {
  const raw = process.env.ANTSIA_CATALOG_MEDIA_ORIGIN ?? process.env.CONVEX_SITE_URL
  if (!raw || raw.length > 2048) return null
  try {
    const url = new URL(raw), loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (raw !== url.origin && raw !== `${url.origin}/`) || url.protocol !== "https:" && !(process.env.FEDERATION_ENVIRONMENT === "sandbox" && loopback && url.protocol === "http:")) return null
    return url.origin
  } catch { return null }
}

export async function catalogMediaDto(ctx: Pick<QueryCtx, "db">, head: Doc<"commerceCatalogHeads">, manifest: readonly CommerceMedia[]) {
  const assets = await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_head", (q) => q.eq("headId", head._id)).take(7)
  const origin = catalogMediaOrigin()
  return await Promise.all(manifest.slice(0, 6).map(async (descriptor, index) => {
    const asset = assets.find((row) => row.index === index && row.revision === head.revision && row.digest === head.digest)
    const status = asset ? await getScanStatus(ctx, asset.storageId) : null
    const withheld = withheldCodeOf(status)
    return { url: head.mediaState === "attached" && asset && !withheld && origin ? new URL(`/catalogue/media/${asset.publicToken}`, origin).href : null, altText: descriptor.altText ?? null, width: descriptor.width ?? null, height: descriptor.height ?? null, withheld }
  }))
}

export const publicAsset = internalQuery({
  args: { token: v.string() }, returns: v.union(v.null(), v.object({ storageId: v.id("_storage"), mimeType: v.string(), byteSize: v.number() })),
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 64 || /[^a-f0-9]/u.test(args.token)) return null
    const asset = await ctx.db.query("commerceCatalogMediaAssets").withIndex("by_public_token", (q) => q.eq("publicToken", args.token)).unique()
    if (!asset) return null
    const head = await ctx.db.get(asset.headId), root = await rootNetwork(ctx)
    if (!head || !root || head.networkId !== asset.networkId || head.revision !== asset.revision || head.digest !== asset.digest || head.mediaState !== "attached") return null
    const context = await publicContext(ctx, root._id)
    const live = await readableCatalogMapping(ctx, root, head.shopId, context.reader?.personId)
    if (!live || !headBelongsToCurrentCatalog(head, live) || (await contentState(ctx, "commerceOffer", head._id))?.status !== "published" || !await canReadModeratedContent(ctx, "commerceOffer", head._id, context.reader?.personId) || !await isServableStorage(ctx, asset.storageId)) return null
    const parsed = parseCommercePublicBody(head.body, Date.now())
    if (!parsed.ok || (parsed.value.payload.type !== "offer.published" && parsed.value.payload.type !== "offer.updated")) return null
    const descriptor = parsed.value.payload.media[asset.index]
    return descriptor ? { storageId: asset.storageId, mimeType: descriptor.mimeType, byteSize: descriptor.byteSize } : null
  },
})
