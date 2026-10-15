/**
 * i18n du moteur — i18next, comme le socle et consulat.ga.
 *
 * Un espace de noms par paquet : `social` (ces surfaces), `errors` (codes
 * renvoyés par le serveur, `@antia/social-contracts`), et ceux des
 * applications (`antia`, `admin`, et `diasporale` chez DIASPORALE). Aucune
 * chaîne d'interface hors des fichiers de locale (cliquet
 * `no-hardcoded-strings`) ; les deux langues portent les mêmes clés (cliquet
 * `i18n-locales`).
 */
import { createInstance, type i18n as I18nInstance, type Resource } from "i18next"

import { serverCodeResources } from "@antia/social-contracts/i18n"

import enSocial from "./locales/en/social.json"
import frSocial from "./locales/fr/social.json"

export const SUPPORTED_LOCALES = ["fr", "en"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "fr"

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Ressources du moteur (surfaces + codes serveur), par langue. */
export const engineResources = {
  fr: { social: frSocial, ...serverCodeResources.fr },
  en: { social: enSocial, ...serverCodeResources.en },
} as const

export type AppResources = Record<Locale, Record<string, Record<string, unknown>>>

/**
 * Instance i18next ISOLÉE : une par requête côté serveur, une par arbre côté
 * client. Les ressources sont en mémoire, l'initialisation est synchrone
 * (`initAsync: false`) — aucun clignotement de clés au premier rendu.
 */
export function createAppI18n(options: {
  locale: Locale
  appResources: AppResources
  defaultNS: string
  /** Variables interpolées par défaut dans toutes les clés (la marque de l'application, `{{brand}}`). */
  defaultVariables?: Record<string, string>
}): I18nInstance {
  const resources: Resource = {}
  for (const locale of SUPPORTED_LOCALES) {
    resources[locale] = { ...engineResources[locale], ...options.appResources[locale] }
  }
  const instance = createInstance()
  void instance.init({
    lng: options.locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    resources,
    defaultNS: options.defaultNS,
    ns: Object.keys(resources[DEFAULT_LOCALE] ?? {}),
    interpolation: { escapeValue: false, ...(options.defaultVariables ? { defaultVariables: options.defaultVariables } : {}) },
    initAsync: false,
    returnNull: false,
  })
  return instance
}
