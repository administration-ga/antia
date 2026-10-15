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
  // Authentification (clé : l'adresse ou le numéro normalisé, jamais l'IP seule)
  "auth.login": { kind: "token bucket", rate: 5, period: 15 * MINUTE, capacity: 5 },
  "auth.otp.send": { kind: "token bucket", rate: 3, period: 5 * MINUTE, capacity: 3 },
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
  // Graphe (PA3 lot 4)
  "connection.request": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "connection.respond": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "connection.block": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "follow.toggle": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "mark.toggle": { kind: "token bucket", rate: 240, period: HOUR, capacity: 60 },
  "mute.toggle": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "post.edit": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "post.remove": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Cloche (PA3 lot 5)
  "notification.read": { kind: "token bucket", rate: 300, period: HOUR, capacity: 60 },
  "notification.readAll": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Garde des fichiers : gestes humains (libération par un modérateur, relance par un opérateur).
  "file.moderate": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Console (PA7)
  "operator.network": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "operator.membership": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Tranche DIASPORALE (`convex/modules/diaspora`, PD1). Entrer et régler sa
  // facette consomment « network.join » et « person.facet » : une personne n'a
  // qu'un budget, quel que soit le chemin. Les quotas MÉTIER (10 parrainages
  // par 30 jours glissants, 24 h entre deux demandes d'attestation) vivent dans
  // `@diasporale/domain`, en plus de ces seaux.
  "diaspora.sponsor": { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  "diaspora.sponsor.revoke": { kind: "token bucket", rate: 20, period: HOUR, capacity: 10 },
  "diaspora.attestation.request": { kind: "token bucket", rate: 3, period: DAY, capacity: 1 },
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
