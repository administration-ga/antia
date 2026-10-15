// Dupliqué de socle/convex/modules/direct/grants.test.ts @ ad2e7fdc2 — adaptations : aucune ; les neuf cas portés tels quels (le plafond d'antenne se lit par le réexport de `grants.ts`, la copie littérale du filtre superviseur du socle reste la garde de non-collision des identités).
/**
 * Grants et identités du DIRECT — le contrat que le SFU verra.
 *
 *  1. Le SPECTATEUR ne peut RIEN émettre : publish/data fermés, sources
 *     VIDES, caché — et le TTL est d'UNE heure (le filet de la
 *     rétrogradation).
 *  2. Le sujet reste en PRÉFIXE des identités — c'est ce qui permet à la
 *     promotion de retrouver les connexions d'une personne par
 *     `startsWith`, quel que soit le nonce de l'onglet.
 *  3. AUCUNE identité de direct ne matche `CITIZEN_SUPERVISOR_FILTER` : une
 *     collision rendrait le flux MUET côté citoyen (le filtre supprime
 *     l'audio des superviseurs whisper/listen).
 */
import { describe, expect, it } from "vitest"
import {
  buildDirectIdentity,
  DIRECT_MAX_SPEAKERS,
  DIRECT_TOKEN_TTL_SECONDS,
  directIdentityPrefix,
  identityBelongsToSubject,
  sfuPermissionFor,
  speakerGrant,
  viewerGrant,
} from "./grants"

/**
 * Copie LITTÉRALE de `FilteredAudioRenderer.CITIZEN_SUPERVISOR_FILTER`
 * (packages/agent-features/src/components/call-center/FilteredAudioRenderer.tsx)
 * — même patron régressif que `lib/livekitIdentity.test.ts` : le composant
 * client n'est pas importable d'ici, la copie DOIT suivre toute évolution du
 * filtre.
 */
const CITIZEN_SUPERVISOR_FILTER = /^supervisor_.+_(whisper|listen)$/

describe("grants du direct", () => {
  it("spectateur : rien ne s'émet — publish/data fermés, sources vides, caché", () => {
    const grant = viewerGrant("direct-room")
    expect(grant).toMatchObject({
      roomJoin: true,
      room: "direct-room",
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: [],
      hidden: true,
    })
  })

  it("intervenant : publication ouverte, visible", () => {
    const grant = speakerGrant("direct-room")
    expect(grant).toMatchObject({
      roomJoin: true,
      room: "direct-room",
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
    })
    // Sources ABSENTES (= toutes), jamais un tableau vide par accident.
    expect("canPublishSources" in grant).toBe(false)
  })

  it("le TTL est d'UNE heure — le filet de la rétrogradation", () => {
    expect(DIRECT_TOKEN_TTL_SECONDS).toBe(3600)
  })

  it("le plafond d'antenne est 8, hôte compris", () => {
    expect(DIRECT_MAX_SPEAKERS).toBe(8)
  })

  it("la permission SFU d'un rôle est EXACTEMENT celle du grant du même rôle", () => {
    const viewer = viewerGrant("-")
    expect(sfuPermissionFor("viewer")).toEqual({
      canPublish: viewer.canPublish,
      canSubscribe: viewer.canSubscribe,
      canPublishData: viewer.canPublishData,
      hidden: viewer.hidden,
    })
    const speaker = speakerGrant("-")
    expect(sfuPermissionFor("speaker")).toEqual({
      canPublish: speaker.canPublish,
      canSubscribe: speaker.canSubscribe,
      canPublishData: speaker.canPublishData,
      hidden: speaker.hidden,
    })
  })
})

describe("identités du direct", () => {
  it("forme exacte : direct-v_{subject}::{nonce} / direct-s_{subject}::{nonce}", () => {
    expect(
      buildDirectIdentity({ role: "viewer", subject: "abc123", nonce: "n0" }),
    ).toBe("direct-v_abc123::n0")
    expect(
      buildDirectIdentity({ role: "speaker", subject: "abc123", nonce: "n0" }),
    ).toBe("direct-s_abc123::n0")
  })

  it("le sujet reste en PRÉFIXE : startsWith retrouve toutes les connexions", () => {
    const identity = buildDirectIdentity({
      role: "viewer",
      subject: "abc123",
      nonce: "z9y8",
    })
    expect(
      identity.startsWith(directIdentityPrefix({ role: "viewer", subject: "abc123" })),
    ).toBe(true)
    expect(identityBelongsToSubject(identity, "abc123")).toBe(true)
    // `::` clôt le sujet : "abc" ne matche pas les identités de "abc123".
    expect(identityBelongsToSubject(identity, "abc")).toBe(false)
  })

  it("deux nonces (deux onglets) appartiennent au même sujet", () => {
    const a = buildDirectIdentity({ role: "viewer", subject: "s1", nonce: "aa" })
    const b = buildDirectIdentity({ role: "speaker", subject: "s1", nonce: "bb" })
    expect(identityBelongsToSubject(a, "s1")).toBe(true)
    expect(identityBelongsToSubject(b, "s1")).toBe(true)
  })

  it("AUCUNE collision avec CITIZEN_SUPERVISOR_FILTER — même avec un sujet piégé", () => {
    // Sujets ordinaires ET sujets construits pour ressembler au filtre : si
    // l'identité commençait par le sujet nu, "supervisor_x" + mode piégé
    // matcherait. Le préfixe `direct-…_` l'empêche structurellement.
    const subjects = ["abc123", "supervisor_x", "supervisor_a_whisper"]
    const nonces = ["n0", "whisper", "listen"]
    for (const subject of subjects) {
      for (const nonce of nonces) {
        for (const role of ["viewer", "speaker"] as const) {
          const identity = buildDirectIdentity({ role, subject, nonce })
          expect(identity).not.toMatch(CITIZEN_SUPERVISOR_FILTER)
        }
      }
    }
  })
})
