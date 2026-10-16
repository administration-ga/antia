/** PA5 — gestes explicites, rollback de canal et formulaire rendu ; aucun navigateur réel. */
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@antsia/api/engine"

const state = vi.hoisted(() => ({ digest: false, canQuery: true, mutation: vi.fn(), calls: [] as unknown[] }))
vi.mock("@antsia/api/engine", () => ({ api: { modules: {
  notifications: { preferences: { getMine: "preferences", update: "update" }, pushSubscriptions: { configuration: "configuration", listMine: "subscriptions", subscribe: "subscribe", unsubscribe: "unsubscribe" } },
  people: { consents: { recordConsent: "record", revokeConsent: "revoke" } },
} } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: (query: string, args: unknown) => {
  state.calls.push([query, args])
  if (args === "skip") return { data: undefined, error: null }
  if (query === "preferences") return { data: { pushCategories: { social: true, messages: true, calls: true, network: true, moderation: true, files: true }, digestCategories: { social: true, messages: true, calls: true, network: true, moderation: true, files: true }, emailDigest: state.digest, weeklyLimit: 35 }, error: null }
  if (query === "configuration") return { data: { applications: [{ applicationId: "antsia_ga" }], vapidPublicKey: "AQID", available: { web: true, digest: true } }, error: null }
  return { data: [], error: null }
} }))
vi.mock("convex/react", () => ({ useMutation: () => state.mutation }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { browserCredentialHash, currentDeviceSubscriptions, disableWebNotifications, enableWebNotifications, NotificationControls, notificationPreferencesSchema, saveNotificationPreferences, webPushKey, type NotificationPreferenceValues } from "./notification-controls"

const categories = { social: true, messages: true, calls: true, network: true, moderation: true, files: true }
const values: NotificationPreferenceValues = { pushCategories: categories, digestCategories: categories, emailDigest: false, weeklyLimit: 35 }
const networkId = "network-fixture" as Id<"networks">
const subscriptionId = "subscription-fixture" as Id<"pushSubscriptions">
const ENDPOINT = "https://push.example.test/opaque-endpoint"

beforeEach(() => { state.digest = false; state.calls.length = 0; state.mutation.mockReset() })
afterEach(() => vi.unstubAllGlobals())

function browserFixture(existing = false) {
  const order: string[] = []
  const native = { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } }), unsubscribe: vi.fn(async () => { order.push("browser-off"); return true }) } as unknown as PushSubscription
  const registration = { pushManager: { getSubscription: vi.fn(async () => existing ? native : null), subscribe: vi.fn(async () => { order.push("browser-subscribe"); return native }) } } as unknown as ServiceWorkerRegistration
  const operations = {
    register: vi.fn(async () => { order.push("register"); return registration }),
    requestPermission: vi.fn(async (): Promise<NotificationPermission> => { order.push("permission"); return "granted" }),
    recordConsent: vi.fn(async () => { order.push("consent"); return null }),
    subscribe: vi.fn(async () => { order.push("server-subscribe"); return { subscriptionId } }),
    unsubscribe: vi.fn(async () => { order.push("server-off"); return null }),
    deviceId: () => "device_fixture", current: () => true,
  }
  return { native, registration, operations, order }
}

describe("activation Web explicite", () => {
  it("clef base64url convertie sans exposer les clés d'abonnement", () => {
    expect([...webPushKey("AQID")]).toEqual([1, 2, 3])
  })
  it("pas de VAPID : aucun worker, prompt, consentement ni écriture", async () => {
    const fixture = browserFixture()
    expect(await enableWebNotifications(fixture.operations, "")).toEqual({ ok: false, reason: "unavailable" })
    expect(fixture.order).toEqual([])
  })
  it("permission refusée : aucune souscription ni consentement", async () => {
    const fixture = browserFixture()
    fixture.operations.requestPermission.mockResolvedValue("denied")
    expect(await enableWebNotifications(fixture.operations, "AQID")).toEqual({ ok: false, reason: "denied" })
    expect(fixture.operations.recordConsent).not.toHaveBeenCalled()
    expect(fixture.operations.subscribe).not.toHaveBeenCalled()
  })
  it("le consentement précède l'écriture et le serveur reçoit un canal précis", async () => {
    const fixture = browserFixture()
    expect(await enableWebNotifications(fixture.operations, "AQID")).toEqual({ ok: true, credentialHash: await browserCredentialHash(ENDPOINT) })
    expect(fixture.order).toEqual(["register", "permission", "browser-subscribe", "consent", "server-subscribe"])
    expect(fixture.operations.subscribe).toHaveBeenCalledWith({ applicationId: "antsia_ga", deviceId: "device_fixture", credential: { provider: "web", endpoint: ENDPOINT, keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } } })
  })
  it("refus serveur : supprime la nouvelle souscription navigateur", async () => {
    const fixture = browserFixture()
    fixture.operations.subscribe.mockRejectedValue(new Error("refus serveur"))
    await expect(enableWebNotifications(fixture.operations, "AQID")).rejects.toThrow("refus serveur")
    expect(fixture.native.unsubscribe).toHaveBeenCalledTimes(1)
  })
  it("refus serveur sur canal préexistant : préserve sa souscription", async () => {
    const fixture = browserFixture(true)
    fixture.operations.subscribe.mockRejectedValue(new Error("autre propriétaire"))
    await expect(enableWebNotifications(fixture.operations, "AQID")).rejects.toThrow()
    expect(fixture.native.unsubscribe).not.toHaveBeenCalled()
    expect(fixture.registration.pushManager.subscribe).not.toHaveBeenCalled()
  })
  it("consentement refusé ou JSON malformé : aucun demi-abonnement", async () => {
    const fixture = browserFixture()
    fixture.operations.recordConsent.mockRejectedValue(new Error("consentement refusé"))
    await expect(enableWebNotifications(fixture.operations, "AQID")).rejects.toThrow()
    expect(fixture.operations.subscribe).not.toHaveBeenCalled()
    expect(fixture.native.unsubscribe).toHaveBeenCalledTimes(1)
    const malformed = browserFixture()
    vi.spyOn(malformed.native, "toJSON").mockReturnValue({ endpoint: ENDPOINT })
    await expect(enableWebNotifications(malformed.operations, "AQID")).rejects.toThrow()
    expect(malformed.operations.recordConsent).not.toHaveBeenCalled()
    expect(malformed.native.unsubscribe).toHaveBeenCalledTimes(1)
  })
  it("annulation après écriture nettoie serveur et nouvelle souscription", async () => {
    const fixture = browserFixture()
    let current = true
    fixture.operations.current = () => current
    fixture.operations.subscribe.mockImplementation(async () => { current = false; return { subscriptionId } })
    expect(await enableWebNotifications(fixture.operations, "AQID")).toEqual({ ok: false, reason: "cancelled" })
    expect(fixture.operations.unsubscribe).toHaveBeenCalledWith(subscriptionId)
    expect(fixture.native.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe("désactivation ciblée", () => {
  it("le hash retrouve le canal après purge du deviceId, sans toucher aux autres appareils", async () => {
    const fixture = browserFixture(), hash = await browserCredentialHash(ENDPOINT)
    const rows = [
      { subscriptionId, applicationId: "antsia_ga", deviceId: "ancien_device", provider: "web", credentialHash: hash, active: true },
      { subscriptionId: "other" as Id<"pushSubscriptions">, applicationId: "antsia_ga", deviceId: "autre_device", provider: "web", credentialHash: "autre_hash", active: true },
    ]
    expect(currentDeviceSubscriptions(rows, hash, "nouveau_device")).toHaveLength(1)
    await disableWebNotifications({ subscription: fixture.native, subscriptions: rows, deviceId: "nouveau_device", unsubscribe: fixture.operations.unsubscribe })
    expect(fixture.operations.unsubscribe).toHaveBeenCalledTimes(1)
    expect(fixture.operations.unsubscribe).toHaveBeenCalledWith(subscriptionId)
    expect(fixture.native.unsubscribe).toHaveBeenCalledTimes(1)
  })
  it("échec backend : ferme quand même le navigateur et remonte l'erreur", async () => {
    const fixture = browserFixture()
    fixture.operations.unsubscribe.mockRejectedValue(new Error("réseau"))
    await expect(disableWebNotifications({ subscription: fixture.native, subscriptions: [{ subscriptionId, applicationId: "antsia_ga", deviceId: "device_fixture", provider: "web", active: true }], deviceId: "device_fixture", unsubscribe: fixture.operations.unsubscribe })).rejects.toThrow("réseau")
    expect(fixture.native.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe("préférences et digest", () => {
  it("le formulaire borne strictement le plafond, y compris champ vide/NaN", () => {
    const schema = notificationPreferencesSchema("borne traduite")
    for (const limit of [-1, 101, 1.5, NaN]) expect(schema.safeParse({ ...values, weeklyLimit: limit }).success).toBe(false)
    expect(schema.parse({ ...values, weeklyLimit: 0 }).weeklyLimit).toBe(0)
    expect(schema.parse({ ...values, weeklyLimit: 100 }).weeklyLimit).toBe(100)
  })
  it("opt-in digest : consentement AVANT activation ; catégories seules ne renouvellent pas un accord", async () => {
    const order: string[] = []
    const operations = { recordDigestConsent: vi.fn(async () => { order.push("grant") }), revokeDigestConsent: vi.fn(async () => { order.push("revoke") }), update: vi.fn(async () => { order.push("update") }) }
    await saveNotificationPreferences({ ...values, emailDigest: true }, values, true, operations)
    expect(order).toEqual(["grant", "update"])
    order.length = 0
    await saveNotificationPreferences({ ...values, emailDigest: true }, { ...values, emailDigest: true }, false, operations)
    expect(order).toEqual(["update"])
  })
  it("OFF révoque d'abord, et l'activation refusée compense le nouvel accord", async () => {
    const order: string[] = []
    const operations = { recordDigestConsent: vi.fn(async () => { order.push("grant") }), revokeDigestConsent: vi.fn(async () => { order.push("revoke") }), update: vi.fn(async () => { order.push("update") }) }
    await saveNotificationPreferences(values, { ...values, emailDigest: true }, false, operations)
    expect(order).toEqual(["revoke", "update"])
    order.length = 0; operations.update.mockRejectedValue(new Error("refus"))
    await expect(saveNotificationPreferences({ ...values, emailDigest: true }, values, true, operations)).rejects.toThrow("refus")
    expect(order).toEqual(["grant", "revoke"])
  })
  it("rendu initial sans demande de permission, digest non précoché, champs nommés et bornés", () => {
    const requestPermission = vi.fn(); vi.stubGlobal("Notification", { permission: "default", requestPermission })
    const html = renderToStaticMarkup(<NotificationControls networkId={networkId} />)
    expect(requestPermission).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled()
    expect(html).toContain('name="emailDigest"')
    const digest = html.match(/<input[^>]*name="emailDigest"[^>]*>/u)?.[0]
    expect(digest).not.toContain("checked")
    expect(html).toContain('type="number"'); expect(html).toContain('max="100"')
    expect(html).toContain("personal.categories.social")
  })
  it("suspendu : configuration skipped, catégories désactivables et submit disponible", () => {
    const html = renderToStaticMarkup(<NotificationControls networkId={networkId} canActivate={false} />)
    expect(state.calls).toContainEqual(["configuration", "skip"])
    expect(html).toContain('max="35"')
    expect(html).not.toContain('aria-busy="true"')
    expect(html.match(/<button[^>]*type="submit"[^>]*>/u)?.[0]).not.toMatch(/\sdisabled(?:=|\s|>)/u)
  })
})
