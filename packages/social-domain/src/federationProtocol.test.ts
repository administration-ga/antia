import { describe, expect, it } from "vitest"

import { equalFederationSignature, FEDERATION_IMPLEMENTED_CONTRACTS, federationEnvironment, federationSigningText, freshFederationTimestamp, parseFederationEnvelope, validFederationContract, validFederationEmitter, validFederationKeyEnvName } from "./federationProtocol"

const base = { eventId: "event-001", contract: "RESEAU-PUBLIC-V1", version: 1, objectRef: "page:administration-test", payload: { title: "Mission publique", values: [true, null, 2] } }
const raw = (value: unknown) => JSON.stringify(value)

describe("FEDERATION-INBOX-V1 — frontière pure et fermée", () => {
  it("accepte l'enveloppe minimale sans présumer un contrat métier branché", () => {
    expect(parseFederationEnvelope(raw(base))).toEqual({ ok: true, envelope: base })
    expect(FEDERATION_IMPLEMENTED_CONTRACTS).toEqual([])
  })
  it.each(["", "dev", "local", "Production", undefined, null])("ne transforme jamais %s en production", (value) => {
    expect(federationEnvironment(value)).toBeNull()
  })
  it("n'accepte que les deux environnements explicites", () => {
    expect(federationEnvironment("sandbox")).toBe("sandbox")
    expect(federationEnvironment("production")).toBe("production")
  })
  it.each([null, [], "event", {}, { ...base, extra: true }, { ...base, version: 2 }, { ...base, eventId: "../internal" }, { ...base, objectRef: "with space" }, { ...base, contract: "reseau-public-v1" }])("refuse une enveloppe ouverte ou mal typée (%j)", (value) => {
    expect(parseFederationEnvelope(raw(value)).ok).toBe(false)
  })
  it("refuse du JSON invalide", () => { expect(parseFederationEnvelope("{" )).toEqual({ ok: false, reason: "invalid_envelope" }) })
  it.each(["_id", "networkId", "personId", "storageId", "authUserId", "email", "phoneNumber", "accessToken", "password", "__proto__"])("refuse un champ interne/sensible imbriqué %s", (key) => {
    expect(parseFederationEnvelope(raw({ ...base, payload: { nested: [{ [key]: "opaque" }] } }))).toEqual({ ok: false, reason: "forbidden_payload_field" })
  })
  it("borne les profondeurs, les tableaux, les champs, les nœuds et les chaînes", () => {
    let nested: unknown = null
    for (let index = 0; index < 10; index++) nested = [nested]
    for (const payload of [nested, Array(257).fill(0), Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`field${index}`, 0])), "x".repeat(8193), Array.from({ length: 200 }, () => Array(20).fill(0))]) {
      expect(parseFederationEnvelope(raw({ ...base, payload }))).toEqual({ ok: false, reason: "payload_too_complex" })
    }
  })
  it("rejette un nombre JSON débordant", () => {
    expect(parseFederationEnvelope('{"eventId":"event","contract":"RESEAU-PUBLIC-V1","version":1,"objectRef":"page","payload":1e999}').ok).toBe(false)
  })
  it("borne et canonicalise les noms sans accepter un chemin ou une clé directe", () => {
    expect(validFederationEmitter("socle-test")).toBe(true)
    expect(validFederationEmitter("SOCLE")).toBe(false)
    expect(validFederationEmitter("../socle")).toBe(false)
    expect(validFederationContract("DIASPORA-ATTESTATION-V1")).toBe(true)
    expect(validFederationContract("RESEAU-PUBLIC")).toBe(false)
    expect(validFederationKeyEnvName("ANTSIA_FEDERATION_SOCLE_SANDBOX_KEY")).toBe(true)
    expect(validFederationKeyEnvName("AUTH_SECRET")).toBe(false)
  })
  it("la fenêtre temporelle est symétrique, canonique et en secondes", () => {
    const now = 1_792_152_000_000
    expect(freshFederationTimestamp(String(now / 1000), now)).toBe(true)
    expect(freshFederationTimestamp(String(now / 1000 - 300), now)).toBe(true)
    expect(freshFederationTimestamp(String(now / 1000 + 300), now)).toBe(true)
    for (const value of [String(now / 1000 - 301), String(now / 1000 + 301), String(now), "1e9", "01792152000", " 1792152000", "NaN"]) expect(freshFederationTimestamp(value, now)).toBe(false)
  })
  it("la signature porte l'environnement, l'horodatage et le corps exact", () => {
    expect(federationSigningText("sandbox", "1792152000", "{\n}" )).toBe("sandbox\n1792152000\n{\n}")
    expect(equalFederationSignature("a".repeat(64), "a".repeat(64))).toBe(true)
    expect(equalFederationSignature("a".repeat(64), "a".repeat(63) + "b")).toBe(false)
    expect(equalFederationSignature("A".repeat(64), "a".repeat(64))).toBe(false)
    expect(equalFederationSignature("a".repeat(63), "a".repeat(64))).toBe(false)
  })
})
