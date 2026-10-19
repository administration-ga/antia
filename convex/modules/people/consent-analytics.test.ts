// @vitest-environment edge-runtime
/** PA6 : les statistiques d’usage exigent un geste global, facultatif et révocable. */
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>

async function fixture(t: T) {
  const now = Date.now()
  const user: unknown = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: "Recette analytics", email: "analytics@example.test", emailVerified: true, createdAt: now, updatedAt: now } },
  })
  if (typeof user !== "object" || user === null || !("_id" in user) || typeof user._id !== "string") throw new Error("Utilisateur de recette absent")
  const sessionId = await createTestSession(t, user._id)
  const as = t.withIdentity({ subject: user._id, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  return { as, personId, sessionId }
}

async function rows(t: T, personId: Id<"persons">) {
  // borné : ce scénario écrit au plus trois lignes analytics pour sa personne.
  return await t.run((ctx) => ctx.db.query("consents")
    .withIndex("by_person_and_purpose", (q) => q.eq("personId", personId).eq("purpose", "usage_analytics"))
    .take(10))
}

async function seedRoot(t: T) {
  return (await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })).root
}

afterEach(() => vi.useRealTimers())

describe("consentement global aux statistiques d’usage", () => {
  it("créer sa personne ne donne aucun consentement analytics et n’exige aucune adhésion", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    expect(await rows(t, person.personId)).toEqual([])
    expect(await t.run((ctx) => ctx.db.query("networkMemberships").take(2))).toEqual([])
  })

  it("un geste global écrit le texte courant et son horodatage, puis se rejoue sans autre preuve", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const grantedAt = Date.now()
    const args = { purpose: "usage_analytics" as const, origin: "settings" as const }
    await person.as.mutation(api.modules.people.consents.recordConsent, args)
    const before = await rows(t, person.personId)
    expect(before).toHaveLength(1)
    expect(before[0]).toMatchObject({ personId: person.personId, purpose: "usage_analytics", textVersion: "2026-10-17", origin: "settings", grantedAt })
    expect(before[0]?.networkId).toBeUndefined()
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
    vi.setSystemTime(grantedAt + 1_000)
    await person.as.mutation(api.modules.people.consents.recordConsent, args)
    expect(await rows(t, person.personId)).toEqual(before)
  })

  it("une version globale ancienne n’active pas la finalité ; un nouveau geste écrit la version courante", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    await t.run((ctx) => ctx.db.insert("consents", { personId: person.personId, purpose: "usage_analytics", textVersion: "2026-10-14", origin: "settings", grantedAt: Date.now() }))
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings" })
    const proofs = await rows(t, person.personId)
    expect(proofs.map((proof) => proof.textVersion).sort()).toEqual(["2026-10-14", CONSENT_TEXT_VERSIONS.usage_analytics])
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
  })

  it.each(["record", "revoke"] as const)("%s refuse networkId sans accorder ni révoquer la preuve globale", async (operation) => {
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const networkId = await seedRoot(t)
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings" })
    const before = await rows(t, person.personId)
    const attempt = operation === "record"
      ? person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings", networkId })
      : person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "usage_analytics", networkId })
    await expect(attempt).rejects.toMatchObject({ data: { code: "invalidArgument", field: "networkId" } })
    expect(await rows(t, person.personId)).toEqual(before)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
  })

  it("une ancienne ligne scoped, même à version courante, ne permet jamais l’activation ou la réactivation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const networkId = await seedRoot(t)
    const scopedId = await t.run((ctx) => ctx.db.insert("consents", {
      personId: person.personId, networkId, purpose: "usage_analytics", textVersion: CONSENT_TEXT_VERSIONS.usage_analytics, origin: "settings", grantedAt: Date.now(),
    }))
    const scopedBefore = await t.run((ctx) => ctx.db.get(scopedId))
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings" })
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
    const revokedAt = Date.now() + 1_000
    vi.setSystemTime(revokedAt)
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "usage_analytics" })
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    expect((await rows(t, person.personId)).find((proof) => proof.networkId === undefined)?.revokedAt).toBe(revokedAt)
    expect(await t.run((ctx) => ctx.db.get(scopedId))).toEqual(scopedBefore)
  })

  it("la règle globale analytics laisse les consentements réseau existants indépendants", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const networkId = await seedRoot(t)
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "notifications", origin: "settings", networkId })
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings" })
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "usage_analytics" })
    const current = await person.as.query(api.modules.people.persons.getMyPerson, {})
    expect(current?.consentsInForce).toContain("notifications")
    expect(current?.consentsInForce).not.toContain("usage_analytics")
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "notifications", networkId })
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("notifications")
  })

  it("plus de cent anciennes révocations ne masquent ni le dernier accord ni sa révocation ou son réaccord", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 125; index += 1) {
        const at = now + index + 1
        vi.setSystemTime(at)
        await ctx.db.insert("consents", { personId: person.personId, purpose: "usage_analytics", textVersion: CONSENT_TEXT_VERSIONS.usage_analytics, origin: "settings", grantedAt: at, revokedAt: at })
      }
    })
    const args = { purpose: "usage_analytics" as const, origin: "settings" as const }
    vi.setSystemTime(now + 1_000)
    await person.as.mutation(api.modules.people.consents.recordConsent, args)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
    vi.setSystemTime(now + 2_000)
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "usage_analytics" })
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    vi.setSystemTime(now + 3_000)
    await person.as.mutation(api.modules.people.consents.recordConsent, args)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
    // borné : 125 preuves historiques et deux accords dans ce scénario.
    const history = () => t.run((ctx) => ctx.db.query("consents")
      .withIndex("by_person_and_purpose", (q) => q.eq("personId", person.personId).eq("purpose", "usage_analytics"))
      .take(130))
    const beforeReplay = await history()
    expect(beforeReplay).toHaveLength(127)
    expect(beforeReplay.filter((proof) => proof.revokedAt === undefined)).toHaveLength(1)
    vi.setSystemTime(now + 4_000)
    await person.as.mutation(api.modules.people.consents.recordConsent, args)
    expect(await history()).toEqual(beforeReplay)
  })

  it("une dernière preuve révoquée ou scoped ne réactive jamais un ancien accord global encore non révoqué", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const t = testConvex({ automaticSessions: false })
    const person = await fixture(t)
    const networkId = await seedRoot(t)
    const now = Date.now()
    const oldId = await t.run((ctx) => ctx.db.insert("consents", { personId: person.personId, purpose: "usage_analytics", textVersion: CONSENT_TEXT_VERSIONS.usage_analytics, origin: "settings", grantedAt: now }))
    const oldBefore = await t.run((ctx) => ctx.db.get(oldId))
    vi.setSystemTime(now + 1_000)
    await t.run((ctx) => ctx.db.insert("consents", { personId: person.personId, purpose: "usage_analytics", textVersion: CONSENT_TEXT_VERSIONS.usage_analytics, origin: "settings", grantedAt: Date.now(), revokedAt: Date.now() }))
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    vi.setSystemTime(now + 2_000)
    const scopedId = await t.run((ctx) => ctx.db.insert("consents", { personId: person.personId, networkId, purpose: "usage_analytics", textVersion: CONSENT_TEXT_VERSIONS.usage_analytics, origin: "settings", grantedAt: Date.now() }))
    const scopedBefore = await t.run((ctx) => ctx.db.get(scopedId))
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "usage_analytics" })
    expect(await t.run((ctx) => ctx.db.get(oldId))).toEqual(oldBefore)
    expect(await t.run((ctx) => ctx.db.get(scopedId))).toEqual(scopedBefore)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).not.toContain("usage_analytics")
    vi.setSystemTime(now + 3_000)
    await person.as.mutation(api.modules.people.consents.recordConsent, { purpose: "usage_analytics", origin: "settings" })
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.consentsInForce).toContain("usage_analytics")
  })

  it("une session anonyme ou révoquée ne peut pas accorder cette finalité", async () => {
    const t = testConvex({ automaticSessions: false })
    const args = { purpose: "usage_analytics" as const, origin: "settings" as const }
    await expect(t.mutation(api.modules.people.consents.recordConsent, args)).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    const person = await fixture(t)
    await t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: person.sessionId }] } })
    await expect(person.as.mutation(api.modules.people.consents.recordConsent, args)).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    expect(await rows(t, person.personId)).toEqual([])
  })
})
