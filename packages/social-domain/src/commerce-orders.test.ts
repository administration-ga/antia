import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { commerceCanonicalJson } from "./commerce/primitives";
import {
  COMMERCE_ORDER_CONTROL_CONTRACT, COMMERCE_ORDER_CONTROL_MAX_BYTES, COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES,
  COMMERCE_ORDER_RECEIPT_VERSION, commerceOrderControlSigningInput,
  parseCommerceOrderControlRequest, parseCommerceOrderControlResponse,
  type CommerceOrderControlRequest, type CommerceOrderView,
} from "./commerce-orders";

const nowMs = 1_800_000_000_000, digest = "a".repeat(64);
const orderRef = "pro.ga:order:01JA00000000000000000000F1";
const shopRef = "pro.ga:structure:01JA00000000000000000000F2";
const context = { source: "antsia", environment: "sandbox" as const, nowMs };
const request: CommerceOrderControlRequest = {
  contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, source: "antsia", environment: "sandbox",
  requestId: "order-control-request-0001", shopRef,
  subject: { kind: "buyer", ref: `antsia:sub:${"b".repeat(64)}`, authVerifiedAt: nowMs },
  issuedAt: nowMs, expiresAt: nowMs + 60_000, operation: "read", payload: { orderRef },
};
const common = { orderRef, actionId: "order-action-0001", expectedRevision: 3 };
const actions: CommerceOrderControlRequest[] = [
  { ...request, operation: "action_status", payload: { orderRef, actionId: common.actionId } },
  { ...request, operation: "cancel_request", payload: { ...common, reason: "changed_mind" } },
  { ...request, operation: "receipt_confirm", payload: { ...common, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION } },
  { ...request, operation: "return_request", payload: { ...common, reason: "damaged" } },
  { ...request, operation: "support_message", payload: { ...common, text: "Où en est la remise ?" } },
];
const order: CommerceOrderView = {
  orderRef, shopRef, checkoutRef: "pro.ga:checkout:01JA00000000000000000000F3", paymentRef: "pro.ga:payment_intent:01JA00000000000000000000F4",
  reference: "CMD-0001", sellerLabel: "Atelier", createdAt: nowMs - 1000, updatedAt: nowMs, revision: 4, paymentRevision: 2,
  lines: [{ offerRef: "pro.ga:offer:01JA00000000000000000000F5", variantRef: null, label: "Article", quantity: 2, unitAmount: { amount: 500, currency: "XAF" }, lineAmount: { amount: 1000, currency: "XAF" } }],
  fees: [{ label: "Remise", amount: { amount: 100, currency: "XAF" } }], amount: { amount: 1100, currency: "XAF" },
  orderState: "pending", paymentState: "processing", stockState: "held", refundState: "none", reviewRequired: false,
  fulfillment: { mode: "pickup", state: "preparing", locality: null, leadTimeDays: null }, receipt: null,
  settlementState: "withheld", cancellationState: "none", returnState: "none",
  history: [{ status: "pending", at: nowMs - 1000 }], historyTruncated: false, messages: [], messagesTruncated: false,
  capabilities: { canCancel: true, canConfirmReceipt: false, canRequestReturn: false, canMessage: true, canRequestRefund: false },
  consentTextVersion: "p11-terms-v1",
};
function body(value: unknown): string {
  const raw = commerceCanonicalJson(value);
  if (raw === null) throw new Error("Invalid fixture");
  return raw;
}
function accepted(value: unknown, action: unknown = null) {
  return { contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, requestId: request.requestId, requestSha256: digest, outcome: "accepted", result: { order: value, action } };
}
function response(value: unknown, req = request, action: unknown = null) {
  return parseCommerceOrderControlResponse(body(accepted(value, action)), { request: req, requestSha256: digest, nowMs });
}

describe("P13 private order control", () => {
  it("admits only the closed buyer operations and explicit receipt text version", () => {
    for (const value of [request, ...actions]) expect(parseCommerceOrderControlRequest(body(value), context)).toEqual({ ok: true, value });
    const receipt = actions[2]!;
    expect(parseCommerceOrderControlRequest(body({ ...receipt, payload: { ...receipt.payload, consentTextVersion: "browser-success" } }), context).ok).toBe(false);
  });
  it("rejects another machine/environment, stale subject proof, wrong reference kind and extra personal fields", () => {
    for (const changed of [
      { ...request, source: "other-source" }, { ...request, environment: "production" },
      { ...request, shopRef: orderRef }, { ...request, payload: { orderRef: shopRef } },
      { ...request, subject: { ...request.subject, kind: "seller_operator" } },
      { ...request, subject: { ...request.subject, ref: "internal-person-id" } },
      { ...request, subject: { ...request.subject, authVerifiedAt: nowMs + 1 } },
      { ...request, subject: { ...request.subject, authVerifiedAt: nowMs - 300_001 } },
      { ...request, subject: { ...request.subject, email: "private@example.invalid" } },
      { ...request, payload: { orderRef, address: "private" } },
      { ...request, expiresAt: nowMs }, { ...request, expiresAt: nowMs + 60_001 },
    ]) expect(parseCommerceOrderControlRequest(body(changed), context).ok).toBe(false);
  });
  it("requires stable opaque action identity, positive revision, closed reasons and bounded normalized text", () => {
    for (const payload of [
      { ...common, reason: "changed_mind", expectedRevision: 0 }, { ...common, reason: "changed_mind", expectedRevision: 1.5 },
      { ...common, reason: "changed_mind", actionId: "short" }, { ...common, reason: "raw provider details" },
      { ...common, reason: "changed_mind", token: "private" },
    ]) expect(parseCommerceOrderControlRequest(body({ ...request, operation: "cancel_request", payload }), context).ok).toBe(false);
    for (const text of ["", " padded ", "x".repeat(1001), "bad\u0000text", "e\u0301"]) {
      expect(parseCommerceOrderControlRequest(body({ ...request, operation: "support_message", payload: { ...common, text } }), context).ok).toBe(false);
    }
  });
  it("rejects noncanonical, duplicate-key and oversized requests or responses", () => {
    const raw = body(request);
    expect(parseCommerceOrderControlRequest(` ${raw}`, context).ok).toBe(false);
    expect(parseCommerceOrderControlRequest(`{"source":"other",${raw.slice(1)}`, context).ok).toBe(false);
    expect(parseCommerceOrderControlRequest("x".repeat(COMMERCE_ORDER_CONTROL_MAX_BYTES + 1), context).ok).toBe(false);
    expect(parseCommerceOrderControlResponse("x".repeat(COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES + 1), { request, requestSha256: digest }).ok).toBe(false);
  });
  it("keeps payment, stock, seller delivery, buyer receipt and payout separate", () => {
    expect(response(order).ok).toBe(true);
    expect(response({ ...order, sellerLabel: null }).ok).toBe(true);
    expect(response({ ...order, paymentState: "succeeded", stockState: "consumed", orderState: "confirmed" }).ok).toBe(true);
    expect(response({ ...order, fulfillment: { ...order.fulfillment, state: "received" } }).ok).toBe(false);
    expect(response({ ...order, fulfillment: { mode: "unknown", state: "unknown", locality: null, leadTimeDays: null } }).ok).toBe(true);
    for (const changed of [
      { ...order, orderState: "paid" }, { ...order, paymentState: "browser_success" }, { ...order, refundState: "browser_refunded" },
      { ...order, receipt: { confirmationRef: common.actionId, confirmedAt: nowMs }, capabilities: { ...order.capabilities, canConfirmReceipt: true } },
      { ...order, fulfillment: { mode: "unknown", state: "delivered", locality: null, leadTimeDays: null } },
      { ...order, payoutExecuted: true },
    ]) expect(response(changed).ok).toBe(false);
  });
  it("accepts an explicit receipt proof without fabricating completed order or seller payout", () => {
    const received: CommerceOrderView = { ...order, paymentState: "succeeded", stockState: "consumed", orderState: "delivered",
      fulfillment: { ...order.fulfillment, state: "received" }, receipt: { confirmationRef: "receipt-proof-0001", confirmedAt: nowMs } };
    expect(response(received, actions[2]!, { actionId: common.actionId, state: "accepted" }).ok).toBe(true);
    expect(received.settlementState).toBe("withheld");
    expect(response({ ...received, receipt: null }, actions[2]!, { actionId: common.actionId, state: "accepted" }).ok).toBe(false);
    expect(response({ ...received, receipt: { ...received.receipt!, confirmedAt: nowMs + 300_001 } }).ok).toBe(false);
  });
  it("validates frozen arithmetic and rejects duplicate, altered or foreign lines", () => {
    const line = order.lines[0]!;
    for (const changed of [
      { ...order, amount: { amount: 1000, currency: "XAF" } },
      { ...order, lines: [{ ...line, lineAmount: { amount: 999, currency: "XAF" } }] },
      { ...order, lines: [{ ...line, quantity: 0 }] },
      { ...order, lines: [{ ...line, offerRef: orderRef }] },
      { ...order, lines: [{ ...line, variantRef: shopRef }] },
      { ...order, lines: [line, line], amount: { amount: 2100, currency: "XAF" } },
      { ...order, amount: { amount: 1100, currency: "EUR" } },
      { ...order, fees: [{ ...order.fees[0]!, sellerAccount: "private" }] },
    ]) expect(response(changed).ok).toBe(false);
  });
  it("correlates machine reply, order, seller, action ID and monotone revisions", () => {
    for (const changed of [
      { ...accepted(order), requestId: "other-request" }, { ...accepted(order), requestSha256: "b".repeat(64) },
      { ...accepted(order), contract: "PRO-COMMERCE-PAYMENT-CONTROL-V1" }, { ...accepted(order), reason: "not_available" },
    ]) expect(parseCommerceOrderControlResponse(body(changed), { request, requestSha256: digest }).ok).toBe(false);
    expect(response({ ...order, orderRef: "pro.ga:order:01JA00000000000000000000F6" }).ok).toBe(false);
    expect(response({ ...order, shopRef: "pro.ga:structure:01JA00000000000000000000F6" }).ok).toBe(false);
    const cancel = actions[1]!;
    expect(response({ ...order, cancellationState: "requested" }, cancel, { actionId: common.actionId, state: "accepted" }).ok).toBe(true);
    expect(response({ ...order, cancellationState: "requested", revision: 2 }, cancel, { actionId: common.actionId, state: "accepted" }).ok).toBe(false);
    expect(response({ ...order, cancellationState: "requested" }, cancel, { actionId: "other-action-0001", state: "accepted" }).ok).toBe(false);
    expect(response(order, actions[0]!, { actionId: common.actionId, state: "not_found" }).ok).toBe(true);
    expect(response(order, cancel, { actionId: common.actionId, state: "accepted" }).ok).toBe(false);
  });
  it("exposes a bounded public-to-buyer timeline and messages without internal actors or notes", () => {
    const message = { messageRef: "message-0001", side: "seller", text: "Votre commande est prête.", createdAt: nowMs };
    expect(response({ ...order, messages: [message] }).ok).toBe(true);
    for (const changed of [
      { ...order, address: "private" }, { ...order, providerToken: "secret" },
      { ...order, history: [{ ...order.history[0]!, note: "internal" }] },
      { ...order, history: [{ status: "pending", at: nowMs }, { status: "confirmed", at: nowMs - 500 }] },
      { ...order, history: [{ status: "pending", at: nowMs + 300_001 }] },
      { ...order, messages: [{ ...message, actorUserId: "private" }] }, { ...order, messages: [message, message] },
      { ...order, messages: [{ ...message, createdAt: nowMs - 1001 }] },
    ]) expect(response(changed).ok).toBe(false);
  });
  it("separates signatures by operation, environment, source and exact body without reusing P12", () => {
    const input = { bodySha256: digest, environment: "sandbox" as const, issuedAtMs: nowMs, keyId: "antsia-key-01", nonce: "n".repeat(43), operation: "read" as const, source: "antsia" };
    const signed = commerceOrderControlSigningInput(input);
    expect(signed).toContain("pro-ga-commerce-order-control-hmac/v1");
    expect(signed).toContain("commerce.order.cancel.request");
    for (const changed of [{ ...input, operation: "receipt_confirm" as const }, { ...input, source: "another-source" }, { ...input, environment: "production" as const }, { ...input, bodySha256: "f".repeat(64) }]) expect(commerceOrderControlSigningInput(changed)).not.toBe(signed);
    for (const changed of [{ ...input, nonce: "short" }, { ...input, keyId: "short" }, { ...input, bodySha256: "bad" }, { ...input, issuedAtMs: -1 }]) expect(commerceOrderControlSigningInput(changed)).toBeNull();
  });
});

const ownSource = new URL("./commerce-orders.ts", import.meta.url);
const twin = [new URL("../../../../ANTSIA/packages/social-domain/src/commerce-orders.ts", import.meta.url), new URL("../../../../PRO_GA/packages/pro-domain/src/commerce-orders.ts", import.meta.url)]
  .find(candidate => fileURLToPath(candidate) !== fileURLToPath(ownSource) && existsSync(candidate));
it.skipIf(twin === undefined)("keeps the P13 private contracts byte-identical when both projects are present", () => {
  if (twin === undefined) return;
  expect(readFileSync(ownSource, "utf8")).toBe(readFileSync(twin, "utf8"));
});
