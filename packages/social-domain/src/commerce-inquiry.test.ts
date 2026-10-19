/** P10 : scénarios de contrat écrits sans exécution pendant cette reprise. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  COMMERCE_INQUIRY_CONSENT_TEXT, COMMERCE_INQUIRY_CONSENT_VERSION,
  COMMERCE_INQUIRY_WITHDRAW_CONTRACT, COMMERCE_INQUIRY_WITHDRAW_MAX_BYTES,
  COMMERCE_INQUIRY_WITHDRAW_OPERATION, COMMERCE_INQUIRY_WITHDRAW_PATH, COMMERCE_INQUIRY_WITHDRAW_TTL_MS,
  parseCommerceInquiryWithdrawal, parseCommerceInquiryWithdrawalResponse,
  type CommerceInquiryWithdrawal, type CommerceInquiryWithdrawalResponse,
} from "./commerce-inquiry"
import { COMMERCE_COMMAND_SCOPES, COMMERCE_OPERATIONS, COMMERCE_RESERVED_COMMANDS, commerceCommandSigningInput, parseCommerceCommandRequest } from "./commerce/command"
import { COMMERCE_MAX_SKEW_MS, commerceCanonicalJson } from "./commerce/primitives"

const NOW = Date.UTC(2026, 9, 18, 12)
const REQUEST: CommerceInquiryWithdrawal = {
  contract: COMMERCE_INQUIRY_WITHDRAW_CONTRACT, version: 1, source: "antsia", environment: "sandbox",
  requestId: "withdraw-request-0001", issuedAt: NOW, expiresAt: NOW + COMMERCE_INQUIRY_WITHDRAW_TTL_MS,
  subjectRef: `antsia:sub:${"a".repeat(32)}`, submitRequestId: "submit-request-0001", submitRequestSha256: "b".repeat(64),
  conversationRef: `antsia:conv:${"c".repeat(32)}`, revokedAt: NOW,
}
const CONTEXT = { source: "antsia", environment: "sandbox" as const, nowMs: NOW }
const DIGEST = "d".repeat(64)
const RESPONSE: CommerceInquiryWithdrawalResponse = { contract: COMMERCE_INQUIRY_WITHDRAW_CONTRACT, version: 1,
  requestId: REQUEST.requestId, requestSha256: DIGEST, outcome: "withdrawn", respondedAt: NOW }
function canonical(value: unknown): string { const body = commerceCanonicalJson(value); if (body === null) throw new Error("Fixture non canonisable"); return body }
const request = (changes: Record<string, unknown> = {}) => parseCommerceInquiryWithdrawal(canonical({ ...REQUEST, ...changes }), CONTEXT)
const response = (changes: Record<string, unknown> = {}) => parseCommerceInquiryWithdrawalResponse(canonical({ ...RESPONSE, ...changes }), { requestId: REQUEST.requestId, requestSha256: DIGEST })
const peer = new URL("../../../../PRO_GA/packages/pro-domain/src/commerce-inquiry.ts", import.meta.url)

describe("P10 — contrat privé du retrait", () => {
  it.skipIf(!existsSync(peer))("conserve le jumeau PRO.GA octet pour octet quand le dépôt voisin est présent", () => {
    expect(readFileSync(new URL("./commerce-inquiry.ts", import.meta.url), "utf8")).toBe(readFileSync(peer, "utf8"))
  })

  it("rend le corps exact et conserve la version explicite du texte FR/EN", () => {
    expect(request()).toEqual({ ok: true, value: REQUEST })
    expect(COMMERCE_INQUIRY_CONSENT_VERSION).toBe("2026-10-18-p10-v1")
    expect(COMMERCE_INQUIRY_CONSENT_TEXT.fr).toContain("texte et du nom d’affichage que j’ai choisis")
    expect(COMMERCE_INQUIRY_CONSENT_TEXT.en).toContain("my chosen text and display name")
    expect(COMMERCE_INQUIRY_WITHDRAW_PATH).toBe("/commerce/v1/inquiry-consents")
    expect(COMMERCE_INQUIRY_WITHDRAW_MAX_BYTES).toBe(8192)
    expect(COMMERCE_INQUIRY_WITHDRAW_TTL_MS).toBe(60_000)
  })

  it("ferme chaque champ requis et refuse données privées, finalité ou version de texte ajoutées au retrait", () => {
    for (const key of Object.keys(REQUEST)) {
      const body = Object.fromEntries(Object.entries(REQUEST).filter(([name]) => name !== key))
      expect(parseCommerceInquiryWithdrawal(canonical(body), CONTEXT), key).toMatchObject({ ok: false })
    }
    for (const extra of [{ extra: true }, { sessionId: "private-session" }, { message: "fil entier" }, { purpose: "lead_marketing" }, { textVersion: "other" }, { scope: "commerce.request.status" }, { consent: true }]) {
      expect(request(extra)).toMatchObject({ ok: false, reason: "invalid_payload" })
    }
  })

  it("sépare ce contrat des commandes P06 et ne rend active aucune opération réservée", () => {
    expect(request({ contract: "PRO-COMMERCE-COMMAND-V1" })).toMatchObject({ ok: false, reason: "invalid_request" })
    expect(request({ version: 2 })).toMatchObject({ ok: false, reason: "invalid_request" })
    expect(parseCommerceCommandRequest(canonical(REQUEST), CONTEXT)).toMatchObject({ ok: false })
    expect(COMMERCE_RESERVED_COMMANDS).toContain("inquiry.withdraw")
    expect(COMMERCE_OPERATIONS).not.toContain("inquiry.withdraw")
    expect(COMMERCE_INQUIRY_WITHDRAW_OPERATION).toBe("inquiry.submit")
    expect(COMMERCE_COMMAND_SCOPES[COMMERCE_INQUIRY_WITHDRAW_OPERATION]).toBe("commerce.inquiry.submit")
  })

  it("corrèle source et environnement au contexte machine, sans réparation de casse", () => {
    for (const source of ["other", "ANTSIA", "", "antsia\n"]) expect(request({ source })).toMatchObject({ ok: false, reason: "source_mismatch" })
    expect(request({ environment: "production" })).toMatchObject({ ok: false, reason: "environment_mismatch" })
    expect(request({ environment: "development" })).toMatchObject({ ok: false })
    expect(parseCommerceInquiryWithdrawal(canonical({ ...REQUEST, environment: "production" }), { ...CONTEXT, environment: "production" })).toMatchObject({ ok: true })
  })

  it("borne les identifiants et exige l'empreinte hexadécimale exacte du dépôt original", () => {
    for (const field of ["requestId", "submitRequestId"] as const) {
      for (const value of ["short", "x".repeat(201), " ".repeat(16), 123]) expect(request({ [field]: value })).toMatchObject({ ok: false })
    }
    for (const submitRequestSha256 of ["a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), "", 123]) {
      expect(request({ submitRequestSha256 })).toMatchObject({ ok: false, reason: "invalid_payload" })
    }
  })

  it("ne reçoit que les sujets et conversations opaques du bon type", () => {
    for (const subjectRef of [REQUEST.conversationRef, `antsia:shop:${"a".repeat(32)}`, `antsia:sub:${"A".repeat(32)}`, "person@example.test"]) {
      expect(request({ subjectRef })).toMatchObject({ ok: false, reason: "invalid_reference" })
    }
    for (const conversationRef of [REQUEST.subjectRef, "personal-thread-id", `antsia:conv:${"a".repeat(25)}`]) {
      expect(request({ conversationRef })).toMatchObject({ ok: false, reason: "invalid_reference" })
    }
  })

  it("refuse expiration, TTL excessif, horloges invalides et révocation postérieure à l'émission", () => {
    for (const changes of [
      { expiresAt: NOW }, { expiresAt: NOW + COMMERCE_INQUIRY_WITHDRAW_TTL_MS + 1 },
      { issuedAt: NOW + COMMERCE_MAX_SKEW_MS + 1, expiresAt: NOW + COMMERCE_MAX_SKEW_MS + 60_001 },
      { issuedAt: NOW - COMMERCE_MAX_SKEW_MS - 1 }, { issuedAt: NOW + 0.5 },
      { revokedAt: NOW + 1 }, { revokedAt: -1 }, { expiresAt: Number.MAX_SAFE_INTEGER + 1 },
    ]) expect(request(changes)).toMatchObject({ ok: false, reason: "invalid_time" })
    expect(parseCommerceInquiryWithdrawal(canonical(REQUEST), { ...CONTEXT, nowMs: REQUEST.expiresAt - 1 })).toMatchObject({ ok: true })
    expect(parseCommerceInquiryWithdrawal(canonical(REQUEST), { ...CONTEXT, nowMs: REQUEST.expiresAt })).toMatchObject({ ok: false, reason: "invalid_time" })
    expect(parseCommerceInquiryWithdrawal(canonical(REQUEST), { ...CONTEXT, nowMs: Number.NaN })).toMatchObject({ ok: false, reason: "invalid_time" })
    expect(request({ issuedAt: NOW + COMMERCE_MAX_SKEW_MS, expiresAt: NOW + COMMERCE_MAX_SKEW_MS + COMMERCE_INQUIRY_WITHDRAW_TTL_MS })).toMatchObject({ ok: true })
  })

  it("vérifie les octets UTF-8 et refuse doublons JSON, retours ajoutés et objets non canoniques", () => {
    for (const raw of ["{", "null", "[]"]) expect(parseCommerceInquiryWithdrawal(raw, CONTEXT)).toMatchObject({ ok: false })
    expect(parseCommerceInquiryWithdrawal(`${canonical(REQUEST)}\n`, CONTEXT)).toMatchObject({ ok: false, reason: "not_canonical" })
    expect(parseCommerceInquiryWithdrawal('{"source":"antsia","source":"other"}', CONTEXT)).toMatchObject({ ok: false, reason: "not_canonical" })
    expect(parseCommerceInquiryWithdrawal(canonical({ padding: "é".repeat(4096) }), CONTEXT)).toMatchObject({ ok: false, reason: "body_too_large" })
    expect(parseCommerceInquiryWithdrawal(JSON.stringify(REQUEST, null, 2), CONTEXT)).toMatchObject({ ok: false, reason: "not_canonical" })
  })

  it("signe au profil P08 avec scope inquiry.submit et empreinte des octets exacts", () => {
    const body = canonical(REQUEST), bodySha256 = createHash("sha256").update(body).digest("hex")
    const input = { bodySha256, source: REQUEST.source, environment: REQUEST.environment, issuedAtMs: NOW, nonce: "n".repeat(24), keyId: "antsia-sandbox-key", operation: COMMERCE_INQUIRY_WITHDRAW_OPERATION }
    const signed = commerceCommandSigningInput(input)
    expect(signed).toContain("pro-ga-commerce-command-hmac/v1")
    expect(signed).toContain("commerce.inquiry.submit")
    expect(signed).toContain(bodySha256)
    expect(commerceCommandSigningInput({ ...input, environment: "production" })).not.toBe(signed)
    expect(commerceCommandSigningInput({ ...input, source: "other" })).not.toBe(signed)
    expect(commerceCommandSigningInput({ ...input, operation: "request.status" })).not.toBe(signed)
    expect(commerceCommandSigningInput({ ...input, bodySha256: createHash("sha256").update(`${body}\n`).digest("hex") })).not.toBe(signed)
  })
})

describe("P10 — réponse du retrait", () => {
  it("rend seulement la réponse fermée corrélée, pour withdrawn et rejected", () => {
    expect(response()).toEqual({ ok: true, value: RESPONSE })
    expect(response({ outcome: "rejected" })).toEqual({ ok: true, value: { ...RESPONSE, outcome: "rejected" } })
  })

  it("refuse toute corrélation approchée d'identifiant ou d'empreinte", () => {
    for (const changes of [{ requestId: "another-request" }, { requestSha256: "e".repeat(64) }, { requestSha256: DIGEST.toUpperCase() }, { requestSha256: "short" }]) {
      expect(response(changes)).toMatchObject({ ok: false, reason: "correlation_mismatch" })
    }
  })

  it("refuse mauvais contrat, état inconnu, champ manquant ou charge supplémentaire", () => {
    for (const key of Object.keys(RESPONSE)) {
      const body = Object.fromEntries(Object.entries(RESPONSE).filter(([name]) => name !== key))
      expect(parseCommerceInquiryWithdrawalResponse(canonical(body), { requestId: REQUEST.requestId, requestSha256: DIGEST }), key).toMatchObject({ ok: false })
    }
    for (const changes of [{ contract: "PRO-COMMERCE-COMMAND-V1" }, { version: 2 }, { outcome: "accepted" }, { respondedAt: -1 }, { result: { leadId: "private-id" } }, { rawBody: "private" }]) {
      expect(response(changes)).toMatchObject({ ok: false })
    }
  })

  it("applique aussi canonicalisation et borne UTF-8 à la réponse", () => {
    const context = { requestId: REQUEST.requestId, requestSha256: DIGEST }
    expect(parseCommerceInquiryWithdrawalResponse(`${canonical(RESPONSE)}\n`, context)).toMatchObject({ ok: false, reason: "not_canonical" })
    expect(parseCommerceInquiryWithdrawalResponse(canonical({ padding: "é".repeat(4096) }), context)).toMatchObject({ ok: false, reason: "body_too_large" })
  })
})
