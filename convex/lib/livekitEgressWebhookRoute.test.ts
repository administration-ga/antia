// @vitest-environment edge-runtime
// Dupliqué de socle/convex/tests/livekitEgressWebhook.test.ts @ ad2e7fdc2 — adaptations : SIMPLIFIÉ au direct, seul propriétaire d'un egress dans le moteur — trois cas RETIRÉS avec leurs traitements absents du moteur : « un enregistrement d'appel en échec garde son motif d'avant » (`callRecordings`), « un enregistrement d'appel et un message vocal reçoivent leur fichier confronté » (`callRecordings`, `voicemails`), « une piste iRéunion reçoit le fichier ET les métadonnées de capture » (`ireunionRecordingTracks`) ; « les quatre requêtes répondent pour leur table » devient la seule requête du direct ; l'egress d'APPEL de l'autre déploiement devient un chemin hors contrat ; « un fichier déposé pour un egress DISPARU » porté sur la branche du direct ; actions du moteur (`modules/live/egressActions`, `ingestEgressFile` sans début de capture ni taille), sessions `liveSessions` COMPLÈTES posées par l'outillage du module ; motifs attendus en CODES (`egress_aborted`, `transfer_download_failed`, `upload_refused`) ; horloge simulée dans tout le fichier (aucun job planifié ne part seul) ; cas NEUFS : le fichier rapatrié entre à la garde des fichiers (admis à l'analyse, réseau et hôte), et un fichier que la garde connaît déjà n'est ni rattaché ni supprimé.
/**
 * `POST /webhooks/livekit-egress` — correctifs du 2026-09-17.
 *
 * Trois défauts, tous vérifiés au socle avant correction :
 *
 *  · l'en-tête `Authorization` était comparé à un secret FIXE, alors que
 *    LiveKit envoie un JWT signé avec la clé d'API (claim `sha256` = empreinte
 *    du corps) : chaque événement réel était refusé ;
 *  · une même VM LiveKit sert plusieurs déploiements, et le webhook part vers
 *    chacun : l'egress d'un autre déploiement était TÉLÉCHARGÉ avant qu'on
 *    sache à qui il était, puis laissé orphelin, et journalisé ;
 *  · le fichier était chargé ENTIER en mémoire, dans le runtime à 64 MiB.
 *
 * Les jetons sont fabriqués avec l'`AccessToken` RÉEL du SDK (claim `sha256`
 * compris) et vérifiés par le `WebhookReceiver` RÉEL, dans l'action Node
 * (`modules/live/egressActions.verifyEgressWebhook`). Seul le transfert de
 * fichier est simulé : il a ses propres tests (`livekitEgressFileTransfer.test.ts`).
 */
import { AccessToken } from "livekit-server-sdk"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { enter, insertSession, seed, type T, T0 } from "../modules/live/fixtures.setup"
import { testConvex } from "../test.setup"

const transfer = vi.hoisted(() => vi.fn())
vi.mock("./livekitEgressFileTransfer", () => ({
  transferEgressFileToStorage: transfer,
}))

const WEBHOOK_PATH = "/webhooks/livekit-egress"
const API_KEY = "APIwebhooktest"
const API_SECRET = "secret-d-api-livekit-pour-les-tests-du-webhook"
const LOCATION = "https://storage.googleapis.com/egress-prive/directs/x.mp4?X-Goog-Signature=abc"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.stubEnv("LIVEKIT_API_KEY", API_KEY)
  vi.stubEnv("LIVEKIT_API_SECRET", API_SECRET)
  vi.stubEnv("LIVEKIT_WS_URL", "wss://livekit.test")
  vi.stubEnv("LIVEKIT_WEBHOOK_SECRET", "")
  transfer.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// Le premier `fetch` d'un fichier importe le routeur `convex/http.ts` et tout son
// graphe (Better Auth compris) : payé ici une fois pour le fichier, cet import
// sort du budget des tests — il n'appartient à aucun des comportements testés.
beforeAll(async () => {
  // Corps illisible : refusé (400) avant l'authentification, donc sans lire les
  // clés d'API et sans aucun effet.
  const response = await testConvex().fetch(WEBHOOK_PATH, {
    method: "POST",
    headers: { "content-type": "application/webhook+json" },
    body: "{pas du json",
  })
  expect(response.status).toBe(400)
}, 120_000)

/** Ce que LiveKit met dans `Authorization` : un JWT dont `sha256` scelle le corps. */
async function signWebhook(body: string, options: { key?: string; secret?: string } = {}): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))
  const token = new AccessToken(options.key ?? API_KEY, options.secret ?? API_SECRET)
  token.sha256 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return token.toJwt()
}

function post(t: T, body: string, authorization?: string): Promise<Response> {
  return t.fetch(WEBHOOK_PATH, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/webhook+json",
      ...(authorization !== undefined ? { authorization } : {}),
    },
  })
}

function egressEvent(event: "egress_started" | "egress_updated" | "egress_ended", egressInfo: Record<string, unknown>): string {
  return JSON.stringify({ event, id: `EV_${Math.random()}`, createdAt: "1789650000", egressInfo })
}

/** Une conférence terminée dont la capture attend encore son fichier. */
async function directEnAttente(t: T, egressId: string): Promise<Id<"liveSessions">> {
  const { root } = await seed(t)
  const host = await enter(t, root, "hote")
  const sessionId = await insertSession(t, { networkId: root, host, status: "ended" })
  await t.run((ctx) =>
    ctx.db.patch(sessionId, {
      roomName: "direct-room",
      replayStatus: "pending",
      replayEgressState: "requested",
      egressId,
      startedAt: Date.now() - 3_600_000,
      endedAt: Date.now(),
    }),
  )
  return sessionId
}

async function counts(t: T): Promise<{ jobs: number; files: number }> {
  return t.run(async (ctx) => ({
    jobs: (await ctx.db.system.query("_scheduled_functions").take(100)).length,
    files: (await ctx.db.system.query("_storage").take(100)).length,
  }))
}

async function row(t: T, sessionId: Id<"liveSessions">) {
  return await t.run((ctx) => ctx.db.get(sessionId))
}

describe("authentification — le JWT de LiveKit, plus un secret fixe", () => {
  it("un JWT signé par la clé d'API est ACCEPTÉ, et l'événement agit", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    const body = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_ACTIVE" })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, observed: true })
    expect((await row(t, sessionId))?.replayEgressState).toBe("active")
  })

  it("le préfixe `Bearer ` d'un relais est toléré", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    const body = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_ACTIVE" })

    const response = await post(t, body, `Bearer ${await signWebhook(body)}`)

    expect(response.status).toBe(200)
    expect((await row(t, sessionId))?.replayEgressState).toBe("active")
  })

  it("un JWT signé avec un AUTRE secret est refusé (401), sans effet", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const body = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_ACTIVE" })

    const response = await post(t, body, await signWebhook(body, { secret: "un-autre-secret-que-celui-du-deploiement" }))

    expect(response.status).toBe(401)
    expect((await row(t, sessionId))?.replayEgressState).toBe("requested")
  })

  it("un corps MODIFIÉ après signature est refusé : l'empreinte ne correspond plus", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const signed = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_STARTING" })
    const forged = signed.replace("EGRESS_STARTING", "EGRESS_ACTIVE")

    const response = await post(t, forged, await signWebhook(signed))

    expect(response.status).toBe(401)
    expect((await row(t, sessionId))?.replayEgressState).toBe("requested")
  })

  it("sans en-tête Authorization, un événement d'egress est refusé", async () => {
    const t = testConvex()
    await directEnAttente(t, "EG_OURS")
    const body = egressEvent("egress_ended", { egressId: "EG_OURS", status: "EGRESS_FAILED" })

    const response = await post(t, body)

    expect(response.status).toBe(401)
  })

  it("le secret fixe historique reste accepté s'il est posé — sans être requis", async () => {
    const t = testConvex()
    vi.stubEnv("LIVEKIT_WEBHOOK_SECRET", "secret-historique-du-relais")
    const sessionId = await directEnAttente(t, "EG_OURS")
    const body = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_ACTIVE" })

    const legacy = await post(t, body, "Bearer secret-historique-du-relais")
    expect(legacy.status).toBe(200)
    expect((await row(t, sessionId))?.replayEgressState).toBe("active")

    // Le secret posé ne ferme pas la porte au vrai jeton de LiveKit.
    const jwt = await post(t, body, await signWebhook(body))
    expect(jwt.status).toBe(200)
  })

  it("sans clés d'API (ni secret historique) : 503, sans effet", async () => {
    const t = testConvex()
    vi.stubEnv("LIVEKIT_API_KEY", "")
    vi.stubEnv("LIVEKIT_API_SECRET", "")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const sessionId = await directEnAttente(t, "EG_OURS")
    const body = egressEvent("egress_updated", { egressId: "EG_OURS", status: "EGRESS_ACTIVE" })

    const response = await post(t, body, "n-importe-quoi")

    expect(response.status).toBe(503)
    expect((await row(t, sessionId))?.replayEgressState).toBe("requested")
  })

  it("un événement de SALLE est absorbé tout de suite : ni authentification, ni effet", async () => {
    const t = testConvex()
    const response = await post(t, JSON.stringify({ event: "participant_joined", room: { name: "salle-de-l-autre-deploiement" } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true })
    expect(await counts(t)).toEqual({ jobs: 0, files: 0 })
  })

  it("un corps illisible rend 400, un corps démesuré 413", async () => {
    const t = testConvex()
    expect((await post(t, "{pas du json")).status).toBe(400)
    expect((await post(t, "null")).status).toBe(400)
    expect((await post(t, "x".repeat(2_000_001))).status).toBe(413)
  })
})

describe("une VM, plusieurs déploiements — l'egress d'un AUTRE est ignoré, sans bruit", () => {
  it("terminé AVEC fichier : 200, ni téléchargement, ni stockage, ni job, ni journal", async () => {
    const t = testConvex()
    await directEnAttente(t, "EG_OURS")
    const before = await counts(t)
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const warn = vi.spyOn(console, "warn")
    const error = vi.spyOn(console, "error")
    const body = egressEvent("egress_ended", {
      egressId: "EG_DE_LA_PROD",
      status: "EGRESS_COMPLETE",
      fileResults: [{ filename: "directs/k57prodsession.mp4", location: LOCATION, duration: "12000000000", size: "2048" }],
    })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(transfer).not.toHaveBeenCalled()
    expect(await counts(t)).toEqual(before)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it("terminé SANS fichier (échec précoce, filepath vide) : 200, et aucun « filepath non routé »", async () => {
    const t = testConvex()
    const warn = vi.spyOn(console, "warn")
    const error = vi.spyOn(console, "error")
    const body = egressEvent("egress_ended", { egressId: "EG_DE_LA_PROD", status: "EGRESS_FAILED" })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true })
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it("un chemin HORS CONTRAT (l'enregistrement d'appel d'un autre déploiement) n'est pas téléchargé non plus", async () => {
    const t = testConvex()
    const body = egressEvent("egress_ended", {
      egressId: "EG_APPEL_PROD",
      status: "EGRESS_COMPLETE",
      fileResults: [{ filename: "recordings/k57record.mp4", location: LOCATION }],
    })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true })
    expect(transfer).not.toHaveBeenCalled()
    expect(await counts(t)).toEqual({ jobs: 0, files: 0 })
  })
})

describe("NOTRE egress terminé : rapatrié en flux, ou conclu tout de suite", () => {
  it("AVEC fichier : le rapatriement est PLANIFIÉ hors du webhook, puis la rediffusion est prête", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(256)])))
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 256, contentType: "video/mp4" })
    const body = egressEvent("egress_ended", {
      egressId: "EG_OURS",
      status: "EGRESS_COMPLETE",
      fileResults: [{ filename: `directs/${sessionId}.mp4`, location: LOCATION, duration: "12000000000", size: "256" }],
    })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ingest: "scheduled" })
    // Rien n'a été transféré DANS le webhook.
    expect(transfer).not.toHaveBeenCalled()
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(100))
    const ingest = jobs.find((job) => job.name.includes("ingestEgressFile"))
    expect(ingest?.args[0]).toEqual({
      route: "direct",
      egressId: "EG_OURS",
      filepath: `directs/${sessionId}.mp4`,
      location: LOCATION,
      durationMs: 12_000,
    })

    await vi.advanceTimersByTimeAsync(10)
    await t.finishInProgressScheduledFunctions()

    expect(transfer).toHaveBeenCalledWith(expect.objectContaining({ location: LOCATION, filepath: `directs/${sessionId}.mp4` }))
    const ready = await row(t, sessionId)
    expect(ready?.replayStatus).toBe("ready")
    expect(ready?.replayStorageId).toBe(storageId)
    expect(ready?.replayDurationMs).toBe(12_000)
  })

  it("en ÉCHEC déclaré : conclu tout de suite chez son propriétaire, sans rien télécharger", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const body = egressEvent("egress_ended", {
      egressId: "EG_OURS",
      status: "EGRESS_ABORTED",
      fileResults: [{ filename: `directs/${sessionId}.mp4`, location: LOCATION }],
    })

    const response = await post(t, body, await signWebhook(body))

    expect(response.status).toBe(200)
    expect(transfer).not.toHaveBeenCalled()
    const failed = await row(t, sessionId)
    expect(failed?.replayStatus).toBe("failed")
    expect(failed?.replayFailureReason).toBe("egress_aborted")
    expect(await counts(t)).toMatchObject({ jobs: 0, files: 0 })
  })
})

describe("propriété — le direct ne connaît que SA table", () => {
  it("la requête du direct répond pour ses sessions, et pour elles seules", async () => {
    const t = testConvex()
    await directEnAttente(t, "EG_DIRECT")
    expect(await t.query(internal.modules.live.replay.isEgressKnown, { egressId: "EG_DIRECT" })).toBe(true)
    expect(await t.query(internal.modules.live.replay.isEgressKnown, { egressId: "EG_CALL" })).toBe(false)
    expect(await t.query(internal.modules.live.replay.isEgressKnown, { egressId: "EG_INCONNU" })).toBe(false)
  })
})

describe("ingestEgressFile — le fichier en flux, puis la complétion", () => {
  const ingest = internal.modules.live.egressActions.ingestEgressFile

  it("un rapatriement ÉCHOUÉ donne son motif (un code) à l'hôte du direct", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const reason = "Le fichier d'enregistrement n'a pas pu être récupéré (HTTP 403)."
    transfer.mockResolvedValue({ ok: false, code: "download_failed", reason })

    const result = await t.action(ingest, { route: "direct", egressId: "EG_OURS", filepath: `directs/${sessionId}.mp4`, location: LOCATION })

    expect(result).toEqual({ status: "failed", code: "download_failed" })
    const failed = await row(t, sessionId)
    expect(failed?.replayStatus).toBe("failed")
    expect(failed?.replayFailureReason).toBe("transfer_download_failed")
  })

  it("politique de dépôt, temps 2 : un fichier qui n'est PAS un enregistrement est refusé ET supprimé", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "error").mockImplementation(() => {})
    // L'URL présignée a rendu une page d'erreur en 200 : le transfert l'a déposée.
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(512)])))
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 512, contentType: "text/html" })

    await t.action(ingest, { route: "direct", egressId: "EG_OURS", filepath: `directs/${sessionId}.mp4`, location: LOCATION })

    const refused = await row(t, sessionId)
    expect(refused?.replayStatus).toBe("failed")
    expect(refused?.replayStorageId).toBeUndefined()
    expect(refused?.replayFailureReason).toBe("upload_refused")
    expect(await counts(t)).toMatchObject({ files: 0 })
  })

  it("une taille STOCKÉE qui contredit les octets transférés est refusée", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(100)])))
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 4096, contentType: "video/mp4" })

    await t.action(ingest, { route: "direct", egressId: "EG_OURS", filepath: `directs/${sessionId}.mp4`, location: LOCATION })

    expect((await row(t, sessionId))?.replayStatus).toBe("failed")
    expect(await counts(t)).toMatchObject({ files: 0 })
  })

  it("un fichier déposé pour un egress DISPARU entre-temps n'est jamais laissé orphelin", async () => {
    const t = testConvex()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)])))
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 64, contentType: "video/mp4" })

    await t.action(ingest, { route: "direct", egressId: "EG_PURGE", filepath: "directs/k57purge.mp4", location: LOCATION })

    expect(await counts(t)).toMatchObject({ files: 0 })
  })

  it("le fichier rapatrié entre à la GARDE des fichiers : admis à l'analyse, au réseau et à l'hôte de la conférence", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(256)])))
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 256, contentType: "video/mp4" })

    expect(await t.action(ingest, { route: "direct", egressId: "EG_OURS", filepath: `directs/${sessionId}.mp4`, location: LOCATION })).toEqual({ status: "stored", bytes: 256 })

    const session = await row(t, sessionId)
    const scan = await t.run((ctx) =>
      ctx.db
        .query("fileScans")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
    )
    expect(scan).toMatchObject({ source: "live", status: "pending", networkId: session?.networkId, uploadedByPersonId: session?.hostPersonId, sizeBytes: 256 })
    // L'analyse est planifiée, jamais jouée dans la complétion.
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(100))
    expect(jobs.some((job) => job.name.includes("runScan"))).toBe(true)
  })

  it("un fichier que la garde CONNAÎT déjà n'est ni rattaché ni supprimé — il n'est pas le nôtre", async () => {
    const t = testConvex()
    const sessionId = await directEnAttente(t, "EG_OURS")
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob([new Uint8Array(32)]))
      await ctx.db.insert("fileScans", { storageId: id, status: "clean", source: "post_media", attempts: 1, createdAt: 1, updatedAt: 1 })
      return id
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    transfer.mockResolvedValue({ ok: true, storageId, bytes: 32, contentType: "video/mp4" })

    await t.action(ingest, { route: "direct", egressId: "EG_OURS", filepath: `directs/${sessionId}.mp4`, location: LOCATION })

    const refused = await row(t, sessionId)
    expect(refused?.replayStatus).toBe("failed")
    expect(refused?.replayStorageId).toBeUndefined()
    expect(refused?.replayFailureReason).toBe("upload_refused")
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull()
  })
})
