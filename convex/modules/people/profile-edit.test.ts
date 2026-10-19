// @vitest-environment edge-runtime
/** Complément PD4 : édition personnelle atomique sans geste de republication. */
import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { publishedMiniProfile } from "./miniProfile"

type T = ReturnType<typeof testConvex>

afterEach(() => vi.useRealTimers())

async function fixture() {
  const t = testConvex()
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const enter = async (subject: string, handle: string) => {
    const as = t.withIdentity({ subject })
    const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
    await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
    await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle, headline: "Accroche initiale" })
    await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
    return { as, personId }
  }
  const owner = await enter("profile-edit-owner", "alias.initial")
  const reader = await enter("profile-edit-reader", "alias.lecteur")
  const person = async () => await t.run(async (ctx) => await ctx.db.get(owner.personId))
  const directories = async () => await t.run(async (ctx) => await ctx.db.query("peopleDirectory").withIndex("by_person", (q) => q.eq("personId", owner.personId)).take(10))
  const publicProfile = async () => await t.query(api.modules.public.projections.getProfile, { networkId: root, handle: "alias.initial" })
  return { t, root, testClosed, owner, reader, person, directories, publicProfile }
}

function retained(person: Doc<"persons"> | null) {
  if (!person) throw new Error("Personne de fixture absente")
  const { displayName: _name, headline: _headline, updatedAt: _updated, ...rest } = person
  return rest
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try { await promise } catch (error) { return error }
  return null
}

async function related(t: T, personId: Id<"persons">) {
  return await t.run(async (ctx) => ({
    consents: await ctx.db.query("consents").withIndex("by_person_and_purpose", (q) => q.eq("personId", personId)).take(10),
    handles: await ctx.db.query("handleHistory").withIndex("by_person", (q) => q.eq("personId", personId)).take(10),
    memberships: await ctx.db.query("networkMemberships").withIndex("by_person_and_status", (q) => q.eq("personId", personId)).take(10),
    facets: await ctx.db.query("personFacets").take(10),
  }))
}

describe("updateMyProfile : identité choisie, publication et droits conservés", () => {
  it("met à jour les deux annuaires et le profil public, sans toucher aux identifiants ni aux données associées", async () => {
    const f = await fixture()
    await f.owner.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: f.testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    await f.t.run(async (ctx) => await ctx.db.patch(f.owner.personId, { locale: "en", timeZone: "Africa/Libreville" }))
    const before = await f.person()
    const linksBefore = await related(f.t, f.owner.personId)
    const readerBefore = await f.t.run(async (ctx) => await ctx.db.get(f.reader.personId))
    const result = await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "  Alias du bord de mer  ", headline: "  Nouvelle accroche  ", expectedPersonId: f.owner.personId })
    const after = await f.person()
    expect(result).toEqual({ updatedAt: expect.any(Number) })
    expect(after).toMatchObject({ displayName: "Alias du bord de mer", headline: "Nouvelle accroche", updatedAt: result.updatedAt })
    expect(retained(after)).toEqual(retained(before))
    expect(await related(f.t, f.owner.personId)).toEqual(linksBefore)
    expect(await f.t.run(async (ctx) => await ctx.db.get(f.reader.personId))).toEqual(readerBefore)
    expect(await f.directories()).toHaveLength(2)
    expect((await f.directories()).every((row) => /alias du bord de mer/i.test(row.searchName))).toBe(true)
    expect(await f.publicProfile()).toMatchObject({ displayName: "Alias du bord de mer", headline: "Nouvelle accroche" })
    expect(await f.reader.as.query(api.modules.people.directory.searchPeople, { networkId: f.root, query: "bord de mer" })).toMatchObject([{ personId: f.owner.personId, displayName: "Alias du bord de mer" }])
    expect(await f.reader.as.query(api.modules.people.directory.searchPeople, { networkId: f.root, query: "alias.initial" })).toHaveLength(1)
  })

  it.each(["withdrawn", "private", "both"] as const)("conserve exactement le profil %s et ferme sa découverte publique", async (state) => {
    const f = await fixture()
    if (state !== "withdrawn") await f.owner.as.mutation(api.modules.people.profile.setMyProfilePrivacy, { private: true })
    if (state !== "private") await f.owner.as.mutation(api.modules.people.profile.withdrawMyProfile, {})
    const before = await f.person()
    const linksBefore = await related(f.t, f.owner.personId)
    await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Identité éditée en retrait", headline: "Texte retenu" })
    expect(retained(await f.person())).toEqual(retained(before))
    expect(await related(f.t, f.owner.personId)).toEqual(linksBefore)
    expect((await f.directories()).every((row) => !row.listed)).toBe(true)
    expect(await f.publicProfile()).toBeNull()
    expect(await f.reader.as.query(api.modules.people.directory.searchPeople, { networkId: f.root, query: "identite editee" })).toEqual([])
    if (state !== "private") {
      expect(await f.reader.as.query(api.modules.people.profile.getPublicProfile, { networkId: f.root, handle: "alias.initial" })).toBeNull()
      expect(await f.t.run(async (ctx) => await publishedMiniProfile(ctx, f.owner.personId))).toMatchObject({ displayName: null, hasPublishedProfile: false })
    }
  })

  it("la suspension racine ne réouvre aucun réseau après l’édition personnelle", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => {
      const membership = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", f.root).eq("personId", f.owner.personId)).unique()
      if (!membership) throw new Error("Adhésion de fixture absente")
      await ctx.db.patch(membership._id, { status: "suspendue", statusBeforeSuspension: "declaree" })
    })
    const before = await f.person()
    const linksBefore = await related(f.t, f.owner.personId)
    await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Réglage personnel suspendu" })
    expect(retained(await f.person())).toEqual(retained(before))
    expect(await related(f.t, f.owner.personId)).toEqual(linksBefore)
    expect((await f.directories()).every((row) => !row.listed)).toBe(true)
    expect(await f.publicProfile()).toBeNull()
    expect(await f.reader.as.query(api.modules.people.profile.getPublicProfile, { networkId: f.root, handle: "alias.initial" })).toBeNull()
  })

  it.each([undefined, "", "   "])("efface explicitement l’accroche avec %s", async (headline) => {
    const f = await fixture()
    await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Mon alias choisi", ...(headline === undefined ? {} : { headline }) })
    expect((await f.person())?.headline).toBeUndefined()
    expect(await f.publicProfile()).toMatchObject({ headline: null })
  })

  it.each([
    { displayName: " ", headline: undefined, rule: "DISPLAY_NAME_LENGTH" },
    { displayName: "n".repeat(121), headline: undefined, rule: "DISPLAY_NAME_LENGTH" },
    { displayName: "Alias valide", headline: "a".repeat(161), rule: "HEADLINE_TOO_LONG" },
  ])("refuse la règle $rule sans modifier personne, annuaire ni modération", async ({ displayName, headline, rule }) => {
    const f = await fixture()
    const before = await f.person()
    const directories = await f.directories()
    const states = await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))
    expect(engineErrorRule(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName, headline })))?.rule).toBe(rule)
    expect(await f.person()).toEqual(before)
    expect(await f.directories()).toEqual(directories)
    expect(await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))).toEqual(states)
  })

  it("ne constitue pas un profil encore vide et ne reconstitue pas un profil effacé", async () => {
    const f = await fixture()
    const newcomer = f.t.withIdentity({ subject: "profile-edit-newcomer" })
    const newcomerId = await newcomer.mutation(api.modules.people.persons.ensureMyPerson, {})
    const before = await f.t.run(async (ctx) => await ctx.db.get(newcomerId))
    expect(engineErrorCode(await caught(newcomer.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Sans publication" })))).toBe("profileRequired")
    expect(await f.t.run(async (ctx) => await ctx.db.get(newcomerId))).toEqual(before)
    await f.t.run(async (ctx) => await ctx.db.patch(f.owner.personId, { erasedAt: Date.now() }))
    const erased = await f.person()
    expect(engineErrorCode(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Ne pas rétablir" })))).toBe("profileRequired")
    expect(await f.person()).toEqual(erased)
  })

  it("refuse le réseau racine absent sans écrire", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => await ctx.db.patch(f.root, { status: "archived" }))
    const before = await f.person()
    expect(engineErrorCode(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Sans racine" })))).toBe("notFound")
    expect(await f.person()).toEqual(before)
  })

  it("la prélecture retient l’édition et un retrait de modération refuse toute modification atomiquement", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => await ctx.db.insert("moderationPolicies", { networkId: f.root, surface: "person", preReview: true, maxLinks: 20, maxWrites: 100, windowMs: 60_000, updatedAt: Date.now() }))
    await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Sous relecture" })
    expect(await f.publicProfile()).toBeNull()
    expect(await f.reader.as.query(api.modules.people.directory.searchPeople, { networkId: f.root, query: "sous relecture" })).toEqual([])
    await f.t.run(async (ctx) => {
      const state = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "person").eq("targetId", f.owner.personId)).unique()
      if (!state) throw new Error("État de modération de fixture absent")
      expect(state.status).toBe("pending_review")
      await ctx.db.patch(state._id, { status: "removed" })
    })
    const before = await f.person()
    const directories = await f.directories()
    const states = await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))
    expect(engineErrorCode(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Tentative de retour" })))).toBe("policyRefused")
    expect(await f.person()).toEqual(before)
    expect(await f.directories()).toEqual(directories)
    expect(await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))).toEqual(states)
    expect(await f.publicProfile()).toBeNull()
  })

  it("applique le vrai quota partagé des modifications de profil", async () => {
    vi.useFakeTimers()
    const f = await fixture()
    // La publication de la fixture a déjà consommé un des dix jetons.
    for (let n = 0; n < 9; n++) await f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: `Alias ${n}` })
    const before = await f.person()
    expect(engineErrorCode(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Hors budget" })))).toBe("rateLimited")
    expect(await f.person()).toEqual(before)
  })

  it("une réponse tardive du compte A refuse l’édition depuis B, sans changer les profils ni consommer son quota", async () => {
    vi.useFakeTimers()
    const f = await fixture()
    const readAsA = await f.owner.as.query(api.modules.people.persons.getMyPerson, {})
    if (!readAsA) throw new Error("Identité de l'écran de fixture absente")
    const before = await f.person()
    const readerBefore = await f.t.run(async (ctx) => await ctx.db.get(f.reader.personId))
    const directories = await f.directories()
    const states = await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))
    // La mutation est désormais signée par B, alors que l'écran provient de A.
    for (let n = 0; n < 16; n++) {
      expect(engineErrorCode(await caught(f.reader.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Écran périmé A", expectedPersonId: readAsA._id })))).toBe("notFound")
    }
    expect(await f.person()).toEqual(before)
    expect(await f.t.run(async (ctx) => await ctx.db.get(f.reader.personId))).toEqual(readerBefore)
    expect(await f.directories()).toEqual(directories)
    expect(await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").take(10))).toEqual(states)
    // B garde ses neuf jetons après sa publication initiale, malgré les refus.
    for (let n = 0; n < 9; n++) await f.reader.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: `Compte B ${n}`, expectedPersonId: f.reader.personId })
    expect(engineErrorCode(await caught(f.reader.as.mutation(api.modules.people.profile.updateMyProfile, { displayName: "Budget B épuisé", expectedPersonId: f.reader.personId })))).toBe("rateLimited")
    expect(await f.person()).toEqual(before)
  })

  it("une session révoquée, expirée ou étrangère et l’anonymat ne modifient jamais le profil", async () => {
    const f = await fixture()
    const identity = await f.owner.as.run(async (ctx) => await ctx.auth.getUserIdentity())
    if (!identity || typeof identity.sessionId !== "string") throw new Error("Session de fixture absente")
    const before = await f.person()
    const update = { displayName: "Écriture refusée" }
    expect(engineErrorCode(await caught(f.t.mutation(api.modules.people.profile.updateMyProfile, update)))).toBe("unauthenticated")
    const expired = await createTestSession(f.t, identity.subject, Date.now() - 1)
    const foreign = await createTestSession(f.t, "foreign-profile-edit-owner")
    for (const sessionId of [expired, foreign]) {
      expect(engineErrorCode(await caught(f.t.withIdentity({ subject: identity.subject, sessionId }).mutation(api.modules.people.profile.updateMyProfile, update)))).toBe("unauthenticated")
    }
    await f.t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: identity.sessionId }] } })
    expect(engineErrorCode(await caught(f.owner.as.mutation(api.modules.people.profile.updateMyProfile, update)))).toBe("unauthenticated")
    expect(await f.person()).toEqual(before)
  })
})
