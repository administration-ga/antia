// @vitest-environment edge-runtime
/** PA4 : préférences explicites, session vivante et absence d'effet sur le profil social. */
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, components } from "../../_generated/api"
import { createTestSession, testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>

async function personFixture(t: T, email = "preferences@example.test") {
  const now = Date.now()
  const user: unknown = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: "Nom civil non choisi", email, emailVerified: true, createdAt: now, updatedAt: now } },
  })
  if (typeof user !== "object" || user === null || !("_id" in user) || typeof user._id !== "string") throw new Error("Utilisateur de recette absent")
  const sessionId = await createTestSession(t, user._id)
  const as = t.withIdentity({ subject: user._id, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  return { as, personId, sessionId }
}

afterEach(() => vi.useRealTimers())

describe("préférences de ma personne", () => {
  it.each(["fr", "en"] as const)("enregistre la langue %s et le fuseau choisis", async (locale) => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    expect(await person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale, timeZone: "Africa/Libreville" })).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(person.personId))).toMatchObject({ locale, timeZone: "Africa/Libreville" })
  })

  it("normalise un alias de fuseau IANA au nom canonique", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    await person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "en", timeZone: "US/Eastern" })
    expect((await t.run((ctx) => ctx.db.get(person.personId)))?.timeZone).toBe("America/New_York")
  })

  it.each(["", "   ", "Not/A_Zone", "../Europe/Paris", "x".repeat(101)])("refuse un fuseau illégal sans modifier la personne : %j", async (timeZone) => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    const before = await t.run((ctx) => ctx.db.get(person.personId))
    await expect(person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "fr", timeZone })).rejects.toMatchObject({ data: { code: "invalidArgument", field: "timeZone" } })
    expect(await t.run((ctx) => ctx.db.get(person.personId))).toEqual(before)
  })

  it.each(["de", "FR", "", null])("le validateur refuse une langue hors du contrat : %j", async (locale) => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    const before = await t.run((ctx) => ctx.db.get(person.personId))
    await expect(person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale, timeZone: "UTC" } as never)).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.get(person.personId))).toEqual(before)
  })

  it("un appel anonyme ou une session sans personne ne crée aucun profil", async () => {
    const t = testConvex({ automaticSessions: false })
    const args = { locale: "fr" as const, timeZone: "UTC" }
    await expect(t.mutation(api.modules.people.preferences.setMyPreferences, args)).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    const sessionId = await createTestSession(t, "preferences-without-person")
    await expect(t.withIdentity({ subject: "preferences-without-person", sessionId }).mutation(api.modules.people.preferences.setMyPreferences, args)).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    expect(await t.run((ctx) => ctx.db.query("persons").take(2))).toEqual([])
  })

  it("une session révoquée ne peut plus modifier les préférences malgré son JWT", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    const before = await t.run((ctx) => ctx.db.get(person.personId))
    await t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: person.sessionId }] } })
    await expect(person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "en", timeZone: "UTC" })).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    expect(await t.run((ctx) => ctx.db.get(person.personId))).toEqual(before)
  })

  it("reste auto-borné : un identifiant de personne étrangère dans les arguments est refusé", async () => {
    const t = testConvex({ automaticSessions: false })
    const alice = await personFixture(t, "alice.preferences@example.test")
    const bob = await personFixture(t, "bob.preferences@example.test")
    const before = await t.run((ctx) => ctx.db.get(bob.personId))
    await expect(alice.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "en", timeZone: "UTC", personId: bob.personId } as never)).rejects.toThrow()
    await alice.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "en", timeZone: "UTC" })
    expect(await t.run((ctx) => ctx.db.get(bob.personId))).toEqual(before)
  })

  it("choisir des préférences ne copie ni nom ni handle et ne crée aucun consentement ou adhésion", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    await person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "fr", timeZone: "UTC" })
    const row = await t.run((ctx) => ctx.db.get(person.personId))
    expect(row?.displayName).toBeUndefined()
    expect(row?.handle).toBeUndefined()
    expect(row?.publishedAt).toBeUndefined()
    expect(await t.run((ctx) => ctx.db.query("consents").take(2))).toEqual([])
    expect(await t.run((ctx) => ctx.db.query("networkMemberships").take(2))).toEqual([])
  })

  it("un enregistrement identique préserve l'horodatage sans réécriture", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    const args = { locale: "en" as const, timeZone: "UTC" }
    await person.as.mutation(api.modules.people.preferences.setMyPreferences, args)
    const before = await t.run((ctx) => ctx.db.get(person.personId))
    vi.setSystemTime(Date.now() + 1000)
    await person.as.mutation(api.modules.people.preferences.setMyPreferences, args)
    expect(await t.run((ctx) => ctx.db.get(person.personId))).toEqual(before)
  })

  it("la limitation de débit s'applique aussi aux préférences", async () => {
    const t = testConvex({ automaticSessions: false })
    const person = await personFixture(t)
    const args = { locale: "fr" as const, timeZone: "UTC" }
    for (let count = 0; count < 10; count++) await person.as.mutation(api.modules.people.preferences.setMyPreferences, args)
    await expect(person.as.mutation(api.modules.people.preferences.setMyPreferences, { locale: "en", timeZone: "UTC" })).rejects.toMatchObject({ data: { code: "rateLimited" } })
    expect((await t.run((ctx) => ctx.db.get(person.personId)))?.locale).toBe("fr")
  })
})
