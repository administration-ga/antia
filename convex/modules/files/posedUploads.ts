// Dupliqué de socle/convex/modules/fileGuard/posedUploads.ts @ ad2e7fdc2 — adaptations : personnes et réseaux au lieu des comptes et des administrations ; refus à code du moteur (`notFound` indistinct).
/**
 * Garde des fichiers — les fichiers qu'une écriture POSE.
 *
 * Une ligne qui porte des fichiers (album, page, publication modifiée…) est
 * souvent réécrite EN BLOC : l'écran renvoie les fichiers déjà en place avec
 * ceux qu'il vient de déposer. Ce que la ligne porte déjà n'est pas un dépôt ;
 * ce que l'écriture AJOUTE l'est, et suit la règle de toute entrée client :
 * fichier NEUF (`assertFreshUpload`), politique de son usage, inscription au
 * registre au nom du déposant.
 */
import type { UploadUsage } from "@antia/social-domain/uploadPolicy"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { admitStoredUpload, assertFreshUpload, type StoredBlobFacts } from "./admission"
import type { FileScanSource } from "./policy"

export interface PosedUpload {
  /** Brut : un identifiant lu dans un contenu libre n'est pas typé ; il est normalisé à l'admission. */
  storageId: string
  /** L'usage de politique de dépôt auquel un fichier NEUF est confronté. */
  usage: UploadUsage
  /** Ce que le CLIENT déclare — confronté à ce que le stockage porte. */
  mimeType?: string
  sizeBytes?: number
  filename?: string
}

export interface PosedUploadMeta {
  source: FileScanSource
  networkId?: Id<"networks">
}

/**
 * Admet ce que l'écriture AJOUTE à la ligne ; laisse passer ce qu'elle porte
 * déjà. Rend les faits RÉELS (type, poids, empreinte) de chaque fichier admis,
 * par identifiant — l'appelant écrit ceux-là, jamais ceux du client.
 */
export async function admitPosedUploads(
  ctx: MutationCtx,
  uploaderId: Id<"persons">,
  args: {
    /** Ce que la ligne porte AVANT l'écriture (vide pour une ligne neuve). */
    inPlace: Iterable<string | null | undefined>
    /** Ce que la ligne portera APRÈS l'écriture. */
    posed: readonly PosedUpload[]
    meta: PosedUploadMeta
  },
): Promise<Map<string, StoredBlobFacts>> {
  const inPlace = new Set<string>()
  for (const storageId of args.inPlace) if (storageId) inPlace.add(storageId)
  const admitted = new Map<string, StoredBlobFacts>()
  for (const ref of args.posed) {
    // La même pièce neuve posée deux fois dans une écriture n'entre qu'une fois.
    if (inPlace.has(ref.storageId) || admitted.has(ref.storageId)) continue
    // Un identifiant qui ne désigne aucun fichier se refuse comme un identifiant inventé.
    const storageId = ctx.db.system.normalizeId("_storage", ref.storageId)
    if (!storageId) return notFound()
    await assertFreshUpload(ctx, uploaderId, storageId)
    const stored = await admitStoredUpload(
      ctx,
      { storageId, usage: ref.usage, ...(ref.mimeType ? { mimeType: ref.mimeType } : {}), ...(ref.sizeBytes !== undefined ? { sizeBytes: ref.sizeBytes } : {}) },
      { ...args.meta, uploadedByPersonId: uploaderId, ...(ref.filename ? { filename: ref.filename } : {}) },
    )
    admitted.set(ref.storageId, { storageId, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256 })
  }
  return admitted
}
