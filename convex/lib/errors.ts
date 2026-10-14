import type { EngineErrorCode, EngineErrorData } from "@antia/social-contracts/errors"
import { isDomainViolation } from "@antia/social-domain/violation"
import { ConvexError } from "convex/values"

/**
 * Lève une erreur du moteur, lisible par les applications (`engineErrorCode`)
 * et traduite par elles. Aucune donnée d'identité, aucune valeur saisie dans
 * l'erreur (cahier §12.6) : un code, au plus un champ, une règle et ses bornes,
 * ou un délai.
 */
export function fail(code: EngineErrorCode, details: Omit<EngineErrorData, "code"> = {}): never {
  throw new ConvexError<EngineErrorData>({ code, ...details })
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
