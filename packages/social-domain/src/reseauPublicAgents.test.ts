import { describe, expect, it } from "vitest"

import { CONSENT_PURPOSES, CONSENT_TEXT_VERSIONS, isConsentInForce, missingConsentsToJoin } from "./consent"
import { FEDERATION_IMPLEMENTED_EVENTS, FEDERATION_MAX_SKEW_MS, parseFederationEnvelope, RESEAU_PUBLIC_CONTRACT } from "./federationProtocol"
import { isReseauPublicPersonEvent, parseReseauPublicEvent, parseReseauPublicPage, type ReseauPublicPersonOptInEvent, type ReseauPublicPersonOptOutEvent } from "./reseauPublic"

const NOW = 1_792_281_600_000
const CONSENT_REF = "a".repeat(64)
// Le contrat pur vérifie la forme ; la corrélation SHA-256 est rejugée par le backend.
const AGENT_REF = `agent:${"b".repeat(64)}`
const optedIn: ReseauPublicPersonOptInEvent = {
  type: "person.optin", agentRef: AGENT_REF, revision: 1,
  idnSub: "IDN:Jean-Rémy:Opaque", consentRef: CONSENT_REF,
  textVersion: CONSENT_TEXT_VERSIONS.administration_reflection, consentedAt: NOW,
  displayName: "Jean-Rémy NDONG MBA", orgRef: "page:administration-exemple", roleLabel: "Agent public",
}
const optedOut: ReseauPublicPersonOptOutEvent = {
  type: "person.optout", agentRef: AGENT_REF, revision: 2,
  idnSub: optedIn.idnSub, consentRef: CONSENT_REF,
}
const INVALID = { ok: false, reason: "invalid_payload" }
const parse = (value: unknown) => parseReseauPublicEvent(value, AGENT_REF, NOW)

describe("RESEAU-PUBLIC-V1 — agents volontaires PA9C", () => {
  it("admet les deux charges fermées et les distingue des objets institutionnels", () => {
    expect(parse(optedIn)).toEqual({ ok: true, event: optedIn })
    expect(parse(optedOut)).toEqual({ ok: true, event: optedOut })
    expect(isReseauPublicPersonEvent(optedIn)).toBe(true)
    expect(isReseauPublicPersonEvent(optedOut)).toBe(true)
    expect(isReseauPublicPersonEvent({ type: "post.removed", postRef: "post:exemple", revision: 1 })).toBe(false)
    expect(isReseauPublicPersonEvent({ type: "page.upserted", orgRef: "page:exemple", revision: 1, name: "Administration", country: "GA", verifiedAt: NOW })).toBe(false)
  })

  it("exige chaque champ, sans champ étranger ni métadonnée institutionnelle au retrait", () => {
    for (const source of [optedIn, optedOut]) {
      for (const key of Object.keys(source)) {
        const payload: Record<string, unknown> = { ...source }
        delete payload[key]
        expect(parse(payload)).toEqual(INVALID)
      }
      for (const key of ["unknown", "personId", "authUserId", "networkId", "email", "phoneNumber", "publishedAt", "audience"]) {
        expect(parse({ ...source, [key]: "interdit" })).toEqual(INVALID)
      }
    }
    for (const key of ["displayName", "orgRef", "roleLabel", "textVersion", "consentedAt"]) {
      expect(parse({ ...optedOut, [key]: optedIn[key as keyof ReseauPublicPersonOptInEvent] })).toEqual(INVALID)
    }
  })

  it.each([
    { agentRef: `agent:${"B".repeat(64)}` }, { agentRef: `agent:${"b".repeat(63)}` },
    { agentRef: `person:${"b".repeat(64)}` }, { agentRef: "IDN:Jean-Rémy:Opaque" },
    { consentRef: "a".repeat(63) }, { consentRef: "a".repeat(65) }, { consentRef: "A".repeat(64) },
    { consentRef: "z".repeat(64) }, { consentRef: null }, { consentRef: undefined },
    { revision: 0 }, { revision: -1 }, { revision: 1.5 }, { revision: Number.NaN },
    { revision: Number.POSITIVE_INFINITY }, { revision: Number.MAX_SAFE_INTEGER + 1 },
    { idnSub: "" }, { idnSub: "x".repeat(513) }, { idnSub: " opaque" }, { idnSub: "opaque " },
    { idnSub: "opaque\n" }, { idnSub: "opaque\tvalue" }, { idnSub: "opaque\u0000value" },
    { idnSub: "opaque\u007fvalue" }, { idnSub: null }, { idnSub: 42 },
  ])("refuse une référence, révision ou identité invalide dans les deux événements (%j)", (patch) => {
    expect(parse({ ...optedIn, ...patch })).toEqual(INVALID)
    expect(parse({ ...optedOut, ...patch })).toEqual(INVALID)
  })

  it("corrèle la référence d'enveloppe et conserve le sujet opaque sans normalisation", () => {
    expect(parseReseauPublicEvent(optedIn, `agent:${"c".repeat(64)}`, NOW)).toEqual(INVALID)
    expect(parseReseauPublicEvent(optedOut, optedIn.idnSub, NOW)).toEqual(INVALID)
    for (const idnSub of ["x", "x".repeat(512), "IDN:Éloïse:AbC/opaque=", "opaque  interne"]) {
      expect(parse({ ...optedIn, idnSub })).toMatchObject({ ok: true, event: { idnSub } })
      expect(parse({ ...optedOut, idnSub })).toMatchObject({ ok: true, event: { idnSub } })
    }
    expect(parse({ ...optedIn, revision: Number.MAX_SAFE_INTEGER }).ok).toBe(true)
    expect(parse({ ...optedOut, revision: Number.MAX_SAFE_INTEGER }).ok).toBe(true)
  })

  it.each([
    { displayName: "x" }, { displayName: " " }, { displayName: "x".repeat(121) },
    { displayName: "Jean\nNDONG" }, { displayName: null }, { roleLabel: "" }, { roleLabel: " " },
    { roleLabel: "x".repeat(121) }, { roleLabel: "Agent\u007f" }, { roleLabel: 1 },
    { orgRef: "" }, { orgRef: "page:avec espace" }, { orgRef: "../interne" }, { orgRef: "x".repeat(201) },
    { textVersion: "2026-10-14" }, { textVersion: null }, { textVersion: undefined },
    { consentedAt: 0 }, { consentedAt: -1 }, { consentedAt: 1.5 }, { consentedAt: Number.NaN },
    { consentedAt: Number.POSITIVE_INFINITY }, { consentedAt: NOW + FEDERATION_MAX_SKEW_MS + 1 },
  ])("refuse une preuve d'accord ou une présentation non bornée (%j)", (patch) => {
    expect(parse({ ...optedIn, ...patch })).toEqual(INVALID)
  })

  it("normalise seulement les espaces de présentation et accepte leurs bornes", () => {
    expect(parse({ ...optedIn, displayName: "  Jean-Rémy NDONG MBA  ", roleLabel: "  Agent public  " })).toEqual({ ok: true, event: optedIn })
    expect(parse({ ...optedIn, displayName: "Ab", roleLabel: "A", consentedAt: 1 }).ok).toBe(true)
    expect(parse({ ...optedIn, displayName: "x".repeat(120), roleLabel: "x".repeat(120), orgRef: "x".repeat(200), consentedAt: NOW + FEDERATION_MAX_SKEW_MS }).ok).toBe(true)
    expect(parse(Object.fromEntries(Object.entries(optedIn).reverse()))).toEqual(parse(optedIn))
    expect(parse(Object.fromEntries(Object.entries(optedOut).reverse()))).toEqual(parse(optedOut))
    for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseReseauPublicEvent(optedIn, AGENT_REF, nowMs)).toEqual(INVALID)
      expect(parseReseauPublicEvent(optedOut, AGENT_REF, nowMs)).toEqual(INVALID)
    }
  })

  it("conserve les agents hors du parseur spécialisé de page et ferme les types inconnus", () => {
    for (const payload of [optedIn, optedOut]) expect(parseReseauPublicPage(payload, AGENT_REF, NOW)).toEqual({ ok: false, reason: "unsupported_event" })
    for (const payload of [null, [], "person", {}, { type: "person.updated" }, { type: "person.optin", arbitrary: true }]) expect(parse(payload)).toEqual(INVALID)
  })

  it("déclare les événements sans desserrer la frontière du transport", () => {
    expect(FEDERATION_IMPLEMENTED_EVENTS[RESEAU_PUBLIC_CONTRACT]).toContain("person.optin")
    expect(FEDERATION_IMPLEMENTED_EVENTS[RESEAU_PUBLIC_CONTRACT]).toContain("person.optout")
    const envelope = { eventId: "socle-agent-exemple-000001", contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef: AGENT_REF, payload: optedIn }
    expect(parseFederationEnvelope(JSON.stringify(envelope))).toEqual({ ok: true, envelope })
    expect(parseFederationEnvelope(JSON.stringify({ ...envelope, payload: { ...optedIn, personId: "interdit" } }))).toEqual({ ok: false, reason: "forbidden_payload_field" })
  })

  it("sépare l'accord de reflet du profil social et lui applique sa propre version révocable", () => {
    expect(CONSENT_PURPOSES).toContain("administration_reflection")
    expect(CONSENT_TEXT_VERSIONS.administration_reflection).toBe("2026-10-18")
    expect(isConsentInForce([{ purpose: "administration_reflection", textVersion: "2026-10-18" }], "administration_reflection")).toBe(true)
    expect(isConsentInForce([{ purpose: "administration_reflection", textVersion: "2026-10-18", revokedAt: NOW }], "administration_reflection")).toBe(false)
    expect(isConsentInForce([{ purpose: "administration_reflection", textVersion: "2026-10-14" }], "administration_reflection")).toBe(false)
    expect(isConsentInForce([{ purpose: "social_profile", textVersion: CONSENT_TEXT_VERSIONS.social_profile }], "administration_reflection")).toBe(false)
    expect(missingConsentsToJoin([{ purpose: "administration_reflection", textVersion: "2026-10-18" }])).toEqual(["social_profile"])
    expect(missingConsentsToJoin([{ purpose: "social_profile", textVersion: CONSENT_TEXT_VERSIONS.social_profile }])).toEqual([])
  })
})
