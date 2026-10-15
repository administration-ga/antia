// Dupliqué de socle/convex/lib/livekit.test.ts @ ad2e7fdc2 — adaptations : le refus se lit par son CODE du moteur (`engineErrorCode` → `mediaServerNotConfigured`) au lieu de la chaîne `LIVEKIT_NOT_CONFIGURED` ; les sept cas conservés.
import { engineErrorCode } from "@antia/social-contracts/errors"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getLiveKitConfig } from "./livekit"

/**
 * `getLiveKitConfig` est la SOURCE UNIQUE consultée par l'émission de jeton.
 * Ce test couvre le cas nominal de cet environnement — AUCUNE variable LiveKit
 * — et verrouille ce qui a fait défaut en production au socle : un `Error` nu y
 * est masqué en « Server Error », une `ConvexError` à code traverse intacte.
 */

const ORIGINAL_ENV = { ...process.env }

function caught(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
  return null
}

beforeEach(() => {
  delete process.env.LIVEKIT_API_KEY
  delete process.env.LIVEKIT_API_SECRET
  delete process.env.LIVEKIT_WS_URL
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("getLiveKitConfig — configuration manquante (cas nominal de cet environnement)", () => {
  it("lève une ConvexError à code `mediaServerNotConfigured` quand aucune variable n'est définie", () => {
    const error = caught(() => getLiveKitConfig())
    expect(error).toBeInstanceOf(ConvexError)
    expect(engineErrorCode(error)).toBe("mediaServerNotConfigured")
  })

  it("le `data` de la ConvexError porte le code — c'est ce qui survit au masquage de production", () => {
    const error = caught(() => getLiveKitConfig()) as ConvexError<{ code: string }>
    expect(error.data).toEqual({ code: "mediaServerNotConfigured" })
  })

  it("ne fuite pas la liste des variables manquantes dans l'erreur renvoyée au client", () => {
    const error = caught(() => getLiveKitConfig()) as ConvexError<{ code: string }>
    const data = JSON.stringify(error.data)
    expect(data).not.toContain("LIVEKIT_API_KEY")
    expect(data).not.toContain("LIVEKIT_API_SECRET")
    expect(data).not.toContain("LIVEKIT_WS_URL")
    expect(console.error).toHaveBeenCalled()
  })

  it("lève aussi quand une SEULE variable manque — le défaut de production exact (seul LIVEKIT_WS_URL manquait)", () => {
    process.env.LIVEKIT_API_KEY = "fake-key"
    process.env.LIVEKIT_API_SECRET = "fake-secret"
    expect(engineErrorCode(caught(() => getLiveKitConfig()))).toBe("mediaServerNotConfigured")
  })

  it("traite une valeur uniquement blanche comme absente (`.trim()` défensif)", () => {
    process.env.LIVEKIT_API_KEY = "fake-key"
    process.env.LIVEKIT_API_SECRET = "fake-secret"
    process.env.LIVEKIT_WS_URL = "   \n"
    expect(engineErrorCode(caught(() => getLiveKitConfig()))).toBe("mediaServerNotConfigured")
  })
})

describe("getLiveKitConfig — configuration complète (non-régression)", () => {
  it("retourne les trois valeurs, nettoyées, quand tout est configuré", () => {
    process.env.LIVEKIT_API_KEY = "  key-123  "
    process.env.LIVEKIT_API_SECRET = "secret-456"
    process.env.LIVEKIT_WS_URL = "wss://livekit.example.test\n"
    expect(getLiveKitConfig()).toEqual({ apiKey: "key-123", apiSecret: "secret-456", wsUrl: "wss://livekit.example.test" })
  })

  it("ne journalise rien et ne lève rien quand la configuration est complète", () => {
    process.env.LIVEKIT_API_KEY = "key-123"
    process.env.LIVEKIT_API_SECRET = "secret-456"
    process.env.LIVEKIT_WS_URL = "wss://livekit.example.test"
    expect(() => getLiveKitConfig()).not.toThrow()
    expect(console.error).not.toHaveBeenCalled()
  })
})
