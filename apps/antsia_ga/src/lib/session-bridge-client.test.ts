// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import type { IdentityAuthClient } from "@antsia/social-features/identity"

vi.mock("./auth-client", () => ({ authClient: { getCookie: () => "", getSessionData: () => null } }))
import { currentSessionBridgeGeneration, fencedIdentityEntryClient, requestSessionBridge, rotateSessionBridgeFence } from "./session-bridge-client"
import { BRIDGE_CLIENT_TIMEOUT_MS, BRIDGE_TIMEOUT_MS } from "./session-bridge"

afterEach(() => vi.useRealTimers())
describe("fence avant entrée, client partagé intact", () => {
  it("attend la préparation HTTP initiale sans abandonner au délai du travail serveur", async () => {
    vi.useFakeTimers()
    const generation = rotateSessionBridgeFence()
    const pending = requestSessionBridge("DELETE", { generation, anonymous: false }, () => new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response(null, { status: 204 })), BRIDGE_TIMEOUT_MS + 1_000)
    }))
    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS + 1_001)
    expect(await pending).toBe(true)
  })
  it("un transport bloqué reste borné et une réponse tardive n'est jamais admise", async () => {
    vi.useFakeTimers()
    const generation = rotateSessionBridgeFence()
    let finish: (response: Response) => void = () => undefined
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { finish = resolve }))
    const pending = requestSessionBridge("POST", { generation, cookie: "sdk", jwt: "jwt" }, fetchImpl)
    await vi.advanceTimersByTimeAsync(BRIDGE_CLIENT_TIMEOUT_MS + 1)
    expect(await pending).toBe(false)
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    finish(new Response(null, { status: 204 }))
    expect(await pending).toBe(false)
  })
  it("ferme avant OTP/IDN/vérification SMS, y compris les refus, sans transformer les envois de code", async () => {
    const calls: string[] = []
    const original: IdentityAuthClient = { signIn: { oauth2: async () => { calls.push("idn"); return { error: true } }, emailOtp: async () => { calls.push("otp"); return { error: true } } }, emailOtp: { sendVerificationOtp: async () => { calls.push("send"); return {} } }, phoneNumber: { sendOtp: async () => ({}), verify: async () => { calls.push("sms"); return { error: true } } } }
    const sdkMethod = original.signIn.emailOtp
    const adapted = fencedIdentityEntryClient(original, () => { calls.push("fence"); return "generation" })
    await adapted.emailOtp.sendVerificationOtp({ email: "fiction@example.test", type: "sign-in" })
    await adapted.signIn.emailOtp({ email: "fiction@example.test", otp: "000000" })
    await adapted.signIn.oauth2({ providerId: "idn", callbackURL: "/bienvenue" })
    await adapted.phoneNumber.verify({ phoneNumber: "+2410000000", code: "000000", disableSession: false })
    expect(calls).toEqual(["send", "fence", "otp", "fence", "idn", "fence", "sms"])
    expect(original.signIn.emailOtp).toBe(sdkMethod)
  })
  it("une admission HTTP A retardée reste refusée après rotation B", async () => {
    const a = rotateSessionBridgeFence()
    let complete: (response: Response) => void = () => undefined
    const request = requestSessionBridge("POST", { generation: a, cookie: "sdk", jwt: "jwt" }, () => new Promise<Response>((resolve) => { complete = resolve }))
    const b = rotateSessionBridgeFence()
    complete(new Response(null, { status: 204 }))
    expect(await request).toBe(false)
    expect(currentSessionBridgeGeneration()).toBe(b)
  })
  it("la purge locale HTTP demeure bornée et une annulation externe arrête l'admission", async () => {
    vi.useFakeTimers()
    const generation = rotateSessionBridgeFence(), controller = new AbortController()
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined))
    const pending = requestSessionBridge("POST", { generation, cookie: "sdk", jwt: "jwt" }, fetchImpl, controller.signal)
    controller.abort()
    expect(await pending).toBe(false)
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe("same-origin")
  })
})
