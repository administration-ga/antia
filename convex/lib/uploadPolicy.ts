// Dupliqué de socle/convex/lib/uploadPolicy.ts @ ad2e7fdc2 — adaptations : lecture de `_storage` seulement, les règles vivent dans `@antia/social-domain/uploadPolicy` ; refus à code (`notFound` indistinct pour un fichier absent, règles `UPLOAD_*` en `invalidArgument`) ; `tryStoredUpload` retiré (aucun import en masse dans le moteur).
/**
 * Politique de dépôt — les deux temps côté backend.
 *
 *   1. `guardUploadUrl(ctx, usage)` délivre l'URL de dépôt pour un usage NOMMÉ
 *      (seul appel légitime de `ctx.storage.generateUploadUrl`, cliquet
 *      `upload-policy`) ;
 *   2. `assertStoredUpload(ctx, declared)` confronte, au rattachement, le
 *      fichier RÉELLEMENT stocké à l'usage et à la déclaration du client.
 *
 * Sauter le temps 2 laisse la surface nue, même avec le temps 1. Une surface
 * publique passe d'ailleurs par `admitStoredUpload` (garde des fichiers), qui
 * appelle ce temps 2 puis inscrit le fichier à l'analyse.
 */
import { checkStoredUpload, type DeclaredUpload, type StoredUpload, UPLOAD_USAGES, type UploadUsage } from "@antia/social-domain/uploadPolicy"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { checked, fail, notFound } from "./errors"

type StorageReadCtx = Pick<MutationCtx | QueryCtx, "db">

/** L'usage est-il au registre ? (propriété PROPRE : `toString` n'est pas un usage). */
function isKnownUsage(usage: string): usage is UploadUsage {
  return Object.prototype.hasOwnProperty.call(UPLOAD_USAGES, usage)
}

/**
 * Porte du temps 1 : une URL de dépôt pour un usage du registre. Ne vérifie
 * rien du fichier — il n'existe pas encore. Ne dispense PAS du temps 2.
 */
export async function guardUploadUrl(ctx: Pick<MutationCtx, "storage">, usage: UploadUsage): Promise<string> {
  // Lecture volontaire : un usage absent du registre échoue ici, pas au premier dépôt.
  if (!isKnownUsage(usage)) return fail("invalidArgument", { field: "usage" })
  return await ctx.storage.generateUploadUrl()
}

/**
 * Porte du temps 2 : le fichier est déposé, il est confronté à l'usage annoncé.
 * Un fichier absent du stockage (identifiant forgé, dépôt avorté) se refuse
 * comme toute ressource introuvable : `notFound`, indistinct.
 */
export async function assertStoredUpload(
  ctx: StorageReadCtx,
  declared: DeclaredUpload<Id<"_storage">>,
): Promise<StoredUpload<Id<"_storage">>> {
  if (!isKnownUsage(declared.usage)) return fail("invalidArgument", { field: "usage" })
  const stored = await ctx.db.system.get("_storage", declared.storageId)
  if (!stored) return notFound()
  return checked(() => checkStoredUpload(declared, { contentType: stored.contentType, size: stored.size, sha256: stored.sha256 }))
}
