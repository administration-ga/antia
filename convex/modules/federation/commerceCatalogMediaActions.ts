/** P09 : import séquentiel borné, après claims et relectures transactionnelles. */
import { COMMERCE_CATALOG_READ_CONTRACT, COMMERCE_CATALOG_READ_TTL_MS, type CommerceCatalogReadRequest } from "@antsia/social-domain/commerce-catalogue"
import type { CommerceMedia } from "@antsia/social-domain/commerce/projection"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { readCommerceLinkConfig } from "../shops/commerceLinkConfig"
import { randomLinkId, randomLinkToken } from "../shops/commerceLinkCrypto"
import { fetchCatalogMedia } from "./commerceCatalogClient"

type Job = { networkId: Id<"networks">; headId: Id<"commerceCatalogHeads">; revision: number; digest: string }
type Lease = Job & { leaseToken: string }
type Snapshot = { shopRef: string; offerRef: string; linkRef: string; subjectRef: string; revision: number; media: CommerceMedia[] }
const claim = makeFunctionReference<"mutation", Lease, boolean>("modules/federation/commerceCatalogMedia:claim")
const snapshot = makeFunctionReference<"query", Lease, Snapshot | null>("modules/federation/commerceCatalogMedia:snapshot")
const stage = makeFunctionReference<"mutation", Lease & { index: number; storageId: Id<"_storage">; publicToken: string }, boolean>("modules/federation/commerceCatalogMedia:stage")
const complete = makeFunctionReference<"mutation", Lease, boolean>("modules/federation/commerceCatalogMedia:complete")
const cleanup = makeFunctionReference<"mutation", Lease & { storageIds: Id<"_storage">[]; error: "configuration" | "download" | "obsolete" | "admission" }, null>("modules/federation/commerceCatalogMedia:cleanup")

export const run = internalAction({
  args: { networkId: v.id("networks"), headId: v.id("commerceCatalogHeads"), revision: v.number(), digest: v.string() }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const lease: Lease = { ...args, leaseToken: randomLinkToken() }
    if (!await ctx.runMutation(claim, lease)) return null
    const storageIds: Id<"_storage">[] = []
    let error: "configuration" | "download" | "obsolete" | "admission" = "configuration"
    try {
      const config = await readCommerceLinkConfig()
      if (!config) return null
      const initial = await ctx.runQuery(snapshot, lease)
      if (!initial || initial.media.length < 1 || initial.media.length > 6) return null
      for (let index = 0; index < initial.media.length; index++) {
        error = "obsolete"
        const current = await ctx.runQuery(snapshot, lease)
        const descriptor = current?.media[index]
        if (!current || !descriptor || current.media.length !== initial.media.length ||
          current.revision !== args.revision || current.linkRef !== initial.linkRef || current.offerRef !== initial.offerRef) return null
        const now = Date.now()
        const request: Extract<CommerceCatalogReadRequest, { operation: "media.read" }> = {
          contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, source: config.source, environment: config.environment,
          operation: "media.read", requestId: randomLinkId(), subjectRef: current.subjectRef,
          shopRef: current.shopRef, linkRef: current.linkRef, issuedAt: now, expiresAt: now + COMMERCE_CATALOG_READ_TTL_MS,
          payload: { offerRef: current.offerRef, revision: current.revision, sha256: descriptor.sha256 },
        }
        error = "download"
        const blob = await fetchCatalogMedia(config, request, descriptor)
        if (!blob) return null
        error = "obsolete"
        if (!await ctx.runQuery(snapshot, lease)) return null
        const storageId = await ctx.storage.store(blob)
        // Après store, confier immédiatement le blob à la mutation durable ; finally nettoie tout échec.
        storageIds.push(storageId)
        if (!await ctx.runMutation(stage, { ...lease, index, storageId, publicToken: randomLinkId() + randomLinkId() })) return null
      }
      error = "admission"
      await ctx.runMutation(complete, lease)
    } catch {
      // Pas de corps, URL, clé ni donnée de liaison dans une erreur publique ou un log.
    } finally { await ctx.runMutation(cleanup, { ...lease, storageIds, error }) }
    return null
  },
})
