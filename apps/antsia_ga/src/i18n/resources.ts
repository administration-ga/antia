/**
 * Ressources de traduction de l'application, partagées par le rendu serveur et
 * le fournisseur client (mêmes ressources des deux côtés : aucun écart
 * d'hydratation).
 */
import type { AppResources } from "@antsia/social-features/i18n"

import enAntsia from "./locales/en/antsia.json"
import frAntsia from "./locales/fr/antsia.json"
import enMemberNetwork from "./locales/en/memberNetwork.json"
import frMemberNetwork from "./locales/fr/memberNetwork.json"
import enPublicNetwork from "./locales/en/publicNetwork.json"
import frPublicNetwork from "./locales/fr/publicNetwork.json"

/** Espace de noms de l'application. */
export const APP_NAMESPACE = "antsia"

export const appResources: AppResources = {
  fr: { antsia: frAntsia, memberNetwork: frMemberNetwork, publicNetwork: frPublicNetwork },
  en: { antsia: enAntsia, memberNetwork: enMemberNetwork, publicNetwork: enPublicNetwork },
}
