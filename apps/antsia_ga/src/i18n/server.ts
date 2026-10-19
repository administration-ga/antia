import { BRAND_NAME } from "@antsia/social-contracts"
import { createAppI18n, DEFAULT_LOCALE, type Locale } from "@antsia/social-features/i18n"

import { APP_NAMESPACE, appResources } from "./resources"

export { APP_NAMESPACE, appResources }

/**
 * Traduction côté serveur (composants serveur, métadonnées). Une instance par
 * appel : aucune langue ne fuit d'une requête à l'autre. La marque est
 * interpolée partout par défaut (`{{brand}}`).
 */
export function getAppT(locale: Locale = DEFAULT_LOCALE) {
  const i18n = createAppI18n({ locale, appResources, defaultNS: APP_NAMESPACE, defaultVariables: { brand: BRAND_NAME } })
  const t = i18n.getFixedT(locale, APP_NAMESPACE)
  const tSocial = i18n.getFixedT(locale, "social")
  return {
    locale,
    t: (key: string, options: Record<string, unknown> = {}) => t(key, { brand: BRAND_NAME, ...options }),
    tSocial: (key: string) => tSocial(key),
  }
}
