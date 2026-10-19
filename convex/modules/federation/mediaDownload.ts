"use node"

/** PA9B : octets publics fédérés, téléchargés sans réinterpréter leur destination DNS. */
import { normalizeMimeType, normalizeSha256 } from "@antsia/social-domain/uploadPolicy"
import { createHash } from "node:crypto"
import { resolve4 } from "node:dns/promises"
import type { ClientRequest, IncomingMessage } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"

const MAX_BYTES = 50 * 1024 * 1024
const TIMEOUT_MS = 15_000

type FederatedMediaInput = { url: string; mimeType: string; sizeBytes: number; sha256: string }

function refused(code: string): Error {
  // Aucun détail de transport : une URL source peut contenir une signature temporaire.
  return new Error(`FEDERATED_MEDIA_${code}`)
}

/** Liste conservatrice : aucun espace IPv4 spécial, privé ou réservé n'est une source. */
function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false
  const octets = address.split(".").map(Number)
  const first = octets[0] ?? -1
  const second = octets[1] ?? -1
  const third = octets[2] ?? -1
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false
  if (first === 100 && second >= 64 && second <= 127) return false
  if (first === 169 && second === 254) return false
  if (first === 172 && second >= 16 && second <= 31) return false
  if (first === 192 && ((second === 0 && (third === 0 || third === 2)) || (second === 88 && third === 99) || second === 168)) return false
  if (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) return false
  if (first === 203 && second === 0 && third === 113) return false
  return true
}

/**
 * Ne stocke rien et n'ouvre aucun accès au fichier : l'appelant fait ensuite
 * fraîcheur, admission/scan et rattachement transactionnel. Aucune origine par défaut.
 * IPv6 seul est volontairement indisponible pour cette première version.
 */
export async function downloadFederatedMedia(input: FederatedMediaInput, allowedOrigins: readonly string[]): Promise<Blob> {
  const deadline = Date.now() + TIMEOUT_MS
  let target: URL
  try {
    target = new URL(input.url)
  } catch {
    throw refused("INVALID_URL")
  }
  const authority = /^https:\/\/([^/?#]*)/i.exec(input.url)?.[1]
  if (target.protocol !== "https:" || (target.port !== "" && target.port !== "443") || target.username || target.password
    || !authority || authority.includes("@") || input.url.includes("#") || /[\u0000-\u0020\u007f]/.test(input.url)
    || target.hostname.startsWith("[") || isIP(target.hostname) === 6) throw refused("INVALID_URL")
  if (!allowedOrigins.includes(target.origin)) throw refused("ORIGIN_REFUSED")
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_BYTES) throw refused("SIZE_REFUSED")
  const mimeType = normalizeMimeType(input.mimeType)
  if (!mimeType || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mimeType)) throw refused("MIME_REFUSED")
  const expectedHash = normalizeSha256(input.sha256)
  if (!expectedHash) throw refused("HASH_REFUSED")

  return await new Promise<Blob>((resolve, reject) => {
    let settled = false
    let request: ClientRequest | undefined
    let response: IncomingMessage | undefined
    const chunks: Buffer[] = []
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      response?.destroy()
      request?.destroy()
      chunks.length = 0
      reject(error)
    }
    // Le délai inclut la résolution, la connexion TLS et la totalité du corps.
    const timer = setTimeout(() => fail(refused("TIMEOUT")), Math.max(0, deadline - Date.now()))

    const start = async (): Promise<void> => {
      let addresses: string[]
      try {
        addresses = isIP(target.hostname) === 4 ? [target.hostname] : await resolve4(target.hostname)
      } catch {
        throw refused("DNS_REFUSED")
      }
      if (settled) return
      if (Date.now() >= deadline) return fail(refused("TIMEOUT"))
      if (addresses.length === 0 || addresses.some((address) => !isPublicIpv4(address))) throw refused("ADDRESS_REFUSED")
      const pinnedAddress = addresses[0]
      if (!pinnedAddress) throw refused("DNS_REFUSED")
      const lookup: LookupFunction = (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: pinnedAddress, family: 4 }])
        else callback(null, pinnedAddress, 4)
      }
      request = httpsRequest(target, {
        method: "GET",
        family: 4,
        lookup,
        // Pas de socket réutilisée ni de seconde résolution au moment de connecter.
        agent: false,
        servername: isIP(target.hostname) === 0 ? target.hostname : undefined,
        rejectUnauthorized: true,
        headers: { Accept: mimeType, "Accept-Encoding": "identity" },
      }, (incoming) => {
        response = incoming
        incoming.once("error", () => fail(refused("DOWNLOAD_FAILED")))
        incoming.once("aborted", () => fail(refused("DOWNLOAD_FAILED")))
        incoming.once("close", () => {
          if (!incoming.complete) fail(refused("DOWNLOAD_FAILED"))
        })
        if (settled) {
          incoming.destroy()
          return
        }
        // node:https ne suit aucune redirection : tous les 3xx sont refusés ici.
        if (incoming.statusCode !== 200) return fail(refused("HTTP_REFUSED"))
        const encoding = incoming.headers["content-encoding"]
        if (encoding !== undefined && (typeof encoding !== "string" || encoding.trim().toLowerCase() !== "identity")) return fail(refused("ENCODING_REFUSED"))
        const contentType = incoming.headers["content-type"]
        if (typeof contentType !== "string" || normalizeMimeType(contentType) !== mimeType) return fail(refused("MIME_MISMATCH"))
        const length = incoming.headers["content-length"]
        if (length !== undefined && (!/^\d+$/.test(length) || Number(length) !== input.sizeBytes)) return fail(refused("SIZE_MISMATCH"))

        let bytes = 0
        const hash = createHash("sha256")
        incoming.on("data", (chunk: Buffer) => {
          if (settled) return
          if (!Buffer.isBuffer(chunk)) return fail(refused("DOWNLOAD_FAILED"))
          bytes += chunk.length
          if (bytes > input.sizeBytes || bytes > MAX_BYTES) return fail(refused("SIZE_MISMATCH"))
          hash.update(chunk)
          chunks.push(chunk)
        })
        incoming.once("end", () => {
          if (settled) return
          if (!incoming.complete || bytes !== input.sizeBytes) return fail(refused("SIZE_MISMATCH"))
          if (hash.digest("hex") !== expectedHash) return fail(refused("HASH_MISMATCH"))
          if (Date.now() >= deadline) return fail(refused("TIMEOUT"))
          // Au plus 50 Mio, après toutes les comparaisons avec le contrat signé.
          const blob = new Blob([Buffer.concat(chunks, bytes) as BlobPart], { type: mimeType })
          chunks.length = 0
          settled = true
          clearTimeout(timer)
          resolve(blob)
        })
      })
      request.once("error", () => fail(refused("DOWNLOAD_FAILED")))
      request.end()
    }
    void start().catch((error: unknown) => fail(error instanceof Error && error.message.startsWith("FEDERATED_MEDIA_") ? error : refused("DOWNLOAD_FAILED")))
  })
}
