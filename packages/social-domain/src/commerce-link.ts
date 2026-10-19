/**
 * PRO-COMMERCE-LINK-V1 — préparation privée de la double preuve P08.
 *
 * FICHIER JUMEAU ANTSIA / PRO.GA, hors du manifeste P06 inchangé.
 * Pur : aucun réseau, secret, aléa ni horloge implicite. La préparation
 * emprunte commerceCommandSigningInput avec l'opération link.confirm ; son
 * contrat de corps reste distinct de PRO-COMMERCE-COMMAND-V1.
 */
import { COMMERCE_LINK_PERMISSIONS, type CommerceLinkPermission } from "./commerce/command";
import {
  COMMERCE_ENVIRONMENTS,
  COMMERCE_MAX_SKEW_MS,
  COMMERCE_TRANSPORT_FORBIDDEN_FIELDS,
  commerceAntsiaRef,
  commerceCapture,
  commerceInstant,
  commerceIsMachineIdentity,
  commerceIsOpaqueId,
  commerceLiteral,
  commerceParseCanonicalBody,
  commerceRecord,
  commerceReject,
  commerceScanJson,
  commerceSortedSet,
  type CommerceEnvironment,
  type CommerceResult,
} from "./commerce/primitives";

export const COMMERCE_LINK_CONTRACT = "PRO-COMMERCE-LINK-V1";
export const COMMERCE_LINK_TTL_MS = 300_000;
export const COMMERCE_LINK_CONSENT_VERSION = "2026-10-18";
export const COMMERCE_LINK_MAX_BYTES = 8 * 1024;
export const COMMERCE_LINK_CALLBACK_PATH = "/mes-boutiques/liaison/retour";
export const COMMERCE_LINK_AUTHORIZATION_PATH = "/commerce/autoriser";

export const COMMERCE_LINK_REASONS = [
  "body_too_large",
  "correlation_mismatch",
  "duplicate_entry",
  "environment_mismatch",
  "forbidden_field",
  "invalid_authorization_url",
  "invalid_body",
  "invalid_payload",
  "invalid_reference",
  "invalid_request",
  "invalid_response",
  "invalid_time",
  "not_canonical",
  "redirect_not_allowed",
  "source_mismatch",
  "too_complex",
] as const;
export type CommerceLinkReason = (typeof COMMERCE_LINK_REASONS)[number];

export type CommerceLinkPreparation = {
  readonly contract: typeof COMMERCE_LINK_CONTRACT;
  readonly version: 1;
  readonly source: string;
  readonly environment: CommerceEnvironment;
  readonly requestId: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly subjectRef: string;
  readonly antsiaShopRef: string;
  readonly requestedPermissions: readonly CommerceLinkPermission[];
  readonly redirectUri: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly consentTextVersion: typeof COMMERCE_LINK_CONSENT_VERSION;
};

export type CommerceLinkPreparationContext = {
  readonly source: string;
  readonly environment: CommerceEnvironment;
  readonly nowMs: number;
  readonly allowedRedirectUris: readonly string[];
};

export type CommerceLinkPrepared = {
  readonly contract: typeof COMMERCE_LINK_CONTRACT;
  readonly version: 1;
  readonly requestId: string;
  readonly state: string;
  readonly authorizationUrl: string;
  readonly expiresAt: number;
};

export type CommerceLinkPreparedContext = {
  readonly request: CommerceLinkPreparation;
  readonly authorizationOrigin: string;
  readonly nowMs: number;
};

const PREPARATION_KEYS = [
  "contract", "version", "source", "environment", "requestId", "state",
  "codeChallenge", "codeChallengeMethod", "subjectRef", "antsiaShopRef",
  "requestedPermissions", "redirectUri", "issuedAt", "expiresAt", "consentTextVersion",
] as const;
const PREPARED_KEYS = ["contract", "version", "requestId", "state", "authorizationUrl", "expiresAt"] as const;
const FORBIDDEN: ReadonlySet<string> = new Set(COMMERCE_TRANSPORT_FORBIDDEN_FIELDS);
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** URL absolue sans ambiguïté de normalisation, jamais une redirection relative. */
function readUrl(
  value: unknown,
  environment: CommerceEnvironment,
  path: string,
  reason: "redirect_not_allowed" | "invalid_authorization_url",
  allowQuery: boolean,
): URL {
  if (
    typeof value !== "string" || value.length === 0 || value.length > 2048 ||
    /[\u0000-\u0020\u007f\\]/.test(value) || value.includes("#") ||
    (!allowQuery && value.includes("?"))
  ) commerceReject(reason, path);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    commerceReject(reason, path);
  }
  if (
    url.username !== "" || url.password !== "" || url.hash !== "" ||
    url.hostname === "" || url.origin === "null" ||
    (url.protocol !== "https:" && !(
      url.protocol === "http:" && environment === "sandbox" && LOOPBACK_HOSTS.has(url.hostname)
    ))
  ) commerceReject(reason, path);
  return url;
}

function readWindow(issuedAt: number, expiresAt: number, nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || issuedAt > nowMs + COMMERCE_MAX_SKEW_MS) {
    commerceReject("invalid_time", "$.issuedAt");
  }
  if (expiresAt <= issuedAt || expiresAt - issuedAt > COMMERCE_LINK_TTL_MS || nowMs >= expiresAt) {
    commerceReject("invalid_time", "$.expiresAt");
  }
}

/** Corps canonique exact ; le serveur lie ensuite ce défi à sa session réelle. */
export function parseCommerceLinkPreparation(
  rawBody: string,
  context: CommerceLinkPreparationContext,
): CommerceResult<CommerceLinkPreparation, CommerceLinkReason> {
  return commerceCapture<CommerceLinkPreparation, CommerceLinkReason>(() => {
    const parsed = commerceParseCanonicalBody(rawBody, COMMERCE_LINK_MAX_BYTES);
    commerceScanJson(parsed, FORBIDDEN, "$");
    const row = commerceRecord(parsed, "$", PREPARATION_KEYS, [], "invalid_request");
    if (row.contract !== COMMERCE_LINK_CONTRACT) commerceReject("invalid_request", "$.contract");
    if (row.version !== 1) commerceReject("invalid_request", "$.version");
    const source = row.source;
    if (!commerceIsMachineIdentity(source)) commerceReject("invalid_request", "$.source");
    if (source !== context.source) commerceReject("source_mismatch", "$.source");
    const environment = commerceLiteral(row.environment, "$.environment", COMMERCE_ENVIRONMENTS, "invalid_request");
    if (environment !== context.environment) commerceReject("environment_mismatch", "$.environment");
    const requestId = row.requestId;
    if (!commerceIsOpaqueId(requestId)) commerceReject("invalid_request", "$.requestId");
    const state = row.state;
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) commerceReject("invalid_request", "$.state");
    const codeChallenge = row.codeChallenge;
    if (typeof codeChallenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) commerceReject("invalid_request", "$.codeChallenge");
    if (row.codeChallengeMethod !== "S256") commerceReject("invalid_request", "$.codeChallengeMethod");
    const subjectRef = commerceAntsiaRef(row.subjectRef, "$.subjectRef", "sub");
    const antsiaShopRef = commerceAntsiaRef(row.antsiaShopRef, "$.antsiaShopRef", "shop");
    const requestedPermissions = commerceSortedSet(row.requestedPermissions, "$.requestedPermissions", COMMERCE_LINK_PERMISSIONS, 1);
    const redirectUri = row.redirectUri;
    const redirect = readUrl(redirectUri, environment, "$.redirectUri", "redirect_not_allowed", false);
    if (
      typeof redirectUri !== "string" || redirect.href !== redirectUri ||
      redirect.pathname !== COMMERCE_LINK_CALLBACK_PATH || !context.allowedRedirectUris.includes(redirectUri)
    ) commerceReject("redirect_not_allowed", "$.redirectUri");
    const issuedAt = commerceInstant(row.issuedAt, "$.issuedAt");
    const expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    readWindow(issuedAt, expiresAt, context.nowMs);
    if (row.consentTextVersion !== COMMERCE_LINK_CONSENT_VERSION) commerceReject("invalid_request", "$.consentTextVersion");
    return {
      contract: COMMERCE_LINK_CONTRACT, version: 1, source, environment,
      requestId, state, codeChallenge, codeChallengeMethod: "S256", subjectRef,
      antsiaShopRef, requestedPermissions, redirectUri, issuedAt, expiresAt,
      consentTextVersion: COMMERCE_LINK_CONSENT_VERSION,
    };
  });
}

/** Réponse de préparation : seule l'URL PRO.GA corrélée peut être présentée. */
export function parseCommerceLinkPrepared(
  rawBody: string,
  context: CommerceLinkPreparedContext,
): CommerceResult<CommerceLinkPrepared, CommerceLinkReason> {
  return commerceCapture<CommerceLinkPrepared, CommerceLinkReason>(() => {
    const parsed = commerceParseCanonicalBody(rawBody, COMMERCE_LINK_MAX_BYTES);
    commerceScanJson(parsed, FORBIDDEN, "$");
    const row = commerceRecord(parsed, "$", PREPARED_KEYS, [], "invalid_response");
    if (row.contract !== COMMERCE_LINK_CONTRACT) commerceReject("invalid_response", "$.contract");
    if (row.version !== 1) commerceReject("invalid_response", "$.version");
    const request = context.request;
    if (row.requestId !== request.requestId) commerceReject("correlation_mismatch", "$.requestId");
    if (row.state !== request.state) commerceReject("correlation_mismatch", "$.state");
    const expiresAt = commerceInstant(row.expiresAt, "$.expiresAt");
    if (expiresAt !== request.expiresAt) commerceReject("correlation_mismatch", "$.expiresAt");
    readWindow(request.issuedAt, expiresAt, context.nowMs);
    const origin = readUrl(context.authorizationOrigin, request.environment, "$.authorizationUrl", "invalid_authorization_url", false);
    if (origin.origin !== context.authorizationOrigin) commerceReject("invalid_authorization_url", "$.authorizationUrl");
    const authorizationUrl = row.authorizationUrl;
    if (typeof authorizationUrl !== "string") commerceReject("invalid_authorization_url", "$.authorizationUrl");
    const url = readUrl(authorizationUrl, request.environment, "$.authorizationUrl", "invalid_authorization_url", true);
    if (
      url.origin !== context.authorizationOrigin || url.pathname !== COMMERCE_LINK_AUTHORIZATION_PATH ||
      authorizationUrl !== `${context.authorizationOrigin}${COMMERCE_LINK_AUTHORIZATION_PATH}?defi=${encodeURIComponent(request.requestId)}`
    ) commerceReject("invalid_authorization_url", "$.authorizationUrl");
    return {
      contract: COMMERCE_LINK_CONTRACT, version: 1, requestId: request.requestId,
      state: request.state, authorizationUrl, expiresAt,
    };
  });
}
