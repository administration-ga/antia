/** P08 : preuve locale, défi éphémère privé et octets de confirmation idempotents. */
import { COMMERCE_LINK_PERMISSIONS } from "@antsia/social-domain/commerce/command"
import { COMMERCE_ENVIRONMENTS } from "@antsia/social-domain/commerce/primitives"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const commerceLinkPermissionValidator = literals(COMMERCE_LINK_PERMISSIONS)
export const commerceLinkStateValidator = v.union(v.literal("active"), v.literal("revoked"), v.literal("suspended"))

export const commerceLinkTables = {
  /** Sujet opaque stable par personne/réseau, indépendant de toute boutique. */
  shopCommerceSubjects: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), subjectRef: v.string(), createdAt: v.number(),
  }).index("by_network_person", ["networkId", "personId"]),

  /** Référence de boutique stable malgré les changements d'administrateur et de défi. */
  shopCommerceShopRefs: defineTable({
    networkId: v.id("networks"), shopId: v.id("shops"), antsiaShopRef: v.string(), createdAt: v.number(),
  }).index("by_network_shop", ["networkId", "shopId"]),

  shopCommerceLinks: defineTable({
    networkId: v.id("networks"), shopId: v.id("shops"), pageId: v.id("pages"), personId: v.id("persons"),
    state: commerceLinkStateValidator, source: v.string(), environment: literals(COMMERCE_ENVIRONMENTS), configFingerprint: v.string(),
    subjectRef: v.string(), antsiaShopRef: v.string(), shopRef: v.string(), linkRef: v.string(), permissions: v.array(commerceLinkPermissionValidator),
    consentTextVersion: v.string(), consentedAt: v.number(), linkedAt: v.number(), revokedAt: v.optional(v.number()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_network_shop", ["networkId", "shopId"]).index("by_person_state", ["personId", "state"]),

  /** Une seule incarnation courante par boutique ; tout remplacement invalide les retours anciens. */
  shopCommerceLinkChallenges: defineTable({
    networkId: v.id("networks"), shopId: v.id("shops"), pageId: v.id("pages"), personId: v.id("persons"),
    sessionDigest: v.string(), stateDigest: v.string(), source: v.string(), environment: literals(COMMERCE_ENVIRONMENTS), configFingerprint: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("refused"), v.literal("revoked")),
    phase: v.union(v.literal("preparing"), v.literal("ready"), v.literal("confirming")),
    requestId: v.string(), subjectRef: v.string(), antsiaShopRef: v.string(), permissions: v.array(commerceLinkPermissionValidator),
    consentTextVersion: v.string(), consentedAt: v.number(), expiresAt: v.number(),
    codeVerifier: v.optional(v.string()), preparationBody: v.optional(v.string()), authorizationUrl: v.optional(v.string()),
    codeDigest: v.optional(v.string()), attemptToken: v.optional(v.string()), leaseUntil: v.optional(v.number()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_network_shop", ["networkId", "shopId"]).index("by_state_digest", ["stateDigest"])
    .index("by_person_status", ["personId", "status"]),

  /** Ne sort JAMAIS dans l'export : code + PKCE dans le corps, même avant une panne HTTP. */
  shopCommerceLinkCommands: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), challengeId: v.id("shopCommerceLinkChallenges"),
    requestId: v.string(), codeDigest: v.string(), bodySha256: v.string(), rawBody: v.optional(v.string()),
    outcome: v.union(v.literal("pending"), v.literal("accepted"), v.literal("refused"), v.literal("revoked")),
    responseSha256: v.optional(v.string()), respondedAt: v.optional(v.number()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_challenge", ["challengeId"]).index("by_person", ["personId"]),
}
