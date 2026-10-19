/**
 * P10 (finitions techniques) — les pièces d'un message commercial passent UNIQUEMENT par la garde
 * des fichiers, composée ici même avec les primitives partagées (aucune règle recopiée) :
 *
 *   1. le NOMBRE se juge avant toute lecture du stockage (deux pièces, `COMMERCIAL_ATTACHMENTS_MAX`) ;
 *   2. chaque dépôt doit être NEUF et au nom de l'émetteur (`assertFreshUpload`) : connaître le
 *      `storageId` d'un tiers ne suffit pas à en faire sa pièce ;
 *   3. il est admis sous la politique `chat_attachment` (`admitStoredUpload`) : poids et type RÉELS
 *      relus au stockage, inscription à l'analyse au nom de l'émetteur et du réseau du fil ;
 *   4. le lot est jugé ENSEMBLE par le contrat partagé (`assertAttachmentBatch`).
 *
 * Pourquoi ce fichier plutôt que `messaging/attachmentStorage.verifyDeclaredAttachments` : le module
 * qui délivre une URL de dépôt (`messages.generateUploadUrl` → `guardUploadUrl`) doit rattacher ses
 * fichiers par la garde lui-même (cliquet `upload-policy`, temps 2, jugé par dossier de module). Le
 * comportement est celui de l'envoi P10 d'origine : mêmes refus, même ordre, même ligne d'analyse.
 * La délivrance reste `messaging/participation.deliverAttachments` (URL servie ou retenue nommée).
 */
import { assertAttachmentBatch } from "@antsia/social-contracts/attachments"
import { COMMERCIAL_ATTACHMENTS_MAX } from "@antsia/social-domain/commercialContact"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked, failRule } from "../../lib/errors"
import { admitStoredUpload, assertFreshUpload } from "../files/admission"
import type { DeclaredAttachment, StoredAttachment } from "../messaging/attachmentStorage"

export async function admitCommercialAttachments(
  ctx: MutationCtx,
  declared: readonly DeclaredAttachment[] | undefined,
  meta: { readonly networkId: Id<"networks">; readonly senderPersonId: Id<"persons"> },
): Promise<StoredAttachment[] | undefined> {
  if (declared === undefined || declared.length === 0) return undefined
  // Défense en profondeur : l'envoi refuse déjà au-delà de deux pièces, avant l'empreinte.
  if (declared.length > COMMERCIAL_ATTACHMENTS_MAX) return failRule("ATTACHMENTS_TOO_MANY", { max: COMMERCIAL_ATTACHMENTS_MAX })
  const verified: StoredAttachment[] = []
  for (const file of declared) {
    await assertFreshUpload(ctx, meta.senderPersonId, file.storageId)
    const stored = await admitStoredUpload(
      ctx,
      { storageId: file.storageId, usage: "chat_attachment", mimeType: file.mimeType, sizeBytes: file.sizeBytes },
      { source: "message", networkId: meta.networkId, uploadedByPersonId: meta.senderPersonId, filename: file.filename },
    )
    verified.push({
      storageId: file.storageId,
      filename: file.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      ...(file.durationMs !== undefined ? { durationMs: file.durationMs } : {}),
    })
  }
  checked(() => assertAttachmentBatch(verified))
  return verified
}
