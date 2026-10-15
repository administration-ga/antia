"use client"

import type { RefreshableCrossDomainAuthClient } from "@antia/api/cross-domain-session-bootstrap"
import { EngineConvexProvider } from "@antia/api/next-provider"
import { BRAND_NAME } from "@antia/social-contracts/brand"
import type { Locale } from "@antia/social-features/i18n"
import { I18nProvider } from "@antia/social-features/i18n/client"
import { api } from "@convex/_generated/api"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Toaster } from "sonner"

import { APP_NAMESPACE, appResources } from "@/i18n/resources"
import { authClient } from "@/lib/auth-client"

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""

/** Session Better Auth + client Convex ; sans moteur configuré, un avertissement plutôt qu'un écran blanc. */
function SessionProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation(APP_NAMESPACE)
  if (!CONVEX_URL) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
        <p role="alert" className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          {t("session.backendMissing")}
        </p>
      </main>
    )
  }
  return (
    <EngineConvexProvider
      convexUrl={CONVEX_URL}
      authClient={authClient as unknown as RefreshableCrossDomainAuthClient}
      ensurePerson={api.modules.people.persons.ensureMyPerson}
      labels={{ loading: t("session.loading"), failed: t("session.failed"), retry: t("session.retry") }}
    >
      {children}
    </EngineConvexProvider>
  )
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={locale} appResources={appResources} defaultNS={APP_NAMESPACE} defaultVariables={{ brand: BRAND_NAME }}>
      <SessionProviders>{children}</SessionProviders>
      <Toaster position="top-center" richColors closeButton />
    </I18nProvider>
  )
}
