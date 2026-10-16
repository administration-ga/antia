// Dupliqué de socle/convex/modules/reseau/federation.ts @ 25398f565 — adaptations : reçus et lettres mortes seulement, environnement explicite, signature rejugée et quota avant effet, digest exact du corps, registre métier vide sans personne/adhésion/reflet créés.
import { FEDERATION_BODY_MAX_BYTES, federationEnvironment, freshFederationTimestamp, parseFederationEnvelope } from "@antsia/social-domain/federationProtocol"
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { enforceRateLimit } from "../../lib/rateLimit"
import { federationBodyDigest, verifyFederationSignature } from "./signature"
import { federationEnvironmentValidator, federationReceiptStatusValidator } from "./tables"

export const admit = internalMutation({
  args: { emitterId: v.id("federationEmitters"), emitterRevision: v.number(), environment: federationEnvironmentValidator, timestamp: v.string(), signature: v.string(), rawBody: v.string() },
  returns: v.object({ outcome: v.union(v.literal("accepted"), v.literal("duplicate"), v.literal("conflict"), v.literal("unauthorized"), v.literal("unavailable"), v.literal("invalid_envelope")), status: v.optional(federationReceiptStatusValidator) }),
  handler: async (ctx, args) => {
    const deployedEnvironment = federationEnvironment(process.env.FEDERATION_ENVIRONMENT)
    if (!deployedEnvironment) return { outcome: "unavailable" as const }
    if (args.environment !== deployedEnvironment || !freshFederationTimestamp(args.timestamp, Date.now()) || new TextEncoder().encode(args.rawBody).byteLength > FEDERATION_BODY_MAX_BYTES) return { outcome: "unauthorized" as const }
    const emitter = await ctx.db.get(args.emitterId)
    if (!emitter?.enabled || emitter.environment !== args.environment || emitter.revision !== args.emitterRevision) return { outcome: "unauthorized" as const }
    const network = await ctx.db.get(emitter.networkId)
    if (!network || network.status !== "active") return { outcome: "unauthorized" as const }
    // Le passage HTTP a vérifié la signature. Rejouer ici avec la révision et
    // la clé COURANTES ferme la course à la désactivation/rotation de clé.
    const signature = await verifyFederationSignature({ ...args, keyEnvName: emitter.keyEnvName })
    if (signature !== "valid") return { outcome: signature === "unavailable" ? "unavailable" as const : "unauthorized" as const }
    await enforceRateLimit(ctx, "federation.receive", `${emitter._id}:${emitter.environment}`)
    const parsed = parseFederationEnvelope(args.rawBody)
    if (!parsed.ok) return { outcome: "invalid_envelope" as const }
    const envelope = parsed.envelope
    if (!emitter.allowedContracts.includes(envelope.contract)) return { outcome: "unauthorized" as const }
    const bodySha256 = await federationBodyDigest(args.rawBody)
    const existing = await ctx.db.query("federationInboxReceipts").withIndex("by_emitter_environment_event", (q) => q.eq("emitterId", emitter._id).eq("environment", emitter.environment).eq("eventId", envelope.eventId)).unique()
    if (existing) {
      if (existing.bodySha256 !== bodySha256 || existing.networkId !== emitter.networkId) return { outcome: "conflict" as const }
      return { outcome: "duplicate" as const, status: existing.status }
    }
    const now = Date.now()
    const receiptId = await ctx.db.insert("federationInboxReceipts", { networkId: emitter.networkId, emitterId: emitter._id, environment: emitter.environment, eventId: envelope.eventId, contract: envelope.contract, version: envelope.version, objectRef: envelope.objectRef, bodySha256, status: "received", receivedAt: now, updatedAt: now })
    // PA5 ferme le registre : aucun contrat métier n'est branché. Le corps
    // authentifié est gardé seulement en DLQ, lisible par opérateur vivant.
    await ctx.db.insert("federationDeadLetters", { networkId: emitter.networkId, emitterId: emitter._id, environment: emitter.environment, receiptId, eventId: envelope.eventId, contract: envelope.contract, objectRef: envelope.objectRef, bodySha256, rawBody: args.rawBody, reason: "unsupported_contract", status: "dead_letter", attempts: 1, firstFailedAt: now, lastAttemptAt: now })
    await ctx.db.patch(receiptId, { status: "dead_letter", updatedAt: now })
    return { outcome: "accepted" as const, status: "dead_letter" as const }
  },
})
