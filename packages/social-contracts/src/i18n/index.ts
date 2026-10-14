/**
 * Traductions des codes renvoyés par le serveur du moteur (erreurs, genres de
 * notification). Un espace de noms par tranche : `errors` (moteur) ; `diaspora`
 * est réservé à la tranche `convex/modules/diaspora` (propriété de la session
 * DIASPORALE). Les applications chargent ces ressources dans leur instance
 * i18next, à côté de leurs propres espaces de noms.
 */
import enErrors from "./locales/en/errors.json"
import frErrors from "./locales/fr/errors.json"

export const SERVER_CODE_NAMESPACES = ["errors"] as const
export type ServerCodeNamespace = (typeof SERVER_CODE_NAMESPACES)[number]

export const serverCodeResources = {
  fr: { errors: frErrors },
  en: { errors: enErrors },
} as const
