/** P12 : faux transport uniquement ; aucun appel réel ni scénario exécuté pendant l'implémentation. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { COMMERCE_COMMAND_LIMITS, commerceCommandSigningInput } from "@antsia/social-domain/commerce/command"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import {
  COMMERCE_PAYMENT_CONSENT_VERSION, COMMERCE_PAYMENT_CONTROL_CONTRACT, COMMERCE_PAYMENT_CONTROL_MAX_BYTES,
  COMMERCE_PAYMENT_CONTROL_PATHS, COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES, commercePaymentControlSigningInput,
  type CommercePaymentControlRequest,
} from "@antsia/social-domain/commerce-payment"
import { sendPaymentCommand, sendPaymentControl } from "./paymentClient"
import { base64url, sha256Hex } from "./commerceLinkCrypto"
import type { CommerceLinkConfig } from "./commerceLinkConfig"

const NOW = Date.UTC(2026, 9, 18, 12)
const config: CommerceLinkConfig = {
  source: "antsia", environment: "sandbox", proHttpOrigin: "https://pro.invalid", proAppOrigin: "https://app.invalid",
  antsiaOrigin: "https://antsia.invalid", redirectUri: "https://antsia.invalid/retour", keyId: "fixture-key-0001",
  signingKey: "fixture-only-private-key-for-payment-not-a-credential", fingerprint: "fixture-fingerprint",
}
const checkoutRef = "pro.ga:checkout:01JA00000000000000000000F1"
const paymentRef = "pro.ga:payment_intent:01JA00000000000000000000F2"
const orderRef = "pro.ga:order:01JA00000000000000000000F3"
const base: Omit<CommercePaymentControlRequest, "operation" | "payload"> = {
  contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1 as const, source: "antsia", environment: "sandbox" as const,
  requestId: "p12-control-fixture-0001", issuedAt: NOW, expiresAt: NOW + 60_000,
  shopRef: "pro.ga:structure:01JA00000000000000000000F4",
  subject: { kind: "buyer" as const, ref: `antsia:sub:${"a".repeat(32)}`, authVerifiedAt: NOW },
}
const options: CommercePaymentControlRequest = { ...base, operation: "options", payload: { checkoutRef } }
const status: CommercePaymentControlRequest = { ...base, operation: "status", payload: { paymentRef } }
const refund: CommercePaymentControlRequest = { ...base, operation: "refund_request", payload: { paymentRef, expectedRevision: 2, reason: "changed_mind" } }
const authorize: CommercePaymentControlRequest = { ...base, operation: "authorize_start", payload: {
  checkoutRef, readinessRef: "b".repeat(32), commandRequestId: "p12-command-fixture-0001", commandRequestSha256: "c".repeat(64),
} }
const state = { checkoutRef, paymentRef, orderRef, paymentState: "processing", orderState: "pending", stockState: "held", refundState: "none",
  reviewRequired: false, revision: 2, updatedAt: NOW, amount: { amount: 1000, currency: "XAF" }, action: null }
function canonical(value: unknown): string { const raw = commerceCanonicalJson(value); if (raw === null) throw new Error("Fixture non sérialisable."); return raw }
async function accepted(request: CommercePaymentControlRequest, result: unknown) {
  return { contract: request.contract, version: 1, requestId: request.requestId, requestSha256: await sha256Hex(canonical(request)), outcome: "accepted", result }
}
async function signature(input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input))))
}
function signingCommon(headers: Headers, rawBody: string) {
  return sha256Hex(rawBody).then(bodySha256 => ({ bodySha256, environment: config.environment, source: config.source,
    issuedAtMs: Number(headers.get("X-Pro-Timestamp")), keyId: headers.get("X-Pro-Key-Id")!, nonce: headers.get("X-Pro-Nonce")! }))
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

describe("P12 private payment transport (fake fetch only)", () => {
  it.each(["payment.start", "request.status"] as const)("resends exact persisted bytes and signs the exact P06 scope for %s", async command => {
    const raw = canonical({ command, requestId: "payment-0000001", payload: { note: "Texte privé choisi" } })
    const bodies: string[] = [], proofs: Headers[] = []
    const fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toBe("https://pro.invalid/commerce/v1/commands")
      expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" })
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      bodies.push(String(init?.body)); proofs.push(new Headers(init?.headers))
      return new Response("{}", { status: 503 })
    }
    expect(await sendPaymentCommand(config, raw, fetcher)).toEqual({ status: 503, rawResponse: "{}" })
    await sendPaymentCommand(config, raw, fetcher)
    expect(bodies).toEqual([raw, raw])
    expect(proofs[0]!.get("X-Pro-Nonce")).not.toBe(proofs[1]!.get("X-Pro-Nonce"))
    for (const proof of proofs) {
      expect(proof.get("Cookie")).toBeNull(); expect(proof.get("Authorization")).toBeNull()
      expect(proof.get("X-Pro-Signature")).toMatch(/^[A-Za-z0-9_-]{43}$/u)
      const common = await signingCommon(proof, raw), input = commerceCommandSigningInput({ ...common, operation: command })!
      expect(proof.get("X-Pro-Signature")).toBe(await signature(input))
      const other = commerceCommandSigningInput({ ...common, operation: command === "payment.start" ? "request.status" : "payment.start" })!
      expect(proof.get("X-Pro-Signature")).not.toBe(await signature(other))
    }
    expect(JSON.stringify([...proofs[0]!.entries()])).not.toContain(config.signingKey)
  })
  it("does not send other commands, malformed JSON or UTF-8 request bodies beyond P06 limits", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"))
    for (const raw of ["not-json", "null", "[]", '{"command":"checkout.prepare"}', '{"command":"inquiry.submit"}', '{"command":"payment.status"}',
      canonical({ command: "payment.start", padding: "é".repeat(COMMERCE_COMMAND_LIMITS.requestMaxBytes) })]) expect(await sendPaymentCommand(config, raw, fetcher)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("accepts the exact request byte boundary and bounds the actual command response stream", async () => {
    const prefix = '{"command":"payment.start","padding":"', suffix = '"}'
    const raw = prefix + "x".repeat(COMMERCE_COMMAND_LIMITS.requestMaxBytes - prefix.length - suffix.length) + suffix
    let called = 0
    const fetcher: typeof fetch = async () => { called += 1; return new Response("x".repeat(COMMERCE_COMMAND_LIMITS.responseMaxBytes)) }
    expect((await sendPaymentCommand(config, raw, fetcher))?.rawResponse.length).toBe(COMMERCE_COMMAND_LIMITS.responseMaxBytes)
    expect(await sendPaymentCommand(config, `${raw} `, fetcher)).toBeNull(); expect(called).toBe(1)
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(COMMERCE_COMMAND_LIMITS.responseMaxBytes + 1)) }, cancel() { cancelled = true } })
    expect(await sendPaymentCommand(config, raw, async () => new Response(stream))).toBeNull(); expect(cancelled).toBe(true)
  })
  it("uses canonical private requests, the payment HMAC profile and the fixed paths for all four controls", async () => {
    const cases: { request: CommercePaymentControlRequest; result: unknown }[] = [
      { request: options, result: { checkoutRef, available: false, reason: "provider_not_configured", amount: { amount: 1000, currency: "XAF" }, expiresAt: NOW + 900_000,
        providerLabel: null, beneficiaryLabel: null, modes: [], consentTextVersion: COMMERCE_PAYMENT_CONSENT_VERSION, readinessRef: null, readinessExpiresAt: null } },
      { request: status, result: state },
      { request: refund, result: { ...state, revision: 3, refundState: "requested" } },
      { request: authorize, result: { ...authorize.payload, authorized: true, expiresAt: NOW + 60_000 } },
    ]
    for (const fixture of cases) {
      const rawBody = canonical(fixture.request), response = await accepted(fixture.request, fixture.result)
      const fetcher: typeof fetch = async (url, init) => {
        expect(String(url)).toBe(`https://pro.invalid${COMMERCE_PAYMENT_CONTROL_PATHS[fixture.request.operation]}`)
        expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", body: rawBody })
        const proof = new Headers(init?.headers), common = await signingCommon(proof, rawBody)
        const input = commercePaymentControlSigningInput({ ...common, operation: fixture.request.operation })!
        expect(proof.get("X-Pro-Signature")).toBe(await signature(input)); expect(proof.get("Cookie")).toBeNull()
        const commandInput = commerceCommandSigningInput({ ...common, operation: "payment.start" })!
        expect(proof.get("X-Pro-Signature")).not.toBe(await signature(commandInput))
        return new Response(canonical(response), { status: 200 })
      }
      expect((await sendPaymentControl(config, fixture.request, fetcher))?.outcome).toBe("accepted")
    }
  })
  it("refuses mismatched source/environment, expired controls, unexpected fields and requests beyond 8 KiB before fetch", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"))
    for (const request of [{ ...options, source: "foreign" }, { ...options, environment: "production" as const }, { ...options, expiresAt: NOW },
      { ...options, expiresAt: NOW + 60_001 }, { ...options, unexpected: "not-allowed" }, { ...options, padding: "é".repeat(COMMERCE_PAYMENT_CONTROL_MAX_BYTES) }]) expect(await sendPaymentControl(config, request, fetcher)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("requires request ID, digest, object reference, closed fields and compatible HTTP status", async () => {
    const response = await accepted(status, state)
    for (const changed of [{ ...response, requestId: "another-request-0001" }, { ...response, requestSha256: "d".repeat(64) },
      { ...response, result: { ...state, paymentRef: "pro.ga:payment_intent:01JA00000000000000000000F5" } }, { ...response, extra: "private" },
      { ...response, result: { ...state, amount: { amount: 1000.5, currency: "XAF" } } }, { ...response, result: { ...state, amount: { amount: 1000, currency: "EUR" } } }]) {
      expect(await sendPaymentControl(config, status, async () => new Response(canonical(changed), { status: 200 }))).toBeNull()
    }
    expect(await sendPaymentControl(config, status, async () => new Response(canonical(response), { status: 503 }))).toBeNull()
    const refused = { contract: status.contract, version: 1, requestId: status.requestId, requestSha256: await sha256Hex(canonical(status)), outcome: "refused", reason: "not_refundable" }
    expect((await sendPaymentControl(config, status, async () => new Response(canonical(refused), { status: 422 })))?.outcome).toBe("refused")
    expect(await sendPaymentControl(config, status, async () => new Response(canonical(refused), { status: 200 }))).toBeNull()
    const unavailable = { ...refused, outcome: "unavailable", reason: "rate_limited" }
    expect((await sendPaymentControl(config, status, async () => new Response(canonical(unavailable), { status: 429 })))?.outcome).toBe("unavailable")
    expect(await sendPaymentControl(config, status, async () => new Response(canonical(unavailable), { status: 200 }))).toBeNull()
  })
  it("does not accept an authorization for different command bytes or an expired readiness", async () => {
    const response = await accepted(authorize, { ...authorize.payload, authorized: true, expiresAt: NOW + 60_000 })
    for (const changed of [{ ...authorize.payload, authorized: true, commandRequestSha256: "e".repeat(64), expiresAt: NOW + 60_000 },
      { ...authorize.payload, authorized: true, readinessRef: "f".repeat(32), expiresAt: NOW + 60_000 },
      { ...authorize.payload, authorized: true, expiresAt: NOW + 60_001 }]) expect(await sendPaymentControl(config, authorize, async () => new Response(canonical({ ...response, result: changed })))).toBeNull()
    expect(await sendPaymentControl(config, authorize, async () => { vi.setSystemTime(NOW + 60_000); return new Response(canonical(response)) })).toBeNull()
  })
  it("bounds control responses at 16 KiB without trusting Content-Length", async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES + 1)) }, cancel() { cancelled = true } })
    expect(await sendPaymentControl(config, status, async () => new Response(stream, { headers: { "Content-Length": "1" } }))).toBeNull()
    expect(cancelled).toBe(true)
  })
  it("fails closed on network errors, redirects and invalid UTF-8", async () => {
    const raw = canonical({ command: "payment.start" })
    expect(await sendPaymentCommand(config, raw, async () => { throw new Error("fixture-network-error") })).toBeNull()
    expect(await sendPaymentControl(config, status, async () => { throw new Error("fixture-network-error") })).toBeNull()
    expect(await sendPaymentCommand(config, raw, async () => new Response("{}", { status: 302, headers: { Location: "https://foreign.invalid" } }))).toBeNull()
    expect(await sendPaymentControl(config, status, async () => new Response(new Uint8Array([0xc3, 0x28])))).toBeNull()
  })
  it("aborts the transport after eight seconds and exposes no provider success from a timeout", async () => {
    let started!: () => void
    const fetched = new Promise<void>(resolve => { started = resolve })
    const captured: { signal?: AbortSignal | null } = {}
    const fetcher: typeof fetch = async (_url, init) => {
      captured.signal = init?.signal; started()
      return new Promise<Response>((_resolve, reject) => captured.signal?.addEventListener("abort", () => reject(new DOMException("fixture-aborted", "AbortError")), { once: true }))
    }
    const result = sendPaymentCommand(config, canonical({ command: "payment.start" }), fetcher)
    await fetched; await vi.advanceTimersByTimeAsync(8_000)
    expect(await result).toBeNull(); expect(captured.signal?.aborted).toBe(true)
  })
})
