"use client"

import { useState, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"

import { createAppI18n, type AppResources, type Locale } from "./index"

/**
 * Fournisseur i18n côté client : une instance par arbre, créée une fois au
 * montage avec les mêmes ressources que le rendu serveur (aucun écart
 * d'hydratation).
 */
export function I18nProvider(props: {
  locale: Locale
  appResources: AppResources
  defaultNS: string
  children: ReactNode
}) {
  const [i18n] = useState(() =>
    createAppI18n({ locale: props.locale, appResources: props.appResources, defaultNS: props.defaultNS }),
  )
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}
