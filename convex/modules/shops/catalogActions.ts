/** P09 : rattrapage manuel paginé ; aucune boucle globale ni écriture directe de projection. */
import { COMMERCE_CATALOG_READ_CONTRACT, COMMERCE_CATALOG_READ_TTL_MS, type CommerceCatalogReadRequest } from "@antsia/social-domain/commerce-catalogue"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { networkAction } from "../../lib/functions"
import { requestCatalogReconciliation } from "../federation/commerceCatalogClient"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { randomLinkId } from "./commerceLinkCrypto"
import type { ReconciliationAdmission } from "./catalogReconciliation"

const prepare = makeFunctionReference<"mutation", { networkId: Id<"networks">; shopId: Id<"shops">; configFingerprint: string }, ReconciliationAdmission | null>("modules/shops/catalogReconciliation:prepare")
const stillAuthorized = makeFunctionReference<"mutation", { networkId: Id<"networks">; shopId: Id<"shops">; admission: ReconciliationAdmission }, boolean>("modules/shops/catalogReconciliation:stillAuthorized")
type Result = { outcome: "queued"; cursor: string | null; done: boolean; queued: number } | { outcome: "unavailable" | "refused" }

export const reconcile = networkAction({
  args: { shopId: v.id("shops"), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.union(v.object({ outcome: v.literal("queued"), cursor: v.union(v.string(), v.null()), done: v.boolean(), queued: v.number() }), v.object({ outcome: v.union(v.literal("unavailable"), v.literal("refused")) })),
  handler: async (ctx, args): Promise<Result> => {
    if (args.cursor !== undefined && args.cursor !== null && (args.cursor.length < 1 || args.cursor.length > 2048 || args.cursor !== args.cursor.trim())) return { outcome: "refused" }
    const config = await readCommerceLinkConfig()
    if (!config) return { outcome: "unavailable" }
    const admission = await ctx.runMutation(prepare, { networkId: ctx.networkId, shopId: args.shopId, configFingerprint: config.fingerprint })
    if (!admission) return { outcome: "refused" }
    const now = Date.now()
    const request: Extract<CommerceCatalogReadRequest, { operation: "reconcile" }> = {
      contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, operation: "reconcile", source: config.source,
      environment: config.environment, requestId: randomLinkId(), subjectRef: admission.subjectRef,
      shopRef: admission.shopRef, linkRef: admission.linkRef, issuedAt: now, expiresAt: now + COMMERCE_CATALOG_READ_TTL_MS,
      payload: { cursor: args.cursor ?? null },
    }
    const response = await requestCatalogReconciliation(config, request)
    if (!await ctx.runMutation(stillAuthorized, { networkId: ctx.networkId, shopId: args.shopId, admission })) return { outcome: "refused" }
    return response ? { outcome: "queued", cursor: response.cursor, done: response.done, queued: response.queued } : { outcome: "unavailable" }
  },
})
