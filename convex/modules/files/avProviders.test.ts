// Dupliqué de socle/convex/modules/fileGuard/avProviders.test.ts @ ad2e7fdc2 — adaptations : sélection FAIL-CLOSED (fournisseur absent, inconnu, incomplet ou mock hors développement local → fournisseur indisponible, verdict `error`) ; le reste tel quel.
import { describe, expect, it, vi } from "vitest"

import {
  ClamAvRestProvider,
  EICAR_SIGNATURE,
  getFileScanProvider,
  MockFileScanProvider,
  parseClamAvResponse,
  UnavailableFileScanProvider,
} from "./avProviders"

const enc = new TextEncoder()
const LOCAL = { CONVEX_CLOUD_URL: "http://127.0.0.1:3210" }

describe("files/avProviders — mock", () => {
  it("reconnaît EICAR et rend sain le reste", async () => {
    const mock = new MockFileScanProvider()
    const infected = await mock.scan({ bytes: enc.encode(`x${EICAR_SIGNATURE}y`), filename: "e.txt", mimeType: "text/plain" })
    expect(infected).toMatchObject({ provider: "mock", verdict: "infected", signature: "Eicar-Test-Signature" })
    const clean = await mock.scan({ bytes: enc.encode("%PDF-1.4"), filename: "a.pdf", mimeType: "application/pdf" })
    expect(clean.verdict).toBe("clean")
  })
})

describe("files/avProviders — lecture des réponses ClamAV", () => {
  it("lit les deux dialectes JSON et le texte de clamdscan", () => {
    expect(parseClamAvResponse('[{"Status":"FOUND","Description":"Win.Test.EICAR_HDB-1","FileName":"x"}]')).toMatchObject({ verdict: "infected", signature: "Win.Test.EICAR_HDB-1" })
    expect(parseClamAvResponse('[{"Status":"OK","FileName":"x"}]')).toMatchObject({ verdict: "clean" })
    expect(parseClamAvResponse('{"success":true,"data":{"result":[{"name":"x","is_infected":true,"viruses":["Eicar-Test-Signature"]}]}}')).toMatchObject({ verdict: "infected", signature: "Eicar-Test-Signature" })
    expect(parseClamAvResponse('{"success":true,"data":{"result":[{"name":"x","is_infected":false,"viruses":[]}]}}')).toMatchObject({ verdict: "clean" })
    expect(parseClamAvResponse("stream: Eicar-Test-Signature FOUND")).toMatchObject({ verdict: "infected", signature: "Eicar-Test-Signature" })
    expect(parseClamAvResponse("stream: OK")).toMatchObject({ verdict: "clean" })
    expect(parseClamAvResponse("")).toMatchObject({ verdict: "error" })
    expect(parseClamAvResponse('{"weird":true}')).toMatchObject({ verdict: "error" })
  })
})

describe("files/avProviders — adaptateur REST", () => {
  const request = { bytes: enc.encode("%PDF-1.4"), filename: "a.pdf", mimeType: "application/pdf" }

  it("envoie le fichier en multipart avec le jeton, et lit le verdict", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST")
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer s3cret")
      expect(init?.body).toBeInstanceOf(FormData)
      return new Response('[{"Status":"OK"}]', { status: 200 })
    })
    const provider = new ClamAvRestProvider({ url: "https://av.local/scan", token: "s3cret", timeoutMs: 1000, maxBytes: 1024, fetchImpl: fetchImpl as unknown as typeof fetch })
    const out = await provider.scan(request)
    expect(out).toMatchObject({ provider: "clamav-rest", verdict: "clean" })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("une réponse HTTP en erreur ou une exception réseau rend `error`, jamais `clean`", async () => {
    const failing = new ClamAvRestProvider({ url: "https://av.local/scan", timeoutMs: 1000, maxBytes: 1024, fetchImpl: (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch })
    expect((await failing.scan(request)).verdict).toBe("error")
    const throwing = new ClamAvRestProvider({
      url: "https://av.local/scan",
      timeoutMs: 1000,
      maxBytes: 1024,
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED")
      }) as unknown as typeof fetch,
    })
    expect(await throwing.scan(request)).toMatchObject({ verdict: "error", detail: "ECONNREFUSED" })
  })

  it("au-delà du plafond, l'antivirus est sauté (le reste de l'inspection tient)", async () => {
    const provider = new ClamAvRestProvider({ url: "https://av.local/scan", timeoutMs: 1000, maxBytes: 2, fetchImpl: (async () => new Response("[]")) as unknown as typeof fetch })
    expect(await provider.scan(request)).toMatchObject({ verdict: "skipped", detail: "too_large" })
  })
})

describe("files/avProviders — sélection par l'environnement (fail-closed)", () => {
  it("en développement local : mock par défaut, ClamAV quand l'URL est là", () => {
    expect(getFileScanProvider(LOCAL).id).toBe("mock")
    expect(getFileScanProvider({ ...LOCAL, FILE_SCAN_PROVIDER: "clamav-rest", FILE_SCAN_CLAMAV_URL: "https://av/scan" }).id).toBe("clamav-rest")
  })

  it("hors développement local : rien de configuré, mock, inconnu ou incomplet → indisponible, verdict `error`", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    for (const env of [{}, { FILE_SCAN_PROVIDER: "mock" }, { FILE_SCAN_PROVIDER: "inconnu" }, { FILE_SCAN_PROVIDER: "clamav-rest" }]) {
      const provider = getFileScanProvider(env)
      expect(provider).toBeInstanceOf(UnavailableFileScanProvider)
      expect((await provider.scan({ bytes: enc.encode("x"), filename: "a.txt", mimeType: "text/plain" })).verdict).toBe("error")
    }
    expect(getFileScanProvider({ FILE_SCAN_PROVIDER: "clamav-rest", FILE_SCAN_CLAMAV_URL: "https://av/scan" }).id).toBe("clamav-rest")
    expect(warn).toHaveBeenCalledTimes(4)
    warn.mockRestore()
  })
})
