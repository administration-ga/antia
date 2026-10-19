"use node"
// Dupliqué de socle/convex/actions/livekit.ts (l. 709-830 : `verifyEgressWebhook`, `ingestEgressFile`) @ ad2e7fdc2 — adaptations : module du direct (`modules/live`), seul propriétaire d'un egress dans le moteur (owner map §6.18 : ces deux actions vont au direct) ; `ingestEgressFile` réduit à ce propriétaire (`route: "direct"`, ni début de capture ni taille : la fusion iRéunion est exclue) ; motif d'un rapatriement raté → CODE (`transfer_<code>`, `replayComposition.directReplayTransferFailureReason`), la phrase du transfert reste au journal ; politique de dépôt et routage du moteur (`lib/livekitEgressUploads`, `lib/livekitEgressWebhook`, `lib/livekitEgressFileTransfer`) ; `returns` validés.
/**
 * Le webhook Egress LiveKit — les deux gestes qui exigent le runtime Node :
 * VÉRIFIER le jeton d'un événement et RAPATRIER un fichier en flux.
 *
 * Le webhook lui-même (`convex/http.ts`) tourne dans le runtime Convex, où
 * `livekit-server-sdk` ne se bundle pas : il délègue ici.
 */
import { v } from "convex/values"
import { WebhookReceiver } from "livekit-server-sdk"

import type { Id } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { transferEgressFileToStorage } from "../../lib/livekitEgressFileTransfer"
import { egressUploadUrl } from "../../lib/livekitEgressUploads"
import { completeEgressForOwners } from "../../lib/livekitEgressWebhook"
import { directReplayTransferFailureReason } from "./replayComposition"

/**
 * Vérifie un webhook LiveKit : le JWT de l'en-tête `Authorization`, signé avec
 * le secret d'API, dont le claim `sha256` est l'empreinte du corps.
 *
 * ⚠️ POURQUOI UNE ACTION NODE. Le webhook (`convex/http.ts`) tourne dans le
 * runtime Convex, et `livekit-server-sdk` ne s'y bundle pas : reproduit le
 * 2026-09-17 avec les options exactes du bundler Convex 1.45 (esbuild,
 * `platform: "browser"`), l'import de `WebhookReceiver` échoue sur
 * `Could not resolve "node:crypto"`. Le webhook délègue donc la vérification ici.
 *
 * L'ancien webhook du socle comparait l'en-tête à un secret FIXE
 * (`LIVEKIT_WEBHOOK_SECRET`) : LiveKit n'envoie jamais ce secret, il envoie ce
 * JWT — chaque événement réel était refusé.
 *
 * Ne lève pas : `configured: false` si les clés manquent (le webhook répond
 * 503), `valid: false` pour tout jeton refusé (401). Le préfixe `Bearer ` est
 * toléré : le SDK le refuse (vérifié), un relais peut l'ajouter.
 */
export const verifyEgressWebhook = internalAction({
  args: {
    /** Le corps BRUT, octet pour octet : son empreinte est signée. */
    body: v.string(),
    authorization: v.string(),
  },
  returns: v.object({ valid: v.boolean(), configured: v.boolean() }),
  handler: async (_ctx, args): Promise<{ valid: boolean; configured: boolean }> => {
    const apiKey = process.env.LIVEKIT_API_KEY?.trim()
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim()
    if (!apiKey || !apiSecret) {
      console.error("[livekit-egress] webhook refusé : LIVEKIT_API_KEY / LIVEKIT_API_SECRET absents.")
      return { valid: false, configured: false }
    }
    const token = args.authorization.replace(/^Bearer\s+/i, "").trim()
    if (token.length === 0) return { valid: false, configured: true }
    try {
      // `receive` vérifie la signature, l'émetteur (= la clé d'API), la
      // fraîcheur (tolérance 10 s) puis l'empreinte du corps.
      await new WebhookReceiver(apiKey, apiSecret).receive(args.body, token)
      return { valid: true, configured: true }
    } catch (err) {
      // Détail d'exploitation seulement (jamais le jeton) : une clé de webhook
      // différente de LIVEKIT_API_KEY côté serveur se diagnostique ici.
      console.warn("[livekit-egress] jeton de webhook refusé :", err instanceof Error ? err.message : String(err))
      return { valid: false, configured: true }
    }
  },
})

/**
 * Rapatrie EN FLUX le fichier d'un egress terminé, puis conclut chez son
 * traitement. Planifiée par le webhook, qui a DÉJÀ vérifié le jeton et la
 * propriété de l'egress : un fichier de plusieurs centaines de Mo ne transite
 * jamais par la mémoire (`lib/livekitEgressFileTransfer.ts`), et LiveKit reçoit
 * son 200 sans attendre la fin du transfert.
 *
 * Ne lève pas sur un transfert raté : la complétion est TOUJOURS appelée,
 * sans fichier, avec le motif (un code) du rapatriement.
 */
export const ingestEgressFile = internalAction({
  args: {
    route: v.literal("direct"),
    egressId: v.string(),
    filepath: v.string(),
    location: v.string(),
    durationMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ status: v.literal("stored"), bytes: v.number() }),
    v.object({
      status: v.literal("failed"),
      code: v.union(
        v.literal("invalid_location"),
        v.literal("download_failed"),
        v.literal("empty"),
        v.literal("too_large"),
        v.literal("length_mismatch"),
        v.literal("timeout"),
        v.literal("upload_failed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const transfer = await transferEgressFileToStorage({
      location: args.location,
      filepath: args.filepath,
      // Politique de dépôt, temps 1 : l'URL est délivrée pour un usage nommé.
      generateUploadUrl: () => egressUploadUrl(ctx),
    })
    if (!transfer.ok) {
      console.error(`[livekit-egress] rapatriement en échec (egressId=${args.egressId}, ${transfer.code}) : ${transfer.reason}`)
    }
    await completeEgressForOwners(
      ctx,
      [args.route],
      {
        egressId: args.egressId,
        route: args.route,
        filepath: args.filepath,
        location: args.location,
        ...(args.durationMs !== undefined ? { durationMs: args.durationMs } : {}),
      },
      transfer.ok
        ? {
            storageId: transfer.storageId as Id<"_storage">,
            // Politique de dépôt, temps 2 : confronté au rattachement.
            upload: { mimeType: transfer.contentType, sizeBytes: transfer.bytes },
          }
        : { transferFailureReason: directReplayTransferFailureReason(transfer.code) },
    )
    return transfer.ok ? { status: "stored" as const, bytes: transfer.bytes } : { status: "failed" as const, code: transfer.code }
  },
})
