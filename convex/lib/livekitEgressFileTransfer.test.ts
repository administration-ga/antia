// Dupliqué de socle/convex/lib/egressFileTransfer.test.ts @ ad2e7fdc2 — adaptations : module importé sous son nom du moteur (`./livekitEgressFileTransfer`) et référence du commentaire d'en-tête ; les seize cas portés tels quels.
/**
 * Le rapatriement d'un fichier d'Egress PASSE EN FLUX — correctif du 2026-09-17.
 *
 * Environnement `node` (défaut du projet) : le dépôt est un VRAI serveur HTTP
 * local, joint par le chemin de production (`postStreamToUrl`, `node:http`), et
 * la source est une `Response` dont TOUTES les lectures intégrales (`blob()`,
 * `arrayBuffer()`, `text()`…) lèvent. Un transfert qui chargerait le fichier
 * en mémoire échouerait donc ici, au lieu de passer inaperçu jusqu'à la
 * première conférence longue.
 *
 * La borne MÉMOIRE elle-même ne se prouve pas dans un test unitaire : elle a
 * été mesurée à part (voir l'en-tête de `livekitEgressFileTransfer.ts`).
 */
import { createHash } from "node:crypto"
import http from "node:http"
import type { AddressInfo } from "node:net"
import { Readable } from "node:stream"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  EGRESS_FILE_MAX_BYTES,
  egressFileContentType,
  egressFileTransferReason,
  formatEgressBytes,
  parseEgressContentLength,
  transferEgressFileToStorage,
  type StreamUpload,
} from "./livekitEgressFileTransfer"

const LOCATION = "https://storage.test/egress/directs/session.mp4?X-Goog-Signature=abc"

type UploadRecord = {
  headers: http.IncomingHttpHeaders
  bytes: number
  sha256: string
  completed: boolean
}

const servers: http.Server[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  )
})

/** Un dépôt local qui compte et empreinte ce qu'il REÇOIT. */
async function uploadServer(
  respond: (record: UploadRecord) => { status: number; body: string } = () => ({
    status: 200,
    body: JSON.stringify({ storageId: "kg2storage" }),
  }),
): Promise<{ url: string; records: UploadRecord[] }> {
  const records: UploadRecord[] = []
  const server = http.createServer((req, res) => {
    const hash = createHash("sha256")
    const record: UploadRecord = { headers: req.headers, bytes: 0, sha256: "", completed: false }
    records.push(record)
    req.on("data", (chunk: Buffer) => {
      record.bytes += chunk.length
      hash.update(chunk)
    })
    req.on("end", () => {
      record.completed = true
      record.sha256 = hash.digest("hex")
      const reply = respond(record)
      res.writeHead(reply.status, { "Content-Type": "application/json" })
      res.end(reply.body)
    })
    req.on("error", () => {
      // Requête interrompue par le client : c'est précisément ce qu'on teste.
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}/api/storage/upload?token=t`, records }
}

function chunksOf(count: number, size: number): Uint8Array[] {
  return Array.from({ length: count }, (_, index) => new Uint8Array(size).fill(index % 251))
}

function sha256Of(chunks: Uint8Array[]): string {
  const hash = createHash("sha256")
  for (const chunk of chunks) hash.update(chunk)
  return hash.digest("hex")
}

/**
 * Une source qui livre ses morceaux À LA DEMANDE et interdit toute lecture
 * intégrale. `pulled()` dit combien de morceaux ont été tirés jusqu'ici.
 */
function streamingSource(
  chunks: Uint8Array[],
  init: { status?: number; headers?: Record<string, string>; stallAfter?: number } = {},
): { response: Response; pulled: () => number; wholeBodyReads: () => number } {
  let pulled = 0
  let wholeBodyReads = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (init.stallAfter !== undefined && pulled >= init.stallAfter) {
        return new Promise<void>(() => {
          // Le serveur de stockage ne livre plus rien.
        })
      }
      const next = chunks[pulled]
      if (next === undefined) {
        controller.close()
        return
      }
      pulled += 1
      controller.enqueue(next)
    },
  })
  const response = new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  })
  for (const method of ["arrayBuffer", "blob", "text", "json", "formData"] as const) {
    Object.defineProperty(response, method, {
      value: () => {
        wholeBodyReads += 1
        throw new Error(`${method}() interdit : le fichier doit passer en flux`)
      },
    })
  }
  return { response, pulled: () => pulled, wholeBodyReads: () => wholeBodyReads }
}

describe("le fichier passe EN FLUX jusqu'au dépôt", () => {
  it("arrive octet pour octet, avec Content-Type et Content-Length, sans lecture intégrale", async () => {
    const chunks = chunksOf(32, 64 * 1024)
    const total = 32 * 64 * 1024
    const source = streamingSource(chunks, {
      headers: { "content-type": "video/mp4", "content-length": String(total) },
    })
    const depot = await uploadServer()
    const fetchImpl = vi.fn(async () => source.response)

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      filepath: "directs/session.mp4",
      generateUploadUrl: async () => depot.url,
      fetchImpl,
    })

    expect(result).toEqual({
      ok: true,
      storageId: "kg2storage",
      bytes: total,
      contentType: "video/mp4",
    })
    expect(fetchImpl).toHaveBeenCalledWith(LOCATION, { signal: expect.any(AbortSignal) })
    expect(source.wholeBodyReads()).toBe(0)
    expect(depot.records).toHaveLength(1)
    const [record] = depot.records
    expect(record?.completed).toBe(true)
    expect(record?.bytes).toBe(total)
    expect(record?.sha256).toBe(sha256Of(chunks))
    expect(record?.headers["content-type"]).toBe("video/mp4")
    // Longueur FIXE annoncée : pas de corps fragmenté vers le stockage Convex.
    expect(record?.headers["content-length"]).toBe(String(total))
    expect(record?.headers["transfer-encoding"]).toBeUndefined()
  })

  it("au premier morceau reçu par le dépôt, la source n'a PAS été lue en entier", async () => {
    const chunks = chunksOf(32, 64 * 1024)
    const source = streamingSource(chunks, {
      headers: { "content-length": String(32 * 64 * 1024) },
    })
    let pulledAtFirstChunk: number | undefined
    let receivedBody: unknown
    const upload: StreamUpload = async (_url, init) => {
      receivedBody = init.body
      for await (const _chunk of init.body) {
        pulledAtFirstChunk ??= source.pulled()
      }
      return { status: 200, body: JSON.stringify({ storageId: "kg2storage" }) }
    }

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => "https://convex.test/api/storage/upload",
      fetchImpl: async () => source.response,
      upload,
    })

    expect(result.ok).toBe(true)
    // Le dépôt reçoit un FLUX Node, pas un tampon ni un Blob.
    expect(receivedBody).toBeInstanceOf(Readable)
    // Contre-pression : la lecture de la source suit le dépôt au lieu de le précéder.
    expect(pulledAtFirstChunk).toBeDefined()
    expect(pulledAtFirstChunk!).toBeLessThan(chunks.length / 2)
  })

  it("sans type déclaré par la source, le type suit le contrat de filepath", async () => {
    const chunks = chunksOf(2, 1024)
    const source = streamingSource(chunks, {
      headers: { "content-type": "application/octet-stream", "content-length": "2048" },
    })
    const depot = await uploadServer()
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      filepath: "voicemails/vm.ogg",
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
    })
    expect(result).toMatchObject({ ok: true, contentType: "audio/ogg" })
    expect(depot.records[0]?.headers["content-type"]).toBe("audio/ogg")
  })
})

describe("les bornes : taille, longueur, délai — et le motif DIT", () => {
  it("une taille ANNONCÉE au-delà du plafond est refusée avant d'ouvrir le dépôt", async () => {
    const source = streamingSource(chunksOf(4, 1024), {
      headers: { "content-length": String(5 * 1024 ** 3) },
    })
    const generateUploadUrl = vi.fn(async () => "https://convex.test/upload")
    const upload = vi.fn<StreamUpload>()

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl,
      fetchImpl: async () => source.response,
      upload,
    })

    expect(result).toEqual({
      ok: false,
      code: "too_large",
      reason: "L'enregistrement est trop volumineux pour être rapatrié (5 Go ; plafond 4 Go).",
    })
    expect(generateUploadUrl).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    // Un `ReadableStream` remplit sa file d'UN morceau dès sa création : rien
    // n'a été lu au-delà.
    expect(source.pulled()).toBeLessThanOrEqual(1)
  })

  it("sans taille annoncée, le plafond COUPE le flux en cours de route", async () => {
    const source = streamingSource(chunksOf(10, 1024))
    const depot = await uploadServer()

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
      maxBytes: 4 * 1024,
    })

    expect(result).toMatchObject({ ok: false, code: "too_large" })
    // Le dépôt n'a jamais reçu de requête COMPLÈTE : aucun fichier n'est né.
    expect(depot.records.every((record) => !record.completed)).toBe(true)
    expect(source.pulled()).toBeLessThan(10)
  })

  it("un fichier TRONQUÉ (moins d'octets qu'annoncé) n'est jamais déposé", async () => {
    const source = streamingSource(chunksOf(3, 1024), {
      headers: { "content-length": String(8 * 1024) },
    })
    const depot = await uploadServer()

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
    })

    expect(result).toEqual({
      ok: false,
      code: "length_mismatch",
      reason: "Le fichier d'enregistrement est arrivé incomplet (3 ko reçus sur 8 ko).",
    })
    expect(depot.records.every((record) => !record.completed)).toBe(true)
  })

  it("un délai dépassé interrompt le transfert et le DIT", async () => {
    const source = streamingSource(chunksOf(8, 1024), {
      headers: { "content-length": String(8 * 1024) },
      stallAfter: 2,
    })
    const depot = await uploadServer()

    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
      timeoutMs: 150,
    })

    expect(result).toMatchObject({ ok: false, code: "timeout" })
    expect(depot.records.every((record) => !record.completed)).toBe(true)
  })

  it("un fichier vide n'est pas une rediffusion", async () => {
    const source = streamingSource([], { headers: { "content-length": "0" } })
    const generateUploadUrl = vi.fn(async () => "https://convex.test/upload")
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl,
      fetchImpl: async () => source.response,
    })
    expect(result).toMatchObject({ ok: false, code: "empty" })
    expect(generateUploadUrl).not.toHaveBeenCalled()
  })
})

describe("les refus des deux bouts sont nommés", () => {
  it("un refus HTTP de la source (URL présignée expirée) est DIT, sans ouvrir le dépôt", async () => {
    const source = streamingSource([], { status: 403 })
    const generateUploadUrl = vi.fn(async () => "https://convex.test/upload")
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl,
      fetchImpl: async () => source.response,
    })
    expect(result).toEqual({
      ok: false,
      code: "download_failed",
      reason: "Le fichier d'enregistrement n'a pas pu être récupéré (HTTP 403).",
    })
    expect(generateUploadUrl).not.toHaveBeenCalled()
  })

  it("une source injoignable est DITE avec sa cause", async () => {
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => "https://convex.test/upload",
      fetchImpl: async () => {
        // Forme d'une erreur de `fetch` (undici) : la cause porte le code système.
        throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })
      },
    })
    expect(result).toEqual({
      ok: false,
      code: "download_failed",
      reason: "Le fichier d'enregistrement n'a pas pu être récupéré (fetch failed : ENOTFOUND).",
    })
  })

  it("un dépôt refusé par le stockage est DIT", async () => {
    const source = streamingSource(chunksOf(2, 1024), {
      headers: { "content-length": "2048" },
    })
    const depot = await uploadServer(() => ({ status: 500, body: "boom" }))
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
    })
    expect(result).toEqual({
      ok: false,
      code: "upload_failed",
      reason: "Le stockage n'a pas accepté l'enregistrement (HTTP 500).",
    })
  })

  it("un dépôt qui ne rend pas d'identifiant de fichier est un échec", async () => {
    const source = streamingSource(chunksOf(1, 512), { headers: { "content-length": "512" } })
    const depot = await uploadServer(() => ({ status: 200, body: "{}" }))
    const result = await transferEgressFileToStorage({
      location: LOCATION,
      generateUploadUrl: async () => depot.url,
      fetchImpl: async () => source.response,
    })
    expect(result).toMatchObject({ ok: false, code: "upload_failed" })
  })

  it("une adresse qui n'est ni http ni https n'est jamais lue", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret"))
    const result = await transferEgressFileToStorage({
      location: "file:///etc/passwd",
      generateUploadUrl: async () => "https://convex.test/upload",
      fetchImpl,
    })
    expect(result).toMatchObject({ ok: false, code: "invalid_location" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe("règles pures", () => {
  it("le type de contenu : la source d'abord, le filepath en repli", () => {
    expect(egressFileContentType("video/mp4; codecs=avc1", "x.ogg")).toBe("video/mp4")
    expect(egressFileContentType("binary/octet-stream", "directs/a.mp4")).toBe("video/mp4")
    expect(egressFileContentType(null, "meetings/t.ogg")).toBe("audio/ogg")
    expect(egressFileContentType(undefined, "autre.bin")).toBe("application/octet-stream")
  })

  it("Content-Length : un entier sûr, ou rien", () => {
    expect(parseEgressContentLength("1048576")).toBe(1_048_576)
    expect(parseEgressContentLength(" 12 ")).toBe(12)
    expect(parseEgressContentLength("-1")).toBeUndefined()
    expect(parseEgressContentLength("1e9")).toBeUndefined()
    expect(parseEgressContentLength("99999999999999999999")).toBeUndefined()
    expect(parseEgressContentLength(null)).toBeUndefined()
  })

  it("les tailles se lisent à la française, et le plafond est de 4 Go", () => {
    expect(EGRESS_FILE_MAX_BYTES).toBe(4 * 1024 ** 3)
    expect(formatEgressBytes(512)).toBe("512 octets")
    expect(formatEgressBytes(1536)).toBe("1,5 ko")
    expect(formatEgressBytes(4 * 1024 ** 3)).toBe("4 Go")
    expect(egressFileTransferReason("timeout", { timeoutMs: 110_000 })).toBe(
      "Le rapatriement de l'enregistrement a dépassé 110 s et a été interrompu.",
    )
  })
})
