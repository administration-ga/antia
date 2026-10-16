// Dupliqué de socle/convex/modules/reseauPersonnel/messagerie/attachmentStorage.ts @ ad2e7fdc2 — adaptations : garde des fichiers du moteur (fraîcheur du dépôt au nom de l'expéditeur, puis admission sous la politique `chat_attachment`, réseau et déposant inscrits) ; provenance iDocument (`sourceDocumentId`) retirée ; le POIDS et le type sont confrontés au stockage (une déclaration qui ment est refusée, `UPLOAD_MISMATCH`) ; refus à code ; le lot est jugé par le contrat partagé (`assertAttachmentBatch`), son NOMBRE avant toute lecture du stockage.
/**
 * Le SEUL endroit qui relit le stockage avant d'écrire une pièce jointe de
 * conversation — partagé par l'envoi, l'ouverture d'un fil et le transfert (et
 * les groupes au lot 11) : un contrôle recopié divergerait au premier correctif.
 *
 * Une pièce DÉCLARÉE par l'expéditeur doit être NEUVE (`assertFreshUpload`) :
 * connaître le `storageId` d'un tiers ne suffit pas à en faire sa pièce. Une
 * pièce RECOPIÉE par le serveur (transfert, sans acteur) n'est pas un dépôt :
 * son identifiant vient du message d'origine, jamais d'un argument client.
 */
import { ATTACHMENTS_MAX_PER_MESSAGE, type AttachmentInput, assertAttachmentBatch } from "@antsia/social-contracts/attachments"
import type { FileScanSource } from "@antsia/social-domain/filePolicy"
import { type Infer, v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked, failRule } from "../../lib/errors"
import { admitStoredUpload, assertFreshUpload } from "../files/admission"
import type { storedAttachmentValidator } from "./tables"

/** Une pièce jointe à l'ENTRÉE, telle que le client la déclare. */
export const attachmentFileValidator = v.object({
  storageId: v.id("_storage"),
  filename: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
  /** Durée d'un message VOCAL (mime sonore), en millisecondes. */
  durationMs: v.optional(v.number()),
})

export type DeclaredAttachment = Infer<typeof attachmentFileValidator>
export type StoredAttachment = Infer<typeof storedAttachmentValidator>

export interface AttachmentAdmissionMeta {
  /** L'expéditeur. Absent : une pièce RECOPIÉE par le serveur (transfert). */
  actorPersonId?: Id<"persons">
  networkId: Id<"networks">
  source: FileScanSource
}

/**
 * Relit chaque pièce au stockage (poids et type RÉELS), l'inscrit à l'analyse,
 * puis juge le lot ENSEMBLE. `filename` et `durationMs` restent déclarés : le
 * premier nomme, la seconde dessine une barre de lecture — aucun ne décide d'un
 * accès.
 */
export async function verifyDeclaredAttachments(
  ctx: MutationCtx,
  declared: readonly DeclaredAttachment[] | undefined,
  meta: AttachmentAdmissionMeta,
): Promise<StoredAttachment[] | undefined> {
  if (declared === undefined || declared.length === 0) return undefined
  // Le NOMBRE se juge avant toute lecture du stockage : un lot démesuré ne coûte rien.
  if (declared.length > ATTACHMENTS_MAX_PER_MESSAGE) return failRule("ATTACHMENTS_TOO_MANY", { max: ATTACHMENTS_MAX_PER_MESSAGE })
  const verified: StoredAttachment[] = []
  for (const file of declared) {
    if (meta.actorPersonId !== undefined) await assertFreshUpload(ctx, meta.actorPersonId, file.storageId)
    const stored = await admitStoredUpload(
      ctx,
      { storageId: file.storageId, usage: "chat_attachment", mimeType: file.mimeType, ...(meta.actorPersonId !== undefined ? { sizeBytes: file.sizeBytes } : {}) },
      { source: meta.source, networkId: meta.networkId, ...(meta.actorPersonId !== undefined ? { uploadedByPersonId: meta.actorPersonId } : {}), filename: file.filename },
    )
    verified.push({
      storageId: file.storageId,
      filename: file.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      ...(file.durationMs !== undefined ? { durationMs: file.durationMs } : {}),
    })
  }
  checked(() => assertAttachmentBatch(verified as readonly AttachmentInput[]))
  return verified
}
