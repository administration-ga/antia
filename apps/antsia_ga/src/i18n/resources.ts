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
import enShops from "./locales/en/shops.json"
import frShops from "./locales/fr/shops.json"
import enCheckout from "./locales/en/checkout.json"
import frCheckout from "./locales/fr/checkout.json"
import enPayment from "./locales/en/payment.json"
import frPayment from "./locales/fr/payment.json"
import frCart from "./locales/fr/cart.json"
import enCart from "./locales/en/cart.json"
import frPurchases from "./locales/fr/purchases.json"
import enPurchases from "./locales/en/purchases.json"
import frJobs from "./locales/fr/jobs.json"
import enJobs from "./locales/en/jobs.json"
import frServices from "./locales/fr/services.json"
import enServices from "./locales/en/services.json"

/** Espace de noms de l'application. */
export const APP_NAMESPACE = "antsia"

export const appResources: AppResources = {
  fr: { antsia: frAntsia, memberNetwork: frMemberNetwork, publicNetwork: frPublicNetwork, shops: frShops, checkout: frCheckout, payment: frPayment, cart: frCart, purchases: frPurchases, jobs: frJobs, services: frServices },
  en: { antsia: enAntsia, memberNetwork: enMemberNetwork, publicNetwork: enPublicNetwork, shops: enShops, checkout: enCheckout, payment: enPayment, cart: enCart, purchases: enPurchases, jobs: enJobs, services: enServices },
}
