import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AppState } from "react-native"
import * as Crypto from "expo-crypto"
import * as WebBrowser from "expo-web-browser"
import { runNativeIdn } from "./native-idn"
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
  const idnPending = useRef<object | null>(null)
  const [idnBusy, setIdnBusy] = useState(false)
  const [idnError, setIdnError] = useState(false)
  const cancelIdn = useCallback(() => {
    idnPending.current = null
    setIdnBusy(false)
    try { WebBrowser.dismissAuthSession() } catch { /* Android ferme sa Custom Tab au retour. */ }
  }, [])

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
    // Le navigateur peut masquer l'app ; seul le retour corrélé arme la capture.
    if (idnPending.current) return
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
    cancelIdn()
    closePrivateState()
    currentPhase.current = "failure"
    setPhase("failure")
  }, [cancelIdn, closePrivateState])
  const revoked = useCallback(() => {
    if (currentPhase.current === "exiting" || !mounted.current) return
    cancelIdn()
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
  }, [authUrl, cancelIdn, closePrivateState, vault])

  const exit = useCallback(async () => {
    cancelIdn()
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
  }, [auth, authUrl, cancelIdn, closePrivateState, exitGate, lifecycle, sessionLifecycle, vault])

  const signInIdn = useCallback(async ({ scheme, webUrl }: { scheme: string; webUrl: string }) => {
    if (idnPending.current || currentPhase.current !== "anonymous" || vault.hasCredential) return
    vault.fence()
    const pending = {}
    idnPending.current = pending
    setIdnBusy(true)
    setIdnError(false)
    const current = () => mounted.current && idnPending.current === pending && currentPhase.current !== "exiting" && currentPhase.current !== "purgeFailed"
    try {
      const base64url = (value: string) => value.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
      const admitted = await runNativeIdn({
        scheme, webUrl, auth, vault, isCurrent: current, isForeground: () => foreground.current,
        randomToken: async () => base64url(btoa(String.fromCharCode(...await Crypto.getRandomBytesAsync(32)))),
        sha256: async (value) => base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.BASE64 })),
        openSession: (url, redirectUri) => WebBrowser.openAuthSessionAsync(url, redirectUri, { preferEphemeralSession: true }),
      })
      if (!current()) return
      if (!admitted) {
        // Un masquage après l'échange peut avoir fermé la génération du coffre.
        // Aucun credential n'existait au départ de cette tentative.
        if (vault.hasCredential) await vault.clear()
        else vault.fence()
        return
      }
      idnPending.current = null
      setIdnBusy(false)
      await resume()
    } catch {
      if (current()) {
        vault.fence()
        if (vault.hasCredential) await vault.clear().catch(() => { /* Le coffre publie son refus fermé. */ })
        if (current()) setIdnError(true)
      }
    } finally {
      if (current()) {
        idnPending.current = null
        setIdnBusy(false)
        if (foreground.current && !vault.hasCredential) { currentPhase.current = "anonymous"; setPhase("anonymous") }
      }
    }
  }, [auth, resume, vault])

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
    return () => {
      mounted.current = false
      if (idnPending.current) {
        idnPending.current = null
        try { WebBrowser.dismissAuthSession() } catch { /* Aucun retour ne peut réadopter cette session. */ }
      }
      listener.remove(); operation.current += 1; lifecycle.invalidate(); vault.fence(); void lifecycle.stopResources()
    }
  }, [closePrivateState, lifecycle, resume, vault])
  useEffect(() => () => { callSessionRef.current = null; sessionLifecycle.invalidate(); void sessionLifecycle.stopResources() }, [sessionLifecycle])
  const firstHydration = useRef(false)
  useEffect(() => {
    if (credential.ready && !firstHydration.current) { firstHydration.current = true; void resume() }
  }, [credential.ready, resume])
  useEffect(() => {
    if (!credential.failed || currentPhase.current === "exiting" || currentPhase.current === "purgeFailed") return
    cancelIdn()
    closePrivateState()
    currentPhase.current = "purgeFailed"
    setPhase("purgeFailed")
  }, [credential.failed, cancelIdn, closePrivateState])
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
  return { auth, vault, lifecycle, phase, session, callSession, foreground: foreground.current, transportKey, exitResult, resume, exit, revoked, blocked, signInIdn, idnBusy, idnError, sessionIsCurrent, callSessionIsCurrent, registerSessionCleanup }
}
export type NativeSessionController = ReturnType<typeof useNativeSessionController>
