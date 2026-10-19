/** PA9B : imports bornés, baux révisés et rattachement transactionnel sous la garde des fichiers. */
import { federationEnvironment, RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import type { ReseauPublicMedia } from "@antsia/social-domain/reseauPublic"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server"
import { admitStoredUpload, assertFreshUpload, findScanByStorageId } from "../files/admission"
import { purgeStoredFile } from "../files/purge"
import { reserveStagedFile } from "../files/staging"
import type { StoredMedia } from "../media/media"
import { federationMediaValidator } from "./mediaValidators"
import { isFederatedContentAvailable } from "./mirrorAccess"
import { reseauPublicNetwork } from "./reseauPublicAccess"

export type MediaJobArgs = { mirrorId: Id<"mirrors">; revision: number; digest: string }
export type MediaLeaseArgs = MediaJobArgs & { leaseToken: string }
export type MediaFailure = "configuration" | "download" | "obsolete" | "admission"
type ReadCtx = Pick<QueryCtx, "db">
type Target = { kind: "post"; row: Doc<"posts"> } | { kind: "page"; row: Doc<"pages"> }

const MAX_MEDIA = 4
const MAX_ATTEMPTS = 3
const MAX_ACTIVE = 2
const LEASE_MS = 90_000
const BUSY_RETRY_MS = 30_000
const jobArgs = { mirrorId: v.id("mirrors"), revision: v.number(), digest: v.string() }
const leaseArgs = { ...jobArgs, leaseToken: v.string() }
const failureValidator = v.union(v.literal("configuration"), v.literal("download"), v.literal("obsolete"), v.literal("admission"))
const runReference = makeFunctionReference<"action", MediaJobArgs, null>("modules/federation/mediaActions:run")
const watchdogReference = makeFunctionReference<"mutation", MediaLeaseArgs, null>("modules/federation/mediaJobs:watchdog")

function sameRevision(mirror: Doc<"mirrors">, args: MediaJobArgs): boolean {
  return mirror.sourceRevision === args.revision && mirror.sourceDigest === args.digest
}

function sameLease(mirror: Doc<"mirrors">, args: MediaLeaseArgs): boolean {
  return sameRevision(mirror, args) && mirror.mediaStatus === "running" && mirror.mediaLeaseToken === args.leaseToken
}

function argsOf(mirror: Doc<"mirrors">): MediaJobArgs | null {
  return mirror.sourceRevision !== undefined && Number.isSafeInteger(mirror.sourceRevision) && mirror.sourceRevision > 0 && mirror.sourceDigest
    ? { mirrorId: mirror._id, revision: mirror.sourceRevision, digest: mirror.sourceDigest }
    : null
}

/** La propriété reste vérifiable après retrait de la source ou suppression de son émetteur. */
async function ownedTarget(ctx: ReadCtx, mirror: Doc<"mirrors">): Promise<Target | null> {
  if (mirror.contract !== RESEAU_PUBLIC_CONTRACT || !mirror.localId) return null
  if (mirror.localTable === "posts") {
    const id = ctx.db.normalizeId("posts", mirror.localId)
    const post = id ? await ctx.db.get(id) : null
    return post && post.networkId === mirror.networkId && post.federationSource?.emitterId === mirror.emitterId && post.federationSource.objectRef === mirror.objectRef
      ? { kind: "post", row: post } : null
  }
  if (mirror.localTable === "pages") {
    const id = ctx.db.normalizeId("pages", mirror.localId)
    const page = id ? await ctx.db.get(id) : null
    return page && page.networkId === mirror.networkId && page.importRef === `${RESEAU_PUBLIC_CONTRACT}:${RESEAU_PUBLIC_EMITTER}:${mirror.environment}:${mirror.objectRef}`
      ? { kind: "page", row: page } : null
  }
  return null
}

async function availableTarget(ctx: ReadCtx, mirror: Doc<"mirrors">): Promise<Target | null> {
  if (mirror.sourceState !== "active" || federationEnvironment(process.env.FEDERATION_ENVIRONMENT) !== mirror.environment) return null
  const emitter = await ctx.db.get(mirror.emitterId)
  if (!emitter || emitter.environment !== mirror.environment || emitter.networkId !== mirror.networkId || !await reseauPublicNetwork(ctx, emitter)) return null
  const target = await ownedTarget(ctx, mirror)
  if (!target || target.kind === "post" && target.row.status !== "published" || target.kind === "page" && target.row.status !== "active") return null
  if (!await isFederatedContentAvailable(ctx, mirror.localTable === "posts" ? "posts" : "pages", target.row._id)) return null
  return target
}

function validManifest(mirror: Doc<"mirrors">): boolean {
  const items = mirror.mediaManifest
  return items !== undefined && items.length > 0 && items.length <= MAX_MEDIA
    && (mirror.localTable === "posts" || mirror.localTable === "pages" && items.length === 1 && items[0]?.kind === "image")
}

/** Un ancien job n'efface jamais un blob déjà admis, même si son accusé de rattachement s'est perdu. */
async function purgeProvisional(ctx: MutationCtx, storageIds: readonly Id<"_storage">[]): Promise<void> {
  for (const storageId of new Set(storageIds)) {
    if (!await findScanByStorageId(ctx, storageId)) await purgeStoredFile(ctx, storageId)
  }
}

async function setPostPlaceholder(ctx: MutationCtx, mirror: Doc<"mirrors">, status: "pending" | "failed"): Promise<void> {
  const target = await ownedTarget(ctx, mirror)
  if (target?.kind === "post" && mirror.mediaManifest?.length) {
    const items = mirror.mediaManifest.map(({ kind, mimeType, width, height, durationMs, altText }) => ({ kind, mimeType, ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), ...(durationMs === undefined ? {} : { durationMs }), ...(altText === undefined ? {} : { altText }) }))
    await ctx.db.patch(target.row._id, { federationMedia: { items, status } })
  }
}

/** Purge volontaire du reflet : fichiers provisoires ET fichiers déjà attachés à son objet. */
export async function clearFederatedMedia(ctx: MutationCtx, mirror: Doc<"mirrors">): Promise<void> {
  const current = await ctx.db.get(mirror._id)
  if (!current) return
  await purgeProvisional(ctx, current.mediaStored ?? [])
  const target = await ownedTarget(ctx, current)
  if (target?.kind === "post") {
    for (const item of target.row.media ?? []) await purgeStoredFile(ctx, item.storageId)
    await ctx.db.patch(target.row._id, { media: undefined, federationMedia: undefined })
  } else if (target?.kind === "page") {
    if (target.row.logoStorageId) await purgeStoredFile(ctx, target.row.logoStorageId)
    await ctx.db.patch(target.row._id, { logoStorageId: undefined })
  }
  await ctx.db.patch(current._id, {
    mediaManifest: undefined, mediaStatus: undefined, mediaAttempts: undefined,
    mediaLeaseToken: undefined, mediaLeaseUntil: undefined, mediaError: undefined, mediaStored: undefined,
  })
}

/** Une nouvelle révision repart à zéro ; les arguments planifiés ne contiennent aucune URL. */
export async function queueFederatedMedia(ctx: MutationCtx, mirrorId: Id<"mirrors">, revision: number, digest: string, manifest: ReseauPublicMedia[]): Promise<void> {
  const mirror = await ctx.db.get(mirrorId)
  if (!mirror || !sameRevision(mirror, { mirrorId, revision, digest })) return
  await purgeProvisional(ctx, mirror.mediaStored ?? [])
  await ctx.db.patch(mirrorId, {
    mediaManifest: manifest, mediaStatus: manifest.length === 0 ? "attached" : "pending", mediaAttempts: 0,
    updatedAt: Date.now(),
    mediaLeaseToken: undefined, mediaLeaseUntil: undefined, mediaError: undefined, mediaStored: undefined,
  })
  const queued = await ctx.db.get(mirrorId)
  if (queued && manifest.length > 0) await setPostPlaceholder(ctx, queued, "pending")
  if (manifest.length > 0) await ctx.scheduler.runAfter(0, runReference, { mirrorId, revision, digest })
}

/** Seule une révision encore actuelle et disponible peut reprendre ; trois essais au maximum. */
export async function retryFederatedMedia(ctx: MutationCtx, mirror: Doc<"mirrors">): Promise<void> {
  const current = await ctx.db.get(mirror._id)
  if (!current || (current.mediaAttempts ?? 0) >= MAX_ATTEMPTS || !validManifest(current)) return
  const staleRunning = current.mediaStatus === "running" && (current.mediaLeaseUntil ?? 0) <= Date.now()
  if (current.mediaStatus !== "failed" && current.mediaStatus !== "pending" && !staleRunning) return
  const args = argsOf(current)
  if (!args || !await availableTarget(ctx, current)) return
  await purgeProvisional(ctx, current.mediaStored ?? [])
  await ctx.db.patch(current._id, { mediaStatus: "pending", mediaLeaseToken: undefined, mediaLeaseUntil: undefined, mediaStored: undefined, updatedAt: Date.now() })
  await ctx.scheduler.runAfter(BUSY_RETRY_MS, runReference, args)
}

async function failCurrent(ctx: MutationCtx, mirror: Doc<"mirrors">, error: MediaFailure): Promise<void> {
  await purgeProvisional(ctx, mirror.mediaStored ?? [])
  await ctx.db.patch(mirror._id, {
    mediaStatus: "failed", mediaError: error, mediaStored: undefined,
    updatedAt: Date.now(),
    mediaLeaseToken: undefined, mediaLeaseUntil: undefined,
  })
  await setPostPlaceholder(ctx, mirror, "failed")
  await retryFederatedMedia(ctx, mirror)
}

export const claim = internalMutation({
  args: jobArgs,
  returns: v.union(v.null(), v.object({ leaseToken: v.string() })),
  handler: async (ctx, args): Promise<{ leaseToken: string } | null> => {
    const mirror = await ctx.db.get(args.mirrorId)
    if (!mirror || !sameRevision(mirror, args) || !validManifest(mirror)) return null
    if (mirror.mediaStatus !== "pending" && mirror.mediaStatus !== "failed" && mirror.mediaStatus !== "running") return null
    const now = Date.now()
    if (mirror.mediaStatus === "running" && (mirror.mediaLeaseUntil ?? 0) > now) return null
    if ((mirror.mediaAttempts ?? 0) >= MAX_ATTEMPTS) return null
    if (!await availableTarget(ctx, mirror)) { await failCurrent(ctx, mirror, "obsolete"); return null }
    // Borné à trois : deux baux peuvent travailler. Tout reliquat expiré est d'abord sorti de running.
    const running = await ctx.db.query("mirrors").withIndex("by_media_status", (q) => q.eq("mediaStatus", "running")).take(MAX_ACTIVE + 1)
    const expired = running.filter((row) => (row.mediaLeaseUntil ?? 0) <= now)
    for (const row of expired) await failCurrent(ctx, row, "download")
    if (expired.length > 0 || running.length >= MAX_ACTIVE) {
      await ctx.scheduler.runAfter(BUSY_RETRY_MS, runReference, args)
      return null
    }
    await purgeProvisional(ctx, mirror.mediaStored ?? [])
    const leaseToken = `${now}:${(mirror.mediaAttempts ?? 0) + 1}`
    await ctx.db.patch(mirror._id, {
      mediaStatus: "running", mediaAttempts: (mirror.mediaAttempts ?? 0) + 1,
      updatedAt: now,
      mediaLeaseToken: leaseToken, mediaLeaseUntil: now + LEASE_MS,
      mediaStored: [], mediaError: undefined,
    })
    await setPostPlaceholder(ctx, mirror, "pending")
    await ctx.scheduler.runAfter(LEASE_MS, watchdogReference, { ...args, leaseToken })
    return { leaseToken }
  },
})

/** Relecture avant chaque téléchargement ; aucune charge distante ne se trouve dans le job. */
export const snapshot = internalQuery({
  args: leaseArgs,
  returns: v.union(v.null(), v.object({ manifest: v.array(federationMediaValidator) })),
  handler: async (ctx, args): Promise<{ manifest: ReseauPublicMedia[] } | null> => {
    const mirror = await ctx.db.get(args.mirrorId)
    if (!mirror || !sameLease(mirror, args) || (mirror.mediaLeaseUntil ?? 0) <= Date.now() || !validManifest(mirror) || !await availableTarget(ctx, mirror)) return null
    return { manifest: mirror.mediaManifest ?? [] }
  },
})

/** Chaque blob neuf est enregistré immédiatement ; l'ordre est celui du manifeste signé. */
export const stage = internalMutation({
  args: { ...leaseArgs, storageId: v.id("_storage"), index: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const mirror = await ctx.db.get(args.mirrorId)
    if (!mirror || !sameLease(mirror, args) || (mirror.mediaLeaseUntil ?? 0) <= Date.now() || !await availableTarget(ctx, mirror)) {
      await purgeProvisional(ctx, [args.storageId])
      return false
    }
    const stored = mirror.mediaStored ?? []
    if (stored[args.index] === args.storageId) {
      await reserveStagedFile(ctx, mirror, args.storageId)
      return true
    }
    if (!Number.isInteger(args.index) || args.index !== stored.length || args.index >= MAX_MEDIA || args.index >= (mirror.mediaManifest?.length ?? 0) || stored.includes(args.storageId) || await findScanByStorageId(ctx, args.storageId)) {
      await purgeProvisional(ctx, [args.storageId])
      return false
    }
    await reserveStagedFile(ctx, mirror, args.storageId)
    await ctx.db.patch(mirror._id, { mediaStored: [...stored, args.storageId] })
    return true
  },
})

/** Fraîcheur, admission puis attachement sont dans UNE transaction ; aucun demi-rattachement. */
export const complete = internalMutation({
  args: leaseArgs,
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const mirror = await ctx.db.get(args.mirrorId)
    if (!mirror || !sameLease(mirror, args)) return false
    if ((mirror.mediaLeaseUntil ?? 0) <= Date.now() || !validManifest(mirror)) { await failCurrent(ctx, mirror, "obsolete"); return false }
    const target = await availableTarget(ctx, mirror)
    if (!target) { await failCurrent(ctx, mirror, "obsolete"); return false }
    const manifest = mirror.mediaManifest ?? []
    const storageIds = mirror.mediaStored ?? []
    if (manifest.length !== storageIds.length || new Set(storageIds).size !== storageIds.length) { await failCurrent(ctx, mirror, "admission"); return false }
    const admitted: StoredMedia[] = []
    for (let index = 0; index < manifest.length; index++) {
      const descriptor = manifest[index]
      const storageId = storageIds[index]
      if (!descriptor || !storageId) throw new Error("Incomplete federation media batch")
      await assertFreshUpload(ctx, null, storageId)
      const facts = await admitStoredUpload(ctx, {
        storageId, usage: target.kind === "post" ? "media_social" : "page_logo",
        mimeType: descriptor.mimeType, sizeBytes: descriptor.sizeBytes, sha256: descriptor.sha256,
      }, { source: target.kind === "post" ? "post_media" : "page", networkId: mirror.networkId })
      await ctx.db.patch(facts.scanId, { requiresFullScan: true })
      admitted.push({
        storageId, kind: descriptor.kind, mimeType: facts.mimeType, sizeBytes: facts.sizeBytes,
        ...(descriptor.width === undefined ? {} : { width: descriptor.width }),
        ...(descriptor.height === undefined ? {} : { height: descriptor.height }),
        ...(descriptor.durationMs === undefined ? {} : { durationMs: descriptor.durationMs }),
        ...(descriptor.altText === undefined ? {} : { altText: descriptor.altText }),
      })
    }
    if (target.kind === "post") {
      await ctx.db.patch(target.row._id, { media: admitted, federationMedia: undefined })
    } else {
      const logo = admitted[0]
      if (!logo || admitted.length !== 1 || logo.kind !== "image") throw new Error("Invalid federation page media")
      await ctx.db.patch(target.row._id, { logoStorageId: logo.storageId })
    }
    await ctx.db.patch(mirror._id, {
      mediaStatus: "attached", mediaLeaseToken: undefined, mediaLeaseUntil: undefined,
      updatedAt: Date.now(),
      mediaStored: undefined, mediaError: undefined,
    })
    return true
  },
})

/** Le nettoyage d'un job périmé se limite à SES blobs non admis, jamais à ceux de la révision suivante. */
export const cleanup = internalMutation({
  args: { ...leaseArgs, storageIds: v.array(v.id("_storage")), error: failureValidator },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (args.storageIds.length > MAX_MEDIA) throw new Error("Invalid federation cleanup batch")
    await purgeProvisional(ctx, args.storageIds)
    const mirror = await ctx.db.get(args.mirrorId)
    if (mirror && sameLease(mirror, args)) await failCurrent(ctx, mirror, args.error)
    return null
  },
})

/** Un crash pur ne laisse pas running indéfiniment ; les fichiers déjà enregistrés sont repris ici. */
export const watchdog = internalMutation({
  args: leaseArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const mirror = await ctx.db.get(args.mirrorId)
    if (mirror && sameLease(mirror, args) && (mirror.mediaLeaseUntil ?? 0) <= Date.now()) await failCurrent(ctx, mirror, "download")
    return null
  },
})
