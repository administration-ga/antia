import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { commerceCanonicalJson } from "./commerce/primitives";
import {
  COMMERCE_PAYMENT_CONSENT_TEXT, COMMERCE_PAYMENT_CONSENT_VERSION, COMMERCE_PAYMENT_CONTROL_CONTRACT,
  COMMERCE_PAYMENT_CONTROL_MAX_BYTES, COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES,
  commercePaymentControlSigningInput, parseCommercePaymentControlRequest, parseCommercePaymentControlResponse,
  type CommercePaymentAuthorization, type CommercePaymentControlRequest, type CommercePaymentControlState, type CommercePaymentOptions,
} from "./commerce-payment";

const nowMs = 1_800_000_000_000;
const digest = "a".repeat(64), commandDigest = "b".repeat(64), readinessRef = "c".repeat(64);
const checkoutRef = "pro.ga:checkout:01JA00000000000000000000F1";
const paymentRef = "pro.ga:payment_intent:01JA00000000000000000000F2";
const orderRef = "pro.ga:order:01JA00000000000000000000F3";
const context = { source: "antsia", environment: "sandbox" as const, nowMs };
const optionsRequest: CommercePaymentControlRequest = {
  contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1, source: "antsia", environment: "sandbox", requestId: "payment-control-0001",
  shopRef: "pro.ga:structure:01JA00000000000000000000F4", subject: { kind: "buyer", ref: `antsia:sub:${"d".repeat(64)}`, authVerifiedAt: nowMs },
  issuedAt: nowMs, expiresAt: nowMs + 60_000, operation: "options", payload: { checkoutRef },
};
const statusRequest: CommercePaymentControlRequest = { ...optionsRequest, operation: "status", payload: { paymentRef } };
const refundRequest: CommercePaymentControlRequest = { ...optionsRequest, operation: "refund_request", payload: { paymentRef, expectedRevision: 2, reason: "changed_mind" } };
const authorizeRequest: CommercePaymentControlRequest = { ...optionsRequest, operation: "authorize_start", payload: { checkoutRef, readinessRef, commandRequestId: "payment-start-0001", commandRequestSha256: commandDigest } };
const options: CommercePaymentOptions = { checkoutRef, available: true, reason: null, amount: { amount: 1500, currency: "XAF" }, expiresAt: nowMs + 900_000,
  providerLabel: "Prestataire configuré", beneficiaryLabel: "Atelier", modes: ["mobile_money"], consentTextVersion: COMMERCE_PAYMENT_CONSENT_VERSION, readinessRef, readinessExpiresAt: nowMs + 60_000 };
const state: CommercePaymentControlState = { checkoutRef, paymentRef, orderRef, paymentState: "pending", orderState: "pending", stockState: "held", refundState: "none", reviewRequired: false, revision: 2, updatedAt: nowMs, amount: { amount: 1500, currency: "XAF" }, action: { kind: "await_provider_confirmation" } };
const authorization: CommercePaymentAuthorization = { checkoutRef, readinessRef, commandRequestId: "payment-start-0001", commandRequestSha256: commandDigest, authorized: true, expiresAt: nowMs + 60_000 };
function body(value: unknown): string { const raw = commerceCanonicalJson(value); if (raw === null) throw new Error("Invalid fixture"); return raw; }
function accepted(result: unknown) { return { contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1, requestId: optionsRequest.requestId, requestSha256: digest, outcome: "accepted", result }; }
function response(result: unknown, request = optionsRequest, at = nowMs) { return parseCommercePaymentControlResponse(body(accepted(result)), { request, requestSha256: digest, nowMs: at }); }

describe("P12 private payment control", () => {
  it("accepts the four closed buyer-bound operations without extending P06", () => {
    for (const request of [optionsRequest, statusRequest, refundRequest, authorizeRequest]) expect(parseCommercePaymentControlRequest(body(request), context)).toEqual({ ok: true, value: request });
    expect(COMMERCE_PAYMENT_CONSENT_TEXT.fr).toBe("J’autorise le lancement de ce paiement pour le montant et le bénéficiaire affichés. Une demande en attente ou un retour du fournisseur ne confirme pas le règlement.");
    expect(COMMERCE_PAYMENT_CONSENT_TEXT.en).toBe("I authorise starting this payment for the displayed amount and beneficiary. A pending request or provider return does not confirm settlement.");
  });
  it("rejects foreign source/environment, wrong buyer references and stale authentication", () => {
    for (const changed of [
      { ...optionsRequest, source: "other-source" }, { ...optionsRequest, environment: "production" },
      { ...optionsRequest, subject: { ...optionsRequest.subject, kind: "seller_operator" } },
      { ...optionsRequest, subject: { ...optionsRequest.subject, ref: `antsia:conv:${"d".repeat(64)}` } },
      { ...optionsRequest, subject: { ...optionsRequest.subject, ref: "convex-person-id" } },
      { ...optionsRequest, subject: { ...optionsRequest.subject, authVerifiedAt: nowMs + 1 } },
      { ...optionsRequest, subject: { ...optionsRequest.subject, authVerifiedAt: nowMs - 300_001 } },
      { ...optionsRequest, shopRef: orderRef }, { ...optionsRequest, subject: { ...optionsRequest.subject, email: "private@example.invalid" } },
    ]) expect(parseCommercePaymentControlRequest(body(changed), context).ok).toBe(false);
  });
  it("enforces TTL, exact reference kinds, positive revisions and opaque readiness proofs", () => {
    for (const changed of [
      { ...optionsRequest, expiresAt: nowMs }, { ...optionsRequest, expiresAt: nowMs + 60_001 },
      { ...optionsRequest, issuedAt: nowMs + 300_001, expiresAt: nowMs + 360_001 },
      { ...optionsRequest, payload: { checkoutRef: orderRef } }, { ...statusRequest, payload: { checkoutRef } },
      { ...refundRequest, payload: { ...refundRequest.payload, expectedRevision: 0 } },
      { ...refundRequest, payload: { ...refundRequest.payload, expectedRevision: 1.5 } },
      { ...refundRequest, payload: { ...refundRequest.payload, reason: "raw_private_note" } },
      { ...authorizeRequest, payload: { ...authorizeRequest.payload, readinessRef: "short" } },
      { ...authorizeRequest, payload: { ...authorizeRequest.payload, commandRequestSha256: "B".repeat(64) } },
      { ...authorizeRequest, payload: { ...authorizeRequest.payload, commandRequestId: "bad" } },
      { ...optionsRequest, merchantId: "private" }, { ...optionsRequest, payload: { checkoutRef, returnUrl: "https://example.invalid" } },
    ]) expect(parseCommercePaymentControlRequest(body(changed), context).ok).toBe(false);
  });
  it("rejects noncanonical, duplicate-key and oversized bodies before accepting a result", () => {
    const raw = body(optionsRequest);
    expect(parseCommercePaymentControlRequest(` ${raw}`, context).ok).toBe(false);
    expect(parseCommercePaymentControlRequest(`{"source":"other",${raw.slice(1)}`, context).ok).toBe(false);
    expect(parseCommercePaymentControlRequest("x".repeat(COMMERCE_PAYMENT_CONTROL_MAX_BYTES + 1), context).ok).toBe(false);
    expect(parseCommercePaymentControlResponse("x".repeat(COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES + 1), { request: optionsRequest, requestSha256: digest }).ok).toBe(false);
  });
  it("accepts configured options and honest unavailable options without a fabricated provider", () => {
    expect(response(options).ok).toBe(true);
    expect(response({ ...options, available: false, reason: "configuration_missing", providerLabel: null, beneficiaryLabel: null, modes: [], readinessRef: null, readinessExpiresAt: null }).ok).toBe(true);
    for (const result of [
      { ...options, available: "true" }, { ...options, reason: "provider_not_configured" },
      { ...options, providerLabel: null }, { ...options, beneficiaryLabel: "" }, { ...options, modes: [] },
      { ...options, modes: ["mobile_money", "mobile_money"] }, { ...options, modes: ["Contact me"] },
      { ...options, modes: Array.from({ length: 11 }, (_, i) => `mode_${i}`) },
      { ...options, readinessRef: null }, { ...options, readinessExpiresAt: null },
      { ...options, readinessExpiresAt: nowMs }, { ...options, readinessExpiresAt: nowMs + 60_001 },
      { ...options, expiresAt: nowMs + 59_999 }, { ...options, consentTextVersion: "older-version" },
      { ...options, checkoutRef: "pro.ga:checkout:01JA00000000000000000000F5" },
      { ...options, accountNumber: "private" }, { ...options, providerUrl: "https://example.invalid" },
    ]) expect(response(result).ok).toBe(false);
    expect(response(options, optionsRequest, nowMs + 60_000).ok).toBe(false);
  });
  it("requires an integer positive XAF amount and a closed money record", () => {
    for (const amount of [{ amount: 0, currency: "XAF" }, { amount: -1, currency: "XAF" }, { amount: 1.5, currency: "XAF" }, { amount: 10_000_000_001, currency: "XAF" }, { amount: "1500", currency: "XAF" }, { amount: 1500, currency: "EUR" }, { amount: 1500, currency: "XAF", recipient: "private" }]) {
      expect(response({ ...options, amount }).ok).toBe(false);
      expect(response({ ...state, amount }, statusRequest).ok).toBe(false);
    }
  });
  it("correlates request ID, exact digest, operation and business references", () => {
    expect(response(state, statusRequest).ok).toBe(true);
    for (const changed of [
      { ...accepted(options), requestId: "other-request" }, { ...accepted(options), requestSha256: "b".repeat(64) },
      { ...accepted(options), requestSha256: "A".repeat(64) }, { ...accepted(options), contract: "PRO-COMMERCE-COMMAND-V1" },
      { ...accepted(options), subject: optionsRequest.subject }, { ...accepted(options), reason: "not_available" },
    ]) expect(parseCommercePaymentControlResponse(body(changed), { request: optionsRequest, requestSha256: digest }).ok).toBe(false);
    expect(response(state, optionsRequest).ok).toBe(false);
    expect(response(options, statusRequest).ok).toBe(false);
    expect(response({ ...state, paymentRef: "pro.ga:payment_intent:01JA00000000000000000000F6" }, statusRequest).ok).toBe(false);
    expect(response({ ...state, checkoutRef: paymentRef }, statusRequest).ok).toBe(false);
    expect(response({ ...state, orderRef: checkoutRef }, statusRequest).ok).toBe(false);
  });
  it("cannot turn a provider return or callback into settlement", () => {
    for (const result of [
      { ...state, paymentState: "browser_success" }, { ...state, callbackSuccess: true },
      { ...state, orderState: "paid" }, { ...state, stockState: "reserved" }, { ...state, refundState: "success" },
      { ...state, reviewRequired: "false" }, { ...state, revision: 0 }, { ...state, updatedAt: nowMs + 300_001 },
      { ...state, action: { kind: "provider_return", success: true } },
    ]) expect(response(result, statusRequest).ok).toBe(false);
    expect(response({ ...state, paymentState: "succeeded", action: null, stockState: "released", reviewRequired: true }, statusRequest).ok).toBe(true);
  });
  it("accepts only syntactic HTTPS redirects and leaves the configured provider allowlist to the server", () => {
    const result = { ...state, paymentState: "requires_action", action: { kind: "provider_redirect", url: "https://provider.example/pay/opaque?token=opaque" } };
    expect(response(result, statusRequest).ok).toBe(true);
    for (const url of ["http://provider.example/pay", "//provider.example/pay", "https:provider.example", "https://user:password@provider.example/pay", "https://@provider.example/pay", "https://provider.example/#fragment", "https://provider.example/#", "https://provider.example:99999/pay", "https://provider.example:0/pay", "https://provider.example/a b", "https://provider.example/%zz", "javascript:alert(1)"]) expect(response({ ...result, action: { kind: "provider_redirect", url } }, statusRequest).ok).toBe(false);
    expect(response({ ...state, action: result.action }, statusRequest).ok).toBe(false);
    expect(response({ ...result, action: { kind: "none" } }, statusRequest).ok).toBe(false);
    expect(response({ ...state, action: { kind: "await_provider_confirmation", url: "https://provider.example" } }, statusRequest).ok).toBe(false);
  });
  it("requires a recorded refund, never an unchanged or regressed refund acknowledgement", () => {
    expect(response({ ...state, refundState: "requested", revision: 3 }, refundRequest).ok).toBe(true);
    expect(response(state, refundRequest).ok).toBe(false);
    expect(response({ ...state, refundState: "requested", revision: 1 }, refundRequest).ok).toBe(false);
  });
  it("binds start authorization to the exact readiness and P06 command bytes and a short deadline", () => {
    expect(response(authorization, authorizeRequest).ok).toBe(true);
    for (const result of [
      { ...authorization, checkoutRef: "pro.ga:checkout:01JA00000000000000000000F7" },
      { ...authorization, readinessRef: "e".repeat(64) }, { ...authorization, commandRequestId: "another-command-0001" },
      { ...authorization, commandRequestSha256: "f".repeat(64) }, { ...authorization, authorized: false },
      { ...authorization, expiresAt: nowMs }, { ...authorization, expiresAt: nowMs + 60_001 },
      { ...authorization, success: true }, { ...authorization, beneficiaryId: "private" },
    ]) expect(response(result, authorizeRequest).ok).toBe(false);
    expect(response(authorization, authorizeRequest, nowMs + 60_000).ok).toBe(false);
  });
  it("keeps refusal bodies neutral, bounded and mutually exclusive with accepted results", () => {
    const refusal = { contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1, requestId: optionsRequest.requestId, requestSha256: digest, outcome: "refused", reason: "revision_mismatch" };
    const correlation = { request: refundRequest, requestSha256: digest };
    expect(parseCommercePaymentControlResponse(body(refusal), correlation).ok).toBe(true);
    for (const changed of [{ ...refusal, result: state }, { ...refusal, reason: "private_provider_error" }, { ...refusal, merchantKey: "private" }]) expect(parseCommercePaymentControlResponse(body(changed), correlation).ok).toBe(false);
  });
  it("separates signatures by operation, environment, source, profile and exact body digest", () => {
    const input = { bodySha256: digest, environment: "sandbox" as const, issuedAtMs: nowMs, keyId: "antsia-key-01", nonce: "n".repeat(43), operation: "options" as const, source: "antsia" };
    const signed = commercePaymentControlSigningInput(input);
    expect(signed).toContain("pro-ga-commerce-payment-control-hmac/v1");
    expect(signed).toContain("commerce.payment.start");
    for (const changed of [{ ...input, operation: "authorize_start" as const }, { ...input, operation: "status" as const }, { ...input, operation: "refund_request" as const }, { ...input, environment: "production" as const }, { ...input, source: "other-source" }, { ...input, bodySha256: commandDigest }]) expect(commercePaymentControlSigningInput(changed)).not.toBe(signed);
    for (const changed of [{ ...input, nonce: "short" }, { ...input, keyId: "short" }, { ...input, bodySha256: "bad" }, { ...input, issuedAtMs: -1 }]) expect(commercePaymentControlSigningInput(changed)).toBeNull();
  });
});

const ownSource = new URL("./commerce-payment.ts", import.meta.url);
const twin = [new URL("../../../../ANTSIA/packages/social-domain/src/commerce-payment.ts", import.meta.url), new URL("../../../../PRO_GA/packages/pro-domain/src/commerce-payment.ts", import.meta.url)]
  .find((candidate) => fileURLToPath(candidate) !== fileURLToPath(ownSource) && existsSync(candidate));
it.skipIf(twin === undefined)("keeps the private P12 domain twins byte-identical when both checkouts are present", () => {
  if (twin === undefined) return;
  expect(readFileSync(ownSource, "utf8")).toBe(readFileSync(twin, "utf8"));
});
