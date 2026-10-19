"use node"

/** PA9B : quatre téléchargements séquentiels au maximum ; l'autorité et l'admission restent en mutation. */
import type { ReseauPublicMedia } from "@antsia/social-domain/reseauPublic"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Id } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { downloadFederatedMedia } from "./mediaDownload"
import type { MediaFailure, MediaJobArgs, MediaLeaseArgs } from "./mediaJobs"

const claimReference = makeFunctionReference<"mutation", MediaJobArgs, { leaseToken: string } | null>("modules/federation/mediaJobs:claim")
const snapshotReference = makeFunctionReference<"query", MediaLeaseArgs, { manifest: ReseauPublicMedia[] } | null>("modules/federation/mediaJobs:snapshot")
const stageReference = makeFunctionReference<"mutation", MediaLeaseArgs & { storageId: Id<"_storage">; index: number }, boolean>("modules/federation/mediaJobs:stage")
const completeReference = makeFunctionReference<"mutation", MediaLeaseArgs, boolean>("modules/federation/mediaJobs:complete")
const cleanupReference = makeFunctionReference<"mutation", MediaLeaseArgs & { storageIds: Id<"_storage">[]; error: MediaFailure }, null>("modules/federation/mediaJobs:cleanup")

/** Configuration fermée : origines HTTPS exactes, port 443, sans identifiant, chemin ni joker. */
function allowedMediaOrigins(raw: string | undefined): string[] | null {
  if (!raw || raw.length > 32_768) return null
  try {
    const decoded: unknown = JSON.parse(raw)
    if (!Array.isArray(decoded) || decoded.length < 1 || decoded.length > 16) return null
    const origins: string[] = []
    for (const entry of decoded) {
      if (typeof entry !== "string" || entry.length > 2048 || entry !== entry.trim() || entry.includes("*") || entry.includes("\\")) return null
      const parsed = new URL(entry)
      if (parsed.protocol !== "https:" || parsed.port !== "" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null
      if (entry !== parsed.origin && entry !== `https://${parsed.hostname}:443`) return null
      origins.push(parsed.origin)
    }
    return [...new Set(origins)]
  } catch {
    return null
  }
}

export const run = internalAction({
  args: { mirrorId: v.id("mirrors"), revision: v.number(), digest: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claim = await ctx.runMutation(claimReference, args)
    if (!claim) return null
    const lease: MediaLeaseArgs = { ...args, leaseToken: claim.leaseToken }
    const storageIds: Id<"_storage">[] = []
    let error: MediaFailure = "obsolete"
    try {
      const origins = allowedMediaOrigins(process.env.ANTSIA_FEDERATION_ADMINISTRATION_MEDIA_ORIGINS)
      if (!origins) { error = "configuration"; return null }
      const initial = await ctx.runQuery(snapshotReference, lease)
      if (!initial || initial.manifest.length < 1 || initial.manifest.length > 4) return null
      for (let index = 0; index < initial.manifest.length; index++) {
        error = "obsolete"
        const current = await ctx.runQuery(snapshotReference, lease)
        const descriptor = current?.manifest[index]
        if (!current || !descriptor || current.manifest.length !== initial.manifest.length) return null
        error = "download"
        const blob = await downloadFederatedMedia({ url: descriptor.url, mimeType: descriptor.mimeType, sizeBytes: descriptor.sizeBytes, sha256: descriptor.sha256 }, origins)
        const storageId = await ctx.storage.store(blob)
        // Fenêtre incompressible : un crash après store et avant stage peut laisser un blob sans registre.
        // Dès le retour de store, l'action le garde pour finally et le confie immédiatement au registre durable.
        storageIds.push(storageId)
        error = "obsolete"
        if (!await ctx.runMutation(stageReference, { ...lease, storageId, index })) return null
      }
      error = "admission"
      await ctx.runMutation(completeReference, lease)
    } catch {
      // Ni URL signée ni détail de transport n'est conservé : seul le code fermé est enregistré ci-dessous.
    } finally {
      // Un succès est sans effet ici : ses blobs ont désormais une admission, que cleanup ne peut pas purger.
      await ctx.runMutation(cleanupReference, { ...lease, storageIds, error })
    }
    return null
  },
})
