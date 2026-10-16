// Dupliqué de socle/convex/modules/reseau/federationTables.ts @ 25398f565 — adaptations : réseaux du moteur, émetteur/environnement, empreinte du corps exact, payload borné signé, aucun graphe externe créé ; miroir réservé à PA9.
import { FEDERATION_ENVIRONMENTS } from "@antsia/social-domain/federationProtocol"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const federationEnvironmentValidator = literals(FEDERATION_ENVIRONMENTS)
export const federationReceiptStatusValidator = v.union(v.literal("received"), v.literal("applied"), v.literal("dead_letter"))
export const federationFailureValidator = v.union(v.literal("unsupported_contract"), v.literal("contract_not_allowed"))

export const federationTables = {
  federationEmitters: defineTable({
    networkId: v.id("networks"), slug: v.string(), environment: federationEnvironmentValidator,
    enabled: v.boolean(), keyEnvName: v.string(), allowedContracts: v.array(v.string()),
    revision: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_slug_environment", ["slug", "environment"]).index("by_key_env", ["keyEnvName"]).index("by_network", ["networkId"]),

  federationInboxReceipts: defineTable({
    networkId: v.id("networks"), emitterId: v.id("federationEmitters"), environment: federationEnvironmentValidator,
    eventId: v.string(), contract: v.string(), version: v.literal(1), objectRef: v.string(), bodySha256: v.string(),
    status: federationReceiptStatusValidator, receivedAt: v.number(), updatedAt: v.number(),
  }).index("by_emitter_environment_event", ["emitterId", "environment", "eventId"]).index("by_network_receivedAt", ["networkId", "receivedAt"]),

  federationDeadLetters: defineTable({
    networkId: v.id("networks"), emitterId: v.id("federationEmitters"), environment: federationEnvironmentValidator,
    receiptId: v.id("federationInboxReceipts"), eventId: v.string(), contract: v.string(), objectRef: v.string(),
    bodySha256: v.string(), rawBody: v.string(), reason: federationFailureValidator,
    status: v.union(v.literal("dead_letter"), v.literal("resolved")), attempts: v.number(),
    firstFailedAt: v.number(), lastAttemptAt: v.number(), resolvedAt: v.optional(v.number()),
  }).index("by_receipt", ["receiptId"]).index("by_network_status_failedAt", ["networkId", "status", "firstFailedAt"]),

  federationReplayAudit: defineTable({
    networkId: v.id("networks"), emitterId: v.id("federationEmitters"), environment: federationEnvironmentValidator,
    deadLetterId: v.id("federationDeadLetters"), eventId: v.string(), requestedByPersonId: v.id("persons"),
    reason: v.string(), outcome: v.union(v.literal("deduplicated"), v.literal("still_failing")), requestedAt: v.number(),
  }).index("by_dead_letter_at", ["deadLetterId", "requestedAt"]).index("by_network_at", ["networkId", "requestedAt"]),

  /** Aucun écrivain PA5 ; un contrat métier doit admettre le reflet avant toute ligne. */
  mirrors: defineTable({
    networkId: v.id("networks"), emitterId: v.id("federationEmitters"), environment: federationEnvironmentValidator,
    contract: v.string(), objectRef: v.string(), localTable: v.union(v.literal("pages"), v.literal("posts"), v.literal("persons")),
    localId: v.string(), updatedAt: v.number(),
  }).index("by_emitter_environment_object", ["emitterId", "environment", "objectRef"]).index("by_network", ["networkId"]),
}
