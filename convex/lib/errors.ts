import { type AppRuleParams, type EngineErrorCode, type EngineErrorData, isAppRule } from "@antsia/social-contracts/errors"
import { type DomainRule, type DomainRuleParams, isDomainViolation } from "@antsia/social-domain/violation"
import { ConvexError } from "convex/values"

/**
 * Lève une erreur du moteur, lisible par les applications (`engineErrorCode`)
 * et traduite par elles. Aucune donnée d'identité, aucune valeur saisie dans
 * l'erreur (cahier §12.6) : un code, au plus un champ, une règle et ses bornes,
 * ou un délai.
 */
export function fail(code: EngineErrorCode, details: Omit<EngineErrorData, "code"> = {}): never {
  // Un code d'application mal formé est une faute de programmation : jamais une phrase vers l'écran.
  if (details.appRule !== undefined && !isAppRule(details.appRule)) throw new Error("[errors] code de refus d'application mal formé")
  throw new ConvexError<EngineErrorData>({ code, ...details })
}

/**
 * Refus MÉTIER d'une application, levé par sa tranche (`convex/modules/<tranche>`) :
 * un code de l'ensemble fermé de l'application et ses paramètres numériques,
 * traduits par elle (`policyRefused` par défaut : la demande est bien formée,
 * la règle de l'application la refuse).
 */
export function failAppRule(appRule: string, appParams: AppRuleParams = {}, code: EngineErrorCode = "policyRefused"): never {
  return fail(code, { appRule, appParams: { ...appParams } })
}

/**
 * Une règle du domaine levée HORS du domaine — un ÉTAT jugé par le serveur
 * (fil archivé, fenêtre d'édition close), pas une saisie : `invalidArgument`
 * portant le code de la règle et ses bornes, comme `rethrowDomain`.
 */
export function failRule(rule: DomainRule, params: DomainRuleParams = {}): never {
  return fail("invalidArgument", { rule, params: { ...params } })
}

/** Le refus indistinct (invariant 8) : absent, privé, bloqué, hors réseau — même réponse. */
export function notFound(): never {
  return fail("notFound")
}

/**
 * Au bord du domaine : une violation de règle (`DomainViolation`) devient
 * `invalidArgument` portant le code de la règle et ses bornes ; toute autre
 * erreur est relancée telle quelle. Équivalent du `rethrowDomain` du socle
 * (`reseauPersonnel/people.ts`), sans texte : l'écran traduit `rules.<code>`.
 */
export function rethrowDomain(error: unknown): never {
  if (isDomainViolation(error)) fail("invalidArgument", { rule: error.code, params: { ...error.params } })
  throw error
}

/** Applique une règle du domaine ; une violation devient `invalidArgument` (voir `rethrowDomain`). */
export function checked<T>(rule: () => T): T {
  try {
    return rule()
  } catch (error) {
    return rethrowDomain(error)
  }
}
