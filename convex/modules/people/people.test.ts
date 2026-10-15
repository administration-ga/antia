// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauPersonnel/people.adoption.test.ts (avec profileAutoPublish.test.ts et les cas `people.*` de reseauPersonnel.test.ts) @ ad2e7fdc2 — adaptations : personnes et réseaux ; la publication d'office est RÉÉCRITE EN NÉGATIF (rien n'est publié tant que la personne ne publie pas, invariant 7) ; annuaire borné au réseau ; images de profil par la garde des fichiers (fail-closed) ; mentions résolues dans le réseau ; cas d'organisation, de poste et de comptes de plateforme retirés.
/**
 * Le profil social d'une personne dans le moteur : publier, retirer, mode
 * privé, annuaire du réseau, images de profil, fiche publique, mentions.
 */
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { miniProfileCache, publishedMiniProfile, resolveMentionedPersonIds } from "./miniProfile"

type T = ReturnType<typeof testConvex>

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

/** Le parcours d'entrée par les fonctions publiques : personne, consentement, profil, racine. */
async function enter(t: T, rootId: Id<"networks">, subject: string, handle: string, displayName = handle) {
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  return { as, personId }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

async function store(t: T, content: Uint8Array, type: string): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([content as BlobPart], { type })))
}

describe("rien n'est publié d'office (réécrit en négatif depuis profileAutoPublish)", () => {
  it("une personne qui n'a pas publié n'a ni fiche, ni place dans l'annuaire, ni nom", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const silent = t.withIdentity({ subject: "auth-silencieux" })
    const silentId = await silent.mutation(api.modules.people.persons.ensureMyPerson, {})
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "silencieux" })).toEqual([])
    expect(await t.run(async (ctx) => publishedMiniProfile(ctx, silentId))).toMatchObject({ displayName: null, handle: null, hasPublishedProfile: false })
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("peopleDirectory")
        .withIndex("by_person", (q) => q.eq("personId", silentId))
        .take(5),
    )
    expect(rows).toEqual([])
  })
})

describe("annuaire du réseau", () => {
  it("trouve un membre découvrable par son nom (sans accents) et par son identifiant exact ; jamais soi-même ; requête vide : rien", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    await enter(t, root, "auth-helene", "helene.mba", "Hélène Mba")
    await enter(t, root, "auth-paul", "pmba", "Paul Mba")
    const search = (query: string) => lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query })
    expect((await search("helene")).map((hit) => hit.handle)).toEqual(["helene.mba"])
    expect((await search("pmba"))[0]?.handle).toBe("pmba")
    expect(await search("   ")).toEqual([])
    expect((await search("lynda")).map((hit) => hit.handle)).toEqual([])
    const hit = (await search("Hélène"))[0]
    expect(hit).toMatchObject({ handle: "helene.mba", displayName: "Hélène Mba", headline: null, avatarUrl: null, badges: ["community"] })
  })

  it("le mode privé retire de l'annuaire sans retirer la fiche ; le retrait rend le nom neutre", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const paul = await enter(t, root, "auth-paul", "paul.mba", "Paul Mba")
    expect(await paul.as.mutation(api.modules.people.profile.setMyProfilePrivacy, { private: true })).toEqual({ isPrivate: true })
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).toEqual([])
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul.mba" })).toEqual([])
    expect(await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "paul.mba" })).toMatchObject({ displayName: "Paul Mba" })

    await paul.as.mutation(api.modules.people.profile.setMyProfilePrivacy, { private: false })
    expect((await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).length).toBe(1)
    await paul.as.mutation(api.modules.people.profile.withdrawMyProfile, {})
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).toEqual([])
    expect(await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "paul.mba" })).toBeNull()
    expect(await t.run(async (ctx) => publishedMiniProfile(ctx, paul.personId))).toMatchObject({ displayName: null, hasPublishedProfile: false })
    // Republier rétablit, sans perdre l'identifiant.
    await paul.as.mutation(api.modules.people.profile.publishMyProfile, { handle: "paul.mba", displayName: "Paul Mba" })
    expect((await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).length).toBe(1)
  })

  it("un réseau fermé ne montre que ses membres ; la suspension à la racine retire de tous les annuaires", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const paul = await enter(t, root, "auth-paul", "paul.mba", "Paul Mba")
    await lynda.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    await paul.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    const outsider = await enter(t, root, "auth-hors", "hors.reseau", "Hors Réseau")
    expect((await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "paul" })).map((hit) => hit.handle)).toEqual(["paul.mba"])
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "hors.reseau" })).toEqual([])
    expect(await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: testClosed, handle: "hors.reseau" })).toBeNull()
    // La racine voit tout le monde ; le non-membre du réseau fermé n'y lit rien.
    expect((await outsider.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).length).toBe(1)
    expect(engineErrorCode(await caught(outsider.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "paul" })))).toBe("notFound")

    const operator = await enter(t, root, "auth-operateur", "operateur.un", "Opérateur")
    await t.run(async (ctx) => {
      await ctx.db.insert("operators", { personId: operator.personId, role: "platform_operator", grantedAt: Date.now() })
    })
    await operator.as.mutation(api.modules.people.memberships.suspendEverywhere, { personId: paul.personId, reason: "Signalements répétés et confirmés." })
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).toEqual([])
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "paul" })).toEqual([])
    await operator.as.mutation(api.modules.people.memberships.liftSuspension, { personId: paul.personId })
    expect((await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "paul" })).length).toBe(1)
  })

  it("quitter un réseau retire de son annuaire, pas de celui de la racine", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const paul = await enter(t, root, "auth-paul", "paul.mba", "Paul Mba")
    for (const person of [lynda, paul]) {
      await person.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    }
    await paul.as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: testClosed })
    expect(await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: testClosed, query: "paul" })).toEqual([])
    expect((await lynda.as.query(api.modules.people.directory.searchPeople, { networkId: root, query: "paul" })).length).toBe(1)
  })
})

describe("images de profil — par la garde des fichiers", () => {
  it("une photo neuve est vérifiée, admise à l'analyse, et retenue jusqu'au verdict", async () => {
    vi.useFakeTimers()
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga")
    await lynda.as.mutation(api.modules.people.profile.generateProfileUploadUrl, { usage: "avatar" })
    const photo = await store(t, PNG, "image/png")
    expect(await lynda.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: photo, mimeType: "image/png" })).toEqual({ url: null, withheld: "fileScanPending" })
    expect((await lynda.as.query(api.modules.people.persons.getMyPerson, {}))?.avatar).toEqual({ url: null, withheld: "fileScanPending" })
    const scan = await t.run(async (ctx) =>
      ctx.db
        .query("fileScans")
        .withIndex("by_storageId", (q) => q.eq("storageId", photo))
        .unique(),
    )
    expect(scan).toMatchObject({ source: "profile", uploadedByPersonId: lynda.personId, status: "pending" })
    expect(scan?.networkId).toBeUndefined()
    vi.useRealTimers()
    if (scan) await t.action(internal.modules.files.scan.runScan, { scanId: scan._id })
    expect((await lynda.as.query(api.modules.people.persons.getMyPerson, {}))?.avatar?.url).toBeTruthy()
    // Retirer la photo.
    expect(await lynda.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: null })).toEqual({ url: null, withheld: null })
    expect((await lynda.as.query(api.modules.people.persons.getMyPerson, {}))?.avatar).toBeNull()
  })

  it("l'image d'autrui se refuse comme une image absente ; un format interdit nomme sa règle ; sans profil publié, rien", async () => {
    vi.useFakeTimers()
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga")
    const paul = await enter(t, root, "auth-paul", "paul.mba")
    const photo = await store(t, PNG, "image/png")
    await lynda.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: photo, mimeType: "image/png" })
    expect(engineErrorCode(await caught(paul.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: photo, mimeType: "image/png" })))).toBe("notFound")
    // La même image reposée en couverture par sa propriétaire : libre (ce n'est pas un dépôt).
    expect((await lynda.as.mutation(api.modules.people.profile.setMyCover, { storageId: photo })).withheld).toBe("fileScanPending")

    const gif = await store(t, new Uint8Array([0x47, 0x49, 0x46, 0x38]), "image/gif")
    expect(engineErrorRule(await caught(paul.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: gif, mimeType: "image/gif" })))?.rule).toBe("UPLOAD_TYPE_NOT_ALLOWED")

    const silent = t.withIdentity({ subject: "auth-silencieux" })
    await silent.mutation(api.modules.people.persons.ensureMyPerson, {})
    const other = await store(t, PNG, "image/png")
    expect(engineErrorCode(await caught(silent.mutation(api.modules.people.profile.setMyAvatar, { storageId: other, mimeType: "image/png" })))).toBe("profileRequired")
  })
})

describe("fiche publique et mini-profil", () => {
  it("la fiche se lit dans le réseau : badges calculés, images par la garde, `isMe` ; identifiant inconnu : null", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    await enter(t, root, "auth-paul", "paul.mba", "Paul Mba")
    expect(await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "Paul.Mba" })).toEqual({
      personId: expect.any(String),
      handle: "paul.mba",
      displayName: "Paul Mba",
      headline: null,
      avatar: { url: null, withheld: null },
      cover: { url: null, withheld: null },
      badges: ["community"],
      isMe: false,
    })
    expect((await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "lynda.onanga" }))?.isMe).toBe(true)
    expect(await lynda.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "personne" })).toBeNull()
  })

  it("le cache de mini-profils ne relit pas deux fois la même personne", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga", "Lynda Onanga")
    const result = await t.run(async (ctx) => {
      const profileOf = miniProfileCache(ctx)
      const first = await profileOf(lynda.personId)
      const second = await profileOf(lynda.personId)
      return { same: first === second, first }
    })
    expect(result.same).toBe(true)
    expect(result.first).toMatchObject({ displayName: "Lynda Onanga", handle: "lynda.onanga", badges: ["community"], hasPublishedProfile: true })
  })
})

describe("mentions", () => {
  it("résout les @identifiants des membres publiés du réseau ; ignore en silence l'inconnu, le retiré et le non-membre", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const lynda = await enter(t, root, "auth-lynda", "lynda.onanga")
    const paul = await enter(t, root, "auth-paul", "paul.mba")
    const helene = await enter(t, root, "auth-helene", "helene.mba")
    await helene.as.mutation(api.modules.people.profile.withdrawMyProfile, {})
    const body = "Bravo @paul.mba et @Lynda.Onanga ! (@inconnu, @helene.mba, @paul.mba)"
    expect(await t.run(async (ctx) => resolveMentionedPersonIds(ctx, root, body))).toEqual([paul.personId, lynda.personId])
    // Dans le réseau fermé, aucun des deux n'est membre : personne n'est cité.
    expect(await t.run(async (ctx) => resolveMentionedPersonIds(ctx, testClosed, body))).toEqual([])
  })
})
