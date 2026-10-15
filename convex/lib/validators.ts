/**
 * Validateurs PRÉCIS des notions du moteur, dérivés des constantes du domaine
 * pur (`@antia/social-domain`) : une seule source pour les littéraux, jamais
 * le validateur permissif (cliquet `no-any-validators`).
 */
import { BADGES, IDENTITY_PROVIDERS, PAGE_OWNER_KINDS, PAGE_TRUST_LEVELS } from "@antia/social-domain/badges"
import { CONSENT_ORIGINS, CONSENT_PURPOSES } from "@antia/social-domain/consent"
import { PERSONAL_POST_AUDIENCES, PERSONAL_POST_STATUSES, PERSONAL_REACH_AUDIENCES, PERSONAL_REACTION_KINDS } from "@antia/social-domain/content"
import { FACET_FIELD_KINDS, FACET_VISIBILITIES } from "@antia/social-domain/facets"
import { ACTIVE_MEMBERSHIP_STATUSES, MEMBERSHIP_ROLES, MEMBERSHIP_STATUSES, VERIFICATION_SOURCES } from "@antia/social-domain/membership"
import { CONTENT_VISIBILITIES, MEMBERSHIP_POLICIES, NETWORK_KINDS, NETWORK_STATUSES } from "@antia/social-domain/network"
import { type Validator, v, type VLiteral, type VUnion } from "convex/values"

/** `v.union(v.literal(a), v.literal(b), …)` à partir d'une liste `as const`. */
export function literals<const T extends readonly [string, string, ...string[]]>(
  values: T,
): VUnion<T[number], { -readonly [K in keyof T]: VLiteral<T[K], "required"> }, "required"> {
  const [first, second, ...rest] = values.map((value) => v.literal(value)) as unknown as [
    Validator<T[number], "required">,
    Validator<T[number], "required">,
    ...Validator<T[number], "required">[],
  ]
  return v.union(first, second, ...rest) as never
}

export const networkKindValidator = literals(NETWORK_KINDS)
export const membershipPolicyValidator = literals(MEMBERSHIP_POLICIES)
export const contentVisibilityValidator = literals(CONTENT_VISIBILITIES)
export const networkStatusValidator = literals(NETWORK_STATUSES)

export const membershipStatusValidator = literals(MEMBERSHIP_STATUSES)
export const activeMembershipStatusValidator = literals(ACTIVE_MEMBERSHIP_STATUSES)
export const membershipRoleValidator = literals(MEMBERSHIP_ROLES)
export const verificationSourceValidator = literals(VERIFICATION_SOURCES)

export const identityProviderValidator = literals(IDENTITY_PROVIDERS)
export const badgeValidator = literals(BADGES)
export const pageTrustValidator = literals(PAGE_TRUST_LEVELS)
export const pageOwnerKindValidator = literals(PAGE_OWNER_KINDS)

export const facetFieldKindValidator = literals(FACET_FIELD_KINDS)
export const facetVisibilityValidator = literals(FACET_VISIBILITIES)
export const facetValueValidator = v.union(v.string(), v.number(), v.boolean(), v.array(v.string()))

export const facetFieldValidator = v.object({
  key: v.string(),
  kind: facetFieldKindValidator,
  required: v.boolean(),
  defaultVisibility: facetVisibilityValidator,
  maxLength: v.optional(v.number()),
  maxItems: v.optional(v.number()),
  enumValues: v.optional(v.array(v.string())),
  excludedValues: v.optional(v.array(v.string())),
})
export const facetSchemaValidator = v.object({ fields: v.array(facetFieldValidator) })

export const consentPurposeValidator = literals(CONSENT_PURPOSES)
export const consentOriginValidator = literals(CONSENT_ORIGINS)

export const localeValidator = v.union(v.literal("fr"), v.literal("en"))

// Publications et engagement (miroirs EXACTS des listes du domaine pur)
export const postAudienceValidator = literals(PERSONAL_POST_AUDIENCES)
export const reachAudienceValidator = literals(PERSONAL_REACH_AUDIENCES)
export const postStatusValidator = literals(PERSONAL_POST_STATUSES)
export const reactionKindValidator = literals(PERSONAL_REACTION_KINDS)
export const reactionCountsValidator = v.object({ like: v.number(), bravo: v.number(), soutien: v.number(), instructif: v.number() })
