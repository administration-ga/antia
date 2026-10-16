// Dupliqué de socle/convex/modules/reseauPages/validators.ts @ ad2e7fdc2 — adaptations : littéraux DÉRIVÉS des listes du domaine pur (`@antsia/social-domain/pages`, une seule source) ; rôles de signataire, statuts et décisions de revendication, audiences d'une publication de page et carte allowlistée d'une page ajoutés.
/**
 * Validateurs des PAGES. Module sans fonction Convex enregistrée : un import
 * client l'atteint sans embarquer le backend.
 */
import { PAGE_CLAIM_DECISIONS, PAGE_CLAIM_STATUSES, PAGE_POST_AUDIENCES, PAGE_ROLES, PAGE_STATUSES } from "@antsia/social-domain/pages"
import { type Infer, v } from "convex/values"

import { badgeValidator, literals, pageOwnerKindValidator } from "../../lib/validators"

/**
 * État d'une page : `active`, ou `inactive` (le retrait — la ligne demeure,
 * ses publications cessent d'être servies sans jamais être supprimées).
 */
export const pageStatusValidator = literals(PAGE_STATUSES)

/** Rôle d'un signataire : `admin` publie et gère, `signatory` publie. */
export const pageRoleValidator = literals(PAGE_ROLES)

export const pageClaimStatusValidator = literals(PAGE_CLAIM_STATUSES)

export const pageClaimDecisionValidator = literals(PAGE_CLAIM_DECISIONS)

/** Le communiqué (`public`) ou la note aux abonnés (`followers`). */
export const pagePostAudienceValidator = literals(PAGE_POST_AUDIENCES)

/**
 * La CARTE d'une page — l'en-tête d'une publication, une ligne d'annuaire, un
 * rappel. Allowlistée : aucun identifiant de stockage (le logo par la garde des
 * fichiers), le badge CALCULÉ de la confiance.
 */
export const pageCardValidator = v.object({
  pageId: v.id("pages"),
  networkId: v.id("networks"),
  handle: v.string(),
  name: v.string(),
  shortName: v.union(v.string(), v.null()),
  logoUrl: v.union(v.string(), v.null()),
  badge: badgeValidator,
  ownerKind: pageOwnerKindValidator,
  country: v.union(v.string(), v.null()),
})

export type PageCard = Infer<typeof pageCardValidator>
