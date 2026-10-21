"use client"

import { useTranslation } from "react-i18next"
import { appBasePath } from "@/lib/app-path"
import { demoEntryEnabled } from "@/lib/demo-embed"
import { routes } from "@/lib/routes"

const actionClassName = "inline-flex min-h-11 items-center justify-center rounded-[var(--ui2-button-radius)] border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Changement de zone = nouveau document, aucun singleton de session partagé. */
export function DemoEntryLink() {
  const { t } = useTranslation("antsia")
  if (!demoEntryEnabled() || appBasePath()) return null
  return <a href={routes.demo()} className={actionClassName}>{t("demoIntegration.entry")}</a>
}

export function DemoModeBanner() {
  const { t } = useTranslation("antsia")
  if (!appBasePath()) return null
  return <aside aria-label={t("demoIntegration.title")} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 text-card-foreground">
    <div className="min-w-0"><p className="text-sm font-bold">{t("demoIntegration.title")}</p><p className="text-xs text-muted-foreground">{t("demoIntegration.lead")}</p></div>
    <a href={routes.home()} className={actionClassName}>{t("demoIntegration.back")}</a>
  </aside>
}

/** Repli fermé si le relais privé n'est pas configuré, sans origine secondaire. */
export function DemoEmbedScreen() {
  const { t } = useTranslation("antsia")
  return <main id="contenu" tabIndex={-1} className="flex min-h-dvh min-w-0 flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
    <h1 className="text-lg font-bold">{t("demoIntegration.title")}</h1>
    <p role="status">{t("demoIntegration.unavailable")}</p>
    <a href={routes.home()} className={actionClassName}>{t("demoIntegration.back")}</a>
  </main>
}
