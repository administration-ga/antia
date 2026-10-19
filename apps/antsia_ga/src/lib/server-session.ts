import { decodeJwtClaims } from "@antsia/api/cross-domain-session-bootstrap"
import { api } from "@convex/_generated/api"
import { fetchQuery } from "convex/nextjs"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { z } from "zod"

import catalog from "../../../../deploy/catalog.json"
import { routes } from "./routes"
import { BRIDGE_TIMEOUT_MS, bridgeAdmission, bridgeCookieNames } from "./session-bridge"

export type ServerViewer = { status: "anonymous" } | { status: "authenticated"; token: string } | { status: "refused" } | { status: "unavailable" }

/** L'origine canonique est configurée, jamais extraite d'un Host reçu. */
export function configuredMetadataOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  if (!value || value.trim() !== value) return null
  try {
    const url = new URL(value)
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost"))) return null
    return url.origin
  } catch { return null }
}

/** Catalogue approuvé pour le port local ; en production une origine configurée est obligatoire. */
export function configuredBridgeOrigin(): string | null {
  const configured = configuredMetadataOrigin()
  if (configured || process.env.NODE_ENV === "production") return configured
  const local = new URL(catalog.applications.antsia_ga.site_url)
  local.protocol = "http:"
  local.hostname = "localhost"
  local.port = String(catalog.applications.antsia_ga.dev_port)
  return local.origin
}

export async function withinBridgeDeadline<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = BRIDGE_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work(controller.signal), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("authUnavailable")) }, timeoutMs)
    })])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

export async function boundedAuthFetch(path: string, cookie: string, fetchImpl: typeof fetch = fetch, outerSignal?: AbortSignal): Promise<Response> {
  const site = process.env.CONVEX_SITE_URL
  if (!site) throw new Error("authUnavailable")
  const controller = new AbortController()
  const abort = () => controller.abort()
  outerSignal?.addEventListener("abort", abort, { once: true })
  if (outerSignal?.aborted) controller.abort()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(new URL(path, site), { method: "GET", cache: "no-store", redirect: "manual", headers: { Cookie: cookie, Accept: "application/json" }, signal: controller.signal })
        const body = await readBoundedText(response.body, 32_768, controller.signal)
        return new Response(body || null, { status: response.status, headers: { "Content-Type": "application/json" } })
      })(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("authUnavailable")) }, BRIDGE_TIMEOUT_MS) }),
    ])
  } finally { if (timer !== undefined) clearTimeout(timer); outerSignal?.removeEventListener("abort", abort) }
}

/** Aucun JSON de session ni requête d'admission ne peut dépasser cette borne. */
export async function readBoundedText(body: ReadableStream<Uint8Array> | null, limit = 32_768, signal?: AbortSignal): Promise<string> {
  if (!body) return ""
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal?.addEventListener("abort", abort, { once: true })
  try {
    while (true) {
      if (signal?.aborted) throw new Error("bodyUnavailable")
      const part = await reader.read()
      if (signal?.aborted) throw new Error("bodyUnavailable")
      if (part.done) break
      size += part.value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error("bodyTooLarge") }
      chunks.push(part.value)
    }
  } finally { signal?.removeEventListener("abort", abort); reader.releaseLock() }
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder("utf-8", { fatal: true }).decode(output)
}

const sessionSchema = z.object({ session: z.object({ id: z.string().min(1), userId: z.string().min(1), expiresAt: z.union([z.string().datetime(), z.number().finite()]) }).passthrough(), user: z.object({ id: z.string().min(1) }).passthrough() }).passthrough()

export function verifiedSessionDto(value: unknown, now = Date.now()) {
  const parsed = sessionSchema.safeParse(value)
  if (!parsed.success || parsed.data.session.userId !== parsed.data.user.id) return null
  const expiresAt = typeof parsed.data.session.expiresAt === "number" ? parsed.data.session.expiresAt : Date.parse(parsed.data.session.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > now ? { sessionId: parsed.data.session.id, subject: parsed.data.user.id, expiresAt } : null
}

/** Appelé seulement APRÈS vérification cryptographique de ce JWT par Convex. */
export function tokenCorrelatesWithSession(token: string, session: { sessionId: string; subject: string }): boolean {
  const claims = decodeJwtClaims(token)
  return claims?.sessionId === session.sessionId && claims.sub === session.subject
}

export async function serverViewerFromBridge(generation: string | undefined, receipt: string | undefined, dependencies: { authFetch?: typeof boundedAuthFetch; sessionActive?: (token: string) => Promise<boolean> } = {}): Promise<ServerViewer> {
  const admission = bridgeAdmission(generation, receipt)
  if (admission.status === "anonymous") return { status: "anonymous" }
  if (admission.status === "closed") return { status: "refused" }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return { status: "unavailable" }
  const cookie = `${admission.receipt.cookieName}=${encodeURIComponent(admission.receipt.cookieValue)}`
  const authFetch = dependencies.authFetch ?? boundedAuthFetch
  try {
    return await withinBridgeDeadline<ServerViewer>(async (signal) => {
    const sessionResponse = await authFetch(routes.authSession(), cookie, undefined, signal)
    if (sessionResponse.status === 401 || sessionResponse.status === 403) return { status: "refused" }
    if (!sessionResponse.ok) return { status: "unavailable" }
    const session = verifiedSessionDto(await sessionResponse.json())
    if (!session) return { status: "refused" }
    signal.throwIfAborted()
    const response = await authFetch(routes.authToken(), cookie, undefined, signal)
    if (response.status === 401 || response.status === 403) return { status: "refused" }
    if (!response.ok) return { status: "unavailable" }
    const parsed = z.object({ token: z.string().min(1).max(8192) }).strict().safeParse(await response.json())
    if (!parsed.success) return { status: "refused" }
    const token = parsed.data.token
    signal.throwIfAborted()
    const active = await (dependencies.sessionActive ?? ((jwt) => fetchQuery(api.modules.platform.authentication.mySession, {}, { url, token: jwt })))(token)
    if (!active || !tokenCorrelatesWithSession(token, session)) return { status: "refused" }
    return { status: "authenticated", token }
    })
  } catch { return { status: "unavailable" } }
}

export const getServerViewer = cache(async (): Promise<ServerViewer> => {
  const store = await cookies()
  const requestHeaders = await headers()
  if (requestHeaders.has("authorization") || requestHeaders.has("better-auth-cookie")) return { status: "refused" }
  const origin = configuredBridgeOrigin()
  const secureNames = bridgeCookieNames(true), localNames = bridgeCookieNames(false)
  const hasSecure = store.has(secureNames.generation) || store.has(secureNames.receipt)
  const hasLocal = store.has(localNames.generation) || store.has(localNames.receipt)
  if (!origin && (hasSecure || hasLocal)) return { status: "unavailable" }
  const secure = origin?.startsWith("https:") ?? false
  if ((secure && hasLocal) || (!secure && hasSecure)) return { status: "refused" }
  const names = bridgeCookieNames(secure)
  return serverViewerFromBridge(store.get(names.generation)?.value, store.get(names.receipt)?.value)
})

export const getPublicLocale = cache(async (): Promise<"fr" | "en"> => {
  const value = (await headers()).get("accept-language") ?? ""
  return /^en(?:[-;,]|$)/i.test(value) ? "en" : "fr"
})
