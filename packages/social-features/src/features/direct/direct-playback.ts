// Dupliqué de socle/packages/agent-features/src/features/direct/direct-playback.ts @ ad2e7fdc2 — adaptations : décisions pures conservées, audience followers, libellés délégués à i18n et refus de sous-titres par le domaine du moteur.
import type { DirectAudience } from "@antsia/social-domain/live/domain"
import { DIRECT_REPLAY_CAPTIONS_MAX_BYTES, isDirectReplayCaptionsMime } from "@antsia/social-domain/live/replayComposition"

export function replayVisibilityOptions(audience: DirectAudience): DirectAudience[] {
  return audience === "public" ? ["public", "connections"] : [audience]
}

export function replayCanRetry(replay: { status: string; recoverable: boolean }): boolean {
  return replay.recoverable && (replay.status === "pending" || replay.status === "failed")
}

export function replayCanDecide(status: string): boolean {
  return status === "pending" || status === "ready"
}

export function replayRetentionIsNear(until: number | null, now: number): boolean {
  return until !== null && until > now && until - now <= 7 * 86_400_000
}

export function replayDurationParts(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs <= 0) return null
  const minutes = Math.max(1, Math.round(durationMs / 60_000))
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60, totalMinutes: minutes }
}

/** Filtre avant lecture : l'action rejoue la taille UTF-8 et la signature. */
export function replayCaptionsFileRefusal(file: Pick<File, "size" | "type">) {
  if (!isDirectReplayCaptionsMime(file.type)) return "wrong_type" as const
  if (file.size === 0) return "missing" as const
  if (file.size > DIRECT_REPLAY_CAPTIONS_MAX_BYTES) return "too_large" as const
  return null
}
