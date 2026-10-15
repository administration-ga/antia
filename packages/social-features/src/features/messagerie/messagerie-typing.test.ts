// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-typing.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import {
  shouldPingTyping,
  TYPING_PING_INTERVAL_MS,
  TYPING_SERVER_TTL_MS,
} from "./messagerie-typing"

describe("shouldPingTyping", () => {
  it("signale dès la PREMIÈRE frappe", () => {
    // Sinon l'indicateur n'apparaît qu'après 2,5 s — souvent après l'envoi
    // d'un message court, c'est-à-dire jamais.
    expect(shouldPingTyping(null, 1000)).toBe(true)
  })

  it("ne re-signale pas avant l'intervalle", () => {
    expect(shouldPingTyping(1000, 1000 + TYPING_PING_INTERVAL_MS - 1)).toBe(false)
  })

  it("re-signale à l'intervalle exact, et au-delà", () => {
    expect(shouldPingTyping(1000, 1000 + TYPING_PING_INTERVAL_MS)).toBe(true)
    expect(shouldPingTyping(1000, 1000 + 10_000)).toBe(true)
  })

  it("⚠️ la cadence reste STRICTEMENT sous le TTL serveur", () => {
    // C'est l'invariant qui compte : un ping plus lent que le TTL ferait
    // clignoter l'indicateur chez le correspondant, ce qu'on prendrait pour
    // une latence réseau. Deux pings doivent tenir dans une fenêtre de vie.
    expect(TYPING_PING_INTERVAL_MS).toBeLessThan(TYPING_SERVER_TTL_MS)
    expect(TYPING_PING_INTERVAL_MS * 2).toBeLessThanOrEqual(TYPING_SERVER_TTL_MS)
  })
})
