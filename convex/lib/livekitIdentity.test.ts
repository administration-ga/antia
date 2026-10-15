// Dupliqué de socle/convex/lib/livekitIdentity.test.ts @ ad2e7fdc2 — adaptations : variante `call` seule (les cas `eau`, `citizen`, `supervisor`, `pnpe` et le filtre de supervision partent avec leurs émetteurs) ; un cas ajouté : le nonce ne se recolle jamais au sujet sans séparateur.
import { describe, expect, it } from "vitest"

import { buildLiveKitIdentity } from "./livekitIdentity"

/**
 * La garantie qui compte est l'UNICITÉ par connexion : LiveKit éjecte tout
 * participant dont une seconde connexion arrive avec la MÊME identité.
 */
describe("buildLiveKitIdentity", () => {
  const subject = "auth|64f2a1b9c7d3e5f8"
  const nonce = "9f3c1a2b"

  it("deux nonces différents pour le même sujet produisent deux identités différentes", () => {
    expect(buildLiveKitIdentity({ kind: "call", subject, nonce: "aaaa1111" })).not.toBe(buildLiveKitIdentity({ kind: "call", subject, nonce: "bbbb2222" }))
  })

  it("mêmes arguments ⇒ même résultat (pureté, déterminisme)", () => {
    const args = { kind: "call" as const, subject: "s1", nonce: "n1" }
    expect(buildLiveKitIdentity(args)).toBe(buildLiveKitIdentity(args))
  })

  it("call : {subject}::{nonce} — le sujet d'authentification reste en préfixe", () => {
    expect(buildLiveKitIdentity({ kind: "call", subject, nonce })).toBe(`${subject}::${nonce}`)
  })

  it("le séparateur distingue deux couples (sujet, nonce) qui se recolleraient en une même chaîne", () => {
    expect(buildLiveKitIdentity({ kind: "call", subject: "ab", nonce: "c" })).not.toBe(buildLiveKitIdentity({ kind: "call", subject: "a", nonce: "bc" }))
  })
})
