/** P09 : deux admissions transactionnelles autour du HTTP, sans adoption d'une autre session. */
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { requireMembership } from "../../lib/access"
import { enforceRateLimit } from "../../lib/rateLimit"
import { getActiveIdentity } from "../../lib/session"
import { assertSocialWriteAllowed } from "../moderation/policy"
import { managedShopOrNull } from "./access"
import { liveCatalogMapping } from "./catalogAccess"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { sha256Hex } from "./commerceLinkCrypto"

export const reconciliationAdmissionValidator = v.object({
  mappingId: v.id("commerceCatalogMappings"), generation: v.number(),
  personId: v.id("persons"), sessionDigest: v.string(), configFingerprint: v.string(),
  shopRef: v.string(), linkRef: v.string(), subjectRef: v.string(),
})
export type ReconciliationAdmission = {
  mappingId: Id<"commerceCatalogMappings">; generation: number; personId: Id<"persons">;
  sessionDigest: string; configFingerprint: string; shopRef: string; linkRef: string; subjectRef: string;
}

async function authority(ctx: MutationCtx, networkId: Id<"networks">, shopId: Id<"shops">): Promise<ReconciliationAdmission | null> {
  const access = await requireMembership(ctx, networkId, "declaree")
  if (access.person.deletionRequestedAt !== undefined || access.person.erasedAt !== undefined) return null
  await assertSocialWriteAllowed(ctx, networkId, access.person._id)
  const identity = await getActiveIdentity(ctx)
  const managed = await managedShopOrNull(ctx, networkId, access.person._id, shopId)
  const config = await readCommerceLinkConfig()
  if (!identity || typeof identity.sessionId !== "string" || !managed?.page || !config) return null
  const live = await liveCatalogMapping(ctx, networkId, shopId)
  if (!live || live.page._id !== managed.page._id || live.link.configFingerprint !== config.fingerprint) return null
  return {
    mappingId: live.mapping._id, generation: live.mapping.generation, personId: access.person._id,
    sessionDigest: await sha256Hex(identity.sessionId), configFingerprint: config.fingerprint,
    shopRef: live.link.shopRef, linkRef: live.link.linkRef, subjectRef: live.link.subjectRef,
  }
}

export const prepare = internalMutation({
  args: { networkId: v.id("networks"), shopId: v.id("shops"), configFingerprint: v.string() },
  returns: v.union(reconciliationAdmissionValidator, v.null()),
  handler: async (ctx, args): Promise<ReconciliationAdmission | null> => {
    const access = await requireMembership(ctx, args.networkId, "declaree")
    await enforceRateLimit(ctx, "catalog.reconcile", access.person._id)
    const current = await authority(ctx, args.networkId, args.shopId)
    return current?.configFingerprint === args.configFingerprint ? current : null
  },
})

/** Aucun effet catalogue local ; une réponse tardive ne sert même pas de reçu UI. */
export const stillAuthorized = internalMutation({
  args: { networkId: v.id("networks"), shopId: v.id("shops"), admission: reconciliationAdmissionValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const current = await authority(ctx, args.networkId, args.shopId)
    const before = args.admission
    return current !== null && current.personId === before.personId && current.sessionDigest === before.sessionDigest &&
      current.configFingerprint === before.configFingerprint && current.mappingId === before.mappingId &&
      current.generation === before.generation && current.shopRef === before.shopRef &&
      current.linkRef === before.linkRef && current.subjectRef === before.subjectRef
  },
})
