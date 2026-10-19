"use client"

import { useEffect, useState } from "react"

/**
 * Horloge locale seulement : aucune interrogation de service ni prolongation de réserve.
 *
 * P18b (A17) : `warnBeforeMs` réveille aussi l'écran à `expiresAt − warnBeforeMs`,
 * pour qu'il AVERTISSE avant l'échéance ; sans lui, le seul réveil reste
 * l'échéance elle-même (comportement inchangé pour les autres appelants).
 */
export function useCheckoutClock(expiresAt: number | null | undefined, warnBeforeMs = 0) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (expiresAt === null || expiresAt === undefined) return
    const update = () => setNow(Date.now())
    update()
    const wakeAt = (moment: number) => window.setTimeout(update, Math.min(Math.max(moment - Date.now(), 0) + 20, 2_147_483_647))
    const timers = [wakeAt(expiresAt)]
    if (warnBeforeMs > 0 && expiresAt - warnBeforeMs > Date.now()) timers.push(wakeAt(expiresAt - warnBeforeMs))
    window.addEventListener("focus", update)
    document.addEventListener("visibilitychange", update)
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      window.removeEventListener("focus", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [expiresAt, warnBeforeMs])
  return now
}
