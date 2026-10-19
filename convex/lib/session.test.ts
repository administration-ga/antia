// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../_generated/api"
import { SEED_CONFIRMATION } from "../seeds/foundations"
import { createTestSession, testConvex } from "../test.setup"
import { getActiveIdentity } from "./session"

type T = ReturnType<typeof testConvex>

async function revoke(t: T, sessionId: string) {
  await t.mutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "session", where: [{ field: "_id", value: sessionId }] },
  })
}

afterEach(() => vi.useRealTimers())

describe("identité JWT et session Better Auth vivante", () => {
  it("l'anonyme et le JWT sans claim de session restent anonymes", async () => {
    const t = testConvex({ automaticSessions: false })
    expect(await t.run((ctx) => getActiveIdentity(ctx))).toBeNull()
    const raw = t.withIdentity({ subject: "alice" })
    expect(await raw.run((ctx) => getActiveIdentity(ctx))).toBeNull()
    expect(await raw.query(api.modules.people.persons.getMyPerson, {})).toBeNull()
    await expect(raw.mutation(api.modules.people.persons.ensureMyPerson, {})).rejects.toMatchObject({ data: { code: "unauthenticated" } })
  })

  it.each(["", "not-an-id", null, 42])("refuse le claim de session invalide %s", async (sessionId) => {
    const t = testConvex({ automaticSessions: false })
    const raw = t.withIdentity({ subject: "alice", sessionId })
    expect(await raw.run((ctx) => getActiveIdentity(ctx))).toBeNull()
  })

  it("une session active du sujet permet la première création, sans recopier son identité", async () => {
    const t = testConvex({ automaticSessions: false })
    const sessionId = await createTestSession(t, "alice")
    const as = t.withIdentity({ subject: "alice", sessionId, name: "Nom IDN", email: "alice@example.test" })
    expect(await as.run((ctx) => getActiveIdentity(ctx))).toMatchObject({ subject: "alice", sessionId })
    const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    const person = await t.run((ctx) => ctx.db.get(personId))
    expect(person).toMatchObject({ authUserId: "alice" })
    expect(person?.displayName).toBeUndefined()
    expect(person?.handle).toBeUndefined()
    expect(person?.publishedAt).toBeUndefined()
  })

  it.each([-1, 0])("une session expirée (décalage %s ms) ne peut créer de personne", async (offset) => {
    vi.useFakeTimers()
    vi.setSystemTime(1_760_000_000_000)
    const t = testConvex({ automaticSessions: false })
    const sessionId = await createTestSession(t, "alice", Date.now() + offset)
    const as = t.withIdentity({ subject: "alice", sessionId })
    expect(await as.run((ctx) => getActiveIdentity(ctx))).toBeNull()
    await expect(as.mutation(api.modules.people.persons.ensureMyPerson, {})).rejects.toMatchObject({ data: { code: "unauthenticated" } })
  })

  it("une session d'un autre sujet n'autorise pas l'identité du JWT", async () => {
    const t = testConvex({ automaticSessions: false })
    const sessionId = await createTestSession(t, "bob")
    const wrong = t.withIdentity({ subject: "alice", sessionId })
    expect(await wrong.run((ctx) => getActiveIdentity(ctx))).toBeNull()
    await expect(wrong.mutation(api.modules.people.persons.ensureMyPerson, {})).rejects.toMatchObject({ data: { code: "unauthenticated" } })
  })

  it("le même JWT perd ses lectures et écritures dès la suppression de sa session", async () => {
    const t = testConvex({ automaticSessions: false })
    await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    const root = await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })
    if (!root) throw new Error("Racine absente")
    const sessionId = await createTestSession(t, "alice")
    const oldJwt = t.withIdentity({ subject: "alice", sessionId })
    const personId = await oldJwt.mutation(api.modules.people.persons.ensureMyPerson, {})
    await oldJwt.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
    await oldJwt.mutation(api.modules.people.profile.publishMyProfile, { handle: "alice", displayName: "Alice" })
    await oldJwt.mutation(api.modules.people.memberships.joinNetwork, { networkId: root._id })
    expect(await oldJwt.query(api.modules.people.persons.getMyPerson, {})).toMatchObject({ _id: personId })
    expect((await oldJwt.query(api.modules.posts.posts.feed, { networkId: root._id, paginationOpts: { numItems: 5, cursor: null } })).page).toEqual([])

    expect(await oldJwt.query(api.modules.platform.authentication.mySession, {})).toBe(true)
    expect(await t.query(api.modules.platform.authentication.mySession, {})).toBe(false)
    await revoke(t, sessionId)

    expect(await oldJwt.query(api.modules.platform.authentication.mySession, {})).toBe(false)
    expect(await oldJwt.run((ctx) => getActiveIdentity(ctx))).toBeNull()
    expect(await oldJwt.query(api.modules.people.persons.getMyPerson, {})).toBeNull()
    await expect(oldJwt.query(api.modules.posts.posts.feed, { networkId: root._id, paginationOpts: { numItems: 5, cursor: null } })).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    await expect(oldJwt.mutation(api.modules.people.memberships.joinNetwork, { networkId: root._id })).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    expect(await t.run((ctx) => ctx.db.get(personId))).not.toBeNull()
  })

  it("ne confond pas la panne du composant avec une session anonyme ou autorisée", async () => {
    const t = testConvex({ automaticSessions: false })
    const as = t.withIdentity({ subject: "alice", sessionId: "valid-claim-unavailable-backend" })
    const unavailable = new Error("Better Auth component unavailable")
    await expect(as.run((ctx) => getActiveIdentity({ ...ctx, runQuery: vi.fn().mockRejectedValue(unavailable) }))).rejects.toThrow(unavailable)
  })

  it("une session vivante conserve le refus indistinct pour un réseau sans adhésion", async () => {
    const t = testConvex({ automaticSessions: false })
    await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
    const root = await t.query(api.modules.networks.networks.getBySlug, { slug: "antsia" })
    if (!root) throw new Error("Racine absente")
    const sessionId = await createTestSession(t, "outsider")
    const outsider = t.withIdentity({ subject: "outsider", sessionId })
    await outsider.mutation(api.modules.people.persons.ensureMyPerson, {})
    await expect(outsider.query(api.modules.posts.posts.feed, { networkId: root._id, paginationOpts: { numItems: 5, cursor: null } })).rejects.toMatchObject({ data: { code: "notFound" } })
  })
})
