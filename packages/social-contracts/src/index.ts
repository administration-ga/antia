/**
 * @antia/social-contracts — ce que le backend du moteur et ses applications
 * partagent sans passer par `convex/` : types, modules purs (médias, pièces
 * jointes, capacités de groupe, schémas de validation) et codes renvoyés par le
 * serveur. C'est l'abstraction manquante n° 5 relevée par l'audit du front du
 * socle (annexe B) : le front ne doit plus importer de module serveur.
 */
export { BRAND_NAME } from "./brand"
export {
  APP_RULE_PATTERN,
  type AppRuleParams,
  ENGINE_ERROR_CODES,
  type EngineErrorCode,
  type EngineErrorData,
  engineErrorAppRule,
  engineErrorCode,
  engineErrorRule,
  isAppRule,
  isEngineErrorCode,
} from "./errors"
export type { MediaWithheld, PostMediaDto } from "./media"
export { SOCIAL_DOMAIN_VERSION } from "@antia/social-domain"
