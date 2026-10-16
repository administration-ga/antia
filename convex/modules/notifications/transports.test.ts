/** Transports Node : doubles HTTP/VAPID/APNs, aucune connexion ni clef réelle. */
import { EventEmitter } from "node:events"
import { generateKeyPairSync, verify } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NeutralNotificationPayload } from "@antsia/social-domain/notificationDelivery"

const mocks = vi.hoisted(() => ({ web: vi.fn(), connect: vi.fn() }))
vi.mock("web-push", () => ({ default: { sendNotification: mocks.web } }))
vi.mock("node:http2", () => ({ connect: mocks.connect }))
import { deliverPush, readExpoReceipt } from "./transports"

const payload: NeutralNotificationPayload = { version: 1, networkId: "network", reference: "delivery", count: 2, locale: "fr", url: "https://app.example.test/fil" }
beforeEach(() => { mocks.web.mockReset().mockResolvedValue({}); mocks.connect.mockReset() })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("transports push", () => {
  it.each(["web", "expo", "fcm", "apns"] as const)("%s non configuré : indisponible, jamais succès", async (provider) => {
    for (const key of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "EXPO_PUSH_ENDPOINT", "FCM_SEND_ENDPOINT", "APNS_ENDPOINT"]) vi.stubEnv(key, "")
    const credential = provider === "web" ? { provider, endpoint: "https://push.example.test/endpoint", keys: { p256dh: "key", auth: "auth" } } : { provider, token: "token" }
    expect(await deliverPush(credential, payload)).toEqual({ status: "unavailable" })
  })
  it("Web : payload fermé, options VAPID privées, endpoint disparu invalidé", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key"); vi.stubEnv("VAPID_PRIVATE_KEY", "private-key"); vi.stubEnv("VAPID_SUBJECT", "mailto:network@example.test"); vi.stubEnv("WEB_PUSH_ALLOWED_ORIGINS", "https://push.example.test")
    const credential = { provider: "web", endpoint: "https://push.example.test/endpoint", keys: { p256dh: "key", auth: "auth" } } as const
    expect(await deliverPush(credential, payload, true)).toEqual({ status: "sent" })
    expect(JSON.parse(mocks.web.mock.calls[0]![1] as string)).toEqual(payload)
    expect(mocks.web.mock.calls[0]![2]).toMatchObject({ TTL: 45, urgency: "high" })
    mocks.web.mockRejectedValueOnce({ statusCode: 410 })
    expect(await deliverPush(credential, payload)).toEqual({ status: "invalid" })
  })
  it("Expo accepté n'est pas livré ; reçu invalide désactive le jeton", async () => {
    vi.stubEnv("EXPO_PUSH_ENDPOINT", "https://expo.example.test/send"); vi.stubEnv("EXPO_RECEIPTS_ENDPOINT", "https://expo.example.test/receipts")
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "ok", id: "receipt" } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { receipt: { status: "error", details: { error: "DeviceNotRegistered" } } } })))
    vi.stubGlobal("fetch", fetchMock)
    expect(await deliverPush({ provider: "expo", token: "ExpoPushToken[token]" }, payload)).toEqual({ status: "accepted", receiptId: "receipt" })
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { title: string; body: string; data: NeutralNotificationPayload }
    expect(sent.data).toEqual(payload); expect(sent.title).toBe("ANTSIA"); expect(sent.body).toContain("2 nouvelles notifications")
    expect(await readExpoReceipt("receipt")).toEqual({ status: "accepted", receiptId: "receipt" })
    expect(await readExpoReceipt("receipt")).toEqual({ status: "invalid" })
  })
  it("FCM : assertion RS256 vérifiable puis token OAuth, aucun contenu de l'acteur", async () => {
    const key = generateKeyPairSync("rsa", { modulusLength: 2048 })
    vi.stubEnv("FCM_SEND_ENDPOINT", "https://fcm.example.test/send"); vi.stubEnv("FCM_OAUTH_ENDPOINT", "https://oauth.example.test/token"); vi.stubEnv("FCM_OAUTH_SCOPE", "fixture-scope")
    vi.stubEnv("FCM_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "service@example.test", private_key: key.privateKey.export({ format: "pem", type: "pkcs8" }) }))
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-fixture" }))).mockResolvedValueOnce(new Response(JSON.stringify({ name: "provider-message" })))
    vi.stubGlobal("fetch", fetchMock)
    expect(await deliverPush({ provider: "fcm", token: "device-token" }, payload)).toEqual({ status: "sent" })
    const assertion = (fetchMock.mock.calls[0]![1].body as URLSearchParams).get("assertion")!, [header, claims, signature] = assertion.split(".")
    expect(verify("sha256", Buffer.from(`${header}.${claims}`), key.publicKey, Buffer.from(signature!, "base64url"))).toBe(true)
    expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toMatchObject({ scope: "fixture-scope", aud: "https://oauth.example.test/token" })
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string) as { message: { data: Record<string, string> } }
    expect(body.message.data.reference).toBe("delivery")
    expect(Object.keys(body.message.data).sort()).toEqual(Object.keys(payload).sort())
  })
  it("APNs : JWT ES256, HTTP2, expiration courte et jeton invalide", async () => {
    const key = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    vi.stubEnv("APNS_ENDPOINT", "https://apns.example.test/"); vi.stubEnv("APNS_PRIVATE_KEY", key.privateKey.export({ format: "pem", type: "pkcs8" }).toString()); vi.stubEnv("APNS_KEY_ID", "key-fixture"); vi.stubEnv("APNS_TEAM_ID", "team-fixture"); vi.stubEnv("APNS_TOPIC", "test.app")
    let requestHeaders: Record<string, unknown> = {}, posted = ""
    const session = new EventEmitter() as EventEmitter & { request: (headers: Record<string, unknown>) => unknown; destroy: () => void }
    session.destroy = vi.fn()
    session.request = (headers) => {
      requestHeaders = headers
      const request = new EventEmitter() as EventEmitter & { setEncoding: () => void; end: (body: string) => void }
      request.setEncoding = () => {}
      request.end = (body) => { posted = body; queueMicrotask(() => { request.emit("response", { ":status": 410 }); request.emit("data", JSON.stringify({ reason: "Unregistered" })); request.emit("end") }) }
      return request
    }
    mocks.connect.mockReturnValue(session)
    expect(await deliverPush({ provider: "apns", token: "a".repeat(64) }, payload, true)).toEqual({ status: "invalid" })
    expect(requestHeaders).toMatchObject({ "apns-topic": "test.app", "apns-push-type": "alert", "apns-priority": "10" })
    const token = String(requestHeaders.authorization).replace("bearer ", ""), [header, claims, signature] = token.split(".")
    expect(verify("sha256", Buffer.from(`${header}.${claims}`), { key: key.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature!, "base64url"))).toBe(true)
    expect(JSON.parse(posted).reference).toBe("delivery")
  })
  it("un champ de contenu ajouté au payload refuse le transport", async () => {
    expect(await deliverPush({ provider: "expo", token: "token" }, { ...payload, body: "contenu privé" } as NeutralNotificationPayload)).toEqual({ status: "invalid" })
  })
  it("FCM rejuge la politique après OAuth ; un consentement révoqué interdit le deuxième HTTP", async () => {
    const key = generateKeyPairSync("rsa", { modulusLength: 2048 })
    vi.stubEnv("FCM_SEND_ENDPOINT", "https://fcm.example.test/send"); vi.stubEnv("FCM_OAUTH_ENDPOINT", "https://oauth.example.test/token"); vi.stubEnv("FCM_OAUTH_SCOPE", "fixture-scope")
    vi.stubEnv("FCM_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "service@example.test", private_key: key.privateKey.export({ format: "pem", type: "pkcs8" }) }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "access-fixture" })))
    vi.stubGlobal("fetch", fetchMock)
    expect(await deliverPush({ provider: "fcm", token: "device-token" }, payload, false, async () => false)).toEqual({ status: "cancelled" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
