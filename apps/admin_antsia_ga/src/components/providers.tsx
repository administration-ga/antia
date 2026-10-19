"use client"

import { api } from "@antsia/api/engine"
import type { RefreshableCrossDomainAuthClient } from "@antsia/api/cross-domain-session-bootstrap"
import { useStableConvexAuth } from "@antsia/api/hooks"
import { EngineConvexProvider } from "@antsia/api/next-provider"
import { ViewerPreferencesProvider } from "@antsia/api/viewer-preferences"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import type { Locale } from "@antsia/social-features/i18n"
import { I18nProvider } from "@antsia/social-features/i18n/client"
import { useQuery } from "convex/react"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Toaster } from "sonner"

import { APP_NAMESPACE, appResources } from "@/i18n/resources"
import { authClient } from "@/lib/auth-client"

export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""

/** La préférence de la personne s'applique après session, sans recopier les claims IDN. */
function PersonalLocale({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useStableConvexAuth()
  const person = useQuery(api.modules.people.persons.getMyPerson, isAuthenticated ? {} : "skip")
  const { i18n } = useTranslation()
  useEffect(() => {
    if (!person?.locale) return
    document.documentElement.lang = person.locale
    if (i18n.language !== person.locale) void i18n.changeLanguage(person.locale)
  }, [person?.locale, i18n])
  return <ViewerPreferencesProvider timeZone={person?.timeZone}>{children}</ViewerPreferencesProvider>
}

function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(APP_NAMESPACE)
  // La santé reste lisible même sans backend. Les surfaces de session affichent le manque.
  if (!CONVEX_URL) return <>{children}</>
  return <EngineConvexProvider convexUrl={CONVEX_URL} authClient={authClient as unknown as RefreshableCrossDomainAuthClient} ensurePerson={api.modules.people.persons.ensureMyPerson} isSessionActive={api.modules.platform.authentication.mySession} labels={{ loading: t("session.loading"), failed: t("session.failed"), retry: t("session.retry") }}><PersonalLocale>{children}</PersonalLocale></EngineConvexProvider>
}

function ConsoleToaster() {
  const { t } = useTranslation(APP_NAMESPACE)
  return <Toaster position="top-center" closeButton containerAriaLabel={t("common.notices")} toastOptions={{ closeButtonAriaLabel: t("common.closeNotice"), classNames: { closeButton: "min-h-11 min-w-11" }, style: { background: "var(--card)", color: "var(--card-foreground)", border: "1px solid var(--border)" } }} />
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nProvider locale={locale} appResources={appResources} defaultNS={APP_NAMESPACE} defaultVariables={{ brand: BRAND_NAME }}><SessionProvider>{children}</SessionProvider><ConsoleToaster /></I18nProvider>
}
