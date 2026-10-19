/** P11 : contrôle privé des préparations, hors du manifeste P06 inchangé. Jumeau ANTSIA / PRO.GA. */
import type { CommerceCheckoutFee } from "./commerce/command";
import {
  COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAntsiaRef, commerceArray,
  commerceBoolean, commerceCapture, commerceHas, commerceInstant, commerceInteger, commerceIsMachineIdentity,
  commerceIsOpaqueId, commerceIsSha256, commerceLiteral, commerceMoney, commerceParseCanonicalBody,
  commerceRecord, commerceRef, commerceReject, commerceText, commerceUnique,
  type CommerceEnvironment, type CommerceResult,
} from "./commerce/primitives";

export const COMMERCE_CHECKOUT_CONTROL_CONTRACT = "PRO-COMMERCE-CHECKOUT-CONTROL-V1";
export const COMMERCE_CHECKOUT_CONTROL_PROFILE = "pro-ga-commerce-checkout-control-hmac/v1";
export const COMMERCE_CHECKOUT_CONTROL_MAX_BYTES = 8192;
export const COMMERCE_CHECKOUT_CONTROL_TTL_MS = 60_000;
export const COMMERCE_CHECKOUT_CONSENT_VERSION = "2026-10-18";
export const COMMERCE_CHECKOUT_CONTROL_OPERATIONS = ["options", "status", "release"] as const;
export type CommerceCheckoutControlOperation = (typeof COMMERCE_CHECKOUT_CONTROL_OPERATIONS)[number];
export const COMMERCE_CHECKOUT_CONTROL_PATHS = {
  options: "/commerce/v1/checkouts/options", status: "/commerce/v1/checkouts/status", release: "/commerce/v1/checkouts/release",
} as const;
export const COMMERCE_CHECKOUT_CONTROL_REASONS = ["access_denied", "not_available", "not_releasable", "rate_limited", "invalid_request"] as const;

type ControlBase = {
  contract: typeof COMMERCE_CHECKOUT_CONTROL_CONTRACT; version: 1; source: string; environment: CommerceEnvironment;
  requestId: string; shopRef: string; subject: { kind: "buyer"; ref: string; authVerifiedAt: number }; issuedAt: number; expiresAt: number;
};
export type CommerceCheckoutControlRequest = ControlBase & (
  | { operation: "options"; payload: Record<string, never> }
  | { operation: "status" | "release"; payload: { checkoutRef: string } }
);
export type CommerceCheckoutOptions = {
  shopRef: string; policyVersion: number; pickup: { establishmentRef: string; label: string }[];
  fees: CommerceCheckoutFee[];
  sellerDelivery: null | { fee: { amount: number; currency: "XAF" }; label: string };
};
export type CommerceCheckoutState = {
  checkoutRef: string; state: "held" | "expired" | "released" | "consumed";
  revision: number; expiresAt: number; confirmationRequired: boolean;
};
type ReplyBase = { contract: typeof COMMERCE_CHECKOUT_CONTROL_CONTRACT; version: 1; requestId: string; requestSha256: string };
export type CommerceCheckoutControlResponse = ReplyBase & (
  | { outcome: "accepted"; result: CommerceCheckoutOptions | CommerceCheckoutState }
  | { outcome: "refused" | "unavailable"; reason: (typeof COMMERCE_CHECKOUT_CONTROL_REASONS)[number] }
);

/** Réseau/tenant absents : source et sujet opaques sont résolus par le destinataire. */
export function parseCommerceCheckoutControlRequest(rawBody: string, context: { source: string; environment: CommerceEnvironment; nowMs: number }): CommerceResult<CommerceCheckoutControlRequest, string> {
  return commerceCapture((): CommerceCheckoutControlRequest => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_CHECKOUT_CONTROL_MAX_BYTES), "$", [
      "contract", "version", "source", "environment", "requestId", "shopRef", "subject", "issuedAt", "expiresAt", "operation", "payload",
    ]);
    if (row.contract !== COMMERCE_CHECKOUT_CONTROL_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$");
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source");
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS);
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment");
    if (!commerceIsOpaqueId(row.requestId)) commerceReject("invalid_request", "$.requestId");
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt"), expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    if (!Number.isSafeInteger(context.nowMs) || Math.abs(issuedAt - context.nowMs) > COMMERCE_MAX_SKEW_MS ||
      expiresAt <= context.nowMs || expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_CHECKOUT_CONTROL_TTL_MS) commerceReject("invalid_time", "$.expiresAt");
    const subject = commerceRecord(row.subject, "$.subject", ["kind", "ref", "authVerifiedAt"]);
    if (subject.kind !== "buyer") commerceReject("subject_not_allowed", "$.subject.kind");
    const authVerifiedAt = commerceInstant(subject.authVerifiedAt, "$.subject.authVerifiedAt");
    if (authVerifiedAt > issuedAt || issuedAt - authVerifiedAt > COMMERCE_MAX_SKEW_MS) commerceReject("invalid_time", "$.subject.authVerifiedAt");
    const base: ControlBase = { contract: COMMERCE_CHECKOUT_CONTROL_CONTRACT, version: 1, source: row.source, environment,
      requestId: row.requestId, shopRef: commerceRef(row.shopRef, "$.shopRef", ["structure"]), issuedAt, expiresAt,
      subject: { kind: "buyer", ref: commerceAntsiaRef(subject.ref, "$.subject.ref", "sub"), authVerifiedAt } };
    const operation = commerceLiteral(row.operation, "$.operation", COMMERCE_CHECKOUT_CONTROL_OPERATIONS);
    if (operation === "options") {
      commerceRecord(row.payload, "$.payload", []);
      return { ...base, operation, payload: {} };
    }
    const payload = commerceRecord(row.payload, "$.payload", ["checkoutRef"]);
    return { ...base, operation, payload: { checkoutRef: commerceRef(payload.checkoutRef, "$.payload.checkoutRef", ["checkout"]) } };
  });
}

function readOptions(value: unknown, shopRef: string): CommerceCheckoutOptions {
  const row = commerceRecord(value, "$.result", ["shopRef", "policyVersion", "pickup", "fees", "sellerDelivery"]);
  if (row.shopRef !== shopRef) commerceReject("correlation_mismatch", "$.result.shopRef");
  const pickup = commerceArray(row.pickup, "$.result.pickup", 0, 20).map((value, index) => {
    const path = `$.result.pickup[${index}]`, item = commerceRecord(value, path, ["establishmentRef", "label"]);
    return { establishmentRef: commerceRef(item.establishmentRef, `${path}.establishmentRef`, ["establishment"]), label: commerceText(item.label, `${path}.label`, 1, 120) };
  });
  commerceUnique(pickup.map((item) => item.establishmentRef), "$.result.pickup");
  const fees = commerceArray(row.fees, "$.result.fees", 0, 4).map((value, index): CommerceCheckoutFee => {
    const path = `$.result.fees[${index}]`, fee = commerceRecord(value, path, ["kind", "label", "amount"]);
    return { kind: commerceLiteral(fee.kind, `${path}.kind`, ["delivery", "packaging", "service"] as const), label: commerceText(fee.label, `${path}.label`, 1, 80), amount: commerceMoney(fee.amount, `${path}.amount`) };
  });
  let sellerDelivery: CommerceCheckoutOptions["sellerDelivery"] = null;
  if (row.sellerDelivery !== null) {
    const delivery = commerceRecord(row.sellerDelivery, "$.result.sellerDelivery", ["fee", "label"]);
    sellerDelivery = { fee: commerceMoney(delivery.fee, "$.result.sellerDelivery.fee"), label: commerceText(delivery.label, "$.result.sellerDelivery.label", 1, 80) };
  }
  if (pickup.length === 0 && sellerDelivery === null) commerceReject("invalid_payload", "$.result");
  return { shopRef, policyVersion: commerceInteger(row.policyVersion, "$.result.policyVersion", 1, Number.MAX_SAFE_INTEGER), pickup, fees, sellerDelivery };
}

export function parseCommerceCheckoutControlResponse(rawBody: string, context: { request: CommerceCheckoutControlRequest; requestSha256: string }): CommerceResult<CommerceCheckoutControlResponse, string> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_CHECKOUT_CONTROL_MAX_BYTES), "$", ["contract", "version", "requestId", "requestSha256", "outcome"], ["result", "reason"]);
    if (row.contract !== COMMERCE_CHECKOUT_CONTROL_CONTRACT || row.version !== 1 || row.requestId !== context.request.requestId ||
      !commerceIsSha256(row.requestSha256) || row.requestSha256 !== context.requestSha256) commerceReject("correlation_mismatch", "$");
    const base: ReplyBase = { contract: COMMERCE_CHECKOUT_CONTROL_CONTRACT, version: 1, requestId: context.request.requestId, requestSha256: context.requestSha256 };
    if (row.outcome !== "accepted") {
      if (commerceHas(row, "result")) commerceReject("invalid_payload", "$.result");
      return { ...base, outcome: commerceLiteral(row.outcome, "$.outcome", ["refused", "unavailable"] as const), reason: commerceLiteral(row.reason, "$.reason", COMMERCE_CHECKOUT_CONTROL_REASONS) };
    }
    if (commerceHas(row, "reason")) commerceReject("invalid_payload", "$.reason");
    if (context.request.operation === "options") return { ...base, outcome: "accepted", result: readOptions(row.result, context.request.shopRef) };
    const result = commerceRecord(row.result, "$.result", ["checkoutRef", "state", "revision", "expiresAt", "confirmationRequired"]);
    const checkoutRef = commerceRef(result.checkoutRef, "$.result.checkoutRef", ["checkout"]);
    if (checkoutRef !== context.request.payload.checkoutRef) commerceReject("correlation_mismatch", "$.result.checkoutRef");
    const state = commerceLiteral(result.state, "$.result.state", ["held", "expired", "released", "consumed"] as const);
    if (context.request.operation === "release" && state !== "released" && state !== "expired") commerceReject("invalid_payload", "$.result.state");
    return { ...base, outcome: "accepted", result: { checkoutRef, state,
      revision: commerceInteger(result.revision, "$.result.revision", 1, Number.MAX_SAFE_INTEGER),
      expiresAt: commerceInstant(result.expiresAt, "$.result.expiresAt"), confirmationRequired: commerceBoolean(result.confirmationRequired, "$.result.confirmationRequired") } };
  });
}

export function commerceCheckoutControlSigningInput(input: { bodySha256: string; environment: CommerceEnvironment; issuedAtMs: number; keyId: string; nonce: string; operation: CommerceCheckoutControlOperation; source: string }): string | null {
  if (!commerceIsSha256(input.bodySha256) || !commerceIsMachineIdentity(input.source) || !COMMERCE_ENVIRONMENTS.includes(input.environment) ||
    !COMMERCE_CHECKOUT_CONTROL_OPERATIONS.includes(input.operation) || !Number.isSafeInteger(input.issuedAtMs) || input.issuedAtMs < 0 ||
    !/^[A-Za-z0-9._:-]{8,128}$/u.test(input.keyId) || !/^[A-Za-z0-9_-]{24,128}$/u.test(input.nonce)) return null;
  return [COMMERCE_CHECKOUT_CONTROL_PROFILE, input.keyId, String(input.issuedAtMs), input.nonce, input.source, input.environment,
    "pro.ga.commerce.checkout", "commerce.checkout.prepare", input.operation, input.bodySha256].map((part) => `${part.length}:${part}`).join("|");
}
