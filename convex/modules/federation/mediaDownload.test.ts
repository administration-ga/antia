/** PA9B : scénarios écrits ; aucune requête externe et aucun scan dans ces tests unitaires. */
import { createHash } from "node:crypto"
import { EventEmitter } from "node:events"
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "node:http"
import type { RequestOptions } from "node:https"
import { PassThrough } from "node:stream"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const transport = vi.hoisted(() => ({
  resolve4: vi.fn<(hostname: string) => Promise<string[]>>(),
  request: vi.fn<(url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest>(),
}))
vi.mock("node:dns/promises", () => ({ resolve4: transport.resolve4 }))
vi.mock("node:https", () => ({ request: transport.request }))

import { downloadFederatedMedia } from "./mediaDownload"

const ORIGIN = "https://media.example"
const BODY = Buffer.from("public signed media")
const input = {
  url: `${ORIGIN}/public/image.png?signature=temporary`,
  mimeType: "image/png",
  sizeBytes: BODY.length,
  sha256: createHash("sha256").update(BODY).digest("hex"),
}

function reply(args: { status?: number; headers?: IncomingHttpHeaders; chunks?: Buffer[]; stall?: boolean } = {}) {
  const response = Object.assign(new PassThrough(), {
    statusCode: args.status ?? 200,
    headers: args.headers ?? { "content-type": "image/png", "content-length": String(BODY.length) },
    complete: false,
  })
  const destroy = vi.fn()
  transport.request.mockImplementation((_url, _options, callback) => {
    const request = Object.assign(new EventEmitter(), {
      destroy,
      end: vi.fn(() => {
        void Promise.resolve().then(() => {
          callback(response as unknown as IncomingMessage)
          if (response.destroyed || args.stall) return
          for (const chunk of args.chunks ?? [BODY]) {
            if (response.destroyed) break
            response.write(chunk)
          }
          response.complete = true
          if (!response.destroyed) response.end()
        })
      }),
    })
    return request as unknown as ClientRequest
  })
  return { response, destroy }
}

beforeEach(() => {
  transport.resolve4.mockReset().mockResolvedValue(["93.184.216.34"])
  transport.request.mockReset()
  reply()
})
afterEach(() => vi.useRealTimers())

describe("federation/mediaDownload — destination", () => {
  it("épingle la connexion à l'IPv4 validée, conserve le nom TLS et n'envoie aucun secret", async () => {
    const blob = await downloadFederatedMedia(input, [ORIGIN])
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(BODY)
    expect(blob.type).toBe("image/png")
    expect(transport.resolve4).toHaveBeenCalledExactlyOnceWith("media.example")
    const call = transport.request.mock.calls[0]
    expect(call).toBeDefined()
    const options = call?.[1]
    expect(options).toMatchObject({ family: 4, agent: false, servername: "media.example", rejectUnauthorized: true, headers: { Accept: "image/png", "Accept-Encoding": "identity" } })
    expect(options?.auth).toBeUndefined()
    expect(options?.headers).not.toHaveProperty("Cookie")
    expect(options?.headers).not.toHaveProperty("Authorization")
    const callback = vi.fn()
    options?.lookup?.("media.example", { family: 4 }, callback)
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4)
    const all = vi.fn()
    options?.lookup?.("media.example", { family: 4, all: true }, all)
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }])
    expect(transport.resolve4).toHaveBeenCalledTimes(1)
  })

  it.each([
    "http://media.example/public/image.png",
    "https://media.example:444/public/image.png",
    "https://user:password@media.example/public/image.png",
    "https://@media.example/public/image.png",
    "https://media.example/public/image.png#fragment",
    "https://media.example/public/image.png#",
    " https://media.example/public/image.png",
    "https://[2606:4700:4700::1111]/public/image.png",
  ])("refuse la forme d'URL %s avant le réseau", async (url) => {
    await expect(downloadFederatedMedia({ ...input, url }, [ORIGIN, "https://[2606:4700:4700::1111]"])).rejects.toThrow("FEDERATED_MEDIA_INVALID_URL")
    expect(transport.resolve4).not.toHaveBeenCalled()
    expect(transport.request).not.toHaveBeenCalled()
  })

  it.each([
    { origins: [] },
    { origins: ["https://example"] },
    { origins: ["https://media.example.evil"] },
    { origins: [`${ORIGIN}/`] },
    { origins: ["http://media.example"] },
  ])("exige l'origine exacte explicitement autorisée ($origins)", async ({ origins }) => {
    await expect(downloadFederatedMedia(input, origins)).rejects.toThrow("FEDERATED_MEDIA_ORIGIN_REFUSED")
    expect(transport.resolve4).not.toHaveBeenCalled()
    expect(transport.request).not.toHaveBeenCalled()
  })

  it.each([
    "0.0.0.0", "0.1.2.3", "10.1.2.3", "100.64.0.1", "100.127.255.254", "127.0.0.1",
    "169.254.169.254", "172.16.0.1", "172.31.255.254", "192.0.0.1", "192.0.2.1",
    "192.88.99.1", "192.168.1.1", "198.18.0.1", "198.19.255.254", "198.51.100.1",
    "203.0.113.1", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
    "::1", "::ffff:127.0.0.1", "not-an-address",
  ])("refuse une résolution non publique : %s", async (address) => {
    transport.resolve4.mockResolvedValue([address])
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_ADDRESS_REFUSED")
    expect(transport.request).not.toHaveBeenCalled()
  })

  it("refuse un résultat DNS mixte même si sa première adresse est publique", async () => {
    transport.resolve4.mockResolvedValue(["93.184.216.34", "10.0.0.1"])
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_ADDRESS_REFUSED")
    expect(transport.request).not.toHaveBeenCalled()
  })

  it("refuse une résolution sans IPv4, sans repli AAAA", async () => {
    transport.resolve4.mockResolvedValue([])
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_ADDRESS_REFUSED")
    transport.resolve4.mockRejectedValue(new Error("ENODATA"))
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_DNS_REFUSED")
    expect(transport.request).not.toHaveBeenCalled()
  })

  it("refuse aussi une IPv4 privée littérale, sans passer par le DNS", async () => {
    await expect(downloadFederatedMedia({ ...input, url: "https://127.0.0.1/file" }, ["https://127.0.0.1"])).rejects.toThrow("FEDERATED_MEDIA_ADDRESS_REFUSED")
    expect(transport.resolve4).not.toHaveBeenCalled()
    expect(transport.request).not.toHaveBeenCalled()
  })
})

describe("federation/mediaDownload — octets signés", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 50 * 1024 * 1024 + 1])("refuse la taille signée %s avant le réseau", async (sizeBytes) => {
    await expect(downloadFederatedMedia({ ...input, sizeBytes }, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_SIZE_REFUSED")
    expect(transport.request).not.toHaveBeenCalled()
    expect(transport.resolve4).not.toHaveBeenCalled()
  })

  it("refuse une empreinte invalide avant le réseau", async () => {
    await expect(downloadFederatedMedia({ ...input, sha256: "untrusted" }, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_HASH_REFUSED")
    expect(transport.request).not.toHaveBeenCalled()
  })

  it.each([201, 206, 301, 302, 307, 308, 404, 500])("refuse HTTP %s sans redirection", async (status) => {
    const current = reply({ status, headers: { location: "https://127.0.0.1/private" } })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_HTTP_REFUSED")
    expect(transport.request).toHaveBeenCalledTimes(1)
    expect(current.response.destroyed).toBe(true)
  })

  it.each(["gzip", "br", "deflate", "gzip, identity", ""])("refuse l'encodage %s", async (encoding) => {
    reply({ headers: { "content-type": "image/png", "content-encoding": encoding } })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_ENCODING_REFUSED")
  })

  it.each([undefined, "text/html", "image/jpeg", "application/octet-stream"])("exige le MIME attendu, reçu %s", async (mimeType) => {
    reply({ headers: { "content-type": mimeType } })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_MIME_MISMATCH")
  })

  it("normalise les paramètres et la casse du MIME sans modifier les octets", async () => {
    reply({ headers: { "content-type": "IMAGE/PNG; charset=binary", "content-encoding": "Identity" } })
    const blob = await downloadFederatedMedia({ ...input, mimeType: "IMAGE/PNG" }, [ORIGIN])
    expect(blob.type).toBe("image/png")
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(BODY)
  })

  it.each(["0", "1", String(BODY.length + 1), "invalid", "1.5", "99999999999999999999"])("refuse Content-Length %s", async (length) => {
    reply({ headers: { "content-type": "image/png", "content-length": length } })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_SIZE_MISMATCH")
  })

  it("compte les octets sans Content-Length et accepte plusieurs morceaux exacts", async () => {
    reply({ headers: { "content-type": "image/png" }, chunks: [BODY.subarray(0, 3), BODY.subarray(3)] })
    expect((await downloadFederatedMedia(input, [ORIGIN])).size).toBe(BODY.length)
  })

  it("coupe le flux dès qu'il dépasse la taille signée", async () => {
    const current = reply({ headers: { "content-type": "image/png" }, chunks: [BODY, Buffer.from("extra")] })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_SIZE_MISMATCH")
    expect(current.response.destroyed).toBe(true)
    expect(current.destroy).toHaveBeenCalled()
  })

  it.each([{ chunks: [] }, { chunks: [BODY.subarray(0, BODY.length - 1)] }])("refuse un corps vide ou tronqué", async ({ chunks }) => {
    reply({ headers: { "content-type": "image/png" }, chunks })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_SIZE_MISMATCH")
  })

  it("refuse la même taille avec des octets différents", async () => {
    reply({ chunks: [Buffer.alloc(BODY.length, 42)] })
    await expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_HASH_MISMATCH")
  })

  it("borne à quinze secondes une résolution DNS suspendue", async () => {
    vi.useFakeTimers()
    transport.resolve4.mockImplementation(() => new Promise<string[]>(() => {}))
    const pending = expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_TIMEOUT")
    await vi.advanceTimersByTimeAsync(15_000)
    await pending
    expect(transport.request).not.toHaveBeenCalled()
  })

  it("borne à quinze secondes un corps suspendu et ferme le transport", async () => {
    vi.useFakeTimers()
    const current = reply({ stall: true })
    const pending = expect(downloadFederatedMedia(input, [ORIGIN])).rejects.toThrow("FEDERATED_MEDIA_TIMEOUT")
    await vi.advanceTimersByTimeAsync(15_000)
    await pending
    expect(current.response.destroyed).toBe(true)
    expect(current.destroy).toHaveBeenCalled()
  })
})
