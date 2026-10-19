/**
 * P09 — lecture privée bornée du catalogue et de ses octets publics.
 * Jumeau ANTSIA / PRO.GA hors du manifeste P06. Zéro secret/réseau/horloge implicite.
 * Le transport PUBLIC reste l'unique chemin d'application des projections.
 */
import {
  COMMERCE_ENVIRONMENTS, COMMERCE_MAX_SKEW_MS, commerceAntsiaRef,
  commerceBoolean, commerceCapture, commerceInstant, commerceInteger,
  commerceIsMachineIdentity, commerceIsOpaqueId, commerceIsSha256,
  commerceLiteral, commerceParseCanonicalBody, commerceRecord, commerceRef,
  commerceReject, commerceText, type CommerceEnvironment, type CommerceResult,
} from "./commerce/primitives";

export const COMMERCE_CATALOG_READ_CONTRACT = "PRO-COMMERCE-CATALOG-READ-V1";
export const COMMERCE_CATALOG_READ_PROFILE = "pro-ga-commerce-catalog-read-hmac/v1";
export const COMMERCE_CATALOG_READ_SCOPE = "commerce.request.status";
export const COMMERCE_CATALOG_READ_MAX_BYTES = 8192;
export const COMMERCE_CATALOG_READ_TTL_MS = 60_000;
export const COMMERCE_CATALOG_PAGE_MAX = 20;
export const COMMERCE_CATALOG_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const COMMERCE_CATALOG_OPERATIONS = ["reconcile", "media.read"] as const;
export type CommerceCatalogOperation = (typeof COMMERCE_CATALOG_OPERATIONS)[number];
export const COMMERCE_CATALOG_PATHS = {
  reconcile: "/commerce/v1/catalogue/reconcile",
  "media.read": "/commerce/v1/catalogue/media",
} as const;

type CatalogReadBase = {
  readonly contract: typeof COMMERCE_CATALOG_READ_CONTRACT;
  readonly version: 1;
  readonly source: string;
  readonly environment: CommerceEnvironment;
  readonly requestId: string;
  readonly subjectRef: string;
  readonly shopRef: string;
  readonly linkRef: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
};
export type CommerceCatalogReadRequest = CatalogReadBase & (
  | { readonly operation: "reconcile"; readonly payload: { readonly cursor: string | null } }
  | { readonly operation: "media.read"; readonly payload: { readonly offerRef: string; readonly revision: number; readonly sha256: string } }
);
export type CommerceCatalogReadContext = { source: string; environment: CommerceEnvironment; nowMs: number };
export type CommerceCatalogReconcileResponse = {
  contract: typeof COMMERCE_CATALOG_READ_CONTRACT;
  version: 1;
  requestId: string;
  requestSha256: string;
  outcome: "accepted";
  cursor: string | null;
  done: boolean;
  queued: number;
};
export type CommerceCatalogReadReason =
  | "invalid_payload" | "invalid_request" | "invalid_reference" | "invalid_time"
  | "invalid_text" | "body_too_large" | "invalid_body" | "not_canonical"
  | "too_complex" | "source_mismatch" | "environment_mismatch" | "correlation_mismatch";

/** Schéma fermé ; durée courte et contexte serveur imposés, aucun tenant reçu. */
export function parseCommerceCatalogReadRequest(rawBody: string, context: CommerceCatalogReadContext): CommerceResult<CommerceCatalogReadRequest, CommerceCatalogReadReason> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_CATALOG_READ_MAX_BYTES), "$", [
      "contract", "version", "operation", "source", "environment", "requestId", "subjectRef", "shopRef", "linkRef", "issuedAt", "expiresAt", "payload",
    ]);
    if (row.contract !== COMMERCE_CATALOG_READ_CONTRACT || row.version !== 1) commerceReject("invalid_request", "$");
    if (!commerceIsMachineIdentity(row.source) || row.source !== context.source) commerceReject("source_mismatch", "$.source");
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS);
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment");
    if (!commerceIsOpaqueId(row.requestId)) commerceReject("invalid_request", "$.requestId");
    const operation = commerceLiteral(row.operation, "$.operation", COMMERCE_CATALOG_OPERATIONS);
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt");
    const expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    if (!Number.isSafeInteger(context.nowMs) || issuedAt > context.nowMs + COMMERCE_MAX_SKEW_MS ||
      issuedAt < context.nowMs - COMMERCE_MAX_SKEW_MS || expiresAt <= context.nowMs ||
      expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_CATALOG_READ_TTL_MS) commerceReject("invalid_time", "$.expiresAt");
    const base: CatalogReadBase = {
      contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, source: row.source, environment,
      requestId: row.requestId, subjectRef: commerceAntsiaRef(row.subjectRef, "$.subjectRef", "sub"),
      shopRef: commerceRef(row.shopRef, "$.shopRef", ["structure"]),
      linkRef: commerceRef(row.linkRef, "$.linkRef", ["commerce_link"]), issuedAt, expiresAt,
    };
    if (operation === "reconcile") {
      const payload = commerceRecord(row.payload, "$.payload", ["cursor"]);
      const cursor = payload.cursor === null ? null : commerceText(payload.cursor, "$.payload.cursor", 1, 2048);
      return { ...base, operation, payload: { cursor } };
    }
    const payload = commerceRecord(row.payload, "$.payload", ["offerRef", "revision", "sha256"]);
    if (!commerceIsSha256(payload.sha256)) commerceReject("invalid_payload", "$.payload.sha256");
    return { ...base, operation, payload: {
      offerRef: commerceRef(payload.offerRef, "$.payload.offerRef", ["offer"]),
      revision: commerceInteger(payload.revision, "$.payload.revision", 1, Number.MAX_SAFE_INTEGER), sha256: payload.sha256,
    } };
  });
}

/** La réponse de rattrapage ne transporte pas d'offre : elle ne vaut jamais `applied`. */
export function parseCommerceCatalogReconcileResponse(rawBody: string, context: { requestId: string; requestSha256: string }): CommerceResult<CommerceCatalogReconcileResponse, CommerceCatalogReadReason> {
  return commerceCapture(() => {
    const row = commerceRecord(commerceParseCanonicalBody(rawBody, COMMERCE_CATALOG_READ_MAX_BYTES), "$", [
      "contract", "version", "requestId", "requestSha256", "outcome", "cursor", "done", "queued",
    ]);
    if (row.contract !== COMMERCE_CATALOG_READ_CONTRACT || row.version !== 1 || row.outcome !== "accepted") commerceReject("invalid_request", "$");
    if (row.requestId !== context.requestId || !commerceIsSha256(row.requestSha256) || row.requestSha256 !== context.requestSha256) commerceReject("correlation_mismatch", "$.requestId");
    const cursor = row.cursor === null ? null : commerceText(row.cursor, "$.cursor", 1, 2048);
    const done = commerceBoolean(row.done, "$.done");
    if (done !== (cursor === null)) commerceReject("invalid_payload", "$.cursor");
    return { contract: COMMERCE_CATALOG_READ_CONTRACT, version: 1, outcome: "accepted", requestId: context.requestId,
      requestSha256: context.requestSha256, cursor, done, queued: commerceInteger(row.queued, "$.queued", 0, COMMERCE_CATALOG_PAGE_MAX) };
  });
}

/** Profil distinct de COMMAND et de PUBLIC, avec opération et corps liés à la preuve. */
export function commerceCatalogSigningInput(input: {
  bodySha256: string; environment: CommerceEnvironment; issuedAtMs: number; keyId: string;
  nonce: string; operation: CommerceCatalogOperation; source: string;
}): string | null {
  if (!commerceIsSha256(input.bodySha256) || !commerceIsMachineIdentity(input.source) ||
    !COMMERCE_ENVIRONMENTS.includes(input.environment) || !COMMERCE_CATALOG_OPERATIONS.includes(input.operation) ||
    !Number.isSafeInteger(input.issuedAtMs) || input.issuedAtMs < 0 ||
    !/^[A-Za-z0-9._:-]{8,128}$/u.test(input.keyId) || !/^[A-Za-z0-9_-]{24,128}$/u.test(input.nonce)) return null;
  return [COMMERCE_CATALOG_READ_PROFILE, input.keyId, String(input.issuedAtMs), input.nonce,
    input.source, input.environment, "pro.ga.commerce.catalogue", COMMERCE_CATALOG_READ_SCOPE,
    input.operation, input.bodySha256].map((value) => `${value.length}:${value}`).join("|");
}
