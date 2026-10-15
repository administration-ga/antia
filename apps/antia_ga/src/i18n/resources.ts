/**
 * Ressources de traduction de l'application, partagées par le rendu serveur et
 * le fournisseur client (mêmes ressources des deux côtés : aucun écart
 * d'hydratation).
 */
import type { AppResources } from "@antia/social-features/i18n"

import enAntia from "./locales/en/antia.json"
import frAntia from "./locales/fr/antia.json"

/** Espace de noms de l'application. */
export const APP_NAMESPACE = "antia"

export const appResources: AppResources = {
  fr: { antia: frAntia },
  en: { antia: enAntia },
}
