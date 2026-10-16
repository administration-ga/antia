// Dupliqué de socle/convex/modules/fileGuard/admission.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (`uploadedByPersonId`, `networkId`) ; `isKeptApartStorage` retiré (registres RH, signatures, marques officielles, courrier : aucun dans le moteur, la garde ne connaît que `fileScans`) ; coupe-circuit FAIL-CLOSED (la ligne naît `pending` sans analyse, retenue jusqu'à la levée) ; refus à code du moteur (`notFound` indistinct, `conflict` pour un fichier déjà joint par soi) ; sujet iDocument retiré.
/**
 * Garde des fichiers — l'ADMISSION, temps unique d'entrée d'un fichier.
 *
 * `admitStoredUpload` prolonge `assertStoredUpload` (`lib/uploadPolicy.ts`) :
 * même recoupement déclaré ↔ stocké, puis inscription à l'analyse
 * (`enqueueScan`). Une surface qui l'appelle a fait les deux temps de la
 * politique ET a mis son fichier sous garde.
 *
 * `enqueueScan` est IDEMPOTENT par fichier : le même `storageId` n'est analysé
 * qu'une fois. Une ligne terminale ne se rejoue pas ; une ligne
 * `pending`/`running` fraîche ne se double pas ; une ligne rassise (job perdu)
 * ou en `error` sous le plafond de tentatives se replanifie.
 *
 * Le job est TOUJOURS planifié (`scheduler.runAfter(0, …)`), jamais en ligne :
 * une mutation ne lit pas d'octets, et un échec d'analyse n'annule pas le dépôt.
 *
 * Coupe-circuit `FILE_GUARD=off` : la ligne naît `pending`, SANS job — retenue
 * (fail-closed) jusqu'à la levée, où le balayeur la reprend.
 *
 * Un fichier que la plateforme PRODUIT elle-même n'est pas admis : il est
 * INSCRIT (`registerGeneratedBlob`), né `skipped/server_generated`.
 */
import { type DeclaredUpload, normalizeSha256, type StoredUpload } from "@antsia/social-domain/uploadPolicy"

import { internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { fail, notFound } from "../../lib/errors"
import { assertStoredUpload } from "../../lib/uploadPolicy"
import {
  FILE_GUARD_MAX_ATTEMPTS,
  FILE_GUARD_RUNNING_STALE_MS,
  type FileScanSource,
  type FileScanStatus,
  GENERATED_BLOB_SKIP_REASON,
  isKillSwitched,
} from "./policy"

export interface AdmissionMeta {
  source: FileScanSource
  /** Le réseau où le fichier entre — absent pour un fichier de profil. */
  networkId?: Id<"networks">
  uploadedByPersonId?: Id<"persons">
  filename?: string
}

export interface StoredBlobFacts {
  storageId: Id<"_storage">
  mimeType?: string
  sizeBytes?: number
  sha256?: string
}

export interface EnqueueResult {
  scanId: Id<"fileScans">
  status: FileScanStatus
  /** Vrai si une ligne est née de cet appel. */
  created: boolean
  /** Vrai si un job d'analyse a été (re)planifié par cet appel. */
  scheduled: boolean
}

type ScanCtx = Pick<MutationCtx, "db" | "scheduler">

/** La ligne d'analyse d'un fichier, s'il en a une. Une lecture indexée. */
export async function findScanByStorageId(ctx: Pick<MutationCtx, "db">, storageId: Id<"_storage">): Promise<Doc<"fileScans"> | null> {
  return await ctx.db
    .query("fileScans")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first()
}

/**
 * Un dépôt n'« adopte » jamais le fichier d'autrui : seul un fichier NEUF entre.
 *
 * Un `storageId` n'est qu'une référence. Sans ce contrôle, connaître celui du
 * fichier d'un tiers suffirait à en faire la pièce d'une ligne à soi — servie
 * ensuite à ses lecteurs, détruite par sa purge. Neuf = inconnu du registre
 * d'admission (`fileScans`) ; l'admission qui suit l'y inscrit au nom de
 * l'appelant, et un second dépôt du même fichier est refusé à son tour.
 *
 * Refus INDISTINCT (`notFound`, celui d'un identifiant inventé) : un dépôt ne
 * sert pas d'oracle sur les fichiers des autres. Seul le fichier que l'appelant
 * a lui-même déjà déposé se nomme (`conflict`) — il le connaît.
 *
 * À appeler AVANT `assertStoredUpload` par toute surface publique qui écrit un
 * `storageId` fourni par le client (cliquets `fresh-upload` et
 * `storage-arg-freshness`).
 */
export async function assertFreshUpload(ctx: MutationCtx, uploaderId: Id<"persons"> | null, storageId: Id<"_storage">): Promise<void> {
  const scan = await findScanByStorageId(ctx, storageId)
  if (!scan) return
  if (uploaderId !== null && scan.uploadedByPersonId === uploaderId) fail("conflict")
  notFound()
}

/**
 * Ce qu'une nouvelle inscription d'un fichier DÉJÀ connu peut compléter —
 * jamais écraser : le réseau, le déposant, le nom, quand la ligne ne les porte pas.
 */
function missingScanFacts(existing: Doc<"fileScans">, meta: Omit<AdmissionMeta, "source">): Partial<Doc<"fileScans">> {
  const patch: Partial<Doc<"fileScans">> = {}
  if (meta.networkId && !existing.networkId) patch.networkId = meta.networkId
  if (meta.uploadedByPersonId && !existing.uploadedByPersonId) patch.uploadedByPersonId = meta.uploadedByPersonId
  if (meta.filename && !existing.filename) patch.filename = meta.filename
  return patch
}

async function scheduleScan(ctx: ScanCtx, scanId: Id<"fileScans">): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.modules.files.scan.runScan, { scanId })
}

/**
 * Inscrit un fichier à l'analyse. Rend la ligne (créée ou existante) et dit si
 * un job est parti. Ne lève jamais pour une ligne déjà connue.
 */
export async function enqueueScan(
  ctx: ScanCtx,
  stored: StoredBlobFacts,
  meta: AdmissionMeta,
  env: Record<string, string | undefined> = process.env,
): Promise<EnqueueResult> {
  const now = Date.now()
  const existing = await findScanByStorageId(ctx, stored.storageId)
  const killSwitched = isKillSwitched(env)

  if (existing) {
    const patch = missingScanFacts(existing, meta)
    const stale = (existing.status === "pending" || existing.status === "running") && now - existing.updatedAt > FILE_GUARD_RUNNING_STALE_MS
    const retryable = existing.status === "error" && existing.attempts < FILE_GUARD_MAX_ATTEMPTS
    if ((stale || retryable) && !killSwitched) {
      await ctx.db.patch(existing._id, { ...patch, status: "pending", updatedAt: now })
      await scheduleScan(ctx, existing._id)
      return { scanId: existing._id, status: "pending", created: false, scheduled: true }
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, { ...patch, updatedAt: now })
    return { scanId: existing._id, status: existing.status, created: false, scheduled: false }
  }

  const scanId = await ctx.db.insert("fileScans", {
    storageId: stored.storageId,
    source: meta.source,
    ...(meta.networkId ? { networkId: meta.networkId } : {}),
    ...(meta.uploadedByPersonId ? { uploadedByPersonId: meta.uploadedByPersonId } : {}),
    ...(meta.filename ? { filename: meta.filename } : {}),
    ...(stored.mimeType ? { declaredMimeType: stored.mimeType } : {}),
    ...(stored.sizeBytes !== undefined ? { sizeBytes: stored.sizeBytes } : {}),
    ...(stored.sha256 ? { sha256: stored.sha256 } : {}),
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  })
  // Coupe-circuit : la ligne attend la levée, sans job (retenue, fail-closed).
  if (killSwitched) return { scanId, status: "pending", created: true, scheduled: false }
  await scheduleScan(ctx, scanId)
  return { scanId, status: "pending", created: true, scheduled: true }
}

/**
 * Ce que le stockage dit RÉELLEMENT d'un fichier que le SERVEUR vient d'écrire :
 * poids et empreinte, le type étant celui que le serveur a produit.
 */
export async function readStoredBlobFacts(ctx: Pick<MutationCtx, "db">, storageId: Id<"_storage">, mimeType: string): Promise<StoredBlobFacts> {
  const stored = await ctx.db.system.get("_storage", storageId)
  return {
    storageId,
    mimeType,
    ...(stored ? { sizeBytes: stored.size, sha256: normalizeSha256(stored.sha256) ?? stored.sha256 } : {}),
  }
}

/**
 * Le temps 2 de la politique de dépôt, PLUS l'admission à l'analyse. Rend les
 * métadonnées RÉELLES (jamais celles du client) et la ligne d'analyse.
 */
export async function admitStoredUpload(
  ctx: MutationCtx,
  declared: DeclaredUpload<Id<"_storage">>,
  meta: AdmissionMeta,
): Promise<StoredUpload<Id<"_storage">> & { scanId: Id<"fileScans">; scanStatus: FileScanStatus }> {
  const stored = await assertStoredUpload(ctx, declared)
  const queued = await enqueueScan(ctx, stored, meta)
  return { ...stored, scanId: queued.scanId, scanStatus: queued.status }
}

export interface GeneratedBlobMeta {
  /** Le type que le serveur vient d'écrire — il le connaît, il l'a produit. */
  mimeType: string
  filename?: string
  networkId?: Id<"networks">
  /** La personne dont le geste a produit le fichier, quand il y en a une. */
  uploadedByPersonId?: Id<"persons">
}

/**
 * Inscrit au registre un fichier PRODUIT PAR LA PLATEFORME (enregistrement de
 * direct rapatrié par le serveur, par exemple), né `skipped/server_generated` :
 * servable d'emblée, mais TRACÉ, et plus jamais « neuf » pour un dépôt client.
 * IDEMPOTENT : une ligne existante n'est jamais rétrogradée.
 *
 * ⚠️ JAMAIS pour un `storageId` venu d'un client : ce serait déclarer « sans
 * analyse requise » un fichier que personne n'a vérifié.
 */
export async function registerGeneratedBlob(
  ctx: Pick<MutationCtx, "db">,
  storageId: Id<"_storage">,
  meta: GeneratedBlobMeta,
): Promise<{ scanId: Id<"fileScans">; created: boolean }> {
  const now = Date.now()
  const existing = await findScanByStorageId(ctx, storageId)
  if (existing) {
    const patch = missingScanFacts(existing, meta)
    if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, { ...patch, updatedAt: now })
    return { scanId: existing._id, created: false }
  }
  const facts = await readStoredBlobFacts(ctx, storageId, meta.mimeType)
  const scanId = await ctx.db.insert("fileScans", {
    storageId,
    status: "skipped",
    source: "generated",
    skipReason: GENERATED_BLOB_SKIP_REASON,
    ...(meta.networkId ? { networkId: meta.networkId } : {}),
    ...(meta.uploadedByPersonId ? { uploadedByPersonId: meta.uploadedByPersonId } : {}),
    ...(meta.filename ? { filename: meta.filename } : {}),
    declaredMimeType: meta.mimeType,
    ...(facts.sizeBytes !== undefined ? { sizeBytes: facts.sizeBytes } : {}),
    ...(facts.sha256 ? { sha256: facts.sha256 } : {}),
    attempts: 0,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  return { scanId, created: true }
}
