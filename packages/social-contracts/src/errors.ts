import { DOMAIN_RULES, type DomainRule, type DomainRuleParams } from "@antia/social-domain/violation"

/**
 * Codes d'erreur du moteur, partagés par le serveur (qui les lève dans une
 * `ConvexError`) et les applications (qui les traduisent : espace de noms
 * i18n `errors`, une clé par code — cliquet `i18n-locales`).
 *
 * REFUS INDISTINCT (invariant 8) : partout où l'existence d'une ressource est
 * une information — handle inconnu, profil privé, blocage, contenu hors réseau,
 * réseau dont on n'est pas membre —, le serveur rend `notFound`, et rien d'autre.
 */
export const ENGINE_ERROR_CODES = [
  "unauthenticated",
  "notFound",
  "rateLimited",
  "invalidArgument",
  "conflict",
  "handleUnavailable",
  "membershipSuspended",
  "statusInsufficient",
  "operatorRequired",
  "policyRefused",
  "consentRequired",
  "profileRequired",
] as const
export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number]

export type EngineErrorData = {
  code: EngineErrorCode
  /** Pour `rateLimited` : délai avant nouvel essai, en millisecondes. */
  retryAfterMs?: number
  /** Pour `invalidArgument` : le champ fautif (jamais une valeur). */
  field?: string
  /**
   * Pour `invalidArgument` levé par une règle du domaine : son code (espace de
   * noms i18n `rules`) et ses bornes, paramètres d'interpolation du texte.
   */
  rule?: DomainRule
  params?: DomainRuleParams
}

export function isEngineErrorCode(value: unknown): value is EngineErrorCode {
  return typeof value === "string" && (ENGINE_ERROR_CODES as readonly string[]).includes(value)
}

/** Lit le code d'une erreur reçue du serveur (forme `ConvexError` : `{ data }`). */
export function engineErrorCode(error: unknown): EngineErrorCode | null {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data
    if (typeof data === "object" && data !== null && "code" in data) {
      const code = (data as { code: unknown }).code
      return isEngineErrorCode(code) ? code : null
    }
  }
  return null
}

/** Lit la règle du domaine enfreinte, quand le serveur en a nommé une connue. */
export function engineErrorRule(error: unknown): { rule: DomainRule; params: DomainRuleParams } | null {
  if (typeof error !== "object" || error === null || !("data" in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== "object" || data === null || !("rule" in data)) return null
  const { rule, params } = data as { rule: unknown; params?: unknown }
  if (typeof rule !== "string" || !(DOMAIN_RULES as readonly string[]).includes(rule)) return null
  const safeParams: Record<string, number> = {}
  if (typeof params === "object" && params !== null) {
    for (const [key, value] of Object.entries(params)) if (typeof value === "number") safeParams[key] = value
  }
  return { rule: rule as DomainRule, params: safeParams }
}
