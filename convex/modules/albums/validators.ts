// Dupliqué de socle/convex/modules/reseauAlbums/validators.ts @ ad2e7fdc2 — adaptations : statut DÉRIVÉ de la liste du domaine (`ALBUM_STATUSES`, une seule source au lieu d'un miroir recopié) ; sinon tel quel.
/**
 * Validateurs des ALBUMS — ce que la base et l'API acceptent.
 *
 * L'audience n'est PAS redéfinie ici : c'est la portée du moteur
 * (`reachAudienceValidator` : `public` ou `connections`). Deux définitions
 * divergeraient au premier ajout de portée.
 */
import { ALBUM_STATUSES } from "@antsia/social-domain/albums"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

/** `draft` (privé, quelle que soit l'audience), `published`, `withdrawn`. */
export const albumStatusValidator = literals(ALBUM_STATUSES)

/**
 * Le média d'une photo, TEL QU'IL EST ÉCRIT : `image` seulement. `mimeType` et
 * `sizeBytes` sont les valeurs RÉELLES relues du stockage, jamais le déclaré ;
 * `width`/`height` restent déclarés (rapport d'aspect du rendu, jamais une
 * décision).
 */
export const albumItemMediaValidator = v.object({
  storageId: v.id("_storage"),
  kind: v.literal("image"),
  mimeType: v.string(),
  sizeBytes: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
})

/**
 * Ce qu'un client DÉCLARE en ajoutant une photo. `idempotencyKey` est
 * OBLIGATOIRE : tirée par fichier à la sélection, elle fait de la reprise après
 * un téléversement partiel un renvoi exact.
 */
export const albumDeclaredItemValidator = v.object({
  storageId: v.id("_storage"),
  mimeType: v.string(),
  sizeBytes: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  caption: v.optional(v.string()),
  altText: v.optional(v.string()),
  idempotencyKey: v.string(),
})
