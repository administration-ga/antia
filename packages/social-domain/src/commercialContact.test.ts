import { describe, expect, it } from "vitest"

import { COMMERCIAL_ATTACHMENTS_MAX, COMMERCIAL_RETENTION_MS, COMMERCIAL_TEAM_MAX, commercialCanSend, commercialIdempotencyKey, commercialMandateValid, commercialTerminal, commercialText } from "./commercialContact"

describe("P10 — contrat pur du contact commercial", () => {
  it("borne le texte choisi et refuse les contrôles sans perdre les accents", () => {
    expect(commercialText("  Bonjour Éloïse\nUne question.  ")).toBe("Bonjour Éloïse\nUne question.")
    expect(commercialText("a".repeat(2000))).toHaveLength(2000)
    expect(commercialText("a".repeat(2001))).toBeNull()
    expect(commercialText("   ")).toBeNull()
    expect(commercialText("", true)).toBe("")
    expect(commercialText("bonjour\u0000")).toBeNull()
  })
  it("réserve l'écriture à l'acceptation et à un mandat de réponse vivant", () => {
    for (const state of ["requested", "declined", "blocked", "closed"] as const) expect(commercialCanSend(state, false, true)).toBe(false)
    expect(commercialCanSend("accepted", true, true)).toBe(false)
    expect(commercialCanSend("accepted", false, false)).toBe(false)
    expect(commercialCanSend("accepted", false, true)).toBe(true)
  })
  it("sépare lecture, réponse et appel sans autoriser des droits sans lecture", () => {
    expect(commercialMandateValid({ canRead: true, canReply: false, canDecide: false, canCall: false })).toBe(true)
    expect(commercialMandateValid({ canRead: false, canReply: true, canDecide: false, canCall: false })).toBe(false)
    expect(commercialMandateValid({ canRead: false, canReply: false, canDecide: false, canCall: true })).toBe(false)
    expect(COMMERCIAL_TEAM_MAX).toBe(20)
    expect(COMMERCIAL_ATTACHMENTS_MAX).toBe(2)
  })
  it("ferme les clés et fixe une rétention de quatre-vingt-dix jours après fin", () => {
    expect(commercialIdempotencyKey("message_0001")).toBe(true)
    expect(commercialIdempotencyKey("x".repeat(129))).toBe(false)
    expect(commercialIdempotencyKey("with space")).toBe(false)
    expect(commercialTerminal("blocked")).toBe(true)
    expect(commercialTerminal("accepted")).toBe(false)
    expect(COMMERCIAL_RETENTION_MS).toBe(90 * 86400000)
  })
})
