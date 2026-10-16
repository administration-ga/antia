import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import type { TFunction } from "i18next"

/**
 * Le texte d'une erreur renvoyée par le moteur, traduit : règle du domaine
 * enfreinte (espace de noms `rules`, avec ses bornes), sinon code du moteur
 * (`errors`), sinon message générique. Jamais le texte brut du serveur.
 */
export function engineErrorMessage(error: unknown, t: TFunction): string {
  const rule = engineErrorRule(error)
  if (rule) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(error)
  if (code) return t(`errors:${code}`)
  return t("antsia:errors.generic")
}
