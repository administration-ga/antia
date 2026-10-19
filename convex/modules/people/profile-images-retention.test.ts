// @vitest-environment edge-runtime
/** PA10 : le retrait et le remplacement ne laissent aucune ancienne image personnelle détachée. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  // L'analyse est volontairement retenue ; aucun transport antivirus n'est appelé.
  vi.stubEnv("FILE_GUARD", "off")
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs() })

async function fixture() {
  const t = testConvex({ automaticSessions: false }), { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const now = Date.now()
  const user: unknown = await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Alias choisi", email: "profile-image-retention@example.test", emailVerified: true, createdAt: now, updatedAt: now } } })
  if (!user || typeof user !== "object" || !("_id" in user) || typeof user._id !== "string") throw new Error("Utilisateur Better Auth de fixture absent")
  const sessionId = await createTestSession(t, user._id)
  const as = t.withIdentity({ subject: user._id, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "images.recette", displayName: "Alias choisi" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  return { t, as, personId }
}

async function store(t: T, content: BlobPart = PNG, type = "image/png"): Promise<Id<"_storage">> {
  return await t.run(async ctx => ctx.storage.store(new Blob([content], { type })))
}

async function state(t: T, storageId: Id<"_storage">) {
  return await t.run(async ctx => ({
    stored: await ctx.db.system.get("_storage", storageId),
    scan: await ctx.db.query("fileScans").withIndex("by_storageId", q => q.eq("storageId", storageId)).unique(),
  }))
}

describe("PA10 — conservation des images de profil", () => {
  it("retirer une image devenue détachée purge son blob et son admission, de manière idempotente", async () => {
    const f = await fixture(), image = await store(f.t)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: image, mimeType: "image/png" })
    expect((await state(f.t, image)).scan).toMatchObject({ source: "profile", uploadedByPersonId: f.personId })
    expect(await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: null })).toEqual({ url: null, withheld: null })
    expect(await state(f.t, image)).toEqual({ stored: null, scan: null })
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: null })
    expect((await f.t.run(async ctx => ctx.db.get(f.personId)))?.avatarStorageId).toBeUndefined()
  })

  it("remplacer l'avatar purge seulement l'ancienne image et garde la nouvelle sous analyse", async () => {
    const f = await fixture(), previous = await store(f.t), next = await store(f.t), unrelated = await store(f.t)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: previous, mimeType: "image/png" })
    expect(await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: next, mimeType: "image/png" })).toEqual({ url: null, withheld: "fileScanPending" })
    expect(await state(f.t, previous)).toEqual({ stored: null, scan: null })
    expect((await state(f.t, next)).scan).toMatchObject({ source: "profile", status: "pending", uploadedByPersonId: f.personId })
    expect((await state(f.t, next)).stored).not.toBeNull()
    expect((await state(f.t, unrelated)).stored).not.toBeNull()
    expect((await f.t.run(async ctx => ctx.db.get(f.personId)))?.avatarStorageId).toBe(next)
  })

  it("une image commune à l'avatar et la couverture survit jusqu'au retrait du dernier emplacement", async () => {
    const f = await fixture(), image = await store(f.t)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: image, mimeType: "image/png" })
    await f.as.mutation(api.modules.people.profile.setMyCover, { storageId: image })
    const initial = await state(f.t, image)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: image })
    expect(await state(f.t, image)).toEqual(initial)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: null })
    expect(await state(f.t, image)).toEqual(initial)
    expect((await f.t.run(async ctx => ctx.db.get(f.personId)))?.coverStorageId).toBe(image)
    await f.as.mutation(api.modules.people.profile.setMyCover, { storageId: null })
    expect(await state(f.t, image)).toEqual({ stored: null, scan: null })
  })

  it("remplacer successivement les deux emplacements conserve chaque image encore référencée", async () => {
    const f = await fixture(), shared = await store(f.t), avatar = await store(f.t), cover = await store(f.t)
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: shared, mimeType: "image/png" })
    await f.as.mutation(api.modules.people.profile.setMyCover, { storageId: shared })
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: avatar, mimeType: "image/png" })
    expect((await state(f.t, shared)).stored).not.toBeNull()
    await f.as.mutation(api.modules.people.profile.setMyCover, { storageId: cover, mimeType: "image/png" })
    expect(await state(f.t, shared)).toEqual({ stored: null, scan: null })
    expect((await state(f.t, avatar)).stored).not.toBeNull()
    expect((await state(f.t, cover)).stored).not.toBeNull()
    expect(await f.t.run(async ctx => ctx.db.get(f.personId))).toMatchObject({ avatarStorageId: avatar, coverStorageId: cover })
  })

  it("un remplacement refusé conserve l'image précédente et son admission", async () => {
    const f = await fixture(), previous = await store(f.t), forbidden = await store(f.t, "GIF89a", "image/gif")
    await f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: previous, mimeType: "image/png" })
    const initial = await state(f.t, previous)
    await expect(f.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: forbidden, mimeType: "image/gif" })).rejects.toThrow()
    expect(await state(f.t, previous)).toEqual(initial)
    expect((await f.t.run(async ctx => ctx.db.get(f.personId)))?.avatarStorageId).toBe(previous)
    expect((await state(f.t, forbidden)).scan).toBeNull()
  })
})
