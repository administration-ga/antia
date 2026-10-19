/** P12 : contrôle privé du paiement, jumeau ANTSIA / PRO.GA hors manifeste P06. */
import type { CommercePaymentAction } from "./commerce/command";
import { COMMERCE_ORDER_STATES, COMMERCE_PAYMENT_STATES, type CommerceOrderState, type CommercePaymentState } from "./commerce/lifecycle";
import {
  COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAntsiaRef, commerceArray,
  commerceBoolean, commerceCapture, commerceHas, commerceInstant, commerceInteger, commerceIsMachineIdentity,
  commerceIsOpaqueId, commerceIsSha256, commerceLiteral, commerceMoney, commerceParseCanonicalBody,
  commerceRecord, commerceRef, commerceReject, commerceText, commerceUnique,
  type CommerceEnvironment, type CommerceMoney, type CommerceResult,
} from "./commerce/primitives";

export const COMMERCE_PAYMENT_CONTROL_CONTRACT = "PRO-COMMERCE-PAYMENT-CONTROL-V1";
export const COMMERCE_PAYMENT_CONTROL_PROFILE = "pro-ga-commerce-payment-control-hmac/v1";
export const COMMERCE_PAYMENT_CONTROL_MAX_BYTES = 8192;
export const COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES = 16384;
export const COMMERCE_PAYMENT_CONTROL_TTL_MS = 60_000;
export const COMMERCE_PAYMENT_CONSENT_VERSION = "2026-10-18-p12-v1";
export const COMMERCE_PAYMENT_CONSENT_TEXT = {
  fr: "J’autorise le lancement de ce paiement pour le montant et le bénéficiaire affichés. Une demande en attente ou un retour du fournisseur ne confirme pas le règlement.",
  en: "I authorise starting this payment for the displayed amount and beneficiary. A pending request or provider return does not confirm settlement.",
} as const;
export const COMMERCE_PAYMENT_CONTROL_OPERATIONS = ["options", "status", "refund_request", "authorize_start"] as const;
export type CommercePaymentControlOperation = (typeof COMMERCE_PAYMENT_CONTROL_OPERATIONS)[number];
export const COMMERCE_PAYMENT_CONTROL_PATHS = {
  options: "/commerce/v1/payments/options", status: "/commerce/v1/payments/status",
  refund_request: "/commerce/v1/payments/refund-requests", authorize_start: "/commerce/v1/payments/authorizations",
} as const;
export const COMMERCE_PAYMENT_CONTROL_REASONS = ["access_denied", "not_available", "not_refundable", "rate_limited", "invalid_request", "revision_mismatch"] as const;
export const COMMERCE_PAYMENT_OPTIONS_REASONS = ["configuration_missing", "policy_closed", "provider_not_configured", "checkout_unavailable"] as const;
export const COMMERCE_PAYMENT_REFUND_REASONS = ["changed_mind", "duplicate_payment", "late_payment", "other"] as const;
export const COMMERCE_PAYMENT_STOCK_STATES = ["held", "consumed", "expired", "released"] as const;
export const COMMERCE_PAYMENT_REFUND_STATES = ["none", "requested", "processing", "confirmed", "failed", "rejected"] as const;
export type CommercePaymentRefundState = (typeof COMMERCE_PAYMENT_REFUND_STATES)[number];

type ControlBase = {
  contract: typeof COMMERCE_PAYMENT_CONTROL_CONTRACT; version: 1; source: string; environment: CommerceEnvironment;
  requestId: string; shopRef: string; subject: { kind: "buyer"; ref: string; authVerifiedAt: number }; issuedAt: number; expiresAt: number;
};
export type CommercePaymentControlRequest = ControlBase & (
  | { operation: "options"; payload: { checkoutRef: string } }
  | { operation: "status"; payload: { paymentRef: string } }
  | { operation: "refund_request"; payload: { paymentRef: string; expectedRevision: number; reason: (typeof COMMERCE_PAYMENT_REFUND_REASONS)[number] } }
  | { operation: "authorize_start"; payload: { checkoutRef: string; readinessRef: string; commandRequestId: string; commandRequestSha256: string } }
);
export type CommercePaymentOptions = {
  checkoutRef: string; available: boolean; reason: (typeof COMMERCE_PAYMENT_OPTIONS_REASONS)[number] | null;
  amount: CommerceMoney; expiresAt: number; providerLabel: string | null; beneficiaryLabel: string | null;
  modes: string[]; consentTextVersion: typeof COMMERCE_PAYMENT_CONSENT_VERSION;
  readinessRef: string | null; readinessExpiresAt: number | null;
};
export type CommercePaymentControlState = {
  checkoutRef: string; paymentRef: string; orderRef: string; paymentState: CommercePaymentState; orderState: CommerceOrderState;
  stockState: (typeof COMMERCE_PAYMENT_STOCK_STATES)[number]; refundState: CommercePaymentRefundState;
  reviewRequired: boolean; revision: number; updatedAt: number; amount: CommerceMoney; action: CommercePaymentAction | null;
};
export type CommercePaymentAuthorization = {
  checkoutRef: string; readinessRef: string; commandRequestId: string; commandRequestSha256: string; authorized: true; expiresAt: number;
};
type ReplyBase = { contract: typeof COMMERCE_PAYMENT_CONTROL_CONTRACT; version: 1; requestId: string; requestSha256: string };
export type CommercePaymentControlResponse = ReplyBase & (
  | { outcome: "accepted"; result: CommercePaymentOptions | CommercePaymentControlState | CommercePaymentAuthorization }
  | { outcome: "refused" | "unavailable"; reason: (typeof COMMERCE_PAYMENT_CONTROL_REASONS)[number] }
);
export type CommercePaymentControlResponseContext = { request: CommercePaymentControlRequest; requestSha256: string; nowMs?: number };

function opaqueId(value: unknown, path: string): string {
  if (!commerceIsOpaqueId(value)) commerceReject("invalid_reference", path);
  return value;
}
function sha256(value: unknown, path: string): string {
  if (!commerceIsSha256(value)) commerceReject("invalid_payload", path);
  return value;
}
function sameRef(value: string, expected: string, path: string): string {
  if (value !== expected) commerceReject("correlation_mismatch", path);
  return value;
}

/** La preuve de signature et le SHA-256 des octets sont vérifiés par le transport serveur. */
export function parseCommercePaymentControlRequest(rawBody: string, context: { source: string; environment: CommerceEnvironment; nowMs: number }): CommerceResult<CommercePaymentControlRequest, string> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_PAYMENT_CONTROL_MAX_BYTES), "$", [
      "contract", "version", "source", "environment", "requestId", "shopRef", "subject", "issuedAt", "expiresAt", "operation", "payload",
    ]);
    if (row.contract !== COMMERCE_PAYMENT_CONTROL_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$");
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source");
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS);
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment");
    const requestId = opaqueId(row.requestId, "$.requestId");
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt"), expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    if (!Number.isSafeInteger(context.nowMs) || context.nowMs < 0 || Math.abs(issuedAt - context.nowMs) > COMMERCE_MAX_SKEW_MS ||
      expiresAt <= context.nowMs || expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_PAYMENT_CONTROL_TTL_MS) commerceReject("invalid_time", "$.expiresAt");
    const subject = commerceRecord(row.subject, "$.subject", ["kind", "ref", "authVerifiedAt"]);
    if (subject.kind !== "buyer") commerceReject("subject_not_allowed", "$.subject.kind");
    const authVerifiedAt = commerceInstant(subject.authVerifiedAt, "$.subject.authVerifiedAt");
    if (authVerifiedAt > issuedAt || issuedAt - authVerifiedAt > COMMERCE_MAX_SKEW_MS) commerceReject("invalid_time", "$.subject.authVerifiedAt");
    const base: ControlBase = { contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1, source: row.source, environment, requestId,
      shopRef: commerceRef(row.shopRef, "$.shopRef", ["structure"]), issuedAt, expiresAt,
      subject: { kind: "buyer", ref: commerceAntsiaRef(subject.ref, "$.subject.ref", "sub"), authVerifiedAt } };
    const operation = commerceLiteral(row.operation, "$.operation", COMMERCE_PAYMENT_CONTROL_OPERATIONS);
    if (operation === "options") {
      const payload = commerceRecord(row.payload, "$.payload", ["checkoutRef"]);
      return { ...base, operation, payload: { checkoutRef: commerceRef(payload.checkoutRef, "$.payload.checkoutRef", ["checkout"]) } };
    }
    if (operation === "authorize_start") {
      const payload = commerceRecord(row.payload, "$.payload", ["checkoutRef", "readinessRef", "commandRequestId", "commandRequestSha256"]);
      return { ...base, operation, payload: { checkoutRef: commerceRef(payload.checkoutRef, "$.payload.checkoutRef", ["checkout"]),
        readinessRef: opaqueId(payload.readinessRef, "$.payload.readinessRef"), commandRequestId: opaqueId(payload.commandRequestId, "$.payload.commandRequestId"),
        commandRequestSha256: sha256(payload.commandRequestSha256, "$.payload.commandRequestSha256") } };
    }
    if (operation === "status") {
      const payload = commerceRecord(row.payload, "$.payload", ["paymentRef"]);
      return { ...base, operation, payload: { paymentRef: commerceRef(payload.paymentRef, "$.payload.paymentRef", ["payment_intent"]) } };
    }
    const payload = commerceRecord(row.payload, "$.payload", ["paymentRef", "expectedRevision", "reason"]);
    return { ...base, operation, payload: { paymentRef: commerceRef(payload.paymentRef, "$.payload.paymentRef", ["payment_intent"]),
      expectedRevision: commerceInteger(payload.expectedRevision, "$.payload.expectedRevision", 1, Number.MAX_SAFE_INTEGER),
      reason: commerceLiteral(payload.reason, "$.payload.reason", COMMERCE_PAYMENT_REFUND_REASONS) } };
  });
}

/** Reçu court : validité liée à l'instant de la demande, sans horloge implicite. */
function readinessDeadline(value: unknown, path: string, context: CommercePaymentControlResponseContext): number {
  const expiresAt = commerceInstant(value, path);
  if (expiresAt <= context.request.issuedAt || expiresAt - context.request.issuedAt > COMMERCE_PAYMENT_CONTROL_TTL_MS ||
    (context.nowMs !== undefined && expiresAt <= context.nowMs)) commerceReject("invalid_time", path);
  return expiresAt;
}
function readOptions(value: unknown, context: CommercePaymentControlResponseContext & { request: Extract<CommercePaymentControlRequest, { operation: "options" }> }): CommercePaymentOptions {
  const row = commerceRecord(value, "$.result", ["checkoutRef", "available", "reason", "amount", "expiresAt", "providerLabel", "beneficiaryLabel", "modes", "consentTextVersion", "readinessRef", "readinessExpiresAt"]);
  const checkoutRef = sameRef(commerceRef(row.checkoutRef, "$.result.checkoutRef", ["checkout"]), context.request.payload.checkoutRef, "$.result.checkoutRef");
  const available = commerceBoolean(row.available, "$.result.available");
  const reason = row.reason === null ? null : commerceLiteral(row.reason, "$.result.reason", COMMERCE_PAYMENT_OPTIONS_REASONS);
  const providerLabel = row.providerLabel === null ? null : commerceText(row.providerLabel, "$.result.providerLabel", 1, 120);
  const beneficiaryLabel = row.beneficiaryLabel === null ? null : commerceText(row.beneficiaryLabel, "$.result.beneficiaryLabel", 1, 120);
  const modes = commerceArray(row.modes, "$.result.modes", 0, 10).map((value, index) => {
    const path = `$.result.modes[${index}]`, mode = commerceText(value, path, 1, 40);
    if (!/^[a-z][a-z0-9_-]{0,39}$/u.test(mode)) commerceReject("invalid_payload", path);
    return mode;
  });
  commerceUnique(modes, "$.result.modes");
  const expiresAt = commerceInstant(row.expiresAt, "$.result.expiresAt");
  const readinessRef = row.readinessRef === null ? null : opaqueId(row.readinessRef, "$.result.readinessRef");
  const readinessExpiresAt = row.readinessExpiresAt === null ? null : readinessDeadline(row.readinessExpiresAt, "$.result.readinessExpiresAt", context);
  if ((readinessRef === null) !== (readinessExpiresAt === null)) commerceReject("invalid_payload", "$.result.readinessRef");
  if (readinessExpiresAt !== null && readinessExpiresAt > expiresAt) commerceReject("invalid_time", "$.result.readinessExpiresAt");
  if (row.consentTextVersion !== COMMERCE_PAYMENT_CONSENT_VERSION) commerceReject("invalid_payload", "$.result.consentTextVersion");
  if ((available && (reason !== null || providerLabel === null || beneficiaryLabel === null || modes.length === 0 || readinessRef === null || readinessExpiresAt === null)) ||
    (!available && reason === null)) commerceReject("invalid_payload", "$.result.available");
  return { checkoutRef, available, reason, amount: commerceMoney(row.amount, "$.result.amount", 1), expiresAt,
    providerLabel, beneficiaryLabel, modes, consentTextVersion: COMMERCE_PAYMENT_CONSENT_VERSION, readinessRef, readinessExpiresAt };
}

/** Syntaxe seulement : le serveur doit encore appliquer son profil et sa liste d'origines autorisées. */
function readAction(value: unknown): CommercePaymentAction | null {
  if (value === null) return null;
  const row = commerceRecord(value, "$.result.action", ["kind"], ["url"]);
  const kind = commerceLiteral(row.kind, "$.result.action.kind", ["provider_redirect", "await_provider_confirmation", "none"] as const);
  if (kind !== "provider_redirect") {
    if (commerceHas(row, "url")) commerceReject("invalid_payload", "$.result.action.url");
    return { kind };
  }
  const url = commerceText(row.url, "$.result.action.url", 1, 2048);
  let parsed: URL;
  try { parsed = new URL(url); } catch { return commerceReject("invalid_payload", "$.result.action.url"); }
  if (!/^https:\/\//u.test(url) || parsed.protocol !== "https:" || !parsed.hostname || parsed.hostname.length > 253 || parsed.username || parsed.password ||
    url.includes("#") || /^https:\/\/[^/?#]*@/u.test(url) || /[\\\s]/u.test(url) || /%(?![a-f0-9]{2})/iu.test(url) || parsed.port === "0") commerceReject("invalid_payload", "$.result.action.url");
  return { kind, url };
}
function readState(value: unknown, request: Extract<CommercePaymentControlRequest, { operation: "status" | "refund_request" }>, nowMs?: number): CommercePaymentControlState {
  const row = commerceRecord(value, "$.result", ["checkoutRef", "paymentRef", "orderRef", "paymentState", "orderState", "stockState", "refundState", "reviewRequired", "revision", "updatedAt", "amount", "action"]);
  const paymentRef = sameRef(commerceRef(row.paymentRef, "$.result.paymentRef", ["payment_intent"]), request.payload.paymentRef, "$.result.paymentRef");
  const paymentState = commerceLiteral(row.paymentState, "$.result.paymentState", COMMERCE_PAYMENT_STATES, "unknown_state");
  const action = readAction(row.action);
  if ((action?.kind === "provider_redirect" && paymentState !== "requires_action") || (action?.kind === "none" && paymentState === "requires_action")) commerceReject("invalid_response", "$.result.action");
  const revision = commerceInteger(row.revision, "$.result.revision", 1, Number.MAX_SAFE_INTEGER);
  const refundState = commerceLiteral(row.refundState, "$.result.refundState", COMMERCE_PAYMENT_REFUND_STATES);
  if (request.operation === "refund_request" && (revision < request.payload.expectedRevision || refundState === "none")) commerceReject("invalid_response", "$.result.refundState");
  const updatedAt = commerceInstant(row.updatedAt, "$.result.updatedAt");
  if (updatedAt > request.issuedAt + COMMERCE_MAX_SKEW_MS || (nowMs !== undefined && updatedAt > nowMs + COMMERCE_MAX_SKEW_MS)) commerceReject("invalid_time", "$.result.updatedAt");
  return { checkoutRef: commerceRef(row.checkoutRef, "$.result.checkoutRef", ["checkout"]), paymentRef,
    orderRef: commerceRef(row.orderRef, "$.result.orderRef", ["order"]), paymentState,
    orderState: commerceLiteral(row.orderState, "$.result.orderState", COMMERCE_ORDER_STATES, "unknown_state"),
    stockState: commerceLiteral(row.stockState, "$.result.stockState", COMMERCE_PAYMENT_STOCK_STATES), refundState,
    reviewRequired: commerceBoolean(row.reviewRequired, "$.result.reviewRequired"), revision, updatedAt,
    amount: commerceMoney(row.amount, "$.result.amount", 1), action };
}

/** Corrèle une réponse dont la preuve et l'empreinte de demande ont été vérifiées par l'appelant. */
export function parseCommercePaymentControlResponse(rawBody: string, context: CommercePaymentControlResponseContext): CommerceResult<CommercePaymentControlResponse, string> {
  return commerceCapture(() => {
    if (!commerceIsSha256(context.requestSha256) || (context.nowMs !== undefined && (!Number.isSafeInteger(context.nowMs) || context.nowMs < 0))) commerceReject("invalid_request", "$");
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_PAYMENT_CONTROL_RESPONSE_MAX_BYTES), "$", ["contract", "version", "requestId", "requestSha256", "outcome"], ["result", "reason"]);
    if (row.contract !== COMMERCE_PAYMENT_CONTROL_CONTRACT || row.version !== 1 || row.requestId !== context.request.requestId ||
      !commerceIsSha256(row.requestSha256) || row.requestSha256 !== context.requestSha256) commerceReject("correlation_mismatch", "$");
    const base: ReplyBase = { contract: COMMERCE_PAYMENT_CONTROL_CONTRACT, version: 1, requestId: context.request.requestId, requestSha256: context.requestSha256 };
    if (row.outcome !== "accepted") {
      if (commerceHas(row, "result")) commerceReject("invalid_payload", "$.result");
      return { ...base, outcome: commerceLiteral(row.outcome, "$.outcome", ["refused", "unavailable"] as const), reason: commerceLiteral(row.reason, "$.reason", COMMERCE_PAYMENT_CONTROL_REASONS) };
    }
    if (commerceHas(row, "reason")) commerceReject("invalid_payload", "$.reason");
    const request = context.request;
    if (request.operation === "options") return { ...base, outcome: "accepted", result: readOptions(row.result, { ...context, request }) };
    if (request.operation === "authorize_start") {
      const result = commerceRecord(row.result, "$.result", ["checkoutRef", "readinessRef", "commandRequestId", "commandRequestSha256", "authorized", "expiresAt"]);
      if (result.authorized !== true) commerceReject("invalid_payload", "$.result.authorized");
      return { ...base, outcome: "accepted", result: {
        checkoutRef: sameRef(commerceRef(result.checkoutRef, "$.result.checkoutRef", ["checkout"]), request.payload.checkoutRef, "$.result.checkoutRef"),
        readinessRef: sameRef(opaqueId(result.readinessRef, "$.result.readinessRef"), request.payload.readinessRef, "$.result.readinessRef"),
        commandRequestId: sameRef(opaqueId(result.commandRequestId, "$.result.commandRequestId"), request.payload.commandRequestId, "$.result.commandRequestId"),
        commandRequestSha256: sameRef(sha256(result.commandRequestSha256, "$.result.commandRequestSha256"), request.payload.commandRequestSha256, "$.result.commandRequestSha256"),
        authorized: true, expiresAt: readinessDeadline(result.expiresAt, "$.result.expiresAt", context),
      } };
    }
    return { ...base, outcome: "accepted", result: readState(row.result, request, context.nowMs) };
  });
}

export function commercePaymentControlSigningInput(input: { bodySha256: string; environment: CommerceEnvironment; issuedAtMs: number; keyId: string; nonce: string; operation: CommercePaymentControlOperation; source: string }): string | null {
  if (!commerceIsSha256(input.bodySha256) || !commerceIsMachineIdentity(input.source) || !COMMERCE_ENVIRONMENTS.includes(input.environment) ||
    !COMMERCE_PAYMENT_CONTROL_OPERATIONS.includes(input.operation) || !Number.isSafeInteger(input.issuedAtMs) || input.issuedAtMs < 0 ||
    !/^[A-Za-z0-9._:-]{8,128}$/u.test(input.keyId) || !/^[A-Za-z0-9_-]{24,128}$/u.test(input.nonce)) return null;
  return [COMMERCE_PAYMENT_CONTROL_PROFILE, input.keyId, String(input.issuedAtMs), input.nonce, input.source, input.environment,
    "pro.ga.commerce.payment", "commerce.payment.start", input.operation, input.bodySha256].map((part) => `${part.length}:${part}`).join("|");
}
