"use client"

import { resolvePostHogConfiguration } from "@antsia/social-features/shell/analytics"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { analyticsCaptureEndpoint } from "@/lib/routes"

export const usageConfiguration = resolvePostHogConfiguration({
  endpoint: analyticsCaptureEndpoint(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  projectToken: process.env.NEXT_PUBLIC_POSTHOG_KEY,
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
