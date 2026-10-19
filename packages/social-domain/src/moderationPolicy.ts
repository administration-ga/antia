/** Règles pures PA5 : bornes, sanctions et jugement de relecture sans contenu conservé. */
export const MODERATION_SURFACES = ["post", "comment", "groupMessage", "event", "page", "person", "live", "story", "album", "serviceReview", "serviceReviewReply", "commerceOffer", "commercialMessage", "contextualMessage", "commerceJob", "diasporaAidQuestion", "diasporaAidAnswer", "diasporaAidMission", "diasporaMentorProfile", "diasporaMentoringRequest", "diasporaKitResource", "diasporaJobOffer", "diasporaTalentProfile", "diasporaJobApplication"] as const
export type ModerationSurface = (typeof MODERATION_SURFACES)[number]
export const SANCTION_KINDS = ["warning", "removal", "mute", "suspension", "exclusion"] as const
export type SanctionKind = (typeof SANCTION_KINDS)[number]
export const MODERATION_SCAN_LIMIT = 100
export const MODERATION_MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000
export const TRANSPARENCY_MIN_CASES = 5

export function normalizeBlockedTerm(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ")
}

export function validSanctionDuration(kind: SanctionKind, until: number | undefined, now: number): boolean {
  if (kind === "exclusion") return until === undefined
  if (until === undefined) return kind === "warning" || kind === "removal"
  return Number.isFinite(until) && until > now && until - now <= MODERATION_MAX_DURATION_MS
}

export function isSanctionLive(sanction: { status: string; until?: number }, now: number): boolean {
  return sanction.status === "active" && (sanction.until === undefined || sanction.until > now)
}

export function contentNeedsReview(input: { text: string; preReview: boolean; blockedTerms: readonly string[]; maxLinks: number; recentWrites: number; maxWrites: number }): boolean {
  if (input.preReview || input.recentWrites >= input.maxWrites) return true
  const normalized = normalizeBlockedTerm(input.text)
  if (input.blockedTerms.some((term) => term.length > 0 && normalized.includes(term))) return true
  const links = input.text.match(/(?:https?:\/\/|www\.)\S+/gi)?.length ?? 0
  return links > input.maxLinks
}
