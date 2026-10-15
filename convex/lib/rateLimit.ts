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
  "comment.edit": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "comment.remove": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "report.create": { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  "group.create": { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },
  "group.join": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "group.invite": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "group.moderate": { kind: "token bucket", rate: 120, period: HOUR, capacity: 30 },
  "group.manage": { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  "moderation.decide": { kind: "token bucket", rate: 300, period: HOUR, capacity: 60 },
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
  // Messagerie (PA3 lot 10). Ouvrir un fil, y compris par un transfert vers un
  // identifiant, consomme « thread.open » : un seul budget, quel que soit le chemin.
  "thread.open": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "message.send": { kind: "token bucket", rate: 30, period: MINUTE, capacity: 15 },
  "message.read": { kind: "token bucket", rate: 120, period: MINUTE, capacity: 60 },
  "message.edit": { kind: "token bucket", rate: 120, period: HOUR, capacity: 30 },
  "message.react": { kind: "token bucket", rate: 120, period: MINUTE, capacity: 30 },
  "message.typing": { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
  "message.forward": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Conversations de groupe (PA3 lot 11) — les messages consomment les seaux « message.* ».
  "groupThread.create": { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },
  "groupThread.invite": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "groupThread.join": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "groupThread.manage": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Évènements (PA3 lot 12) — l'annonce consomme « post.publish ».
  "event.create": { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  "event.invite": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "event.respond": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "event.manage": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Stories (PA3 lot 12b).
  "story.publish": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "story.view": { kind: "token bucket", rate: 600, period: HOUR, capacity: 120 },
  "story.remove": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  // Suggestions (PA3 lot 12c).
  "suggestion.dismiss": { kind: "token bucket", rate: 120, period: HOUR, capacity: 30 },
  // Pages (PA3 lot 13). Créer une page et la revendiquer sont des gestes rares.
  "page.create": { kind: "token bucket", rate: 5, period: DAY, capacity: 3 },
  "page.follow": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "page.publish": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "page.manage": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "page.claim": { kind: "token bucket", rate: 5, period: DAY, capacity: 3 },
  // Garde des fichiers : gestes humains (libération par un modérateur, relance par un opérateur).
  "file.moderate": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  // Console (PA7)
  "operator.network": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  "operator.membership": { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  "operator.page": { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
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
