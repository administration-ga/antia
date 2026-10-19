// @vitest-environment edge-runtime
/** PA10 : scénarios écrits, sans exécution ni purge d'un stockage réel. */
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { ORPHAN_BATCH_SIZE, ORPHAN_MIN_AGE_MS } from "./orphans"

type T = ReturnType<typeof testConvex>
type PurgeArgs = { cursor?: string | null; before?: number }
type PurgeResult = { scanned: number; deleted: number; done: boolean }
const PURGE = makeFunctionReference<"mutation", PurgeArgs, PurgeResult>("modules/files/orphans:purge")
const RUN = makeFunctionReference<"mutation", Record<string, never>, null>("modules/files/orphans:run")
const PROTECT = makeFunctionReference<"mutation", { cursor: string | null; before: number }, { scanned: number; done: boolean }>("modules/files/orphans:protectStaged")
const T0 = Date.UTC(2026, 9, 18, 12)

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

async function store(t: T, value = "upload de fixture"): Promise<Id<"_storage">> {
  return await t.run(async ctx => ctx.storage.store(new Blob([value], { type: "text/plain" })))
}

async function metadata(t: T, storageId: Id<"_storage">) {
  return await t.run(async ctx => ctx.db.system.get("_storage", storageId))
}

async function legacyMirrors(t: T, files: readonly (readonly Id<"_storage">[])[]) {
  await t.run(async ctx => {
    const networkId = await ctx.db.insert("networks", { slug: "administration", name: "Administration", kind: "closed", status: "active", membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: T0, updatedAt: T0 })
    const emitterId = await ctx.db.insert("federationEmitters", { networkId, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true, keyEnvName: "ANTSIA_ORPHANS_TEST_KEY", allowedContracts: [RESEAU_PUBLIC_CONTRACT], revision: 1, createdAt: T0, updatedAt: T0 })
    for (const [index, mediaStored] of files.entries()) {
      await ctx.db.insert("mirrors", { networkId, emitterId, environment: "sandbox", contract: RESEAU_PUBLIC_CONTRACT, objectRef: `page:legacy-${index}`, localTable: "pages", mediaStored: [...mediaStored], updatedAt: T0 })
    }
  })
}

describe("PA10 — purge bornée des uploads sans admission", () => {
  it("supprime un ancien upload abandonné, conserve un récent et reste idempotente", async () => {
    const t = testConvex({ automaticSessions: false }), old = await store(t, "ancien")
    vi.setSystemTime(T0 + ORPHAN_MIN_AGE_MS + 3_600_000)
    const recent = await store(t, "récent")
    expect(await t.mutation(PURGE, {})).toEqual({ scanned: 1, deleted: 1, done: true })
    expect(await metadata(t, old)).toBeNull()
    expect(await metadata(t, recent)).not.toBeNull()
    expect(await t.mutation(PURGE, {})).toEqual({ scanned: 0, deleted: 0, done: true })
  })

  it("garde la frontière stricte de 24 heures et refuse un cutoff qui ouvrirait les fichiers frais", async () => {
    const t = testConvex({ automaticSessions: false }), storageId = await store(t)
    const stored = await metadata(t, storageId)
    if (!stored) throw new Error("Métadonnées de fixture absentes")
    vi.setSystemTime(Math.floor(stored._creationTime) + ORPHAN_MIN_AGE_MS)
    expect(await t.mutation(PURGE, {})).toEqual({ scanned: 0, deleted: 0, done: true })
    await expect(t.mutation(PURGE, { before: Date.now() })).rejects.toThrow()
    expect(await metadata(t, storageId)).not.toBeNull()
    vi.setSystemTime(Math.ceil(stored._creationTime) + ORPHAN_MIN_AGE_MS + 1)
    expect((await t.mutation(PURGE, {})).deleted).toBe(1)
  })

  it("toute admission protège son blob ancien, y compris clean, skipped, pending et quarantaine", async () => {
    const t = testConvex({ automaticSessions: false }), protectedFiles: Id<"_storage">[] = []
    for (const status of ["pending", "running", "clean", "suspicious", "infected", "error", "skipped"] as const) {
      const storageId = await store(t, status)
      protectedFiles.push(storageId)
      await t.run(async ctx => ctx.db.insert("fileScans", { storageId, status, source: status === "skipped" ? "generated" : "post_media", attempts: 1, createdAt: T0, updatedAt: T0 }))
    }
    const orphan = await store(t, "seul orphelin")
    vi.setSystemTime(T0 + 365 * 86_400_000)
    expect(await t.mutation(PURGE, {})).toEqual({ scanned: 8, deleted: 1, done: true })
    expect(await metadata(t, orphan)).toBeNull()
    for (const storageId of protectedFiles) expect(await metadata(t, storageId)).not.toBeNull()
    expect(await t.run(async ctx => ctx.db.query("fileScans").take(10))).toHaveLength(7)
  })

  it("enchaîne par curseur natif et cutoff figé, sans englober les fichiers vieillissant pendant le passage", async () => {
    const t = testConvex({ automaticSessions: false }), oldFiles: Id<"_storage">[] = []
    await t.run(async ctx => {
      for (let index = 0; index < ORPHAN_BATCH_SIZE + 5; index++) oldFiles.push(await ctx.storage.store(new Blob([`ancien-${index}`], { type: "text/plain" })))
    })
    const passTime = T0 + ORPHAN_MIN_AGE_MS + 3_600_000
    vi.setSystemTime(passTime)
    const recent = await store(t, "doit attendre le prochain passage quotidien")
    const first = await t.mutation(PURGE, {})
    expect(first).toEqual({ scanned: ORPHAN_BATCH_SIZE, deleted: ORPHAN_BATCH_SIZE, done: false })
    const queued = await t.run(async ctx => ctx.db.system.query("_scheduled_functions").take(5)), continuation = queued[0]
    if (!continuation) throw new Error("Suite de purge absente")
    const next: unknown = continuation.args[0]
    if (!next || typeof next !== "object" || !("cursor" in next) || typeof next.cursor !== "string" || !("before" in next) || typeof next.before !== "number") throw new Error("Suite de purge invalide")
    expect(next.before).toBe(passTime - ORPHAN_MIN_AGE_MS)
    await t.run(async ctx => ctx.scheduler.cancel(continuation._id))
    vi.setSystemTime(passTime + 2 * ORPHAN_MIN_AGE_MS)
    expect(await t.mutation(PURGE, { cursor: next.cursor, before: next.before })).toEqual({ scanned: 5, deleted: 5, done: true })
    expect(await metadata(t, recent)).not.toBeNull()
    for (const storageId of oldFiles) expect(await metadata(t, storageId)).toBeNull()
  })

  it("relit l'admission à chaque page : une ligne admise entre deux lots est conservée", async () => {
    const t = testConvex({ automaticSessions: false }), oldFiles: Id<"_storage">[] = []
    await t.run(async ctx => {
      for (let index = 0; index < ORPHAN_BATCH_SIZE + 1; index++) oldFiles.push(await ctx.storage.store(new Blob([`upload-${index}`], { type: "text/plain" })))
    })
    vi.setSystemTime(T0 + ORPHAN_MIN_AGE_MS + 3_600_000)
    expect((await t.mutation(PURGE, {})).done).toBe(false)
    const queued = await t.run(async ctx => ctx.db.system.query("_scheduled_functions").take(5)), continuation = queued[0]
    if (!continuation) throw new Error("Suite de purge absente")
    const next: unknown = continuation.args[0]
    if (!next || typeof next !== "object" || !("cursor" in next) || typeof next.cursor !== "string" || !("before" in next) || typeof next.before !== "number") throw new Error("Suite de purge invalide")
    const last = oldFiles.at(-1)
    if (!last) throw new Error("Dernier fichier de fixture absent")
    await t.run(async ctx => {
      await ctx.scheduler.cancel(continuation._id)
      await ctx.db.insert("fileScans", { storageId: last, status: "clean", source: "post_media", attempts: 1, createdAt: Date.now(), updatedAt: Date.now() })
    })
    expect(await t.mutation(PURGE, { cursor: next.cursor, before: next.before })).toEqual({ scanned: 1, deleted: 0, done: true })
    expect(await metadata(t, last)).not.toBeNull()
  })

  it("le cron protège les mediaStored historiques avant de supprimer le premier orphelin", async () => {
    const t = testConvex({ automaticSessions: false }), historical = await store(t, "copie fédérée historique"), orphan = await store(t, "upload abandonné")
    await legacyMirrors(t, [[historical]])
    vi.setSystemTime(T0 + ORPHAN_MIN_AGE_MS + 3_600_000)
    expect(await t.mutation(RUN, {})).toBeNull()
    expect(await metadata(t, orphan)).not.toBeNull()
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    expect(await metadata(t, historical)).not.toBeNull()
    expect(await metadata(t, orphan)).toBeNull()
    expect(await t.run(async ctx => ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", historical)).unique())).toMatchObject({ storageId: historical })
    expect(await t.run(async ctx => ctx.db.query("fileScans").withIndex("by_storageId", q => q.eq("storageId", historical)).unique())).toBeNull()
  })

  it("une protection historique interrompue après vingt reflets ne commence aucune purge", async () => {
    const t = testConvex({ automaticSessions: false }), historical = await store(t, "dernière copie historique"), orphan = await store(t, "upload doit attendre")
    await legacyMirrors(t, [...Array.from({ length: 20 }, () => [] as Id<"_storage">[]), [historical]])
    vi.setSystemTime(T0 + ORPHAN_MIN_AGE_MS + 3_600_000)
    const before = Date.now() - ORPHAN_MIN_AGE_MS
    expect(await t.mutation(PROTECT, { cursor: null, before })).toEqual({ scanned: 20, done: false })
    const queued = await t.run(async ctx => ctx.db.system.query("_scheduled_functions").take(5)), continuation = queued[0]
    expect(queued).toHaveLength(1)
    if (!continuation) throw new Error("Suite de protection absente")
    expect(continuation.name).toBe("modules/files/orphans:protectStaged")
    const next: unknown = continuation.args[0]
    expect(next).toMatchObject({ before, cursor: expect.any(String) })
    await t.run(async ctx => ctx.scheduler.cancel(continuation._id))
    expect(await metadata(t, historical)).not.toBeNull()
    expect(await metadata(t, orphan)).not.toBeNull()
    expect(await t.run(async ctx => ctx.db.query("fileStagingReservations").withIndex("by_storageId", q => q.eq("storageId", historical)).unique())).toBeNull()
  })

  it("un reflet historique hors contrat de quatre fichiers ferme la chaîne sans purge", async () => {
    const t = testConvex({ automaticSessions: false }), historical: Id<"_storage">[] = []
    for (let index = 0; index < 5; index++) historical.push(await store(t, `copie-${index}`))
    await legacyMirrors(t, [historical])
    vi.setSystemTime(T0 + ORPHAN_MIN_AGE_MS + 3_600_000)
    await expect(t.mutation(PROTECT, { cursor: null, before: Date.now() - ORPHAN_MIN_AGE_MS })).rejects.toThrow()
    expect(await t.run(async ctx => ctx.db.system.query("_scheduled_functions").take(5))).toHaveLength(0)
    for (const storageId of historical) expect(await metadata(t, storageId)).not.toBeNull()
  })
})
