import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { boundedAuthFetch, serverViewerFromBridge, verifiedSessionDto } from "./server-session"
import { routes } from "./routes"
import { BRIDGE_TIMEOUT_MS } from "./session-bridge"

const generation = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const receipt = JSON.stringify({ kind: "session", generation, cookieName: "better-auth.session_token", cookieValue: "abcdefghijklmnopqrstuv.signature1234567890=" })
function token(subject: string, sessionId: string) { return `${btoa("{}")}.${btoa(JSON.stringify({ sub: subject, sessionId }))}.signature` }
function session(subject: string, id: string) { return { session: { id, userId: subject, expiresAt: new Date(Date.now() + 60_000).toISOString() }, user: { id: subject } } }

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://localhost:3210"); vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211") })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe("lecture SSR d'une session connue", () => {
  it("ne transforme aucune panne de session ni 401 en anonymat", async () => {
    const active = vi.fn(async () => true)
    expect(await serverViewerFromBridge(generation, receipt, { authFetch: async () => new Response(null, { status: 401 }), sessionActive: active })).toEqual({ status: "refused" })
    expect(await serverViewerFromBridge(generation, receipt, { authFetch: async () => new Response(null, { status: 503 }), sessionActive: active })).toEqual({ status: "unavailable" })
    expect(active).not.toHaveBeenCalled()
  })
  it("corrèle deux requêtes/sujets sans cache de jeton partagé", async () => {
    const run = (subject: string, id: string) => serverViewerFromBridge(generation, receipt, {
      authFetch: async (path) => Response.json(path === routes.authSession() ? session(subject, id) : { token: token(subject, id) }),
      sessionActive: async (jwt) => jwt === token(subject, id),
    })
    const [a, b] = await Promise.all([run("A", "SID-A"), run("B", "SID-B")])
    expect(a).toEqual({ status: "authenticated", token: token("A", "SID-A") })
    expect(b).toEqual({ status: "authenticated", token: token("B", "SID-B") })
  })
  it("refuse un JWT valide pour une autre session ou une session révoquée", async () => {
    const authFetch = async (path: string) => Response.json(path === routes.authSession() ? session("A", "SID-A") : { token: token("B", "SID-B") })
    expect(await serverViewerFromBridge(generation, receipt, { authFetch, sessionActive: async () => true })).toEqual({ status: "refused" })
    expect(await serverViewerFromBridge(generation, receipt, { authFetch, sessionActive: async () => false })).toEqual({ status: "refused" })
  })
  it("borne également la preuve Convex qui ne répond jamais", async () => {
    vi.useFakeTimers()
    const pending = serverViewerFromBridge(generation, receipt, { authFetch: async (path) => Response.json(path === routes.authSession() ? session("A", "SID-A") : { token: token("A", "SID-A") }), sessionActive: () => new Promise<boolean>(() => undefined) })
    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS + 1)
    expect(await pending).toEqual({ status: "unavailable" })
  })
  it("le timeout englobe le corps après les en-têtes 200 et annule son lecteur", async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel })
    const pending = boundedAuthFetch(routes.authSession(), "selected-cookie", async () => new Response(stream))
    const checked = expect(pending).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS + 1)
    await checked
    expect(cancel).toHaveBeenCalled()
  })
  it("rejette un corps trop grand, un propriétaire divergent ou une expiration passée", async () => {
    await expect(boundedAuthFetch(routes.authSession(), "selected-cookie", async () => new Response("x".repeat(32_769)))).rejects.toThrow("bodyTooLarge")
    expect(verifiedSessionDto({ session: { id: "a", userId: "A", expiresAt: Date.now() + 10_000 }, user: { id: "B" } })).toBeNull()
    expect(verifiedSessionDto({ session: { id: "a", userId: "A", expiresAt: Date.now() - 1 }, user: { id: "A" } })).toBeNull()
  })
})
