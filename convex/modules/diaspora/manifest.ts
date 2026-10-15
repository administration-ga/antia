/**
 * Manifeste de la tranche `diaspora` — ce qu'elle apporte au moteur, en un lieu :
 * le réseau qu'elle gouverne, ses tables, les seaux de débit qu'elle consomme, les
 * finalités de consentement qu'elle lit, les contrats qu'elle consomme, et son
 * passage planifié. Aucune fonction ici ; le test de la tranche vérifie que ce
 * manifeste dit vrai (tables du schéma, seaux du moteur).
 */
import { ATTESTATION_CONTRACT, DIASPORALE_NETWORK_SLUG, DIASPORALE_SLICE } from "@diasporale/domain"

import type { RateLimitBucket } from "../../lib/rateLimit"

export const DIASPORA_SLICE_MANIFEST = {
  slice: DIASPORALE_SLICE,
  network: DIASPORALE_NETWORK_SLUG,
  tables: ["countryHubs", "sponsorships", "consularAttestations", "communityImports", "memberPrivacy"],
  rateLimits: [
    "network.join",
    "network.leave",
    "person.facet",
    "diaspora.sponsor",
    "diaspora.sponsor.revoke",
    "diaspora.attestation.request",
  ] as const satisfies readonly RateLimitBucket[],
  consentPurposes: ["social_profile", "directory", "consular_attestation"],
  contracts: [ATTESTATION_CONTRACT, "DIASPORA-COMMUNAUTE-V1"],
  /** Passage nocturne des compteurs de hub (`convex/crons.ts`, fichier du moteur). */
  scheduled: ["modules/diaspora/hubs:refreshHubCounters"],
} as const
