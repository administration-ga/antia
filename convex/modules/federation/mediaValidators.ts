/** Descripteurs publics signés ; aucune référence de stockage choisie par l’émetteur. */
import { v } from "convex/values"

export const federationMediaValidator = v.object({
  url: v.string(), kind: v.union(v.literal("image"), v.literal("video")),
  mimeType: v.string(), sizeBytes: v.number(), sha256: v.string(),
  width: v.optional(v.number()), height: v.optional(v.number()),
  durationMs: v.optional(v.number()), altText: v.optional(v.string()),
})
