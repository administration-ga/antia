/** P13 : suivi privé d’un engagement, jumeau ANTSIA / PRO.GA hors du contrat P06 gelé. */
import { COMMERCE_ORDER_STATES, COMMERCE_PAYMENT_STATES, type CommerceOrderState, type CommercePaymentState } from "./commerce/lifecycle";
import { COMMERCE_PAYMENT_REFUND_STATES, COMMERCE_PAYMENT_STOCK_STATES, type CommercePaymentRefundState } from "./commerce-payment";
import {
  COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAntsiaRef, commerceArray,
  commerceBoolean, commerceCapture, commerceHas, commerceInstant, commerceInteger, commerceIsMachineIdentity,
  commerceIsOpaqueId, commerceIsSha256, commerceLiteral, commerceMoney, commerceParseCanonicalBody,
  commerceRecord, commerceRef, commerceReject, commerceText, commerceUnique,
  type CommerceEnvironment, type CommerceMoney, type CommerceResult,
} from "./commerce/primitives";

export const COMMERCE_ORDER_CONTROL_CONTRACT = "PRO-COMMERCE-ORDER-CONTROL-V1";
export const COMMERCE_ORDER_CONTROL_PROFILE = "pro-ga-commerce-order-control-hmac/v1";
export const COMMERCE_ORDER_CONTROL_MAX_BYTES = 8192;
export const COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES = 65536;
export const COMMERCE_ORDER_CONTROL_TTL_MS = 60_000;
export const COMMERCE_ORDER_RECEIPT_VERSION = "2026-10-18-p13-v1";
export const COMMERCE_ORDER_RECEIPT_TEXT = {
  fr: "J’atteste avoir reçu les articles ou services de cette commande. Le paiement seul ne prouve pas la réception.",
  en: "I confirm that I have received the items or services in this order. Payment alone does not prove receipt.",
} as const;
export const COMMERCE_ORDER_CONTROL_OPERATIONS = ["read", "action_status", "cancel_request", "receipt_confirm", "return_request", "support_message"] as const;
export type CommerceOrderControlOperation = (typeof COMMERCE_ORDER_CONTROL_OPERATIONS)[number];
export const COMMERCE_ORDER_CONTROL_PATHS = {
  read: "/commerce/v1/orders/read", action_status: "/commerce/v1/orders/actions/status",
  cancel_request: "/commerce/v1/orders/cancellation-requests", receipt_confirm: "/commerce/v1/orders/receipt-confirmations",
  return_request: "/commerce/v1/orders/return-requests", support_message: "/commerce/v1/orders/messages",
} as const;
export const COMMERCE_ORDER_CONTROL_REASONS = ["access_denied", "not_available", "invalid_request", "revision_mismatch", "not_allowed", "rate_limited"] as const;
export const COMMERCE_ORDER_CANCEL_REASONS = ["changed_mind", "delay", "wrong_item", "other"] as const;
export const COMMERCE_ORDER_RETURN_REASONS = ["wrong_item", "damaged", "other"] as const;
export type CommerceOrderAction = { actionId: string; state: "accepted" | "not_found" };

type ControlBase = {
  contract: typeof COMMERCE_ORDER_CONTROL_CONTRACT; version: 1; source: string; environment: CommerceEnvironment;
  requestId: string; shopRef: string; subject: { kind: "buyer"; ref: string; authVerifiedAt: number }; issuedAt: number; expiresAt: number;
};
type ActionBase = { orderRef: string; actionId: string; expectedRevision: number };
export type CommerceOrderControlRequest = ControlBase & (
  | { operation: "read"; payload: { orderRef: string } }
  | { operation: "action_status"; payload: { orderRef: string; actionId: string } }
  | { operation: "cancel_request"; payload: ActionBase & { reason: (typeof COMMERCE_ORDER_CANCEL_REASONS)[number] } }
  | { operation: "receipt_confirm"; payload: ActionBase & { consentTextVersion: typeof COMMERCE_ORDER_RECEIPT_VERSION } }
  | { operation: "return_request"; payload: ActionBase & { reason: (typeof COMMERCE_ORDER_RETURN_REASONS)[number] } }
  | { operation: "support_message"; payload: ActionBase & { text: string } }
);
export type CommerceOrderView = {
  orderRef: string; checkoutRef: string; paymentRef: string; shopRef: string; reference: string; sellerLabel: string | null;
  createdAt: number; updatedAt: number; revision: number; paymentRevision: number;
  lines: { offerRef: string; variantRef: string | null; label: string; quantity: number; unitAmount: CommerceMoney; lineAmount: CommerceMoney }[];
  fees: { label: string; amount: CommerceMoney }[]; amount: CommerceMoney;
  orderState: CommerceOrderState; paymentState: CommercePaymentState;
  stockState: (typeof COMMERCE_PAYMENT_STOCK_STATES)[number]; refundState: CommercePaymentRefundState; reviewRequired: boolean;
  fulfillment: { mode: "pickup" | "seller_delivery" | "unknown"; state: "preparing" | "ready" | "shipped" | "delivered" | "received" | "unknown"; locality: string | null; leadTimeDays: number | null };
  receipt: { confirmationRef: string; confirmedAt: number } | null;
  settlementState: "withheld" | "eligible" | "paid" | "refund" | "unknown";
  cancellationState: "none" | "requested" | "accepted" | "rejected";
  returnState: "none" | "requested" | "resolved" | "rejected";
  history: { status: CommerceOrderState; at: number }[]; historyTruncated: boolean;
  messages: { messageRef: string; side: "buyer" | "seller"; text: string; createdAt: number }[]; messagesTruncated: boolean;
  capabilities: { canCancel: boolean; canConfirmReceipt: boolean; canRequestReturn: boolean; canMessage: boolean; canRequestRefund: boolean };
  consentTextVersion: string;
};
type ReplyBase = { contract: typeof COMMERCE_ORDER_CONTROL_CONTRACT; version: 1; requestId: string; requestSha256: string };
export type CommerceOrderControlResponse = ReplyBase & (
  | { outcome: "accepted"; result: { order: CommerceOrderView; action: CommerceOrderAction | null } }
  | { outcome: "refused" | "unavailable"; reason: (typeof COMMERCE_ORDER_CONTROL_REASONS)[number] }
);
export type CommerceOrderControlResponseContext = { request: CommerceOrderControlRequest; requestSha256: string; nowMs?: number };

function opaque(value: unknown, path: string): string {
  if (!commerceIsOpaqueId(value)) commerceReject("invalid_reference", path);
  return value;
}
function same(value: string, expected: string, path: string): string {
  if (value !== expected) commerceReject("correlation_mismatch", path);
  return value;
}

/** Validation fermée des octets canoniques ; l’authentification est effectuée par le transport. */
export function parseCommerceOrderControlRequest(rawBody: string, context: { source: string; environment: CommerceEnvironment; nowMs: number }): CommerceResult<CommerceOrderControlRequest, string> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_ORDER_CONTROL_MAX_BYTES), "$", ["contract", "version", "source", "environment", "requestId", "shopRef", "subject", "issuedAt", "expiresAt", "operation", "payload"]);
    if (row.contract !== COMMERCE_ORDER_CONTROL_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$");
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source");
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS);
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment");
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt"), expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    if (!Number.isSafeInteger(context.nowMs) || context.nowMs < 0 || Math.abs(issuedAt - context.nowMs) > COMMERCE_MAX_SKEW_MS || expiresAt <= context.nowMs || expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_ORDER_CONTROL_TTL_MS) commerceReject("invalid_time", "$.expiresAt");
    const subject = commerceRecord(row.subject, "$.subject", ["kind", "ref", "authVerifiedAt"]);
    if (subject.kind !== "buyer") commerceReject("subject_not_allowed", "$.subject.kind");
    const authVerifiedAt = commerceInstant(subject.authVerifiedAt, "$.subject.authVerifiedAt");
    if (authVerifiedAt > issuedAt || issuedAt - authVerifiedAt > COMMERCE_MAX_SKEW_MS) commerceReject("invalid_time", "$.subject.authVerifiedAt");
    const base: ControlBase = { contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, source: row.source, environment, requestId: opaque(row.requestId, "$.requestId"), shopRef: commerceRef(row.shopRef, "$.shopRef", ["structure"]), subject: { kind: "buyer", ref: commerceAntsiaRef(subject.ref, "$.subject.ref", "sub"), authVerifiedAt }, issuedAt, expiresAt };
    const operation = commerceLiteral(row.operation, "$.operation", COMMERCE_ORDER_CONTROL_OPERATIONS);
    if (operation === "read") {
      const payload = commerceRecord(row.payload, "$.payload", ["orderRef"]);
      return { ...base, operation, payload: { orderRef: commerceRef(payload.orderRef, "$.payload.orderRef", ["order"]) } };
    }
    if (operation === "action_status") {
      const payload = commerceRecord(row.payload, "$.payload", ["orderRef", "actionId"]);
      return { ...base, operation, payload: { orderRef: commerceRef(payload.orderRef, "$.payload.orderRef", ["order"]), actionId: opaque(payload.actionId, "$.payload.actionId") } };
    }
    const extra = operation === "receipt_confirm" ? "consentTextVersion" : operation === "support_message" ? "text" : "reason";
    const payload = commerceRecord(row.payload, "$.payload", ["orderRef", "actionId", "expectedRevision", extra]);
    const common: ActionBase = { orderRef: commerceRef(payload.orderRef, "$.payload.orderRef", ["order"]), actionId: opaque(payload.actionId, "$.payload.actionId"), expectedRevision: commerceInteger(payload.expectedRevision, "$.payload.expectedRevision", 1, Number.MAX_SAFE_INTEGER) };
    if (operation === "cancel_request") return { ...base, operation, payload: { ...common, reason: commerceLiteral(payload.reason, "$.payload.reason", COMMERCE_ORDER_CANCEL_REASONS) } };
    if (operation === "return_request") return { ...base, operation, payload: { ...common, reason: commerceLiteral(payload.reason, "$.payload.reason", COMMERCE_ORDER_RETURN_REASONS) } };
    if (operation === "support_message") return { ...base, operation, payload: { ...common, text: commerceText(payload.text, "$.payload.text", 1, 1000, true) } };
    if (payload.consentTextVersion !== COMMERCE_ORDER_RECEIPT_VERSION) commerceReject("invalid_payload", "$.payload.consentTextVersion");
    return { ...base, operation, payload: { ...common, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION } };
  });
}

/** Projection privée allowlistée : aucun jeton, adresse ou commentaire interne. */
function readView(value: unknown, context: CommerceOrderControlResponseContext): CommerceOrderView {
  const path = "$.result.order";
  const row = commerceRecord(value, path, ["orderRef", "checkoutRef", "paymentRef", "shopRef", "reference", "sellerLabel", "createdAt", "updatedAt", "revision", "paymentRevision", "lines", "fees", "amount", "orderState", "paymentState", "stockState", "refundState", "reviewRequired", "fulfillment", "receipt", "settlementState", "cancellationState", "returnState", "history", "historyTruncated", "messages", "messagesTruncated", "capabilities", "consentTextVersion"]);
  const orderRef = same(commerceRef(row.orderRef, `${path}.orderRef`, ["order"]), context.request.payload.orderRef, `${path}.orderRef`);
  const shopRef = same(commerceRef(row.shopRef, `${path}.shopRef`, ["structure"]), context.request.shopRef, `${path}.shopRef`);
  const createdAt = commerceInstant(row.createdAt, `${path}.createdAt`), updatedAt = commerceInstant(row.updatedAt, `${path}.updatedAt`);
  const horizon = (context.nowMs ?? context.request.issuedAt) + COMMERCE_MAX_SKEW_MS;
  if (createdAt > updatedAt || updatedAt > horizon) commerceReject("invalid_time", `${path}.updatedAt`);
  const lines = commerceArray(row.lines, `${path}.lines`, 1, 50).map((item, index) => {
    const at = `${path}.lines[${index}]`;
    const line = commerceRecord(item, at, ["offerRef", "variantRef", "label", "quantity", "unitAmount", "lineAmount"]);
    const quantity = commerceInteger(line.quantity, `${at}.quantity`, 1, 999);
    const unitAmount = commerceMoney(line.unitAmount, `${at}.unitAmount`, 0), lineAmount = commerceMoney(line.lineAmount, `${at}.lineAmount`, 0);
    if (!Number.isSafeInteger(quantity * unitAmount.amount) || quantity * unitAmount.amount !== lineAmount.amount) commerceReject("invalid_response", `${at}.lineAmount`);
    return { offerRef: commerceRef(line.offerRef, `${at}.offerRef`, ["offer"]), variantRef: line.variantRef === null ? null : commerceRef(line.variantRef, `${at}.variantRef`, ["offer_variant"]), label: commerceText(line.label, `${at}.label`, 1, 200), quantity, unitAmount, lineAmount };
  });
  commerceUnique(lines.map(line => `${line.offerRef}|${line.variantRef ?? ""}`), `${path}.lines`);
  const fees = commerceArray(row.fees, `${path}.fees`, 0, 20).map((item, index) => {
    const at = `${path}.fees[${index}]`, fee = commerceRecord(item, at, ["label", "amount"]);
    return { label: commerceText(fee.label, `${at}.label`, 1, 120), amount: commerceMoney(fee.amount, `${at}.amount`, 0) };
  });
  const amount = commerceMoney(row.amount, `${path}.amount`, 1);
  const computed = [...lines.map(line => line.lineAmount.amount), ...fees.map(fee => fee.amount.amount)].reduce((sum, item) => sum + item, 0);
  if (!Number.isSafeInteger(computed) || computed !== amount.amount) commerceReject("invalid_response", `${path}.amount`);
  const fulfillmentRow = commerceRecord(row.fulfillment, `${path}.fulfillment`, ["mode", "state", "locality", "leadTimeDays"]);
  const fulfillment: CommerceOrderView["fulfillment"] = {
    mode: commerceLiteral(fulfillmentRow.mode, `${path}.fulfillment.mode`, ["pickup", "seller_delivery", "unknown"] as const),
    state: commerceLiteral(fulfillmentRow.state, `${path}.fulfillment.state`, ["preparing", "ready", "shipped", "delivered", "received", "unknown"] as const),
    locality: fulfillmentRow.locality === null ? null : commerceText(fulfillmentRow.locality, `${path}.fulfillment.locality`, 1, 120),
    leadTimeDays: fulfillmentRow.leadTimeDays === null ? null : commerceInteger(fulfillmentRow.leadTimeDays, `${path}.fulfillment.leadTimeDays`, 0, 365),
  };
  if (fulfillment.mode === "unknown" && (fulfillment.state !== "unknown" || fulfillment.locality !== null || fulfillment.leadTimeDays !== null)) commerceReject("invalid_response", `${path}.fulfillment`);
  let receipt: CommerceOrderView["receipt"] = null;
  if (row.receipt !== null) {
    const item = commerceRecord(row.receipt, `${path}.receipt`, ["confirmationRef", "confirmedAt"]);
    receipt = { confirmationRef: opaque(item.confirmationRef, `${path}.receipt.confirmationRef`), confirmedAt: commerceInstant(item.confirmedAt, `${path}.receipt.confirmedAt`) };
    if (receipt.confirmedAt < createdAt || receipt.confirmedAt > horizon) commerceReject("invalid_time", `${path}.receipt.confirmedAt`);
  }
  if (fulfillment.state === "received" && receipt === null) commerceReject("invalid_response", `${path}.receipt`);
  const history = commerceArray(row.history, `${path}.history`, 0, 40).map((item, index) => {
    const at = `${path}.history[${index}]`, event = commerceRecord(item, at, ["status", "at"]);
    return { status: commerceLiteral(event.status, `${at}.status`, COMMERCE_ORDER_STATES), at: commerceInstant(event.at, `${at}.at`) };
  });
  const messages = commerceArray(row.messages, `${path}.messages`, 0, 20).map((item, index) => {
    const at = `${path}.messages[${index}]`, message = commerceRecord(item, at, ["messageRef", "side", "text", "createdAt"]);
    return { messageRef: opaque(message.messageRef, `${at}.messageRef`), side: commerceLiteral(message.side, `${at}.side`, ["buyer", "seller"] as const), text: commerceText(message.text, `${at}.text`, 1, 1000, true), createdAt: commerceInstant(message.createdAt, `${at}.createdAt`) };
  });
  for (const [index, event] of history.entries()) if (event.at < createdAt || event.at > horizon || (index > 0 && event.at < history[index - 1]!.at)) commerceReject("invalid_time", `${path}.history`);
  for (const [index, message] of messages.entries()) if (message.createdAt < createdAt || message.createdAt > horizon || (index > 0 && message.createdAt < messages[index - 1]!.createdAt)) commerceReject("invalid_time", `${path}.messages`);
  commerceUnique(messages.map(message => message.messageRef), `${path}.messages`);
  const capabilitiesRow = commerceRecord(row.capabilities, `${path}.capabilities`, ["canCancel", "canConfirmReceipt", "canRequestReturn", "canMessage", "canRequestRefund"]);
  const capabilities = { canCancel: commerceBoolean(capabilitiesRow.canCancel, `${path}.capabilities.canCancel`), canConfirmReceipt: commerceBoolean(capabilitiesRow.canConfirmReceipt, `${path}.capabilities.canConfirmReceipt`), canRequestReturn: commerceBoolean(capabilitiesRow.canRequestReturn, `${path}.capabilities.canRequestReturn`), canMessage: commerceBoolean(capabilitiesRow.canMessage, `${path}.capabilities.canMessage`), canRequestRefund: commerceBoolean(capabilitiesRow.canRequestRefund, `${path}.capabilities.canRequestRefund`) };
  if (receipt !== null && capabilities.canConfirmReceipt) commerceReject("invalid_response", `${path}.capabilities.canConfirmReceipt`);
  const revision = commerceInteger(row.revision, `${path}.revision`, 1, Number.MAX_SAFE_INTEGER);
  if ("expectedRevision" in context.request.payload && revision < context.request.payload.expectedRevision) commerceReject("invalid_response", `${path}.revision`);
  return {
    orderRef, shopRef, checkoutRef: commerceRef(row.checkoutRef, `${path}.checkoutRef`, ["checkout"]), paymentRef: commerceRef(row.paymentRef, `${path}.paymentRef`, ["payment_intent"]),
    reference: commerceText(row.reference, `${path}.reference`, 1, 120), sellerLabel: row.sellerLabel === null ? null : commerceText(row.sellerLabel, `${path}.sellerLabel`, 1, 120), createdAt, updatedAt, revision,
    paymentRevision: commerceInteger(row.paymentRevision, `${path}.paymentRevision`, 1, Number.MAX_SAFE_INTEGER), lines, fees, amount,
    orderState: commerceLiteral(row.orderState, `${path}.orderState`, COMMERCE_ORDER_STATES), paymentState: commerceLiteral(row.paymentState, `${path}.paymentState`, COMMERCE_PAYMENT_STATES),
    stockState: commerceLiteral(row.stockState, `${path}.stockState`, COMMERCE_PAYMENT_STOCK_STATES), refundState: commerceLiteral(row.refundState, `${path}.refundState`, COMMERCE_PAYMENT_REFUND_STATES), reviewRequired: commerceBoolean(row.reviewRequired, `${path}.reviewRequired`), fulfillment, receipt,
    settlementState: commerceLiteral(row.settlementState, `${path}.settlementState`, ["withheld", "eligible", "paid", "refund", "unknown"] as const),
    cancellationState: commerceLiteral(row.cancellationState, `${path}.cancellationState`, ["none", "requested", "accepted", "rejected"] as const), returnState: commerceLiteral(row.returnState, `${path}.returnState`, ["none", "requested", "resolved", "rejected"] as const),
    history, historyTruncated: commerceBoolean(row.historyTruncated, `${path}.historyTruncated`), messages, messagesTruncated: commerceBoolean(row.messagesTruncated, `${path}.messagesTruncated`), capabilities, consentTextVersion: commerceText(row.consentTextVersion, `${path}.consentTextVersion`, 1, 120),
  };
}

export function parseCommerceOrderControlResponse(rawBody: string, context: CommerceOrderControlResponseContext): CommerceResult<CommerceOrderControlResponse, string> {
  return commerceCapture(() => {
    if (!commerceIsSha256(context.requestSha256) || (context.nowMs !== undefined && (!Number.isSafeInteger(context.nowMs) || context.nowMs < 0))) commerceReject("invalid_request", "$");
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_ORDER_CONTROL_RESPONSE_MAX_BYTES), "$", ["contract", "version", "requestId", "requestSha256", "outcome"], ["result", "reason"]);
    if (row.contract !== COMMERCE_ORDER_CONTROL_CONTRACT || row.version !== 1 || row.requestId !== context.request.requestId || row.requestSha256 !== context.requestSha256) commerceReject("correlation_mismatch", "$");
    const base: ReplyBase = { contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, requestId: context.request.requestId, requestSha256: context.requestSha256 };
    if (row.outcome !== "accepted") {
      if (commerceHas(row, "result")) commerceReject("invalid_payload", "$.result");
      return { ...base, outcome: commerceLiteral(row.outcome, "$.outcome", ["refused", "unavailable"] as const), reason: commerceLiteral(row.reason, "$.reason", COMMERCE_ORDER_CONTROL_REASONS) };
    }
    if (commerceHas(row, "reason")) commerceReject("invalid_payload", "$.reason");
    const result = commerceRecord(row.result, "$.result", ["order", "action"]);
    const order = readView(result.order, context);
    let action: CommerceOrderAction | null = null;
    if (context.request.operation === "read") {
      if (result.action !== null) commerceReject("invalid_payload", "$.result.action");
    } else {
      const item = commerceRecord(result.action, "$.result.action", ["actionId", "state"]);
      action = { actionId: same(opaque(item.actionId, "$.result.action.actionId"), context.request.payload.actionId, "$.result.action.actionId"), state: commerceLiteral(item.state, "$.result.action.state", ["accepted", "not_found"] as const) };
      if (context.request.operation !== "action_status" && action.state !== "accepted") commerceReject("invalid_response", "$.result.action.state");
      if (context.request.operation === "receipt_confirm" && order.receipt === null) commerceReject("invalid_response", "$.result.order.receipt");
      if (context.request.operation === "cancel_request" && order.cancellationState === "none") commerceReject("invalid_response", "$.result.order.cancellationState");
      if (context.request.operation === "return_request" && order.returnState === "none") commerceReject("invalid_response", "$.result.order.returnState");
    }
    return { ...base, outcome: "accepted", result: { order, action } };
  });
}

export function commerceOrderControlSigningInput(input: { bodySha256: string; environment: CommerceEnvironment; issuedAtMs: number; keyId: string; nonce: string; operation: CommerceOrderControlOperation; source: string }): string | null {
  if (!commerceIsSha256(input.bodySha256) || !commerceIsMachineIdentity(input.source) || !COMMERCE_ENVIRONMENTS.includes(input.environment) || !COMMERCE_ORDER_CONTROL_OPERATIONS.includes(input.operation) || !Number.isSafeInteger(input.issuedAtMs) || input.issuedAtMs < 0 || !/^[A-Za-z0-9._:-]{8,128}$/u.test(input.keyId) || !/^[A-Za-z0-9_-]{24,128}$/u.test(input.nonce)) return null;
  return [COMMERCE_ORDER_CONTROL_PROFILE, input.keyId, String(input.issuedAtMs), input.nonce, input.source, input.environment, "pro.ga.commerce.order", "commerce.order.cancel.request", input.operation, input.bodySha256].map(part => `${part.length}:${part}`).join("|");
}
