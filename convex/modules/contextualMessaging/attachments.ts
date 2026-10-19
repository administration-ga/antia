/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §5.7) — les pièces d'un message contextuel passent
 * UNIQUEMENT par la garde des fichiers, avec les primitives partagées de
 * `messaging/attachmentStorage.ts#verifyDeclaredAttachments` (aucune règle recopiée) :
 *
 *   1. le NOMBRE se juge avant toute lecture du stockage (deux pièces, D9) ;
 *   2. chaque dépôt doit être NEUF et au nom de l'émetteur (`assertFreshUpload`) : connaître le
 *      `storageId` d'un tiers ne suffit pas ;
 *   3. il est admis sous la politique `chat_attachment` (`admitStoredUpload`) : poids et type
 *      RÉELS relus au stockage, inscription à l'analyse au nom de l'émetteur et du réseau ;
 *   4. le lot est jugé ENSEMBLE par le contrat partagé (`assertAttachmentBatch`).
 *
 * Le module compose ces primitives lui-même parce que le module qui délivre une URL de dépôt doit
 * rattacher ses fichiers par la garde (cliquet `upload-policy`, temps 2). La délivrance passe par
 * `deliverAttachments` (URL servie ou retenue nommée) ; aucune pièce n'est recopiée d'un autre fil.
 */
import { assertAttachmentBatch } from "@antsia/social-contracts/attachments"
import { CONTEXTUAL_ATTACHMENTS_MAX } from "@antsia/social-domain/contextualMessaging"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked, failRule } from "../../lib/errors"
import { admitStoredUpload, assertFreshUpload } from "../files/admission"
import type { DeclaredAttachment, StoredAttachment } from "../messaging/attachmentStorage"

export async function admitContextualAttachments(
  ctx: MutationCtx,
  declared: readonly DeclaredAttachment[] | undefined,
  meta: { readonly networkId: Id<"networks">; readonly personId: Id<"persons"> },
): Promise<StoredAttachment[] | undefined> {
  if (declared === undefined || declared.length === 0) return undefined
  if (declared.length > CONTEXTUAL_ATTACHMENTS_MAX) return failRule("ATTACHMENTS_TOO_MANY", { max: CONTEXTUAL_ATTACHMENTS_MAX })
  const verified: StoredAttachment[] = []
  for (const file of declared) {
    await assertFreshUpload(ctx, meta.personId, file.storageId)
    const stored = await admitStoredUpload(
      ctx,
      { storageId: file.storageId, usage: "chat_attachment", mimeType: file.mimeType, sizeBytes: file.sizeBytes },
      { source: "message", networkId: meta.networkId, uploadedByPersonId: meta.personId, filename: file.filename },
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
