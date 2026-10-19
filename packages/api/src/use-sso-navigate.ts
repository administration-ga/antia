// Dupliqué de socle/packages/sso/src/use-cross-domain-handoff.ts @ 25398f565 — adaptations : contrat useSsoNavigate explicite, cible et origines autorisées validées avant création du jeton, requête bornée/annulable, snapshot de session recontrôlé et invalidation au démontage/changement de compte, aucun départ silencieux sous une autre session en cas d'échec ; préparation injectable et résultat discriminé pour le retour utilisateur.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { isSigningOutEverywhere, type AuthRequestOptions } from "./sign-out-everywhere"

export type OttCapableClient = {
  /** Snapshot crossDomain : le jeton doit encore appartenir à cette session au départ. */
  getSessionData?: () => unknown
  oneTimeToken?: {
    generate?: (options?: AuthRequestOptions) => Promise<unknown>
  }
}

export type SsoNavigationResult =
  | { kind: "ready"; href: string; session: "transported" | "absent" }
  | { kind: "refused"; reason: "invalidUrl" | "untrustedOrigin" | "tokenUnavailable" | "timeout" }

export type SsoNavigationOptions = {
  isAuthenticated: boolean
  allowedOrigins: readonly string[]
  timeoutMs?: number
  signal?: AbortSignal
}

function currentSessionId(authClient: OttCapableClient): string | null {
  try {
    const data = authClient.getSessionData?.()
    const session = typeof data === "object" && data !== null && "session" in data ? data.session : null
    const id = typeof session === "object" && session !== null && "id" in session ? session.id : null
    return typeof id === "string" && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/** Aucune URL relative ou avec identifiants ; seule une origine explicite transporte une session. */
export function validateSsoTarget(targetUrl: string, allowedOrigins: readonly string[]): { kind: "allowed"; href: string } | Extract<SsoNavigationResult, { kind: "refused" }> {
  let target: URL
  try {
    target = new URL(targetUrl)
    if ((target.protocol !== "https:" && target.protocol !== "http:") || target.username || target.password) return { kind: "refused", reason: "invalidUrl" }
  } catch {
    return { kind: "refused", reason: "invalidUrl" }
  }
  const allowed = allowedOrigins.some((entry) => {
    try {
      const origin = new URL(entry)
      return (origin.protocol === "https:" || origin.protocol === "http:") && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash && origin.origin === target.origin
    } catch {
      return false
    }
  })
  if (!allowed) return { kind: "refused", reason: "untrustedOrigin" }
  // Un jeton fourni par une adresse ne doit jamais choisir la session de l'arrivée.
  target.searchParams.delete("ott")
  return { kind: "allowed", href: target.toString() }
}

/** Ne génère rien tant que la destination n'est pas prouvée autorisée. */
export async function prepareSsoNavigation(authClient: OttCapableClient, targetUrl: string, options: SsoNavigationOptions): Promise<SsoNavigationResult> {
  if (isSigningOutEverywhere()) return { kind: "refused", reason: "tokenUnavailable" }
  const target = validateSsoTarget(targetUrl, options.allowedOrigins)
  if (target.kind === "refused") return target
  if (options.signal?.aborted) return { kind: "refused", reason: "tokenUnavailable" }
  if (!options.isAuthenticated) return { kind: "ready", href: target.href, session: "absent" }
  const tracksSession = typeof authClient.getSessionData === "function"
  const initialSessionId = currentSessionId(authClient)
  if (tracksSession && initialSessionId === null) return { kind: "refused", reason: "tokenUnavailable" }
  const generator = authClient.oneTimeToken?.generate
  if (typeof generator !== "function") return { kind: "refused", reason: "tokenUnavailable" }

  const requestedTimeout = options.timeoutMs
  const timeoutMs = requestedTimeout !== undefined && Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? Math.min(requestedTimeout, 10_000) : 4_000
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: (() => void) | undefined
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted || options.signal?.aborted) throw new DOMException("Authentication navigation aborted", "AbortError")
        return generator({ fetchOptions: { throw: false, signal: controller.signal } })
      }),
      new Promise<never>((_resolve, reject) => {
        cancel = () => {
          reject(new DOMException("Authentication navigation aborted", "AbortError"))
          controller.abort()
        }
        options.signal?.addEventListener("abort", cancel, { once: true })
        if (options.signal?.aborted) cancel()
        timer = setTimeout(() => {
          reject(new DOMException("Authentication request timed out", "TimeoutError"))
          controller.abort()
        }, timeoutMs)
      }),
    ])
    if (isSigningOutEverywhere() || controller.signal.aborted || options.signal?.aborted || (tracksSession && currentSessionId(authClient) !== initialSessionId)) return { kind: "refused", reason: "tokenUnavailable" }
    if (typeof result !== "object" || result === null || ("error" in result && result.error != null) || !("data" in result)) return { kind: "refused", reason: "tokenUnavailable" }
    const data: unknown = result.data
    const token = typeof data === "object" && data !== null && "token" in data ? data.token : null
    if (typeof token !== "string" || !token.trim() || token.length > 4_096) return { kind: "refused", reason: "tokenUnavailable" }
    const destination = new URL(target.href)
    destination.searchParams.set("ott", token)
    return { kind: "ready", href: destination.toString(), session: "transported" }
  } catch (error) {
    return { kind: "refused", reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "tokenUnavailable" }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (cancel !== undefined) options.signal?.removeEventListener("abort", cancel)
  }
}

export function useSsoNavigate(options: SsoNavigationOptions & { authClient: OttCapableClient }) {
  const { authClient, isAuthenticated, allowedOrigins, timeoutMs, signal } = options
  const [pending, setPending] = useState(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  // Comparer le contenu : une liste recréée au rendu ne doit pas annuler un clic légitime.
  const originsSignature = JSON.stringify(allowedOrigins)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current += 1
      activeRequest.current?.abort()
      activeRequest.current = null
    }
  }, [authClient, isAuthenticated, originsSignature, signal])

  const navigateExternal = useCallback(async (targetUrl: string): Promise<SsoNavigationResult> => {
    if (isSigningOutEverywhere() || !mounted.current || signal?.aborted) return { kind: "refused", reason: "tokenUnavailable" }
    const requestGeneration = ++generation.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const cancel = () => controller.abort()
    signal?.addEventListener("abort", cancel, { once: true })
    const tracksSession = typeof authClient.getSessionData === "function"
    const initialSessionId = currentSessionId(authClient)
    setPending(true)
    try {
      const result = await prepareSsoNavigation(authClient, targetUrl, { isAuthenticated, allowedOrigins, timeoutMs, signal: controller.signal })
      if (isSigningOutEverywhere() || !mounted.current || requestGeneration !== generation.current || controller.signal.aborted || (tracksSession && currentSessionId(authClient) !== initialSessionId)) return { kind: "refused", reason: "tokenUnavailable" }
      if (result.kind === "ready" && typeof window !== "undefined") window.location.assign(result.href)
      return result
    } finally {
      signal?.removeEventListener("abort", cancel)
      if (activeRequest.current === controller) activeRequest.current = null
      if (mounted.current && activeRequest.current === null) setPending(false)
    }
  }, [authClient, isAuthenticated, allowedOrigins, timeoutMs, signal])
  return { navigateExternal, pending }
}
