/**
 * Limitation de débit de TOUTES les écritures sociales (cahier EXF-AN-30,
 * EXT-AN-02 ; le socle n'en avait presque pas). Composant `@convex-dev/rate-limiter`,
 * un seau par type d'écriture, par personne. Les seaux « renforcés » s'appliquent
 * aux membres `declaree` sans badge fort (comptes légers), en plus du seau
 * ordinaire (PA5 les étend à toutes les mutations ; cliquet `rate-limited-writes`).
 */
import { DAY, HOUR, MINUTE, type RateLimitConfig, RateLimiter } from "@convex-dev/rate-limiter"

import { components } from "../_generated/api"
import type { MutationCtx } from "../_generated/server"
import { fail } from "./errors"

const RATE_LIMITS = {
  // Fondations (PA2)
  "person.ensure": { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  "person.profile": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "network.join": { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  "network.leave": { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  "person.facet": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "person.consent": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Contenus (PA3) — valeurs de départ, mesurées puis ajustées en PA10.
  "post.publish": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "post.publish.reinforced": { kind: "token bucket", rate: 10, period: DAY, capacity: 3 },
  "reaction.toggle": { kind: "token bucket", rate: 120, period: MINUTE, capacity: 30 },
  "comment.create": { kind: "token bucket", rate: 60, period: HOUR, capacity: 15 },
  "upload.url": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Console (PA7)
  "operator.network": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitBucket = keyof typeof RATE_LIMITS & string

export const rateLimiter = new RateLimiter(components.rateLimiter, RATE_LIMITS)

/**
 * Consomme un jeton du seau pour la clé donnée (la personne, le plus souvent) ;
 * `rateLimited` (avec le délai) au-delà du seuil.
 */
export async function enforceRateLimit(ctx: MutationCtx, bucket: RateLimitBucket, key: string): Promise<void> {
  const result = await rateLimiter.limit(ctx, bucket, { key })
  if (!result.ok) fail("rateLimited", { retryAfterMs: result.retryAfter })
}
