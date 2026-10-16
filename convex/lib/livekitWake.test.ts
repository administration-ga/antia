// Dupliqué de socle/convex/lib/livekitWake.test.ts @ ad2e7fdc2 — adaptations : le refus se lit par son CODE du moteur (`mediaServerUnavailable`, `mediaServerNoCapacity`) au lieu des chaînes `LIVEKIT_*` ; les dix cas conservés.
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ensureLiveKitAwake } from "./livekitWake"

/**
 * Réveil du serveur LiveKit. Le comportement qui compte est celui des PANNES :
 * un jeton rendu pour un serveur éteint produit exactement la panne qu'on
 * cherche à supprimer — un appel bloqué sur « Appel en cours… », sans message.
 */

const WS_URL = "wss://livekit.example.test"

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.LIVEKIT_WAKE_URL = "https://waker.example.test"
  process.env.LIVEKIT_WAKE_TOKEN = "jeton-de-test"
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Réponse minimale : sans `body`, `json()` est absent — comme un 503 rendu par la plateforme d'hébergement, sans corps JSON. */
function httpResponse(ok: boolean, body?: unknown): Response {
  const response: Partial<Response> = { ok, status: ok ? 200 : 503 }
  if (body !== undefined) response.json = async () => body
  return response as Response
}

/** Le corps qu'envoie le service de réveil quand le nuage n'a plus de machine. */
const CAPACITY_FAILURE = {
  error: "wake_failed",
  reason: "ZONE_RESOURCE_POOL_EXHAUSTED",
  detail: "La zone europe-west1-b n'a pas de capacité pour reprendre livekit-server (3 essais).",
}

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
  } catch (error) {
    return engineErrorCode(error)
  }
  return null
}

describe("ensureLiveKitAwake", () => {
  it("appelle le service de réveil avec le jeton attendu", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpResponse(true))
    vi.stubGlobal("fetch", fetchMock)

    await expect(ensureLiveKitAwake(WS_URL)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }]
    expect(url).toBe("https://waker.example.test")
    expect(init.method).toBe("POST")
    expect(init.headers["x-waker-token"]).toBe("jeton-de-test")
  })

  it("ne fait rien quand le réveil n'est pas configuré", async () => {
    delete process.env.LIVEKIT_WAKE_URL
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(ensureLiveKitAwake(WS_URL)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("laisse passer si le service de réveil est injoignable mais le serveur répond", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("waker down")).mockResolvedValueOnce(httpResponse(true))
    vi.stubGlobal("fetch", fetchMock)

    await expect(ensureLiveKitAwake(WS_URL)).resolves.toBeUndefined()
    // La sonde parle https là où les participants parlent wss.
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://livekit.example.test")
  })

  it("refuse d'émettre un jeton quand ni le réveil ni le serveur ne répondent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")))
    expect(await codeOf(ensureLiveKitAwake(WS_URL))).toBe("mediaServerUnavailable")
  })

  it("sonde le serveur quand le service de réveil répond en erreur HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(httpResponse(false)).mockResolvedValueOnce(httpResponse(false))
    vi.stubGlobal("fetch", fetchMock)

    expect(await codeOf(ensureLiveKitAwake(WS_URL))).toBe("mediaServerUnavailable")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("ensureLiveKitAwake — pénurie de capacité du nuage", () => {
  it("nomme la pénurie : `mediaServerNoCapacity`, pas « le serveur démarre »", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(httpResponse(false, CAPACITY_FAILURE)).mockResolvedValueOnce(httpResponse(false)))
    expect(await codeOf(ensureLiveKitAwake(WS_URL))).toBe("mediaServerNoCapacity")
  })

  it("journalise la raison et le détail rendus par le service de réveil", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(httpResponse(false, CAPACITY_FAILURE)).mockResolvedValueOnce(httpResponse(false)))

    await codeOf(ensureLiveKitAwake(WS_URL))

    const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0]))
    expect(logged.some((line) => line.includes("ZONE_RESOURCE_POOL_EXHAUSTED"))).toBe(true)
    expect(logged.some((line) => line.includes("3 essais"))).toBe(true)
  })

  it("une pénurie n'interrompt pas une visio en cours : le serveur qui répond l'emporte", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(httpResponse(false, CAPACITY_FAILURE)).mockResolvedValueOnce(httpResponse(true)))
    await expect(ensureLiveKitAwake(WS_URL)).resolves.toBeUndefined()
  })

  it("toute autre raison reste `mediaServerUnavailable` — réessayer dans une minute a du sens", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(httpResponse(false, { error: "wake_failed", reason: "livekit_not_ready", detail: "…" }))
        .mockResolvedValueOnce(httpResponse(false)),
    )
    expect(await codeOf(ensureLiveKitAwake(WS_URL))).toBe("mediaServerUnavailable")
  })

  it("un corps illisible ne change rien au verdict", async () => {
    const broken = httpResponse(false)
    broken.json = async () => {
      throw new SyntaxError("Unexpected token <")
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(httpResponse(false)))
    expect(await codeOf(ensureLiveKitAwake(WS_URL))).toBe("mediaServerUnavailable")
  })
})
