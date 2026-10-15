/**
 * Garde des fichiers — la PURGE d'un fichier : le blob ET sa ligne d'analyse,
 * jamais l'un sans l'autre (D10 : au socle, les purges de stories, de groupes
 * et de groupes thématiques laissaient la ligne d'analyse orpheline).
 * Idempotente : un blob déjà absent est une purge acquise.
 */
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { findScanByStorageId } from "./admission"

export async function purgeStoredFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  const scan = await findScanByStorageId(ctx, storageId)
  try {
    await ctx.storage.delete(storageId)
  } catch {
    // Blob déjà absent : la purge est acquise.
  }
  if (scan) await ctx.db.delete(scan._id)
}
