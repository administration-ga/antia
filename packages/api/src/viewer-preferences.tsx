"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { browserTimeZone, canonicalTimeZone, UTC_TIME_ZONE } from "./civil-date"

const ViewerTimeZoneContext = createContext<string | null>(null)

/** Une préférence personnelle prime ; UTC garde le premier rendu SSR/client identique. */
export function ViewerPreferencesProvider({ timeZone, children }: { timeZone?: string | null; children: ReactNode }) {
  const [detectedTimeZone, setDetectedTimeZone] = useState(UTC_TIME_ZONE)
  useEffect(() => { setDetectedTimeZone(browserTimeZone()) }, [])
  const selectedTimeZone = canonicalTimeZone(timeZone) ?? detectedTimeZone
  // Le changement de valeur ne démonte pas les enfants, leurs appels ou leurs brouillons.
  return <ViewerTimeZoneContext.Provider value={selectedTimeZone}>{children}</ViewerTimeZoneContext.Provider>
}

/** Compatibilité des applications qui n'ont pas encore monté le provider. */
export function useViewerTimeZone(): string {
  const providedTimeZone = useContext(ViewerTimeZoneContext)
  const [detectedTimeZone, setDetectedTimeZone] = useState(UTC_TIME_ZONE)
  useEffect(() => {
    if (providedTimeZone === null) setDetectedTimeZone(browserTimeZone())
  }, [providedTimeZone])
  return providedTimeZone ?? detectedTimeZone
}
