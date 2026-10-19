// Dupliqué de socle/convex/lib/egressUploads.ts @ ad2e7fdc2 — adaptations : politique de dépôt du MOTEUR — usage `live_recording` du registre du domaine (`@antsia/social-domain/uploadPolicy`) au lieu d'`enregistrement_egress` ; temps 2 PAR LA GARDE DES FICHIERS (le moteur ne sert aucun fichier qu'elle ne connaît pas) : un fichier NEUF seulement (`assertFreshUpload` — un fichier déjà connu n'est ni rattaché ni supprimé), confronté puis inscrit à l'analyse (`admitStoredUpload`, réseau et hôte de la conférence) tant qu'il tient dans la borne d'inspection de la garde, au-delà confronté (`assertStoredUpload`) puis inscrit comme produit par la plateforme (`registerGeneratedBlob`) — l'analyse sauterait le fichier après l'avoir chargé ENTIER en mémoire ; sans déclaration (complétion interne d'avant le rapatriement en flux), inscrit comme produit par la plateforme, comme les enregistrements d'appel du socle ; le refus se lit dans le code de la garde (`ConvexError`) et devient une VALEUR, jamais une exception qui annulerait la suppression ; fichier écarté : blob ET ligne d'analyse (`purgeStoredFile`, D10) ; `tryStoredUpload` (retiré du moteur) et la phrase `EGRESS_UPLOAD_REFUSED_REASON` partent — le motif est le code `upload_refused` (`replayComposition`).
/**
 * La politique de dépôt (`lib/uploadPolicy.ts`) appliquée aux fichiers
 * d'Egress LiveKit rapatriés par le SERVEUR — correctif du 2026-09-17.
 *
 * Le rapatriement en flux (`lib/livekitEgressFileTransfer.ts`) dépose le
 * fichier par une URL de dépôt, parce que `ctx.storage.store` exige un `Blob`
 * en mémoire. Même délivrée au seul serveur, cette URL suit les DEUX temps de
 * la politique :
 *
 *  1. `egressUploadUrl` — l'URL est délivrée pour un usage NOMMÉ
 *     (`live_recording`), jamais brute ;
 *  2. `acceptStoredEgressFile` — au RATTACHEMENT, dans la mutation de la
 *     rediffusion : le fichier RÉELLEMENT stocké est confronté à l'usage (liste
 *     blanche audio/vidéo, plafond) et à ce que le transfert a déclaré (type,
 *     taille), puis INSCRIT à la garde des fichiers — sans quoi la garde de
 *     délivrance, fail-closed, ne le servirait jamais. Refusé, il est SUPPRIMÉ
 *     et la rediffusion conclut sans fichier.
 *
 * Ce que le second temps rattrape en pratique : une URL présignée qui rend une
 * page d'erreur en 200 (`text/html`), ou un fichier dont la taille stockée ne
 * correspond pas aux octets transférés.
 *
 * Sans enregistrement de fonction ni import de `_generated/api` : importé par
 * les actions Node ET par la mutation de complétion.
 */
import { FILE_GUARD_MAX_INSPECT_BYTES } from "@antsia/social-domain/filePolicy"
import { UPLOAD_USAGES } from "@antsia/social-domain/uploadPolicy"
import { ConvexError, v } from "convex/values"

import type { Id } from "../_generated/dataModel"
import type { ActionCtx, MutationCtx } from "../_generated/server"
import { admitStoredUpload, assertFreshUpload, registerGeneratedBlob } from "../modules/files/admission"
import { purgeStoredFile } from "../modules/files/purge"
import { assertStoredUpload, guardUploadUrl } from "./uploadPolicy"

export const EGRESS_UPLOAD_USAGE = "live_recording" as const

/** Plafond de l'usage — le transfert en flux s'y aligne, une seule valeur. */
export const EGRESS_UPLOAD_MAX_BYTES = UPLOAD_USAGES[EGRESS_UPLOAD_USAGE].maxBytes

/** Le type d'un enregistrement de direct quand rien d'autre ne le dit (contrat `directs/….mp4`). */
export const EGRESS_DEFAULT_MIME_TYPE = "video/mp4"

/** Ce que le transfert DÉCLARE du fichier qu'il vient de déposer. */
export const egressUploadValidator = v.object({
  mimeType: v.string(),
  sizeBytes: v.number(),
})

export type EgressUploadDeclaration = { mimeType: string; sizeBytes: number }

/**
 * À QUI le fichier se rattache dans la garde : le réseau de la conférence,
 * son hôte (le geste qui l'a produit — l'effacement le retrouve par lui), et
 * son chemin de contrat d'egress, comme nom.
 */
export type EgressFileOwner = {
  networkId: Id<"networks">
  personId: Id<"persons">
  filename: string
}

/** Temps 1 — l'URL de dépôt d'un fichier d'egress, pour l'action qui transfère. */
export async function egressUploadUrl(ctx: Pick<ActionCtx, "storage">): Promise<string> {
  return await guardUploadUrl(ctx, EGRESS_UPLOAD_USAGE)
}

/**
 * Temps 2 — au rattachement. `true` : le fichier stocké est bien un
 * enregistrement, conforme à ce que le transfert a déclaré, et la garde le
 * connaît. `false` : il n'est pas rattaché (supprimé s'il était neuf), et
 * l'appelant conclut comme sans fichier.
 *
 * ⚠️ Deux chemins d'inscription, et la borne qui les sépare est celle de la
 * garde : en deçà de `FILE_GUARD_MAX_INSPECT_BYTES`, le fichier est ADMIS
 * comme tout dépôt (analyse : inspection des octets, antivirus) ; au-delà,
 * l'analyse le sauterait (`too_large`) après l'avoir chargé ENTIER en mémoire
 * — une conférence de vingt minutes dépasse les 512 Mio d'une action Node.
 * Le fichier, produit par le service d'enregistrement de la plateforme, est
 * alors inscrit comme tel (`registerGeneratedBlob`) : servable, et TRACÉ.
 */
export async function acceptStoredEgressFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  declared: EgressUploadDeclaration | undefined,
  owner: EgressFileOwner,
): Promise<boolean> {
  const generated = { networkId: owner.networkId, uploadedByPersonId: owner.personId, filename: owner.filename }
  if (declared === undefined) {
    // Complétion sans déclaration : la rediffusion d'un service de la plateforme, inscrite comme telle.
    await registerGeneratedBlob(ctx, storageId, { ...generated, mimeType: EGRESS_DEFAULT_MIME_TYPE })
    return true
  }

  // Un fichier NEUF seulement. Un fichier que la garde connaît déjà n'est pas
  // le nôtre : ni rattaché, ni supprimé.
  try {
    await assertFreshUpload(ctx, null, storageId)
  } catch (error) {
    if (error instanceof ConvexError) return false
    throw error
  }

  const upload = { storageId, usage: EGRESS_UPLOAD_USAGE, mimeType: declared.mimeType, sizeBytes: declared.sizeBytes }
  try {
    if (declared.sizeBytes <= FILE_GUARD_MAX_INSPECT_BYTES) {
      await admitStoredUpload(ctx, upload, { source: "live", ...generated })
    } else {
      const stored = await assertStoredUpload(ctx, upload)
      await registerGeneratedBlob(ctx, storageId, { ...generated, mimeType: stored.mimeType })
    }
    return true
  } catch (error) {
    // Refus de la politique (type, taille, désaccord) : une valeur, et le
    // fichier neuf disparaît dans CETTE transaction — une exception
    // l'annulerait, et le blob resterait stocké pour toujours.
    if (!(error instanceof ConvexError)) throw error
    await discardStoredEgressFile(ctx, storageId)
    return false
  }
}

/**
 * Un fichier déposé par le transfert mais qui ne sera rattaché à RIEN (ligne
 * introuvable, déjà conclue, refusée) : supprimé avec sa ligne d'analyse s'il
 * en a une, sinon il resterait stocké pour toujours, invisible de tous.
 * Idempotent.
 */
export async function discardStoredEgressFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  if ((await ctx.db.system.get("_storage", storageId)) !== null) {
    await purgeStoredFile(ctx, storageId)
  }
}
