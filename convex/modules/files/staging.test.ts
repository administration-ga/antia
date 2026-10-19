// @vitest-environment edge-runtime
/** Réservations PA9/P09 : scénarios source uniquement, aucun transport réel. */
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { createTestSession, testConvex } from "../../test.setup"
import type { MediaLeaseArgs } from "../federation/mediaJobs"
import { applyFederationEnvelope } from "../federation/reseauPublic"
import { assertFreshUpload, enqueueScan, readStoredBlobFacts, registerGeneratedBlob } from "./admission"
import { ORPHAN_MIN_AGE_MS } from "./orphans"
import { purgeStoredFile } from "./purge"
import { reserveStagedFile } from "./staging"

const T0 = Date.UTC(2026, 9, 18, 12)
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const STAGE = makeFunctionReference<"mutation", MediaLeaseArgs & { storageId: Id<"_storage">; index: number }, boolean>("modules/federation/mediaJobs:stage")
const COMPLETE = makeFunctionReference<"mutation", MediaLeaseArgs, boolean>("modules/federation/mediaJobs:complete")
const PURGE = makeFunctionReference<"mutation", Record<string, never>, { scanned: number; deleted: number; done: boolean }>("modules/files/orphans:purge")

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210"); vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox"); vi.stubEnv("FILE_GUARD", "off") })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs() })

async function fixture() {
  const t = testConvex({ automaticSessions: false })
  const ids = await t.run(async ctx => {
    const root = await ctx.db.insert("networks", { slug: ROOT_NETWORK_SLUG, name: "Racine", kind: "root", status: "active", membershipPolicy: "open", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: T0, updatedAt: T0 })
    const networkId = await ctx.db.insert("networks", { slug: "administration", name: "Administration", kind: "closed", parentId: root, status: "active", membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: T0, updatedAt: T0 })
    const emitterId = await ctx.db.insert("federationEmitters", { networkId, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true, keyEnvName: "ANTSIA_STAGING_TEST_KEY", allowedContracts: [RESEAU_PUBLIC_CONTRACT], revision: 1, createdAt: T0, updatedAt: T0 })
    const emitter = await ctx.db.get(emitterId)
    if (!emitter) throw new Error("Émetteur de fixture absent")
    const objectRef = "page:staging-fixture"
    const applied = await applyFederationEnvelope(ctx, emitter, { eventId: "staging-page", contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef, payload: { type: "page.upserted", orgRef: objectRef, revision: 1, name: "Direction de recette", country: "GA", verifiedAt: T0 - 1_000 } }, T0)
    if (!applied.applied) throw new Error("Page de fixture refusée")
    const mirror = await ctx.db.query("mirrors").withIndex("by_emitter_environment_object", q => q.eq("emitterId", emitterId).eq("environment", "sandbox").eq("objectRef", objectRef)).unique()
    if (!mirror?.sourceDigest) throw new Error("Reflet de fixture absent")
    const storageId = await ctx.storage.store(new Blob([PNG], { type: "image/png" }))
    const facts = await readStoredBlobFacts(ctx, storageId, "image/png")
    if (!facts.sha256 || !facts.sizeBytes) throw new Error("Faits du stockage absents")
    const lease = { mirrorId: mirror._id, revision: 1, digest: mirror.sourceDigest, leaseToken: "staging-fixture-lease" }
    await ctx.db.patch(mirror._id, { mediaStatus: "running", mediaLeaseToken: lease.leaseToken, mediaLeaseUntil: T0 + 90_000, mediaStored: [], mediaManifest: [{ url: "https://cdn.example.org/logo.png", kind: "image", mimeType: "image/png", sizeBytes: facts.sizeBytes, sha256: facts.sha256 }] })
    return { root, networkId, emitterId, mirrorId: mirror._id, storageId, lease }
  })
  return { t, ...ids }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

async function reserve(f: Fixture) {
  await f.t.run(async ctx => {
    const mirror = await ctx.db.get(f.mirrorId)
    if (!mirror) throw new Error("Reflet de fixture absent")
    await reserveStagedFile(ctx, mirror, f.storageId)
  })
}

async function state(f: Fixture) {
  return await f.t.run(async ctx => ({
    reservation: await ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", f.storageId)).unique(),
    scan: await ctx.db.query("fileScans").withIndex("by_storageId", q => q.eq("storageId", f.storageId)).unique(),
    stored: await ctx.db.system.get("_storage", f.storageId),
  }))
}

async function caller(f: Fixture) {
  const user: unknown = await f.t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Alias choisi", email: "staging-caller@example.test", emailVerified: true, createdAt: T0, updatedAt: T0 } } })
  if (!user || typeof user !== "object" || !("_id" in user) || typeof user._id !== "string") throw new Error("Utilisateur de fixture absent")
  const as = f.t.withIdentity({ subject: user._id, sessionId: await createTestSession(f.t, user._id) })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "staging.caller", displayName: "Alias choisi" })
  return { as, personId }
}

async function catalogAsset(f: Fixture) {
  await f.t.run(async ctx => {
    const owner = await ctx.db.insert("persons", { authUserId: "catalogue-fixture-owner", createdAt: T0, updatedAt: T0 })
    const shopId = await ctx.db.insert("shops", { networkId: f.networkId, ownerPersonId: owner, model: "products", storefront: "draft", visibility: "network", createdAt: T0, updatedAt: T0 })
    const mappingId = await ctx.db.insert("commerceCatalogMappings", { networkId: f.networkId, shopId, emitterId: f.emitterId, environment: "sandbox", shopRef: "shop:fixture", linkRef: "link:fixture", enabled: true, generation: 1, createdAt: T0, updatedAt: T0 })
    const headId = await ctx.db.insert("commerceCatalogHeads", { networkId: f.networkId, shopId, mappingId, mappingGeneration: 1, emitterId: f.emitterId, environment: "sandbox", objectRef: "offer:fixture", shopRef: "shop:fixture", sequence: "catalog", objectKind: "offer", state: "active", revision: 1, digest: "a".repeat(64), body: "{}", changedAt: T0, receivedAt: T0, activationRevision: 1, parentActivationRevision: 1, gap: false })
    await ctx.db.insert("commerceCatalogMediaAssets", { networkId: f.networkId, headId, revision: 1, digest: "a".repeat(64), index: 0, publicToken: "fixture-private-catalogue-token", storageId: f.storageId, createdAt: T0 })
  })
}

describe("réservation des copies serveur avant admission", () => {
  it("réserve une seule fois pour son reflet et refuse la réattribution", async () => {
    const f = await fixture()
    await reserve(f); await reserve(f)
    expect((await state(f)).reservation).toMatchObject({ networkId: f.networkId, mirrorId: f.mirrorId, storageId: f.storageId })
    await expect(f.t.run(async ctx => {
      const otherId = await ctx.db.insert("mirrors", { networkId: f.networkId, emitterId: f.emitterId, environment: "sandbox", contract: RESEAU_PUBLIC_CONTRACT, objectRef: "page:other", localTable: "pages", updatedAt: T0 })
      const other = await ctx.db.get(otherId)
      if (!other) throw new Error("Autre reflet absent")
      await reserveStagedFile(ctx, other, f.storageId)
    })).rejects.toThrow()
    expect((await state(f)).reservation?.mirrorId).toBe(f.mirrorId)
  })

  it("stage réserve atomiquement le blob et son rejeu reste unique ; complete admet puis libère", async () => {
    const f = await fixture()
    expect(await f.t.mutation(STAGE, { ...f.lease, storageId: f.storageId, index: 0 })).toBe(true)
    expect(await f.t.mutation(STAGE, { ...f.lease, storageId: f.storageId, index: 0 })).toBe(true)
    expect((await state(f)).reservation?.mirrorId).toBe(f.mirrorId)
    expect((await f.t.run(async ctx => ctx.db.get(f.mirrorId)))?.mediaStored).toEqual([f.storageId])
    expect(await f.t.mutation(COMPLETE, f.lease)).toBe(true)
    const after = await state(f)
    expect(after.reservation).toBeNull()
    expect(after.scan).toMatchObject({ status: "pending", requiresFullScan: true, source: "page" })
    expect(after.stored).not.toBeNull()
  })

  it("un bail invalide ne crée aucune réservation et purge seulement son dépôt provisoire", async () => {
    const f = await fixture()
    expect(await f.t.mutation(STAGE, { ...f.lease, leaseToken: "obsolete", storageId: f.storageId, index: 0 })).toBe(false)
    expect(await state(f)).toEqual({ reservation: null, scan: null, stored: null })
    expect((await f.t.run(async ctx => ctx.db.get(f.mirrorId)))?.mediaStored).toEqual([])
  })

  it.each(["reservation", "catalogue"] as const)("la mutation publique refuse l'adoption d'une copie %s sans scan", async kind => {
    const f = await fixture(), person = await caller(f)
    if (kind === "reservation") await reserve(f)
    else await catalogAsset(f)
    let refusal: unknown
    try { await person.as.mutation(api.modules.people.profile.setMyAvatar, { storageId: f.storageId, mimeType: "image/png" }) } catch (error) { refusal = error }
    expect(engineErrorCode(refusal)).toBe("notFound")
    expect((await f.t.run(async ctx => ctx.db.get(person.personId)))?.avatarStorageId).toBeUndefined()
    expect((await state(f)).stored).not.toBeNull()
    await f.t.run(async ctx => assertFreshUpload(ctx, null, f.storageId))
  })

  it.each([
    { generated: false, existing: false }, { generated: false, existing: true },
    { generated: true, existing: false }, { generated: true, existing: true },
  ])("l'admission libère la réservation : generated=$generated, existing=$existing", async variant => {
    const f = await fixture()
    await reserve(f)
    await f.t.run(async ctx => {
      if (variant.existing) await ctx.db.insert("fileScans", { storageId: f.storageId, source: "page", status: "clean", attempts: 1, createdAt: T0, updatedAt: T0 })
      if (variant.generated) await registerGeneratedBlob(ctx, f.storageId, { mimeType: "image/png", networkId: f.networkId })
      else await enqueueScan(ctx, { storageId: f.storageId, mimeType: "image/png" }, { source: "page", networkId: f.networkId }, { FILE_GUARD: "off" })
    })
    const after = await state(f)
    expect(after.reservation).toBeNull()
    expect(after.scan?.status).toBe(variant.existing ? "clean" : variant.generated ? "skipped" : "pending")
    expect(after.stored).not.toBeNull()
  })

  it("purger la copie libère aussi la réservation, y compris au rejeu", async () => {
    const f = await fixture()
    await reserve(f)
    await f.t.run(async ctx => purgeStoredFile(ctx, f.storageId))
    await f.t.run(async ctx => purgeStoredFile(ctx, f.storageId))
    expect(await state(f)).toEqual({ reservation: null, scan: null, stored: null })
  })

  it.each(["reservation", "catalogue"] as const)("la purge d'orphelins protège une copie %s même ancienne et sans scan", async kind => {
    const f = await fixture()
    if (kind === "reservation") await reserve(f)
    else await catalogAsset(f)
    vi.setSystemTime(T0 + 2 * ORPHAN_MIN_AGE_MS)
    expect((await f.t.mutation(PURGE, {})).deleted).toBe(0)
    expect((await state(f)).stored).not.toBeNull()
    expect((await state(f)).scan).toBeNull()
  })
})
