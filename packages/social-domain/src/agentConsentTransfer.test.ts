import { describe, expect, it } from "vitest"

import { AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES, AGENT_CONSENT_TRANSFER_CONTRACT, AGENT_CONSENT_TRANSFER_PATH, agentConsentTransferSigningText, parseAgentConsentTransferRequest, parseAgentConsentTransferResponse } from "./agentConsentTransfer"
import { CONSENT_TEXT_VERSIONS } from "./consent"
import { FEDERATION_MAX_SKEW_MS, federationSigningText } from "./federationProtocol"

const NOW = 1_792_281_600_000
const TOKEN = "a".repeat(64)
const REQUEST_DIGEST = "b".repeat(64)
const REQUEST = { token: TOKEN, idnSub: "IDN:Éloïse:Opaque/AbC=" }
const GRANT = { agentRef: `agent:${"c".repeat(64)}`, consentRef: "d".repeat(64), textVersion: CONSENT_TEXT_VERSIONS.administration_reflection, grantedAt: NOW }
const RESPONSE = { outcome: "granted", grant: GRANT }
const INVALID_REQUEST = { ok: false, reason: "invalid_request" }
const INVALID_RESPONSE = { ok: false, reason: "invalid_response" }
const parseRequest = (value: unknown) => parseAgentConsentTransferRequest(JSON.stringify(value))
const parseResponse = (value: unknown) => parseAgentConsentTransferResponse(JSON.stringify(value), NOW)

describe("ANTSIA-AGENT-CONSENT-V1 — requête privée fermée", () => {
  it("déclare le chemin et reconnaît exactement le jeton et le sujet sans normalisation", () => {
    expect(AGENT_CONSENT_TRANSFER_CONTRACT).toBe("ANTSIA-AGENT-CONSENT-V1")
    expect(AGENT_CONSENT_TRANSFER_PATH).toBe("/federation/agent-consent")
    expect(parseRequest(REQUEST)).toEqual({ ok: true, request: REQUEST })
    expect(parseRequest({ idnSub: REQUEST.idnSub, token: TOKEN })).toEqual({ ok: true, request: REQUEST })
    for (const idnSub of ["x", "x".repeat(512), "opaque  intérieur", "idn:éLOÏSE:AbC"]) {
      expect(parseRequest({ ...REQUEST, idnSub })).toEqual({ ok: true, request: { ...REQUEST, idnSub } })
    }
  })

  it.each([
    null, [], "request", {}, { token: TOKEN }, { idnSub: REQUEST.idnSub },
    { ...REQUEST, extra: true }, { ...REQUEST, personId: "interdit" }, { ...REQUEST, grant: GRANT },
    { ...REQUEST, token: "" }, { ...REQUEST, token: "a".repeat(63) }, { ...REQUEST, token: "a".repeat(65) },
    { ...REQUEST, token: "A".repeat(64) }, { ...REQUEST, token: "z".repeat(64) }, { ...REQUEST, token: null },
    { ...REQUEST, idnSub: "" }, { ...REQUEST, idnSub: "x".repeat(513) }, { ...REQUEST, idnSub: " opaque" },
    { ...REQUEST, idnSub: "opaque " }, { ...REQUEST, idnSub: "opaque\n" }, { ...REQUEST, idnSub: "opaque\tvalue" },
    { ...REQUEST, idnSub: "opaque\u0000value" }, { ...REQUEST, idnSub: "opaque\u007fvalue" },
    { ...REQUEST, idnSub: null }, { ...REQUEST, idnSub: 1 },
  ])("refuse les champs absents, ouverts, mal typés ou non bornés (%j)", (value) => {
    expect(parseRequest(value)).toEqual(INVALID_REQUEST)
  })

  it("borne les octets exacts du corps à 4096, y compris les espaces et l'UTF-8", () => {
    const raw = JSON.stringify({ token: TOKEN, idnSub: "x" })
    const atLimit = raw + " ".repeat(AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES - raw.length)
    expect(parseAgentConsentTransferRequest(atLimit).ok).toBe(true)
    expect(parseAgentConsentTransferRequest(atLimit + " ")).toEqual(INVALID_REQUEST)
    const utf8 = JSON.stringify({ token: TOKEN, idnSub: "é".repeat(512) })
    const belowCharacterLimit = utf8 + " ".repeat(AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES - utf8.length)
    expect(belowCharacterLimit).toHaveLength(AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES)
    expect(parseAgentConsentTransferRequest(belowCharacterLimit)).toEqual(INVALID_REQUEST)
    for (const rawBody of ["", "{", "undefined"]) expect(parseAgentConsentTransferRequest(rawBody)).toEqual(INVALID_REQUEST)
  })
})

describe("ANTSIA-AGENT-CONSENT-V1 — réponse fermée", () => {
  it("admet l'accord typé et les trois refus sans détail privé", () => {
    expect(parseResponse(RESPONSE)).toEqual({ ok: true, response: RESPONSE })
    for (const outcome of ["unavailable", "unauthorized", "invalid_request"]) {
      expect(parseResponse({ outcome })).toEqual({ ok: true, response: { outcome } })
      for (const extra of [{ detail: "privé" }, { idnSub: REQUEST.idnSub }, { token: TOKEN }, { grant: GRANT }]) {
        expect(parseResponse({ outcome, ...extra })).toEqual(INVALID_RESPONSE)
      }
    }
  })

  it("exige chaque clé d'accord et ferme les niveaux réponse et preuve", () => {
    for (const key of Object.keys(GRANT)) {
      const grant: Record<string, unknown> = { ...GRANT }
      delete grant[key]
      expect(parseResponse({ outcome: "granted", grant })).toEqual(INVALID_RESPONSE)
    }
    for (const value of [null, [], "response", {}, { outcome: "unknown" }, { outcome: "granted" }, { grant: GRANT }, { ...RESPONSE, extra: true }, { ...RESPONSE, grant: null }, { ...RESPONSE, grant: [] }, { ...RESPONSE, grant: { ...GRANT, idnSub: REQUEST.idnSub } }]) {
      expect(parseResponse(value)).toEqual(INVALID_RESPONSE)
    }
  })

  it.each([
    { agentRef: `agent:${"C".repeat(64)}` }, { agentRef: `agent:${"c".repeat(63)}` }, { agentRef: `person:${"c".repeat(64)}` },
    { agentRef: null }, { consentRef: "d".repeat(63) }, { consentRef: "D".repeat(64) }, { consentRef: null },
    { textVersion: "2026-10-14" }, { textVersion: " 2026-10-18" }, { textVersion: null },
    { grantedAt: 0 }, { grantedAt: -1 }, { grantedAt: 1.5 }, { grantedAt: null },
    { grantedAt: Number.MAX_SAFE_INTEGER + 1 }, { grantedAt: NOW + FEDERATION_MAX_SKEW_MS + 1 },
  ])("refuse une preuve non bornée ou un texte périmé (%j)", (patch) => {
    expect(parseResponse({ outcome: "granted", grant: { ...GRANT, ...patch } })).toEqual(INVALID_RESPONSE)
  })

  it("admet les bornes temporelles et refuse une horloge invalide ou du JSON malformé", () => {
    expect(CONSENT_TEXT_VERSIONS.administration_reflection).toBe("2026-10-18")
    for (const grantedAt of [1, NOW + FEDERATION_MAX_SKEW_MS]) {
      expect(parseResponse({ outcome: "granted", grant: { ...GRANT, grantedAt } }).ok).toBe(true)
    }
    for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseAgentConsentTransferResponse(JSON.stringify(RESPONSE), nowMs)).toEqual(INVALID_RESPONSE)
      expect(parseAgentConsentTransferResponse('{"outcome":"unavailable"}', nowMs)).toEqual(INVALID_RESPONSE)
    }
    for (const rawBody of ["", "{", '{"outcome":"granted","grant":{"agentRef":"agent","consentRef":"nonce","textVersion":"2026-10-18","grantedAt":1e999}}']) {
      expect(parseAgentConsentTransferResponse(rawBody, NOW)).toEqual(INVALID_RESPONSE)
    }
  })

  it("borne également le corps de réponse en octets", () => {
    const raw = JSON.stringify(RESPONSE)
    const padding = AGENT_CONSENT_TRANSFER_BODY_MAX_BYTES - new TextEncoder().encode(raw).byteLength
    expect(parseAgentConsentTransferResponse(raw + " ".repeat(padding), NOW).ok).toBe(true)
    expect(parseAgentConsentTransferResponse(raw + " ".repeat(padding + 1), NOW)).toEqual(INVALID_RESPONSE)
  })
})

describe("ANTSIA-AGENT-CONSENT-V1 — séparation des textes signés", () => {
  it("signe l'environnement, l'horodatage et les octets exacts de requête dans son domaine", () => {
    const rawBody = '{\n"token":"opaque"\n}'
    expect(agentConsentTransferSigningText("sandbox", "1792281600", rawBody)).toBe(`sandbox\n1792281600\nANTSIA-AGENT-CONSENT-V1/request\n${rawBody}`)
    expect(agentConsentTransferSigningText("production", "1792281600", rawBody)).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody))
    expect(agentConsentTransferSigningText("sandbox", "1792281601", rawBody)).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody))
    expect(agentConsentTransferSigningText("sandbox", "1792281600", rawBody + " ")).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody))
    expect(agentConsentTransferSigningText("sandbox", "1792281600", rawBody)).not.toBe(federationSigningText("sandbox", "1792281600", rawBody))
  })

  it("lie une réponse au digest exact de sa requête, sans confusion avec une requête", () => {
    const rawBody = JSON.stringify(RESPONSE)
    const signed = agentConsentTransferSigningText("sandbox", "1792281600", rawBody, REQUEST_DIGEST)
    expect(signed).toBe(`sandbox\n1792281600\nANTSIA-AGENT-CONSENT-V1/response\n${REQUEST_DIGEST}\n${rawBody}`)
    expect(signed).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody))
    expect(signed).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody, "e".repeat(64)))
    expect(signed).not.toBe(agentConsentTransferSigningText("sandbox", "1792281600", rawBody + " ", REQUEST_DIGEST))
  })

  it.each(["", "b".repeat(63), "b".repeat(65), "B".repeat(64), "z".repeat(64)])("refuse un digest de requête fourni mais invalide (%s)", (digest) => {
    expect(() => agentConsentTransferSigningText("sandbox", "1792281600", "{}", digest)).toThrow(TypeError)
  })
})
