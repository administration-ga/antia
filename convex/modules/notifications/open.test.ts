// @vitest-environment edge-runtime
/**
 * P05 — la porte d'ouverture d'une notification poussée relit TOUT à
 * l'ouverture : session, destinataire, sujet, appel vivant. Vraies sessions,
 * vraie file ; transports doublés (aucun fournisseur réel).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { scheduleIncomingCallPush } from "../calls/push"
import { notifyPerson } from "./notify"

const doubles = vi.hoisted(() => ({ push: vi.fn(), receipt: vi.fn() }))
vi.mock("./transports", () => ({ deliverPush: doubles.push, readExpoReceipt: doubles.receipt }))

type T = ReturnType<typeof testConvex>
const NOW = Date.UTC(2026, 9, 18, 9)
const APPLICATIONS = JSON.stringify([{ applicationId: "antsia_ga", networkSlug: "antsia", origin: "https://antsia.example.test", entryPath: "/fil" }])
const OPEN = api.modules.notifications.open.resolveOpenTarget

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  vi.stubEnv("NOTIFICATION_APPLICATIONS_JSON", APPLICATIONS)
  doubles.push.mockReset().mockResolvedValue({ status: "sent" })
  doubles.receipt.mockReset().mockResolvedValue({ status: "sent" })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

async function seed(t: T) { return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION }) }

/** Une personne avec une VRAIE session, membre déclarée du réseau ; profil publié si `handle`. */
async function member(t: T, networkId: Id<"networks">, subject: string, handle?: string) {
  const sessionId = await createTestSession(t, subject)
  const as = t.withIdentity({ subject, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId, personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW }))
  if (handle !== undefined) {
    await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
    await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  }
  return { as, personId, sessionId }
}

/** Le destinataire accepte les notifications de ce réseau sur un appareil lié à sa session. */
async function subscribed(person: Awaited<ReturnType<typeof member>>, networkId: Id<"networks">) {
  await person.as.mutation(api.modules.people.consents.recordConsent, { networkId, purpose: "notifications", origin: "settings" })
  await person.as.mutation(api.modules.notifications.pushSubscriptions.subscribe, { networkId, applicationId: "antsia_ga", deviceId: "device_open", credential: { provider: "expo", token: "ExpoPushToken[token_open]" } })
}

async function onlyJob(t: T): Promise<Id<"notificationDeliveryJobs">> {
  const rows = await t.run(async (ctx) => await ctx.db.query("notificationDeliveryJobs").take(10))
  expect(rows).toHaveLength(1)
  const [row] = rows
  if (!row) throw new Error("aucun job")
  return row._id
}

async function followerNotice(t: T) {
  const { root, testClosed } = await seed(t)
  const actor = await member(t, root, "acteur", "awa.demo")
  const recipient = await member(t, root, "destinataire")
  await subscribed(recipient, root)
  await t.run(async (ctx) => await notifyPerson({ db: ctx.db, runQuery: ctx.runQuery }, { networkId: root, recipientPersonId: recipient.personId, actorPersonId: actor.personId, kind: "new_follower" }))
  return { root, testClosed, actor, recipient, reference: await onlyJob(t) }
}

describe("resolveOpenTarget — un avis de la cloche", () => {
  it("rend le genre, le sujet et l'acteur PUBLIÉ au seul destinataire, sans rien marquer lu", async () => {
    const t = testConvex()
    const { root, recipient, reference } = await followerNotice(t)
    // P14B : aucun genre commun n'a de destination typée (`target: null`, l'écran garde la cible du sujet).
    expect(await recipient.as.query(OPEN, { networkId: root, reference })).toEqual({ channel: "notification", kind: "new_follower", subject: null, actorHandle: "awa.demo", target: null })
    const bell = await recipient.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })
    expect(bell.page.map((row) => row.readAt)).toEqual([null])
  })

  it("refus indistinct : autre personne, autre réseau, référence inventée, trop longue ou d'une autre table", async () => {
    const t = testConvex()
    const { root, testClosed, actor, recipient, reference } = await followerNotice(t)
    await t.run(async (ctx) => await ctx.db.insert("networkMemberships", { networkId: testClosed, personId: recipient.personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW }))
    expect(await actor.as.query(OPEN, { networkId: root, reference })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: testClosed, reference })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: root, reference: "inexistant" })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: root, reference: "x".repeat(65) })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: root, reference, openingToken: "x".repeat(65) })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: root, reference, openingToken: "opening\n" })).toBeNull()
    expect(await recipient.as.query(OPEN, { networkId: root, reference: recipient.personId })).toBeNull()
  })

  it("le sujet est relu à l'ouverture : un blocage survenu depuis l'envoi ferme la destination", async () => {
    const t = testConvex()
    const { root, actor, recipient, reference } = await followerNotice(t)
    await t.run(async (ctx) => {
      const [low, high] = actor.personId < recipient.personId ? [actor.personId, recipient.personId] : [recipient.personId, actor.personId]
      await ctx.db.insert("connections", { networkId: root, personIdLow: low, personIdHigh: high, requestedByPersonId: recipient.personId, recipientPersonId: actor.personId, status: "blocked", blockedByPersonId: recipient.personId, requestedAt: NOW, updatedAt: NOW })
    })
    expect(await recipient.as.query(OPEN, { networkId: root, reference })).toBeNull()
  })

  it("la session est exigée : sans session vivante, ou session révoquée depuis l'envoi, rien ne s'ouvre", async () => {
    const t = testConvex()
    const { root, recipient, reference } = await followerNotice(t)
    const sansSession = t.withIdentity({ subject: "inconnu" })
    await expect(sansSession.query(OPEN, { networkId: root, reference })).rejects.toBeTruthy()
    await t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: recipient.sessionId }] } })
    await expect(recipient.as.query(OPEN, { networkId: root, reference })).rejects.toBeTruthy()
  })
})

describe("resolveOpenTarget — un appel", () => {
  async function ringingFixture(t: T) {
    const { root } = await seed(t)
    const caller = await member(t, root, "appelant")
    const callee = await member(t, root, "appele")
    await subscribed(callee, root)
    const callId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("calls", { networkId: root, kind: "direct", status: "active", callStatus: "ringing", roomName: "open-fixture", createdByPersonId: caller.personId, calleePersonId: callee.personId, mediaType: "audio", maxParticipants: 2, startedAt: NOW })
      await ctx.db.insert("callParticipants", { networkId: root, callId: id, personId: caller.personId, role: "host", joinedAt: NOW })
      await ctx.db.insert("callParticipants", { networkId: root, callId: id, personId: callee.personId, role: "participant" })
      return id
    })
    await t.run(async (ctx) => await scheduleIncomingCallPush({ db: ctx.db, runQuery: ctx.runQuery }, { networkId: root, calleePersonId: callee.personId, callId }))
    return { root, caller, callee, callId, reference: await onlyJob(t) }
  }

  it("dit si l'appel sonne ENCORE chez le destinataire, relu à l'instant", async () => {
    const t = testConvex()
    const { root, callee, callId, reference } = await ringingFixture(t)
    expect(await callee.as.query(OPEN, { networkId: root, reference })).toEqual({ channel: "call", ringing: true })
    await t.run(async (ctx) => await ctx.db.patch(callId, { status: "ended", callStatus: "missed", endReason: "timeout", endedAt: NOW + 1 }))
    expect(await callee.as.query(OPEN, { networkId: root, reference })).toEqual({ channel: "call", ringing: false })
  })

  it("un appel déjà décroché (ou quitté) ne sonne plus ; l'appelant n'ouvre pas le job de l'appelé", async () => {
    const t = testConvex()
    const { root, caller, callee, callId, reference } = await ringingFixture(t)
    await t.run(async (ctx) => {
      const row = await ctx.db.query("callParticipants").withIndex("by_call_person", (q) => q.eq("callId", callId).eq("personId", callee.personId)).unique()
      if (row) await ctx.db.patch(row._id, { joinedAt: NOW + 1 })
      await ctx.db.patch(callId, { callStatus: "connected", answeredAt: NOW + 1, answeredByPersonId: callee.personId })
    })
    expect(await callee.as.query(OPEN, { networkId: root, reference })).toEqual({ channel: "call", ringing: false })
    expect(await caller.as.query(OPEN, { networkId: root, reference })).toBeNull()
  })
})
