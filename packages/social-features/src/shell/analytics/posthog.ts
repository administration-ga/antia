/** Mesure facultative : seules les catégories publiques déclarées peuvent sortir. */
export const USAGE_SCREENS = [
  "feed", "profile", "page", "albums", "groups", "events", "messages", "stories", "conference", "data",
] as const
export type UsageScreen = (typeof USAGE_SCREENS)[number]
export type UsageLocale = "fr" | "en"

// Une forme de slug seule accepterait aussi certains identifiants internes.
// Chaque nouveau réseau mesurable nécessite une admission explicite ici.
export const PUBLIC_USAGE_NETWORKS = ["antsia", "diasporale", "administration"] as const

export interface PostHogConfiguration {
  /** Adresse complète de capture, injectée par l'application. */
  endpoint: string
  /** Jeton public du projet, jamais une clé personnelle PostHog. */
  projectToken: string
}

export interface UsagePayload {
  token: string
  event: "screen_viewed"
  properties: {
    distinct_id: string
    screen: UsageScreen
    network: (typeof PUBLIC_USAGE_NETWORKS)[number]
    locale: UsageLocale
    $process_person_profile: false
    $geoip_disable: true
  }
}

export function isUsageScreen(value: unknown): value is UsageScreen {
  return typeof value === "string" && USAGE_SCREENS.some((screen) => screen === value)
}

export function isUsageNetwork(value: unknown): value is (typeof PUBLIC_USAGE_NETWORKS)[number] {
  return typeof value === "string" && PUBLIC_USAGE_NETWORKS.some((network) => network === value)
}

export function isUsageLocale(value: unknown): value is UsageLocale {
  return value === "fr" || value === "en"
}

function isProjectToken(value: unknown): value is string {
  return typeof value === "string"
    && /^phc_[A-Za-z0-9]{20,128}$/.test(value)
    && !/^phc_(?:placeholder|replace|example|your|insert|change|todo|test)/i.test(value)
}

export function resolvePostHogConfiguration(value: unknown): PostHogConfiguration | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const fields = value as Record<string, unknown>
  if (typeof fields.endpoint !== "string" || !isProjectToken(fields.projectToken)) return null
  if (/\s|\?|#/.test(fields.endpoint)) return null
  try {
    const endpoint = new URL(fields.endpoint)
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null
    return { endpoint: endpoint.href, projectToken: fields.projectToken }
  } catch {
    return null
  }
}

/** Projection explicite : aucune propriété arbitraire ne traverse le transport. */
export function createUsagePayload(value: unknown): UsagePayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const fields = value as Record<string, unknown>
  if (!isProjectToken(fields.projectToken)
    || typeof fields.distinctId !== "string"
    || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(fields.distinctId)
    || !isUsageScreen(fields.screen)
    || !isUsageNetwork(fields.networkSlug)
    || !isUsageLocale(fields.locale)) return null
  return {
    token: fields.projectToken,
    event: "screen_viewed",
    properties: {
      distinct_id: fields.distinctId,
      screen: fields.screen,
      network: fields.networkSlug,
      locale: fields.locale,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  }
}
