// Dupliqué de plateforme/espace/espace_administration_ga/src/integrations/posthog/provider.tsx @ 25398f565 — adaptations : patron de provider facultatif et validation de configuration conservés ; projection fermée d'écrans publics consentie, transport HTTP natif borné et révocable ; SDK, identification, autocapture, DOM, erreurs, persistance et replay entièrement retirés.
"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"

import {
  createUsagePayload,
  createUsageFunnelPayload,
  isUsageLocale,
  isUsageNetwork,
  isUsageScreen,
  isUsageFunnelStep,
  resolvePostHogConfiguration,
  type PostHogConfiguration,
  type UsageLocale,
  type UsageScreen,
  type UsageFunnelStep,
} from "./posthog"

const CAPTURES_PER_MINUTE = 10
const WINDOW_MS = 60_000
const REQUEST_TIMEOUT_MS = 5_000

interface CaptureState {
  distinctId: string | null
  lastView: string | null
  attempts: number[]
  lastClock: number
}

export interface PostHogProviderProps {
  configuration: PostHogConfiguration | null
  consented: boolean
  screen: UsageScreen | null
  networkSlug: string
  locale: UsageLocale
  children: ReactNode
}

/** Aucun SDK ni abonnement au routeur : l'application déclare uniquement un écran. */
export function PostHogProvider({ configuration, consented, screen, networkSlug, locale, children }: PostHogProviderProps) {
  const stateRef = useRef<CaptureState>({ distinctId: null, lastView: null, attempts: [], lastClock: 0 })
  const endpoint = configuration?.endpoint
  const projectToken = configuration?.projectToken
  const euRelayOrigin = configuration?.euRelayOrigin

  useEffect(() => {
    // Tous les accès au registre se font dans l'effet, jamais pendant le rendu.
    const state = stateRef.current
    const config = resolvePostHogConfiguration({ endpoint, projectToken, euRelayOrigin })
    // Un nouvel accord ne relie pas les deux périodes de consentement. Le
    // budget reste conservé : retirer l'accord ne libère aucune tentative.
    if (consented !== true) state.distinctId = null
    if (consented !== true || config === null || !isUsageScreen(screen) || !isUsageNetwork(networkSlug) || !isUsageLocale(locale)) {
      state.lastView = null
      return
    }
    const view = JSON.stringify([config.endpoint, config.projectToken, screen, networkSlug, locale])
    if (state.lastView === view) return
    let cancelled = false
    let controller: AbortController | null = null
    let timeout: number | undefined

    // StrictMode annule sa première pose avant cette microtask : elle ne
    // consomme ni capture, ni identité, ni budget et la seconde peut envoyer.
    void Promise.resolve().then(() => {
      if (cancelled || state.lastView === view) return
      // Le budget est commun au montage : changer de réseau ou de configuration
      // ne le remet pas à zéro. Un retour d'horloge ne libère pas de nouvelles places.
      const now = Math.max(Date.now(), state.lastClock)
      const attempts = state.attempts.filter((attempt) => now - attempt < WINDOW_MS)
      if (attempts.length >= CAPTURES_PER_MINUTE) return
      if (state.distinctId === null) {
        try {
          state.distinctId = window.crypto.randomUUID()
        } catch {
          return
        }
      }
      const payload = createUsagePayload({ projectToken: config.projectToken, distinctId: state.distinctId, screen, networkSlug, locale })
      if (payload === null) return
      const requestController = new AbortController()
      controller = requestController
      timeout = window.setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS)
      state.lastView = view
      state.lastClock = now
      state.attempts = [...attempts, now]
      try {
        void fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
          signal: requestController.signal,
        }).catch(() => undefined).finally(() => window.clearTimeout(timeout))
      } catch {
        window.clearTimeout(timeout)
      }
    })
    return () => {
      cancelled = true
      controller?.abort()
      window.clearTimeout(timeout)
    }
  }, [endpoint, projectToken, euRelayOrigin, consented, screen, networkSlug, locale])

  return <>{children}</>
}

type FunnelScope = { config: PostHogConfiguration; networkSlug: string; locale: UsageLocale }
type ActiveRequest = { controller: AbortController; timeout: number }

/** Parcours du montage courant seulement : aucune association entre visites ou périodes d'accord. */
export function useUsageFunnel({ configuration, consented, networkSlug, locale }: Pick<PostHogProviderProps, "configuration" | "consented" | "networkSlug" | "locale">) {
  const scopeRef = useRef<FunnelScope | null>(null)
  const requestsRef = useRef(new Set<ActiveRequest>())
  const stateRef = useRef({ distinctId: null as string | null, seen: new Set<UsageFunnelStep>(), attempts: [] as number[], lastClock: 0 })
  const endpoint = configuration?.endpoint, projectToken = configuration?.projectToken, euRelayOrigin = configuration?.euRelayOrigin

  useEffect(() => {
    const config = resolvePostHogConfiguration({ endpoint, projectToken, euRelayOrigin })
    scopeRef.current = consented === true && config && isUsageNetwork(networkSlug) && isUsageLocale(locale) ? { config, networkSlug, locale } : null
    if (!scopeRef.current) {
      stateRef.current.distinctId = null
      stateRef.current.seen.clear()
    }
    return () => {
      scopeRef.current = null
      for (const request of requestsRef.current) {
        request.controller.abort()
        window.clearTimeout(request.timeout)
      }
      requestsRef.current.clear()
    }
  }, [endpoint, projectToken, euRelayOrigin, consented, networkSlug, locale])

  return useCallback((step: UsageFunnelStep) => {
    const scope = scopeRef.current
    if (!scope || !isUsageFunnelStep(step)) return
    // Une révocation ou une sortie avant la microtask ne laisse partir aucun événement.
    void Promise.resolve().then(() => {
      if (scopeRef.current !== scope) return
      const state = stateRef.current
      if (state.seen.has(step)) return
      const now = Math.max(Date.now(), state.lastClock)
      const attempts = state.attempts.filter(at => now - at < WINDOW_MS)
      if (attempts.length >= CAPTURES_PER_MINUTE) return
      if (state.distinctId === null) {
        try { state.distinctId = window.crypto.randomUUID() } catch { return }
      }
      const payload = createUsageFunnelPayload({ projectToken: scope.config.projectToken, distinctId: state.distinctId, step, networkSlug: scope.networkSlug, locale: scope.locale })
      if (!payload) return
      const controller = new AbortController()
      const request = { controller, timeout: window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) }
      requestsRef.current.add(request)
      state.seen.add(step)
      state.lastClock = now
      state.attempts = [...attempts, now]
      const finish = () => { window.clearTimeout(request.timeout); requestsRef.current.delete(request) }
      try {
        void fetch(scope.config.endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal,
        }).catch(() => undefined).finally(finish)
      } catch { finish() }
    })
  }, [])
}
