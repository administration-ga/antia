/** P08 : reçu technique de recette, sans catalogue, personne, contenu ou secret. */
import { defineTable } from "convex/server"
import { v } from "convex/values"

export const commerceTransportTables = {
  federationCommerceProbes: defineTable({
    networkId: v.id("networks"), emitterId: v.id("federationEmitters"), eventId: v.string(),
    correlationId: v.string(), sentAt: v.number(), receivedAt: v.number(),
  }).index("by_emitter_event", ["emitterId", "eventId"]),
}
