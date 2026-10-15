// Dupliqué de socle/convex/functions/authRateLimit.ts @ ad2e7fdc2 — adaptations : patron seulement (une mutation interne par contrôle) ; seaux du moteur `auth.login` et `auth.otp.send` ; délai rendu en millisecondes, sans phrase.
/**
 * Limitation de débit des routes d'authentification, appelée par le greffon
 * Better Auth du moteur (`convex/betterAuth/auth.ts`) avant l'envoi d'un code et
 * avant une connexion. Clé : l'adresse normalisée — changer d'IP ne contourne
 * rien.
 */
import { v } from "convex/values"

import { internalMutation } from "../../_generated/server"
import { rateLimiter } from "../../lib/rateLimit"

export const checkAuthRateLimit = internalMutation({
  args: { bucket: v.union(v.literal("auth.login"), v.literal("auth.otp.send")), key: v.string() },
  returns: v.object({ ok: v.boolean(), retryAfterMs: v.number() }),
  handler: async (ctx, { bucket, key }) => {
    const result = await rateLimiter.limit(ctx, bucket, { key: key.trim().toLowerCase() })
    return { ok: result.ok, retryAfterMs: result.ok ? 0 : result.retryAfter }
  },
})
