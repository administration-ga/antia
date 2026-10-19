/** P09 : mapping explicite, têtes indépendantes catalogue/disponibilité et médias importés. */
import { COMMERCE_ENVIRONMENTS } from "@antsia/social-domain/commerce/primitives"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"
import { catalogKindValidator } from "./catalogValidators"

export const catalogTables = {
  shopCatalogPolicies: defineTable({ networkId: v.id("networks"), enabled: v.boolean(), updatedAt: v.number(), updatedByPersonId: v.optional(v.id("persons")) }).index("by_network", ["networkId"]),
  commerceCatalogMappings: defineTable({
    networkId: v.id("networks"), shopId: v.id("shops"), emitterId: v.id("federationEmitters"), environment: literals(COMMERCE_ENVIRONMENTS),
    shopRef: v.string(), linkRef: v.string(), enabled: v.boolean(), generation: v.number(),
    createdAt: v.number(), updatedAt: v.number(), updatedByPersonId: v.optional(v.id("persons")),
  }).index("by_network_shop", ["networkId", "shopId"]).index("by_emitter_shop_ref", ["emitterId", "shopRef"]),
  commerceCatalogHeads: defineTable({
    networkId: v.id("networks"), shopId: v.id("shops"), mappingId: v.id("commerceCatalogMappings"), mappingGeneration: v.number(),
    emitterId: v.id("federationEmitters"), environment: literals(COMMERCE_ENVIRONMENTS), objectRef: v.string(), shopRef: v.string(),
    sequence: v.union(v.literal("catalog"), v.literal("availability")), objectKind: v.union(v.literal("shop"), v.literal("offer")),
    kind: v.optional(catalogKindValidator), state: v.union(v.literal("active"), v.literal("withdrawn"), v.literal("closed")),
    revision: v.number(), digest: v.string(), body: v.string(), changedAt: v.number(), receivedAt: v.number(),
    activationRevision: v.number(), parentActivationRevision: v.number(), gap: v.boolean(),
    mediaState: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("attached"), v.literal("failed"))),
    mediaAttempts: v.optional(v.number()), mediaLeaseToken: v.optional(v.string()), mediaLeaseUntil: v.optional(v.number()), mediaStaged: v.optional(v.array(v.id("_storage"))),
    mediaError: v.optional(v.union(v.literal("configuration"), v.literal("download"), v.literal("obsolete"), v.literal("admission"))),
  }).index("by_emitter_object_sequence", ["emitterId", "objectRef", "sequence"])
    .index("by_network_shop_kind_state_changedAt", ["networkId", "shopId", "objectKind", "sequence", "state", "changedAt"])
    .index("by_media_state", ["mediaState"]),
  commerceCatalogMediaAssets: defineTable({
    networkId: v.id("networks"), headId: v.id("commerceCatalogHeads"), revision: v.number(), digest: v.string(),
    index: v.number(), publicToken: v.string(), storageId: v.id("_storage"), createdAt: v.number(),
  }).index("by_head", ["headId"]).index("by_public_token", ["publicToken"]).index("by_storage", ["storageId"]),
}
