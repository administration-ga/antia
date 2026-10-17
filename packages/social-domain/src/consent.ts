/**
 * Consentements — horodatés, versionnés, révocables en un geste (cahier
 * EXF-AN-08, §9 du plan). Lus AVANT toute action qui les requiert. Jamais de
 * case précochée : un consentement n'existe que par un geste de la personne.
 */
export const CONSENT_PURPOSES = [
  "social_profile",
  "directory",
  "notifications",
  "email_digest",
  "consular_attestation",
  "talents",
  "usage_analytics",
] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

export const CONSENT_ORIGINS = ["onboarding", "settings", "prompt"] as const
export type ConsentOrigin = (typeof CONSENT_ORIGINS)[number]

/** Ce sans quoi une personne n'existe pas dans un réseau : le profil social. */
export const REQUIRED_CONSENTS_TO_JOIN: readonly ConsentPurpose[] = ["social_profile"]

/** Version courante des textes soumis au consentement (à monter à chaque changement de texte). */
export const CONSENT_TEXT_VERSIONS: Readonly<Record<ConsentPurpose, string>> = {
  social_profile: "2026-10-14",
  directory: "2026-10-14",
  notifications: "2026-10-14",
  email_digest: "2026-10-14",
  consular_attestation: "2026-10-14",
  talents: "2026-10-14",
  usage_analytics: "2026-10-17",
}

export type ConsentRecord = { purpose: ConsentPurpose; textVersion: string; revokedAt?: number }

/** Un consentement est-il en vigueur (accordé, non révoqué, sur le texte courant) ? */
export function isConsentInForce(records: readonly ConsentRecord[], purpose: ConsentPurpose): boolean {
  return records.some(
    (record) => record.purpose === purpose && record.revokedAt === undefined && record.textVersion === CONSENT_TEXT_VERSIONS[purpose],
  )
}

/** Les consentements requis qui manquent pour entrer dans un réseau. */
export function missingConsentsToJoin(records: readonly ConsentRecord[]): ConsentPurpose[] {
  return REQUIRED_CONSENTS_TO_JOIN.filter((purpose) => !isConsentInForce(records, purpose))
}
