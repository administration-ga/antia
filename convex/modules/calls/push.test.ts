// @vitest-environment edge-runtime
/** PA5 — le raccord d'appel consulte des sessions Better Auth réelles, sans transport fournisseur. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { scheduleIncomingCallPush } from "./push"

const NOW = Date.UTC(2026, 9, 16, 8)
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  vi.stubEnv("NOTIFICATION_APPLICATIONS_JSON", JSON.stringify([{ applicationId: "antsia_ga", networkSlug: "antsia", origin: "https://antsia.example.test", entryPath: "/fil" }]))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

async function fixture() {
  const t = testConvex(), { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const callerSession = await createTestSession(t, "caller"), calleeSession = await createTestSession(t, "callee")
  const caller = t.withIdentity({ subject: "caller", sessionId: callerSession }), callee = t.withIdentity({ subject: "callee", sessionId: calleeSession })
  const callerPersonId = await caller.mutation(api.modules.people.persons.ensureMyPerson, {}), calleePersonId = await callee.mutation(api.modules.people.persons.ensureMyPerson, {})
  const callId = await t.run(async (ctx) => {
    for (const personId of [callerPersonId, calleePersonId]) await ctx.db.insert("networkMemberships", { networkId: root, personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW })
    return await ctx.db.insert("calls", { networkId: root, kind: "direct", status: "active", callStatus: "ringing", roomName: "push-fixture", createdByPersonId: callerPersonId, calleePersonId, mediaType: "audio", maxParticipants: 2, startedAt: NOW })
  })
  await callee.mutation(api.modules.people.consents.recordConsent, { networkId: root, purpose: "notifications", origin: "settings" })
  await callee.mutation(api.modules.notifications.pushSubscriptions.subscribe, { networkId: root, applicationId: "antsia_ga", deviceId: "device_fixture", credential: { provider: "expo", token: "ExpoPushToken[token_fixture]" } })
  const schedule = async () => await t.run(async (ctx) => await scheduleIncomingCallPush({ db: ctx.db, runQuery: ctx.runQuery }, { networkId: root, calleePersonId, callId }))
  const jobs = async () => await t.run(async (ctx) => await ctx.db.query("notificationDeliveryJobs").take(10))
  return { t, root, callee, calleeSession, callId, schedule, jobs }
}

describe("raccord push d'appel", () => {
  it("admet une seule sonnerie de la session vivante, malgré le rejeu", async () => {
    const { schedule, jobs, callId } = await fixture()
    expect(await schedule()).toBe(true)
    expect(await schedule()).toBe(true)
    expect(await jobs()).toHaveLength(1)
    expect((await jobs())[0]).toMatchObject({ channel: "call", callId, state: "queued" })
  })
  it("pushIncoming false ferme la porte avant toute réservation", async () => {
    const { callee, schedule, jobs } = await fixture()
    await callee.mutation(api.modules.calls.preferences.update, { pushIncoming: false })
    expect(await schedule()).toBe(false)
    expect(await jobs()).toEqual([])
  })
  it.each(["revoked", "expired"] as const)("session %s : préférence ouverte conservée, aucune livraison admise", async (status) => {
    const { t, calleeSession, schedule, jobs } = await fixture()
    if (status === "revoked") await t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: calleeSession }] } })
    else await t.mutation(components.betterAuth.adapter.updateOne, { input: { model: "session", where: [{ field: "_id", value: calleeSession }], update: { expiresAt: NOW - 1 } } })
    // Le booléen hérité est la préférence ; la file prouve l'admission réelle.
    expect(await schedule()).toBe(true)
    expect(await jobs()).toEqual([])
    expect(await t.run(async (ctx) => await ctx.db.query("notificationWeeklyUsage").take(10))).toEqual([])
  })
})
