/**
 * Validateurs PRÉCIS des arguments et des projections de la tranche `diaspora`,
 * dérivés des constantes de `@diasporale/domain` (jamais le validateur permissif).
 * Les projections sont ALLOWLISTÉES : ce qui n'y figure pas ne sort pas.
 */
import {
  ATTESTATION_SUBJECT_KINDS,
  CONSENT_PURPOSES,
  MEMBER_CAPABILITIES,
  SPONSORSHIP_REFUSALS,
  TRUST_BADGES,
  WRITE_RATE_TIERS,
} from "@diasporale/domain"
import { v } from "convex/values"

import { literals } from "../../lib/validators"
import { directoryVisibilityValidator, facetLevelsValidator, fieldVisibilityValidator } from "./tables"

export { directoryVisibilityValidator, facetLevelsValidator }

/**
 * Ce que la personne SAISIT de sa facette (`FacetInput` du domaine) : le poste
 * consulaire n'y figure pas — il ne vient que de l'attestation.
 */
export const facetInputValidator = v.object({
  countryOfResidence: v.string(),
  city: v.optional(v.union(v.string(), v.null())),
  associationIds: v.optional(v.array(v.string())),
  arrivedAt: v.optional(v.union(v.number(), v.null())),
  helpAvailable: v.optional(v.boolean()),
  visibility: v.optional(
    v.object({
      countryOfResidence: v.optional(fieldVisibilityValidator),
      city: v.optional(fieldVisibilityValidator),
      postSlug: v.optional(fieldVisibilityValidator),
      associationIds: v.optional(fieldVisibilityValidator),
      arrivedAt: v.optional(fieldVisibilityValidator),
      helpAvailable: v.optional(fieldVisibilityValidator),
    }),
  ),
})

/** La facette complète, telle que SA titulaire la voit (et elle seule). */
export const ownFacetValidator = v.object({
  countryOfResidence: v.string(),
  city: v.optional(v.string()),
  postSlug: v.optional(v.string()),
  associationIds: v.array(v.string()),
  arrivedAt: v.optional(v.number()),
  helpAvailable: v.boolean(),
  visibility: facetLevelsValidator,
})

/** Les finalités de consentement que DIASPORALE demande (sous-ensemble de celles du moteur). */
export const consentPurposeValidator = literals(CONSENT_PURPOSES)
export const trustBadgeValidator = literals(TRUST_BADGES)
export const memberCapabilityValidator = literals(MEMBER_CAPABILITIES)
export const writeRateTierValidator = literals(WRITE_RATE_TIERS)
export const sponsorshipRefusalValidator = literals(SPONSORSHIP_REFUSALS)
export const attestationSubjectKindValidator = literals(ATTESTATION_SUBJECT_KINDS)

/** Issue de la dernière demande d'attestation, sans la raison consulaire (EXF-DG-03). */
export const attestationOutcomeValidator = literals(["verified", "not_confirmed", "none"])

/** Une personne citée (parrain, filleul) : identifiant public et nom affiché, rien d'autre. */
export const personLabelValidator = v.object({ handle: v.string(), displayName: v.string() })

/** Présentation d'un compteur de hub : le chiffre, ou « sous le seuil » (le chiffre ne sort pas). */
export const counterPresentationValidator = v.union(
  v.object({ kind: v.literal("value"), value: v.number() }),
  v.object({ kind: v.literal("below_threshold"), threshold: v.number() }),
)

export const hubCountersValidator = v.object({
  dormant: v.boolean(),
  members: counterPresentationValidator,
  associations: counterPresentationValidator,
  companies: counterPresentationValidator,
  upcomingEvents: counterPresentationValidator,
})

export const countryHubViewValidator = v.object({
  country: v.string(),
  open: v.boolean(),
  counters: hubCountersValidator,
  /** Dernier passage nocturne ; `null` tant qu'aucun n'a compté. */
  countersComputedAt: v.union(v.number(), v.null()),
})
