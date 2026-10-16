// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/retention.test.ts @ ad2e7fdc2 — adaptations : le cas PUR (90 jours, rendez-vous borné, fail-closed sans échéance) porté tel quel ; les trois cas d'intégration — purge de la vidéo et des sous-titres puis fermeture de la lecture et de la découverte, « ready » historique sans échéance jusqu'à sa migration bornée, borne de 50 lignes par transaction — portés sur `liveSessions` et le réseau (graine des fondations, personnes entrées, `sessions.*` bornées par `networkId`), sous l'horloge simulée ; comptes et profils du socle (`users`, `publishMyProfile`) remplacés par `enter` ; la piste de sous-titres passe par la garde des fichiers (analyse jouée avant de lire son adresse) et la purge emporte la ligne d'analyse de chaque copie (D10, affirmé en plus).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { enter, type Person, seed, type T, T0 } from "./fixtures.setup"
import { DIRECT_REPLAY_PURGE_BATCH, DIRECT_REPLAY_RETENTION_MS, directReplayRetentionUntil, isDirectReplayRetained, nextDirectReplayRetentionCheck } from "./retention"

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const S = api.modules.live.sessions

/** Une rediffusion PRÊTE : créée, en direct, corrélée, terminée, fichier livré. */
async function readyReplay(t: T, root: Id<"networks">, host: Person) {
  const created = await host.as.mutation(S.create, { networkId: root, title: "Replay retenu", audience: "public", chatMode: "open", replay: true })
  await host.as.mutation(S.goLive, { networkId: root, sessionId: created.sessionId })
  await t.mutation(internal.modules.live.replay.attachEgress, { sessionId: created.sessionId, egressId: `eg-${String(created.sessionId)}` })
  await host.as.mutation(S.end, { networkId: root, sessionId: created.sessionId })
  const videoId = await t.run((ctx) => ctx.storage.store(new Blob(["video"])))
  await t.mutation(internal.modules.live.replay.completeEgress, { egressId: `eg-${String(created.sessionId)}`, storageId: videoId })
  return { sessionId: created.sessionId, videoId }
}

/** La ligne d'analyse d'un fichier, s'il en a une. */
async function scanOf(t: T, storageId: Id<"_storage">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("fileScans")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
  )
}

/** Joue les jobs DÉJÀ dus (analyse, arrêt de l'Egress, diffusion), jamais l'échéance des 90 jours. */
async function drainDueJobs(t: T): Promise<void> {
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1))
}

describe("politique de rétention Direct", () => {
  it("matérialise 90 jours mais borne chaque rendez-vous du scheduler", () => {
    expect(directReplayRetentionUntil(1_000)).toBe(1_000 + DIRECT_REPLAY_RETENTION_MS)
    const deadline = directReplayRetentionUntil(1_000)
    const firstCheck = nextDirectReplayRetentionCheck(1_000, deadline)
    expect(firstCheck).toBeGreaterThan(1_000)
    expect(firstCheck).toBeLessThan(deadline)
    expect(isDirectReplayRetained({ replayStatus: "ready" })).toBe(false)
    expect(
      isDirectReplayRetained({
        replayStatus: "ready",
        replayStorageId: "blob",
        replayRetentionUntil: deadline,
      }),
    ).toBe(true)
  })

  it("purge ensemble vidéo et sous-titres, puis ferme lecture et découverte", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { sessionId, videoId } = await readyReplay(t, root, alice)
    const captionsId = await t.run((ctx) => ctx.storage.store(new Blob(["WEBVTT"], { type: "text/vtt" })))
    expect(await t.mutation(internal.modules.live.replay.attachCaptions, { sessionId, storageId: captionsId })).toEqual({ attached: true })
    // La piste vient d'un client : elle n'a d'adresse qu'une fois jugée par la garde.
    await drainDueJobs(t)
    expect((await alice.as.query(S.get, { networkId: root, sessionId })).replay?.captionsUrl).toBeTruthy()

    const expiredAt = Date.now() - 1
    await t.run((ctx) => ctx.db.patch(sessionId, { replayRetentionUntil: expiredAt }))
    expect(await t.mutation(internal.modules.live.replay.expireReplay, { sessionId, expectedRetentionUntil: expiredAt })).toEqual({ expired: true })

    const state = await t.run(async (ctx) => ({
      session: await ctx.db.get(sessionId),
      video: await ctx.db.system.get("_storage", videoId),
      captions: await ctx.db.system.get("_storage", captionsId),
    }))
    expect(state.session).toMatchObject({ replayStatus: "expired" })
    expect(state.session?.replayStorageId).toBeUndefined()
    expect(state.session?.replayCaptionsStorageId).toBeUndefined()
    expect(state.video).toBeNull()
    expect(state.captions).toBeNull()
    // D10 : la purge emporte aussi la ligne d'analyse de chaque copie.
    expect(await scanOf(t, videoId)).toBeNull()
    expect(await scanOf(t, captionsId)).toBeNull()

    const detail = await alice.as.query(S.get, { networkId: root, sessionId })
    expect(detail.replay).toMatchObject({ status: "expired", url: null })
    const discovery = await alice.as.query(S.listReplays, { networkId: root })
    expect(discovery.items).toEqual([])

    const replayedWebhookBlob = await t.run((ctx) => ctx.storage.store(new Blob(["webhook rejoué"])))
    await t.mutation(internal.modules.live.replay.completeEgress, { egressId: `eg-${String(sessionId)}`, storageId: replayedWebhookBlob })
    const afterReplay = await t.run(async (ctx) => ({
      session: await ctx.db.get(sessionId),
      blob: await ctx.db.system.get("_storage", replayedWebhookBlob),
    }))
    expect(afterReplay.session?.replayStatus).toBe("expired")
    expect(afterReplay.blob).toBeNull()
  })

  it("refuse un ready historique sans échéance jusqu'à sa migration bornée", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const { sessionId } = await readyReplay(t, root, alice)
    await t.run((ctx) => ctx.db.patch(sessionId, { replayRetentionUntil: undefined }))

    expect((await alice.as.query(S.get, { networkId: root, sessionId })).replay).toBeNull()
    expect((await alice.as.query(S.listReplays, { networkId: root })).items).toEqual([])

    await t.mutation(internal.modules.live.replay.purgeExpiredReplays, {})
    expect((await alice.as.query(S.get, { networkId: root, sessionId })).replay?.status).toBe("ready")

    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        endedAt: Date.now() - DIRECT_REPLAY_RETENTION_MS - 1,
        replayRetentionUntil: undefined,
      }),
    )
    await t.mutation(internal.modules.live.replay.purgeExpiredReplays, {})
    expect(await t.run(async (ctx) => (await ctx.db.get(sessionId))?.replayStatus)).toBe("expired")
  })

  it("ne traite jamais plus de 50 lignes dans une transaction", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < DIRECT_REPLAY_PURGE_BATCH + 1; index += 1) {
        const storageId = await ctx.storage.store(new Blob([String(index)]))
        await ctx.db.insert("liveSessions", {
          networkId: root,
          hostPersonId: alice.personId,
          title: `Replay ${index}`,
          roomName: `direct-retention-${index}`,
          status: "ended",
          audience: "public",
          chatMode: "open",
          maxViewers: 10,
          replayRequested: true,
          replayStatus: "ready",
          replayStorageId: storageId,
          replayRetentionUntil: now - 1,
          createdAt: index,
          startedAt: index + 1,
          endedAt: index + 2,
          updatedAt: now,
        })
      }
    })

    expect(await t.mutation(internal.modules.live.replay.purgeExpiredReplays, {})).toEqual({ processed: DIRECT_REPLAY_PURGE_BATCH, done: false })
    const expired = await t.run((ctx) =>
      ctx.db
        .query("liveSessions")
        .withIndex("by_status_replayStatus_endedAt", (q) => q.eq("status", "ended").eq("replayStatus", "expired"))
        .take(DIRECT_REPLAY_PURGE_BATCH + 1),
    )
    expect(expired).toHaveLength(DIRECT_REPLAY_PURGE_BATCH)
  })
})
