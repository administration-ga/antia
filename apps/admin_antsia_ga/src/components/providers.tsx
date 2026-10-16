"use client"

import { api } from "@antsia/api/engine"
import type { RefreshableCrossDomainAuthClient } from "@antsia/api/cross-domain-session-bootstrap"
import { EngineConvexProvider } from "@antsia/api/next-provider"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import type { Locale } from "@antsia/social-features/i18n"
import { I18nProvider } from "@antsia/social-features/i18n/client"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { APP_NAMESPACE, appResources } from "@/i18n/resources"
import { authClient } from "@/lib/auth-client"

export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""

function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(APP_NAMESPACE)
  // La santé reste lisible même sans backend. Les surfaces de session affichent le manque.
  if (!CONVEX_URL) return <>{children}</>
  return <EngineConvexProvider convexUrl={CONVEX_URL} authClient={authClient as unknown as RefreshableCrossDomainAuthClient} ensurePerson={api.modules.people.persons.ensureMyPerson} isSessionActive={api.modules.platform.authentication.mySession} labels={{ loading: t("session.loading"), failed: t("session.failed"), retry: t("session.retry") }}>{children}</EngineConvexProvider>
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nProvider locale={locale} appResources={appResources} defaultNS={APP_NAMESPACE} defaultVariables={{ brand: BRAND_NAME }}><SessionProvider>{children}</SessionProvider></I18nProvider>
}
