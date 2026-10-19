"use client"

import { clearCrossDomainSessionResidue } from "@antsia/api/cross-domain-session-bootstrap"
import type { IdentityAuthClient } from "@antsia/social-features/identity"
import { authClient } from "./auth-client"
import { routes } from "./routes"
import { BRIDGE_CLIENT_TIMEOUT_MS, BRIDGE_RESUME_EVENT, BRIDGE_TTL_SECONDS, bridgeCookieNames, isBridgeGeneration, sdkSessionCookie } from "./session-bridge"

export function currentSessionBridgeGeneration(): string | null {
  if (typeof document === "undefined") return null
  const name = bridgeCookieNames(window.location.protocol === "https:").generation
  const value = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
  return isBridgeGeneration(value) ? value : null
}

/** Synchrone : aucune ancienne réponse HTTP ne peut ouvrir la nouvelle génération. */
export function rotateSessionBridgeFence(): string {
  const generation = crypto.randomUUID()
  const secure = window.location.protocol === "https:"
  const name = bridgeCookieNames(secure).generation
  document.cookie = `${name}=${generation}; Path=/; SameSite=Lax; Max-Age=${BRIDGE_TTL_SECONDS}${secure ? "; Secure" : ""}`
  if (currentSessionBridgeGeneration() !== generation) throw new Error("bridgeStorageUnavailable")
  return generation
}

export async function requestSessionBridge(method: "POST" | "DELETE", body: { generation: string; cookie?: string; jwt?: string; anonymous?: boolean }, fetchImpl: typeof fetch = fetch, outerSignal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  outerSignal?.addEventListener("abort", abort, { once: true })
  if (outerSignal?.aborted) { outerSignal.removeEventListener("abort", abort); return false }
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectAbort: () => void = () => undefined
  const interrupted = new Promise<never>((_resolve, reject) => { rejectAbort = () => reject(new Error("bridgeInterrupted")) })
  controller.signal.addEventListener("abort", rejectAbort, { once: true })
  try {
    const response = await Promise.race([
      fetchImpl(routes.publicSessionBridge(), { method, credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }),
      interrupted,
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("bridgeTimeout")) }, BRIDGE_CLIENT_TIMEOUT_MS) }),
    ])
    return response.ok && currentSessionBridgeGeneration() === body.generation
  } catch { return false }
  finally { if (timer !== undefined) clearTimeout(timer); outerSignal?.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", rejectAbort) }
}

/** Pas de logout SDK ici : une arrivée refusée ne révoque aucune session étrangère. */
export function clearLocalSessionForAnonymousBridge(): boolean {
  try {
    clearCrossDomainSessionResidue(window.localStorage, authClient)
    return !sdkSessionCookie(authClient.getCookie()) && authClient.getSessionData() === null
  } catch { return false }
}

/** Reprise demandée par la personne, jamais déclenchée par une simple rotation. */
export function resumeSessionBridge(): void {
  const generation = rotateSessionBridgeFence()
  window.dispatchEvent(new CustomEvent(BRIDGE_RESUME_EVENT, { detail: generation }))
}

/** Adaptateur d'entrée local : le client partagé et ses plugins restent inchangés. */
export function fencedIdentityEntryClient(client: IdentityAuthClient, fence: () => string = rotateSessionBridgeFence): IdentityAuthClient {
  return {
    signIn: {
      oauth2: (args) => { fence(); return client.signIn.oauth2(args) },
      emailOtp: (args) => { fence(); return client.signIn.emailOtp(args) },
    },
    emailOtp: { sendVerificationOtp: (args) => client.emailOtp.sendVerificationOtp(args) },
    phoneNumber: { sendOtp: (args) => client.phoneNumber.sendOtp(args), verify: (args) => { fence(); return client.phoneNumber.verify(args) } },
  }
}
