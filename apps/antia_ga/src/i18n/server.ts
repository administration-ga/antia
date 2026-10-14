import { BRAND_NAME } from "@antia/social-contracts"
import { createAppI18n, DEFAULT_LOCALE, type AppResources, type Locale } from "@antia/social-features/i18n"

import enAntia from "./locales/en/antia.json"
import frAntia from "./locales/fr/antia.json"

/** Espace de noms de l'application. */
export const APP_NAMESPACE = "antia"

export const appResources: AppResources = {
  fr: { antia: frAntia },
  en: { antia: enAntia },
}

/**
 * Traduction côté serveur (composants serveur, métadonnées). Une instance par
 * appel : aucune langue ne fuit d'une requête à l'autre. La marque est
 * interpolée partout par défaut (`{{brand}}`).
 */
export function getAppT(locale: Locale = DEFAULT_LOCALE) {
  const i18n = createAppI18n({ locale, appResources, defaultNS: APP_NAMESPACE })
  const t = i18n.getFixedT(locale, APP_NAMESPACE)
  const tSocial = i18n.getFixedT(locale, "social")
  return {
    locale,
    t: (key: string, options: Record<string, unknown> = {}) => t(key, { brand: BRAND_NAME, ...options }),
    tSocial: (key: string) => tSocial(key),
  }
}
