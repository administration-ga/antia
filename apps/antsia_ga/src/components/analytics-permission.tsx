"use client"

import { resolvePostHogConfiguration, useUsageFunnel, type UsageLocale } from "@antsia/social-features/shell/analytics"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { analyticsCaptureEndpoint } from "@/lib/routes"

export const usageConfiguration = resolvePostHogConfiguration({
  endpoint: analyticsCaptureEndpoint(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  projectToken: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  euRelayOrigin: process.env.NEXT_PUBLIC_POSTHOG_EU_RELAY_ORIGIN || undefined,
})

const PermissionContext = createContext<{ paused: boolean; pause: () => void; resume: () => void } | null>(null)

/** Un retrait arrête le navigateur immédiatement, y compris si son enregistrement échoue. */
export function UsagePermissionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false)
  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])
  const value = useMemo(() => ({ paused, pause, resume }), [paused, pause, resume])
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function useUsagePermission() {
  const permission = useContext(PermissionContext)
  if (!permission) throw new Error("Usage permission provider missing")
  return permission
}

/** Le parcours n'accorde jamais la mesure : seule une preuve déjà acquise l'active. */
export function useOnboardingUsage(consented: boolean, networkSlug: string, locale: UsageLocale) {
  const permission = useUsagePermission()
  return useUsageFunnel({ configuration: usageConfiguration, consented: consented && !permission.paused, networkSlug, locale })
}
