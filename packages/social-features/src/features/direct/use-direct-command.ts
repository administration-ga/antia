// Dupliqué de socle/packages/agent-features/src/features/direct/DirectAntennaPanel.tsx @ ad2e7fdc2 — adaptations : cycle des commandes mutualisé, refus traduits et verrou concurrent ; horloge des invitations arrondie et arrêtée avec le volet.
"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { postEngineErrorText } from "../reseau-personnel/post-overflow"

export function useDirectCommand() {
  const { t } = useTranslation("direct")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = async (operation: () => Promise<unknown>): Promise<boolean> => {
    if (running.current) return false
    running.current = true
    setPending(true)
    setError(null)
    try { await operation(); return mounted.current } catch (failure) {
      if (mounted.current) setError(postEngineErrorText(failure, "direct:failed", t))
      return false
    } finally {
      running.current = false
      if (mounted.current) setPending(false)
    }
  }
  return { pending, error, run }
}

export function useDirectClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 30_000) * 30_000)
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 30_000) * 30_000)
    const timer = setInterval(tick, 30_000)
    window.addEventListener("focus", tick)
    return () => { clearInterval(timer); window.removeEventListener("focus", tick) }
  }, [])
  return now
}
