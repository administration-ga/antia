"use node"
// Dupliqué de socle/convex/lib/egressFileTransfer.ts @ ad2e7fdc2 — adaptations : le plafond vient de `./livekitEgressUploads` (le module de la politique de dépôt des fichiers d'Egress du moteur, usage `live_recording`, même valeur de 4 Go) ; références des commentaires aux modules du moteur ; rien d'autre — les motifs de ce module (`egressFileTransferReason`) restent des phrases d'EXPLOITATION, écrites au journal du serveur : la rediffusion stocke le CODE de l'échec (`replayComposition.directReplayTransferFailureReason`).

/**
 * RAPATRIER un fichier d'Egress LiveKit dans le stockage Convex — EN FLUX.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ (2026-09-17)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le webhook (`convex/http.ts`) et la réconciliation des directs
 * (`modules/live/livekitActions.reconcileDirectEgress`) faisaient `fetch(location)`
 * puis `blob()` et `ctx.storage.store(blob)` : le MP4 ENTIER en mémoire.
 * Limites documentées par Convex : 64 MiB dans le runtime Convex (celui du
 * webhook), 512 MiB dans le runtime Node. Une conférence de quelques minutes
 * dépassait la première ; une conférence longue, la seconde.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI `node:http(s)`, ET PAS `fetch` AVEC UN CORPS EN FLUX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La piste naturelle — `fetch(uploadUrl, { body: response.body, duplex: "half" })`
 * — a été MESURÉE le 2026-09-17 et écartée : sous Node 22.22.3 comme sous
 * 25.9.0, `fetch` RETIENT en mémoire tout ce qu'il envoie (300 Mo retenus pour
 * 300 Mo envoyés, `arrayBuffers` relevés après `gc()`), alors même que la
 * contre-pression est respectée. `http.request` alimenté par `stream.pipeline`
 * reste, lui, sous 40 Mo quelle que soit la taille (mesuré jusqu'à 500 Mo).
 * Le TÉLÉCHARGEMENT reste un `fetch` : sa lecture en flux est bornée (mesuré).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES BORNES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · Documentation Convex (« Uploading files », consultée le 2026-09-17) :
 *    l'URL de dépôt « expires in 1 hour », « the file size is not limited »,
 *    mais « upload POST request has a 2 minute timeout ». Ce délai est le vrai
 *    plafond d'un transfert : le nôtre (110 s) le précède, pour que l'échec
 *    soit DIT à l'hôte plutôt que subi.
 *  · Une taille plafond, 4 Go (environ deux heures au format « télévision »,
 *    4,5 Mbit/s) : refusée AVANT d'ouvrir le dépôt quand la taille est
 *    annoncée, pendant le flux sinon.
 *  · Une longueur annoncée qui ne correspond pas aux octets reçus ANNULE le
 *    dépôt : un fichier tronqué ne devient jamais une rediffusion.
 *    ⚠️ Pas `ClientRequest.strictContentLength` : mesuré, sa vérification LÈVE
 *    depuis `req.end()`, hors de la promesse de `pipeline` — une exception non
 *    rattrapée qui tue le processus. Le contrôle vit dans le `Transform`.
 *
 * Module `"use node"` : il n'est importé QUE par des actions Node. Le runtime
 * Convex (le webhook) se contente de PLANIFIER le rapatriement.
 */
import { request as httpRequest, type IncomingMessage } from "node:http"
import { request as httpsRequest } from "node:https"
import { Readable, Transform, type TransformCallback } from "node:stream"
import { pipeline } from "node:stream/promises"
import { EGRESS_UPLOAD_MAX_BYTES } from "./livekitEgressUploads"

/**
 * 4 Go — au-delà, l'enregistrement n'est pas rapatrié, et on le dit. C'est le
 * plafond de l'usage `live_recording` de la politique de dépôt : le
 * transfert refuse ce que le rattachement refuserait.
 */
export const EGRESS_FILE_MAX_BYTES = EGRESS_UPLOAD_MAX_BYTES

/** Sous les 2 minutes documentées du POST de dépôt Convex. */
export const EGRESS_FILE_TRANSFER_TIMEOUT_MS = 110_000

/** La réponse du dépôt est un petit JSON `{ storageId }` — rien de plus à lire. */
const UPLOAD_RESPONSE_MAX_BYTES = 64 * 1024

/** Borne d'un détail technique affiché à l'hôte. */
const DETAIL_MAX = 200

export type EgressFileTransferFailureCode =
  | "invalid_location"
  | "download_failed"
  | "empty"
  | "too_large"
  | "length_mismatch"
  | "timeout"
  | "upload_failed"

export type EgressFileTransferResult =
  | { ok: true; storageId: string; bytes: number; contentType: string }
  | { ok: false; code: EgressFileTransferFailureCode; reason: string }

/** Envoie un flux Node à une URL de dépôt ; rend le statut et le (petit) corps. */
export type StreamUpload = (
  url: string,
  init: {
    body: Readable
    headers: Record<string, string>
    signal: AbortSignal
  },
) => Promise<{ status: number; body: string }>

export type EgressFileTransferInput = {
  /** `fileResults[].location` de LiveKit — une URL lisible sans secret (présignée). */
  location: string
  /** Le filepath du contrat d'egress : sert de repli pour le type de contenu. */
  filepath?: string
  /**
   * L'URL de dépôt, délivrée selon la politique de dépôt : `egressUploadUrl`
   * (`lib/livekitEgressUploads.ts`), jamais l'API brute.
   */
  generateUploadUrl: () => Promise<string>
  /** Injection pour les tests — défaut : le `fetch` global. */
  fetchImpl?: (url: string, init: { signal: AbortSignal }) => Promise<Response>
  /** Injection pour les tests — défaut : `postStreamToUrl` (`node:http(s)`). */
  upload?: StreamUpload
  maxBytes?: number
  timeoutMs?: number
}

class EgressFileTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super("EGRESS_FILE_TOO_LARGE")
  }
}

class EgressFileLengthMismatchError extends Error {
  constructor(
    readonly bytes: number,
    readonly expected: number,
  ) {
    super("EGRESS_FILE_LENGTH_MISMATCH")
  }
}

class EgressFileEmptyError extends Error {
  constructor() {
    super("EGRESS_FILE_EMPTY")
  }
}

/**
 * Une erreur NÉE du téléchargement. Une erreur traverse tout le tuyau : sans
 * cette étiquette posée à la source, une coupure du dépôt remonterait jusqu'au
 * téléchargement et serait annoncée comme telle — et inversement.
 */
class EgressDownloadError extends Error {
  constructor(readonly original: unknown) {
    super("EGRESS_FILE_DOWNLOAD_FAILED")
  }
}

/**
 * Le corps téléchargé, lu UN morceau à la fois, à la demande du tuyau.
 * Équivalent de `Readable.fromWeb`, dont il reprend la lecture tirée, avec
 * l'étiquette d'origine en plus.
 */
function readableFromDownload(body: ReadableStream<Uint8Array>): Readable {
  const reader = body.getReader()
  return new Readable({
    read() {
      reader.read().then(
        ({ done, value }) => {
          if (done) this.push(null)
          else this.push(value)
        },
        (err: unknown) => this.destroy(new EgressDownloadError(err)),
      )
    },
    destroy(err, callback) {
      reader.cancel().then(
        () => callback(err),
        () => callback(err),
      )
    },
  })
}

/** Taille lisible par l'hôte (base 1024, décimale à la française). */
export function formatEgressBytes(bytes: number): string {
  const units: ReadonlyArray<readonly [string, number]> = [
    ["Go", 1024 ** 3],
    ["Mo", 1024 ** 2],
    ["ko", 1024],
  ]
  const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
  for (const [unit, size] of units) {
    if (bytes >= size) return `${format.format(bytes / size)} ${unit}`
  }
  return `${bytes} octets`
}

/** Le MOTIF d'un échec de rapatriement — une phrase, servie telle quelle. */
export function egressFileTransferReason(
  code: EgressFileTransferFailureCode,
  facts: {
    bytes?: number
    maxBytes?: number
    expected?: number
    detail?: string
    timeoutMs?: number
  } = {},
): string {
  const detail = facts.detail?.trim().slice(0, DETAIL_MAX)
  switch (code) {
    case "invalid_location":
      return "Le fichier d'enregistrement n'a pas pu être récupéré : son adresse est invalide."
    case "download_failed":
      return detail
        ? `Le fichier d'enregistrement n'a pas pu être récupéré (${detail}).`
        : "Le fichier d'enregistrement n'a pas pu être récupéré."
    case "empty":
      return "Le fichier d'enregistrement livré est vide."
    case "too_large":
      return `L'enregistrement est trop volumineux pour être rapatrié (${formatEgressBytes(
        facts.bytes ?? 0,
      )} ; plafond ${formatEgressBytes(facts.maxBytes ?? EGRESS_FILE_MAX_BYTES)}).`
    case "length_mismatch":
      return `Le fichier d'enregistrement est arrivé incomplet (${formatEgressBytes(
        facts.bytes ?? 0,
      )} reçus sur ${formatEgressBytes(facts.expected ?? 0)}).`
    case "timeout":
      return `Le rapatriement de l'enregistrement a dépassé ${Math.round(
        (facts.timeoutMs ?? EGRESS_FILE_TRANSFER_TIMEOUT_MS) / 1000,
      )} s et a été interrompu.`
    case "upload_failed":
      return detail
        ? `Le stockage n'a pas accepté l'enregistrement (${detail}).`
        : "Le stockage n'a pas accepté l'enregistrement."
  }
}

/**
 * Le type de contenu à déclarer au dépôt : celui de la source s'il dit
 * quelque chose, sinon celui qu'implique le filepath du contrat d'egress.
 */
export function egressFileContentType(
  header: string | null | undefined,
  filepath?: string,
): string {
  const declared = header?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (
    declared.length > 0 &&
    declared !== "application/octet-stream" &&
    declared !== "binary/octet-stream"
  ) {
    return declared
  }
  const path = filepath?.toLowerCase() ?? ""
  if (path.endsWith(".mp4")) return "video/mp4"
  if (path.endsWith(".ogg")) return "audio/ogg"
  return declared.length > 0 ? declared : "application/octet-stream"
}

/** `Content-Length` exploitable, ou `undefined` (absent, illisible, hors borne). */
export function parseEgressContentLength(
  header: string | null | undefined,
): number | undefined {
  const raw = header?.trim() ?? ""
  if (!/^\d+$/.test(raw)) return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : undefined
}

function describeTransferError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    const causeCode =
      typeof cause === "object" && cause !== null && "code" in cause
        ? String((cause as { code: unknown }).code)
        : undefined
    return causeCode ? `${err.message} : ${causeCode}` : err.message
  }
  return String(err)
}

/**
 * Compte les octets qui PASSENT, et arrête le tuyau dès qu'ils dépassent le
 * plafond ou la longueur annoncée — ou qu'il en manque à la fin.
 */
function byteGuard(
  maxBytes: number,
  expected: number | undefined,
): { stream: Transform; bytes: () => number } {
  let bytes = 0
  const stream = new Transform({
    transform(chunk: Uint8Array, _encoding: BufferEncoding, callback: TransformCallback) {
      bytes += chunk.byteLength
      if (bytes > maxBytes) {
        callback(new EgressFileTooLargeError(bytes))
        return
      }
      if (expected !== undefined && bytes > expected) {
        callback(new EgressFileLengthMismatchError(bytes, expected))
        return
      }
      callback(null, chunk)
    },
    flush(callback: TransformCallback) {
      if (bytes === 0) {
        callback(new EgressFileEmptyError())
        return
      }
      if (expected !== undefined && bytes !== expected) {
        callback(new EgressFileLengthMismatchError(bytes, expected))
        return
      }
      callback()
    },
  })
  return { stream, bytes: () => bytes }
}

function readBounded(stream: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    stream.on("data", (chunk: Buffer) => {
      if (size < maxBytes) chunks.push(chunk.subarray(0, maxBytes - size))
      size += chunk.length
    })
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    stream.on("error", reject)
  })
}

/**
 * POST en flux par `node:http(s)` — la seule voie mesurée comme bornée en
 * mémoire (voir l'en-tête). `http:` n'existe que pour les tests locaux :
 * l'URL de dépôt Convex est toujours `https:`.
 */
export const postStreamToUrl: StreamUpload = (url, init) =>
  new Promise((resolve, reject) => {
    let target: URL
    try {
      target = new URL(url)
    } catch (err) {
      reject(err)
      return
    }
    const send = target.protocol === "http:" ? httpRequest : httpsRequest
    const request = send(
      target,
      { method: "POST", headers: init.headers, signal: init.signal },
      (response) => {
        readBounded(response, UPLOAD_RESPONSE_MAX_BYTES).then(
          (body) => resolve({ status: response.statusCode ?? 0, body }),
          reject,
        )
      },
    )
    request.on("error", reject)
    pipeline(init.body, request).catch(reject)
  })

function readStorageId(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === "object" && parsed !== null) {
      const storageId = (parsed as { storageId?: unknown }).storageId
      if (typeof storageId === "string" && storageId.length > 0) return storageId
    }
  } catch {
    // Corps illisible : traité comme un dépôt sans identifiant, ci-dessous.
  }
  return undefined
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // Rien à sauver : on abandonne un corps que personne ne lira.
  }
}

function failure(
  code: EgressFileTransferFailureCode,
  facts?: Parameters<typeof egressFileTransferReason>[1],
): EgressFileTransferResult {
  return { ok: false, code, reason: egressFileTransferReason(code, facts) }
}

/** L'échec porté par une erreur du tuyau, s'il en est un que l'on sait nommer. */
function guardFailure(
  err: unknown,
  maxBytes: number,
): EgressFileTransferResult | undefined {
  if (err instanceof EgressFileTooLargeError) {
    return failure("too_large", { bytes: err.bytes, maxBytes })
  }
  if (err instanceof EgressFileLengthMismatchError) {
    return failure("length_mismatch", { bytes: err.bytes, expected: err.expected })
  }
  if (err instanceof EgressFileEmptyError) return failure("empty")
  return undefined
}

/**
 * Télécharge `location` et le dépose dans le stockage Convex SANS jamais
 * charger le fichier en mémoire. Ne lève pas : tout échec rend un motif.
 */
export async function transferEgressFileToStorage(
  input: EgressFileTransferInput,
): Promise<EgressFileTransferResult> {
  const maxBytes = input.maxBytes ?? EGRESS_FILE_MAX_BYTES
  const timeoutMs = input.timeoutMs ?? EGRESS_FILE_TRANSFER_TIMEOUT_MS
  const download = input.fetchImpl ?? ((url, init) => fetch(url, init))
  const upload = input.upload ?? postStreamToUrl

  let target: URL
  try {
    target = new URL(input.location)
  } catch {
    return failure("invalid_location")
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return failure("invalid_location")
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    let response: Response
    try {
      response = await download(target.toString(), { signal: controller.signal })
    } catch (err) {
      return timedOut
        ? failure("timeout", { timeoutMs })
        : failure("download_failed", { detail: describeTransferError(err) })
    }
    if (!response.ok) {
      await discardBody(response)
      return failure("download_failed", { detail: `HTTP ${response.status}` })
    }
    if (response.body === null) return failure("empty")

    const declared = parseEgressContentLength(response.headers.get("content-length"))
    if (declared === 0) {
      await discardBody(response)
      return failure("empty")
    }
    if (declared !== undefined && declared > maxBytes) {
      // Refus AVANT d'ouvrir le dépôt : rien n'a été transféré.
      await discardBody(response)
      return failure("too_large", { bytes: declared, maxBytes })
    }
    const contentType = egressFileContentType(
      response.headers.get("content-type"),
      input.filepath,
    )

    let uploadUrl: string
    try {
      uploadUrl = await input.generateUploadUrl()
    } catch (err) {
      await discardBody(response)
      return failure("upload_failed", { detail: describeTransferError(err) })
    }

    const guard = byteGuard(maxBytes, declared)
    // Deux moitiés d'un même tuyau : la contre-pression du dépôt remonte
    // jusqu'au téléchargement, et aucune moitié ne garde le fichier.
    const source = readableFromDownload(response.body)
    // Le signal borne AUSSI l'alimentation : au délai, les deux moitiés tombent.
    const feeding: Promise<unknown> = pipeline(source, guard.stream, {
      signal: controller.signal,
    }).then(
      () => undefined,
      (err: unknown) => err,
    )

    let uploaded: { status: number; body: string } | undefined
    let uploadError: unknown
    try {
      uploaded = await upload(uploadUrl, {
        body: guard.stream,
        headers: {
          "Content-Type": contentType,
          ...(declared !== undefined ? { "Content-Length": String(declared) } : {}),
        },
        signal: controller.signal,
      })
    } catch (err) {
      uploadError = err
    }
    const accepted =
      uploaded !== undefined && uploaded.status >= 200 && uploaded.status < 300
    if (!accepted) {
      // Un dépôt refusé ou rompu ne doit laisser aucun tuyau suspendu.
      source.destroy()
      guard.stream.destroy()
    }
    const feedError = await feeding

    if (timedOut) return failure("timeout", { timeoutMs })
    const named = guardFailure(feedError, maxBytes) ?? guardFailure(uploadError, maxBytes)
    if (named !== undefined) return named
    const downloadError = [feedError, uploadError].find(
      (err): err is EgressDownloadError => err instanceof EgressDownloadError,
    )
    if (downloadError !== undefined) {
      return failure("download_failed", {
        detail: describeTransferError(downloadError.original),
      })
    }
    if (uploadError !== undefined) {
      return failure("upload_failed", { detail: describeTransferError(uploadError) })
    }
    if (uploaded === undefined || !accepted) {
      return failure("upload_failed", { detail: `HTTP ${uploaded?.status ?? 0}` })
    }
    if (feedError !== undefined) {
      return failure("upload_failed", { detail: describeTransferError(feedError) })
    }
    const storageId = readStorageId(uploaded.body)
    if (storageId === undefined) {
      return failure("upload_failed", {
        detail: "réponse sans identifiant de fichier",
      })
    }
    return { ok: true, storageId, bytes: guard.bytes(), contentType }
  } finally {
    clearTimeout(timer)
  }
}
