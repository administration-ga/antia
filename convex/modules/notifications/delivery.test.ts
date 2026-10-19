// @vitest-environment edge-runtime
/** PA5 — vraie admission réseau et sessions ; transports doublés, jamais un fournisseur réel. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { notifyPerson } from "./notify"
import { defaultCategorySettings } from "./preferences"
import { enqueueIncomingCallPush } from "./deliveries"

const doubles = vi.hoisted(() => ({ push: vi.fn(), receipt: vi.fn(), email: vi.fn() }))
vi.mock("./transports", () => ({ deliverPush: doubles.push, readExpoReceipt: doubles.receipt }))
vi.mock("@convex-dev/resend", () => ({ Resend: class { sendEmail = doubles.email } }))

type T = ReturnType<typeof testConvex>
const NOW = Date.UTC(2026, 9, 16, 8)
const APPLICATIONS = JSON.stringify([{ applicationId: "antsia_ga", networkSlug: "antsia", origin: "https://antsia.example.test", entryPath: "/fil" }])

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  vi.stubEnv("NOTIFICATION_APPLICATIONS_JSON", APPLICATIONS)
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  doubles.push.mockReset().mockResolvedValue({ status: "sent" })
  doubles.receipt.mockReset().mockResolvedValue({ status: "sent" })
  doubles.email.mockReset().mockResolvedValue("email-fixture")
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

async function seed(t: T) { return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION }) }
async function member(t: T, networkId: Id<"networks">, subject: string) {
  const sessionId = await createTestSession(t, subject)
  const as = t.withIdentity({ subject, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId, personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW }))
  return { as, personId, sessionId }
}
async function subscribe(person: Awaited<ReturnType<typeof member>>, networkId: Id<"networks">, suffix = "a") {
  return await person.as.mutation(api.modules.notifications.pushSubscriptions.subscribe, { networkId, applicationId: "antsia_ga", deviceId: `device_${suffix}`, credential: { provider: "expo", token: `ExpoPushToken[token_${suffix}]` } })
}
async function consent(person: Awaited<ReturnType<typeof member>>, networkId: Id<"networks">, purpose: "notifications" | "email_digest" = "notifications") {
  await person.as.mutation(api.modules.people.consents.recordConsent, { networkId, purpose, origin: "settings" })
}
async function notice(t: T, networkId: Id<"networks">, recipientPersonId: Id<"persons">, actorPersonId: Id<"persons">, kind: "new_follower" | "post_reaction" | "post_comment" | "group_message" = "new_follower") {
  return await t.run(async (ctx) => await notifyPerson({ db: ctx.db, runQuery: ctx.runQuery }, { networkId, recipientPersonId, actorPersonId, kind }))
}
async function jobs(t: T) { return await t.run(async (ctx) => await ctx.db.query("notificationDeliveryJobs").take(100)) }

describe("admission, abonnement et quota", () => {
  it("pas de consentement : la cloche demeure, aucun push ; ni consentement global ni d'un autre réseau", async () => {
    const t = testConvex(), { root, testClosed } = await seed(t)
    const a = await member(t, root, "acteur"), b = await member(t, root, "recepteur")
    await subscribe(b, root)
    await b.as.mutation(api.modules.people.consents.recordConsent, { purpose: "notifications", origin: "settings" })
    await b.as.mutation(api.modules.people.consents.recordConsent, { networkId: testClosed, purpose: "notifications", origin: "settings" })
    expect(await notice(t, root, b.personId, a.personId)).not.toBeNull()
    expect(await jobs(t)).toEqual([])
  })
  it("endpoint non réattribuable ; liste sans credential, clés ni token", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    const first = await subscribe(a, root)
    expect(await subscribe(a, root)).toEqual(first)
    await expect(subscribe(b, root)).rejects.toThrow()
    const rows = await a.as.query(api.modules.notifications.pushSubscriptions.listMine, { networkId: root })
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]!).sort()).toEqual(["active", "applicationId", "credentialHash", "currentSession", "deviceId", "provider", "subscriptionId", "updatedAt"])
    expect(rows[0]).toMatchObject({ currentSession: true, credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/u) })
    expect(JSON.stringify(rows)).not.toContain("ExpoPushToken")
  })
  it("un événement multi-appareils réserve une seule unité, doublon cloche aucun nouveau budget", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root, "a"); await subscribe(b, root, "b"); await consent(b, root)
    await b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, weeklyLimit: 2 })
    const first = await notice(t, root, b.personId, a.personId)
    expect(await notice(t, root, b.personId, a.personId)).toBe(first)
    await notice(t, root, b.personId, a.personId, "post_reaction")
    await notice(t, root, b.personId, a.personId, "post_comment")
    expect(await jobs(t)).toHaveLength(4)
    expect(await t.run(async (ctx) => (await ctx.db.query("notificationWeeklyUsage").take(10))[0]?.reserved)).toBe(2)
    expect(await t.run(async (ctx) => await ctx.db.query("notifications").take(10))).toHaveLength(3)
  })
  it("catégories indépendantes et limite invalide refusée", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root)
    await b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, pushCategories: { ...defaultCategorySettings(), messages: false } })
    await notice(t, root, b.personId, a.personId, "group_message")
    expect(await jobs(t)).toEqual([])
    await expect(b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, weeklyLimit: 101 })).rejects.toThrow()
    await expect(b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, weeklyLimit: 1.5 })).rejects.toThrow()
  })
})

describe("relecture et bail de transport", () => {
  it("avis modération de son propre dossier admis même suspendu ; aucune cloche générale ni avis pour un tiers", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root)
    const reportId = await t.run(async (ctx) => {
      const membership = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", b.personId)).unique()
      await ctx.db.patch(membership!._id, { status: "suspendue" })
      return await ctx.db.insert("reports", { networkId: root, target: { kind: "person", id: b.personId }, targetKind: "person", targetId: b.personId, reporterPersonId: a.personId, ownerPersonId: b.personId, reason: "harassment", level: "network", status: "actioned", createdAt: NOW, updatedAt: NOW, reviewedAt: NOW })
    })
    expect(await notice(t, root, b.personId, a.personId)).toBeNull()
    expect(await t.run(async (ctx) => await notifyPerson({ db: ctx.db, runQuery: ctx.runQuery }, { networkId: root, recipientPersonId: a.personId, kind: "moderation_decision", subject: { report: reportId } }))).toBeNull()
    expect(await t.run(async (ctx) => await notifyPerson({ db: ctx.db, runQuery: ctx.runQuery }, { networkId: root, recipientPersonId: b.personId, kind: "moderation_decision", subject: { report: reportId } }))).not.toBeNull()
    await expect(b.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow()
    const jobId = (await jobs(t))[0]!._id
    await t.action(internal.modules.notifications.push.deliver, { jobId })
    expect(doubles.push).toHaveBeenCalledTimes(1)
  })
  it("l'appel relit pushIncoming et n'admet pas de deuxième sonnerie", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root)
    const callId = await t.run(async (ctx) => await ctx.db.insert("calls", { networkId: root, kind: "direct", status: "active", callStatus: "ringing", roomName: "fixture-room", createdByPersonId: a.personId, calleePersonId: b.personId, mediaType: "audio", maxParticipants: 2, startedAt: NOW }))
    expect(await t.run(async (ctx) => await enqueueIncomingCallPush({ db: ctx.db, runQuery: ctx.runQuery }, root, b.personId, callId))).toBe(true)
    expect(await t.run(async (ctx) => await enqueueIncomingCallPush({ db: ctx.db, runQuery: ctx.runQuery }, root, b.personId, callId))).toBe(true)
    expect(await jobs(t)).toHaveLength(1)
    await b.as.mutation(api.modules.calls.preferences.update, { pushIncoming: false })
    await t.action(internal.modules.notifications.push.deliver, { jobId: (await jobs(t))[0]!._id })
    expect(doubles.push).not.toHaveBeenCalled()
    expect((await jobs(t))[0]?.state).toBe("cancelled")
  })
  it.each(["revoked", "expired"] as const)("session d'appareil %s après admission : aucun transport", async (status) => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root)
    await notice(t, root, b.personId, a.personId)
    const jobId = (await jobs(t))[0]!._id
    if (status === "revoked") await t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: b.sessionId }] } })
    else await t.mutation(components.betterAuth.adapter.updateOne, { input: { model: "session", where: [{ field: "_id", value: b.sessionId }], update: { expiresAt: NOW - 1 } } })
    await t.action(internal.modules.notifications.push.deliver, { jobId })
    expect(doubles.push).not.toHaveBeenCalled()
    expect((await jobs(t))[0]?.state).toBe("cancelled")
  })
  it("session expirée avant admission : cloche seule, ni job ni quota réservé", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root)
    await t.mutation(components.betterAuth.adapter.updateOne, { input: { model: "session", where: [{ field: "_id", value: b.sessionId }], update: { expiresAt: NOW - 1 } } })
    expect(await notice(t, root, b.personId, a.personId)).not.toBeNull()
    expect(await jobs(t)).toEqual([])
    expect(await t.run(async (ctx) => await ctx.db.query("notificationWeeklyUsage").take(10))).toEqual([])
  })
  it.each(["consent", "category", "subscription", "suspension", "block"] as const)("révocation %s avant transport : aucun envoi", async (change) => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    const subscription = await subscribe(b, root); await consent(b, root)
    await notice(t, root, b.personId, a.personId)
    const job = (await jobs(t))[0]!
    if (change === "consent") await b.as.mutation(api.modules.people.consents.revokeConsent, { networkId: root, purpose: "notifications" })
    if (change === "category") await b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, pushCategories: { ...defaultCategorySettings(), social: false } })
    if (change === "subscription") await b.as.mutation(api.modules.notifications.pushSubscriptions.unsubscribe, { networkId: root, ...subscription })
    if (change === "suspension") await t.run(async (ctx) => { const row = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", b.personId)).unique(); await ctx.db.patch(row!._id, { status: "suspendue" }) })
    if (change === "block") await b.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: a.personId })
    await t.action(internal.modules.notifications.push.deliver, { jobId: job._id })
    expect(doubles.push).not.toHaveBeenCalled()
    expect((await jobs(t))[0]?.state).toBe("cancelled")
  })
  it("un deuxième actionnaire sous bail et le rejeu après succès n'envoient rien", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root); await notice(t, root, b.personId, a.personId)
    const job = (await jobs(t))[0]!
    const claim = await t.mutation(internal.modules.notifications.deliveries.claim, { jobId: job._id })
    expect(claim).not.toBeNull()
    expect(await t.mutation(internal.modules.notifications.deliveries.claim, { jobId: job._id })).toBeNull()
    await t.mutation(internal.modules.notifications.deliveries.finish, { jobId: job._id, leaseToken: claim!.leaseToken, state: "sent" })
    await t.action(internal.modules.notifications.push.deliver, { jobId: job._id })
    expect(doubles.push).not.toHaveBeenCalled()
  })
  it("configuration absente distincte du succès ; jeton invalide désactivé", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root); await notice(t, root, b.personId, a.personId)
    doubles.push.mockResolvedValueOnce({ status: "unavailable" })
    await t.action(internal.modules.notifications.push.deliver, { jobId: (await jobs(t))[0]!._id })
    expect((await jobs(t))[0]?.state).toBe("unavailable")
    await notice(t, root, b.personId, a.personId, "post_comment")
    doubles.push.mockResolvedValueOnce({ status: "invalid" })
    await t.action(internal.modules.notifications.push.deliver, { jobId: (await jobs(t))[1]!._id })
    expect(await b.as.query(api.modules.notifications.pushSubscriptions.listMine, { networkId: root })).toEqual([])
  })
  it("Expo accepté attend son reçu et ne réémet jamais le ticket", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root); await notice(t, root, b.personId, a.personId)
    const jobId = (await jobs(t))[0]!._id
    doubles.push.mockResolvedValueOnce({ status: "accepted", receiptId: "receipt-fixture" })
    await t.action(internal.modules.notifications.push.deliver, { jobId })
    expect((await jobs(t))[0]?.state).toBe("accepted")
    vi.setSystemTime(NOW + 16 * 60_000)
    await t.action(internal.modules.notifications.push.deliver, { jobId })
    expect(doubles.push).toHaveBeenCalledTimes(1)
    expect(doubles.receipt).toHaveBeenCalledWith("receipt-fixture")
    expect((await jobs(t))[0]?.state).toBe("sent")
  })
  it("les échecs transport sont bornés à trois tentatives", async () => {
    const t = testConvex(), { root } = await seed(t), a = await member(t, root, "a"), b = await member(t, root, "b")
    await subscribe(b, root); await consent(b, root); await notice(t, root, b.personId, a.personId)
    doubles.push.mockResolvedValue({ status: "retry" })
    const jobId = (await jobs(t))[0]!._id
    for (let i = 0; i < 4; i += 1) { vi.setSystemTime(NOW + i * 10 * 60_000); await t.action(internal.modules.notifications.push.deliver, { jobId }) }
    expect(doubles.push).toHaveBeenCalledTimes(3)
    expect((await jobs(t))[0]).toMatchObject({ state: "failed", attempts: 3 })
  })
})

describe("digest par réseau", () => {
  async function fixture() {
    const t = testConvex(), { root } = await seed(t)
    const created: unknown = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Nom civil de test", email: "digest@example.test", emailVerified: true, createdAt: NOW, updatedAt: NOW } } })
    if (!created || typeof created !== "object" || !("_id" in created) || typeof created._id !== "string") throw new Error("fixtureUserMissing")
    const userId = created._id, sessionId = await createTestSession(t, userId), as = t.withIdentity({ subject: userId, sessionId })
    const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId: root, personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW }))
    const b = { as, personId, sessionId }, a = await member(t, root, "a")
    await consent(b, root, "email_digest")
    await b.as.mutation(api.modules.notifications.preferences.update, { networkId: root, emailDigest: true })
    await notice(t, root, b.personId, a.personId)
    return { t, root, b, userId }
  }
  it("réserve un seul digest/semaine/réseau et la file ne contient aucun e-mail ni contenu", async () => {
    const { t } = await fixture()
    expect(await t.mutation(internal.modules.notifications.deliveries.reserveDigests, {})).toEqual({ queued: 1, done: true })
    expect(await t.mutation(internal.modules.notifications.deliveries.reserveDigests, {})).toEqual({ queued: 0, done: true })
    expect(JSON.stringify(await jobs(t))).not.toMatch(/digest@example|Nom civil|body|content|reason/u)
  })
  it("e-mail vérifié au transport, admission Resend et succès transactionnels ; rejeu sans nouveau mail", async () => {
    const { t } = await fixture()
    vi.stubEnv("RESEND_API_KEY", "fixture-key"); vi.stubEnv("RESEND_FROM_ADDRESS", "network@example.test")
    await t.mutation(internal.modules.notifications.deliveries.reserveDigests, {})
    const jobId = (await jobs(t))[0]!._id
    await t.action(internal.modules.notifications.digest.deliver, { jobId })
    await t.action(internal.modules.notifications.digest.deliver, { jobId })
    expect(doubles.email).toHaveBeenCalledTimes(1)
    expect(doubles.email.mock.calls[0]?.[1]).toMatchObject({ to: "digest@example.test", subject: "ANTSIA" })
    expect(doubles.email.mock.calls[0]?.[1].text).not.toContain("Nom civil")
    expect((await jobs(t))[0]?.state).toBe("sent")
  })
  it.each(["consent", "email"] as const)("révocation %s entre réservation et livraison annule le digest", async (change) => {
    const { t, root, b, userId } = await fixture()
    vi.stubEnv("RESEND_API_KEY", "fixture-key"); vi.stubEnv("RESEND_FROM_ADDRESS", "network@example.test")
    await t.mutation(internal.modules.notifications.deliveries.reserveDigests, {})
    if (change === "consent") await b.as.mutation(api.modules.people.consents.revokeConsent, { networkId: root, purpose: "email_digest" })
    else await t.mutation(components.betterAuth.adapter.updateOne, { input: { model: "user", where: [{ field: "_id", value: userId }], update: { emailVerified: false } } })
    await t.action(internal.modules.notifications.digest.deliver, { jobId: (await jobs(t))[0]!._id })
    expect(doubles.email).not.toHaveBeenCalled()
    expect((await jobs(t))[0]?.state).toBe("cancelled")
  })
})
