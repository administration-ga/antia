import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AppState } from "react-native"
import { createNativeLifecycle } from "@antsia/social-native/lifecycle"
import { createNativeSignOutGate, type NativeExitResult } from "@antsia/social-native/sign-out"
import { nativeRequest } from "@antsia/social-native/request"
import { buildNativeAuthClient } from "./auth-client"
import { createNativeCredentialVault } from "./secure-storage"

export type NativeSession = { id: string; userId: string; expiresAt: number }
type Phase = "loading" | "anonymous" | "ready" | "background" | "failure" | "exiting" | "purgeFailed"

/** Session serveur fraîche, JWT uniquement en mémoire. Aucun état sticky ne vaut autorisation. */
export function useNativeSessionController(authUrl: string) {
  const [vault] = useState(() => createNativeCredentialVault(authUrl))
  const [auth, setAuth] = useState(() => buildNativeAuthClient(authUrl, vault))
  const credential = useSyncExternalStore(vault.subscribe, vault.snapshot, vault.snapshot)
  const [lifecycle] = useState(createNativeLifecycle)
  const [sessionLifecycle] = useState(createNativeLifecycle)
  const [exitGate] = useState(createNativeSignOutGate)
  const [phase, setPhase] = useState<Phase>("loading")
  const [session, setSession] = useState<NativeSession | null>(null)
  // L'autorité d'un appel admis survit au masquage des écrans ; jamais à une sortie,
  // une révocation ou à l'échéance de la vraie session serveur.
  const [callSession, setCallSession] = useState<NativeSession | null>(null)
  const callSessionRef = useRef<NativeSession | null>(null)
  const [transportKey, setTransportKey] = useState(0)
  const [exitResult, setExitResult] = useState<NativeExitResult | null>(null)
  const foreground = useRef(AppState.currentState === "active")
  const currentPhase = useRef(phase)
  const currentSession = useRef(session)
  currentPhase.current = phase
  currentSession.current = session
  const operation = useRef(0)
  const mounted = useRef(true)

  const closeCallSession = useCallback((stopResources = true) => {
    callSessionRef.current = null
    setCallSession(null)
    sessionLifecycle.invalidate()
    if (stopResources) void sessionLifecycle.stopResources()
  }, [sessionLifecycle])
  const closePrivateState = useCallback((stopResources = true, closeCalls = true) => {
    operation.current += 1
    lifecycle.invalidate()
    vault.fence()
    currentSession.current = null
    setSession(null)
    if (stopResources) void lifecycle.stopResources()
    if (closeCalls) closeCallSession(stopResources)
  }, [closeCallSession, lifecycle, vault])

  const resume = useCallback(async () => {
    if (!foreground.current || currentPhase.current === "exiting" || currentPhase.current === "purgeFailed") return
    const at = ++operation.current
    lifecycle.invalidate()
    void lifecycle.stopResources()
    currentPhase.current = "loading"
    setPhase("loading")
    setSession(null)
    try {
      const token = await vault.readToken()
      if (!mounted.current || operation.current !== at || !foreground.current) return
      if (!token) {
        closeCallSession()
        currentPhase.current = vault.failed ? "purgeFailed" : "anonymous"
        setPhase(currentPhase.current)
        return
      }
      const result = await nativeRequest((signal) => auth.getSession({ query: { disableCookieCache: true }, fetchOptions: { signal, throw: false } }))
      if (!mounted.current || operation.current !== at || !foreground.current) return
      if (result.error) throw new Error("nativeSessionUnavailable")
      if (!result.data?.session) {
        closeCallSession()
        vault.fence()
        await vault.clear()
        if (!mounted.current || operation.current !== at || !foreground.current) return
        setAuth(buildNativeAuthClient(authUrl, vault))
        currentPhase.current = "anonymous"
        setPhase("anonymous")
        return
      }
      const actual = result.data.session
      const expiresAt = new Date(actual.expiresAt).getTime()
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("nativeSessionExpired")
      const next = { id: actual.id, userId: actual.userId, expiresAt }
      if (callSessionRef.current && (callSessionRef.current.id !== next.id || callSessionRef.current.userId !== next.userId)) closeCallSession()
      const stopped = await sessionLifecycle.waitForStopped()
      if (!mounted.current || operation.current !== at || !foreground.current) return
      if (stopped.some((result) => result.status === "rejected")) {
        closeCallSession()
        currentPhase.current = "purgeFailed"
        setPhase("purgeFailed")
        return
      }
      callSessionRef.current = next
      setCallSession(next)
      sessionLifecycle.activate()
      currentSession.current = next
      setSession(next)
      setTransportKey((value) => value + 1)
      currentPhase.current = "ready"
      setPhase("ready")
    } catch {
      if (!mounted.current || operation.current !== at || !foreground.current) return
      closeCallSession()
      currentPhase.current = vault.failed ? "purgeFailed" : "failure"
      setPhase(currentPhase.current)
    }
  }, [auth, authUrl, closeCallSession, vault, lifecycle, sessionLifecycle])

  const blocked = useCallback(() => {
    if (currentPhase.current === "exiting" || !mounted.current) return
    closePrivateState()
    currentPhase.current = "failure"
    setPhase("failure")
  }, [closePrivateState])
  const revoked = useCallback(() => {
    if (currentPhase.current === "exiting" || !mounted.current) return
    closePrivateState()
    currentPhase.current = "loading"
    setPhase("loading")
    const at = operation.current
    void vault.clear().then(() => {
      if (!mounted.current || operation.current !== at) return
      setAuth(buildNativeAuthClient(authUrl, vault))
      currentPhase.current = "anonymous"
      setPhase("anonymous")
    }).catch(() => {
      if (!mounted.current || operation.current !== at) return
      currentPhase.current = "purgeFailed"
      setPhase("purgeFailed")
    })
  }, [authUrl, closePrivateState, vault])

  const exit = useCallback(async () => {
    const result = await exitGate({
      client: auth,
      block: () => { currentPhase.current = "exiting"; closePrivateState(false); setPhase("exiting") },
      stopResources: async () => {
        const results = [...await lifecycle.stopResources(), ...await sessionLifecycle.stopResources()]
        if (results.some((value) => value.status === "rejected")) throw new Error("nativeCleanupFailed")
      },
      clearCredentials: () => vault.clear(),
      reset: () => { if (mounted.current) { setAuth(buildNativeAuthClient(authUrl, vault)); setSession(null); setTransportKey((value) => value + 1) } },
    })
    if (mounted.current) {
      setExitResult(result)
      currentPhase.current = result.localCleared ? "anonymous" : "purgeFailed"
      setPhase(currentPhase.current)
    }
    return result
  }, [auth, authUrl, closePrivateState, exitGate, lifecycle, sessionLifecycle, vault])

  useEffect(() => {
    mounted.current = true
    const listener = AppState.addEventListener("change", (next) => {
      const active = next === "active"
      if (foreground.current === active) return
      foreground.current = active
      if (!active) {
        closePrivateState(true, false)
        if (currentPhase.current !== "exiting" && currentPhase.current !== "purgeFailed") {
          currentPhase.current = "background"
          setPhase("background")
        }
      } else { void resume() }
    })
    return () => { mounted.current = false; listener.remove(); operation.current += 1; lifecycle.invalidate(); vault.fence(); void lifecycle.stopResources() }
  }, [closePrivateState, lifecycle, resume, vault])
  useEffect(() => () => { callSessionRef.current = null; sessionLifecycle.invalidate(); void sessionLifecycle.stopResources() }, [sessionLifecycle])
  const firstHydration = useRef(false)
  useEffect(() => {
    if (credential.ready && !firstHydration.current) { firstHydration.current = true; void resume() }
  }, [credential.ready, resume])
  useEffect(() => {
    if (!credential.failed || currentPhase.current === "exiting" || currentPhase.current === "purgeFailed") return
    closePrivateState()
    currentPhase.current = "purgeFailed"
    setPhase("purgeFailed")
  }, [credential.failed, closePrivateState])
  useEffect(() => {
    if (!callSession) return
    // Une horloge est nécessaire : Date.now seul dans une query ne s'abonne pas à l'échéance.
    const timeout = setTimeout(revoked, Math.min(2_147_483_647, Math.max(0, callSession.expiresAt - Date.now())))
    return () => clearTimeout(timeout)
  }, [callSession, revoked])

  const sessionIsCurrent = useCallback((id: string, generation: number) =>
    mounted.current && foreground.current && currentPhase.current === "ready" && currentSession.current?.id === id && vault.generation === generation,
  [vault])
  const callSessionIsCurrent = useCallback((id: string) =>
    mounted.current && sessionLifecycle.active && !vault.failed && currentPhase.current !== "exiting" && currentPhase.current !== "purgeFailed" && callSessionRef.current?.id === id && callSessionRef.current.expiresAt > Date.now(),
  [sessionLifecycle, vault])
  const registerSessionCleanup = useCallback((cleanup: () => void | Promise<void>) => sessionLifecycle.register(cleanup), [sessionLifecycle])
  return { auth, vault, lifecycle, phase, session, callSession, foreground: foreground.current, transportKey, exitResult, resume, exit, revoked, blocked, sessionIsCurrent, callSessionIsCurrent, registerSessionCleanup }
}
export type NativeSessionController = ReturnType<typeof useNativeSessionController>
