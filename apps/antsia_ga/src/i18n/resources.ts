/**
 * Ressources de traduction de l'application, partagées par le rendu serveur et
 * le fournisseur client (mêmes ressources des deux côtés : aucun écart
 * d'hydratation).
 */
import type { AppResources } from "@antsia/social-features/i18n"

import enAntsia from "./locales/en/antsia.json"
import frAntsia from "./locales/fr/antsia.json"

/** Espace de noms de l'application. */
export const APP_NAMESPACE = "antsia"

export const appResources: AppResources = {
  fr: { antsia: frAntsia },
  en: { antsia: enAntsia },
}
