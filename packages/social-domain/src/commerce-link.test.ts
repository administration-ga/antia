import { describe, expect, it } from "vitest";

import {
  COMMERCE_LINK_CONSENT_VERSION,
  COMMERCE_LINK_CONTRACT,
  COMMERCE_LINK_MAX_BYTES,
  COMMERCE_LINK_TTL_MS,
  parseCommerceLinkPreparation,
  parseCommerceLinkPrepared,
  type CommerceLinkPreparation,
  type CommerceLinkPreparationContext,
} from "./commerce-link";
import { commerceCanonicalJson } from "./commerce/primitives";
import { commerceCommandSigningInput } from "./commerce/command";

const NOW = 1_792_281_600_000;
const CALLBACK = "https://antsia.example/mes-boutiques/liaison/retour";
const ORIGIN = "https://pro.example";
const REQUEST: CommerceLinkPreparation = {
  contract: COMMERCE_LINK_CONTRACT,
  version: 1,
  source: "antsia",
  environment: "sandbox",
  requestId: "antsia-link-request-0001",
  state: "s".repeat(32),
  codeChallenge: "c".repeat(43),
  codeChallengeMethod: "S256",
  subjectRef: `antsia:sub:${"a".repeat(26)}`,
  antsiaShopRef: `antsia:shop:${"b".repeat(26)}`,
  requestedPermissions: ["catalog_drafts", "publish_catalog"],
  redirectUri: CALLBACK,
  issuedAt: NOW,
  expiresAt: NOW + COMMERCE_LINK_TTL_MS,
  consentTextVersion: COMMERCE_LINK_CONSENT_VERSION,
};
const CONTEXT: CommerceLinkPreparationContext = {
  source: "antsia",
  environment: "sandbox",
  nowMs: NOW,
  allowedRedirectUris: [CALLBACK],
};
const canonical = (value: unknown): string => {
  const body = commerceCanonicalJson(value);
  if (body === null) throw new Error("corps de test non sérialisable");
  return body;
};
const preparation = (changes: Readonly<Record<string, unknown>> = {}) =>
  parseCommerceLinkPreparation(canonical({ ...REQUEST, ...changes }), CONTEXT);
const preparedBody = (changes: Readonly<Record<string, unknown>> = {}) => canonical({
  contract: COMMERCE_LINK_CONTRACT,
  version: 1,
  requestId: REQUEST.requestId,
  state: REQUEST.state,
  authorizationUrl: `${ORIGIN}/commerce/autoriser?defi=${REQUEST.requestId}`,
  expiresAt: REQUEST.expiresAt,
  ...changes,
});
const prepared = (changes: Readonly<Record<string, unknown>> = {}) =>
  parseCommerceLinkPrepared(preparedBody(changes), { request: REQUEST, authorizationOrigin: ORIGIN, nowMs: NOW });

describe("préparation LINK — corps fermé et double preuve", () => {
  it("rend la préparation canonique exacte avec le consentement versionné", () => {
    expect(preparation()).toEqual({ ok: true, value: REQUEST });
    expect(COMMERCE_LINK_TTL_MS).toBe(300000);
    expect(COMMERCE_LINK_CONSENT_VERSION).toBe("2026-10-18");
  });

  it("refuse chaque champ manquant et tout champ supplémentaire", () => {
    for (const key of Object.keys(REQUEST)) {
      const body = Object.fromEntries(Object.entries(REQUEST).filter(([name]) => name !== key));
      expect(parseCommerceLinkPreparation(canonical(body), CONTEXT), key).toMatchObject({ ok: false, reason: "invalid_request" });
    }
    expect(preparation({ extra: true })).toMatchObject({ ok: false, reason: "invalid_request", path: "$.extra" });
    expect(preparation({ sessionId: "private-session" })).toMatchObject({ ok: false, reason: "forbidden_field" });
  });

  it("sépare LINK de COMMAND et refuse une autre version de consentement", () => {
    for (const changes of [
      { contract: "PRO-COMMERCE-COMMAND-V1" }, { version: 2 },
      { codeChallengeMethod: "plain" }, { consentTextVersion: "2026-10-17" },
    ]) expect(preparation(changes)).toMatchObject({ ok: false, reason: "invalid_request" });
  });

  it("corrèle source et environnement au contexte machine", () => {
    expect(preparation({ source: "another-network" })).toMatchObject({ ok: false, reason: "source_mismatch" });
    expect(preparation({ source: "ANTSIA" })).toMatchObject({ ok: false, reason: "invalid_request" });
    expect(preparation({ environment: "production" })).toMatchObject({ ok: false, reason: "environment_mismatch" });
    expect(preparation({ environment: "development" })).toMatchObject({ ok: false, reason: "invalid_request" });
  });

  it("borne identifiant, état base64url et défi S256 sans réparation", () => {
    for (const requestId of ["short", " ".repeat(8), "r".repeat(201)]) {
      expect(preparation({ requestId })).toMatchObject({ ok: false, path: "$.requestId" });
    }
    for (const state of ["s".repeat(31), "s".repeat(129), `${"s".repeat(31)}=`, 123]) {
      expect(preparation({ state })).toMatchObject({ ok: false, path: "$.state" });
    }
    for (const codeChallenge of ["c".repeat(42), "c".repeat(44), `${"c".repeat(42)}+`]) {
      expect(preparation({ codeChallenge })).toMatchObject({ ok: false, path: "$.codeChallenge" });
    }
    expect(preparation({ state: "A_-0".repeat(32) })).toMatchObject({ ok: true });
  });

  it("ne reçoit que les références opaques P06 du bon type", () => {
    for (const subjectRef of [REQUEST.antsiaShopRef, "person@example.test", `antsia:sub:${"A".repeat(26)}`]) {
      expect(preparation({ subjectRef })).toMatchObject({ ok: false, reason: "invalid_reference" });
    }
    expect(preparation({ antsiaShopRef: REQUEST.subjectRef })).toMatchObject({ ok: false, reason: "invalid_reference" });
  });

  it("exige des permissions explicites, triées et sans doublon", () => {
    for (const requestedPermissions of [[], ["publish_catalog", "catalog_drafts"], ["commerce.link.confirm"], ["all"]]) {
      expect(preparation({ requestedPermissions })).toMatchObject({ ok: false, reason: "invalid_payload" });
    }
    expect(preparation({ requestedPermissions: ["catalog_drafts", "catalog_drafts"] })).toMatchObject({ ok: false, reason: "duplicate_entry" });
  });

  it("refuse une fenêtre nulle, excessive, expirée ou au-delà de la tolérance P06", () => {
    for (const changes of [
      { expiresAt: NOW }, { expiresAt: NOW + COMMERCE_LINK_TTL_MS + 1 },
      { issuedAt: NOW - COMMERCE_LINK_TTL_MS, expiresAt: NOW },
      { issuedAt: NOW + COMMERCE_LINK_TTL_MS + 1, expiresAt: NOW + 2 * COMMERCE_LINK_TTL_MS },
      { issuedAt: 1.5 }, { expiresAt: Number.MAX_SAFE_INTEGER },
    ]) expect(preparation(changes)).toMatchObject({ ok: false, reason: "invalid_time" });
    expect(parseCommerceLinkPreparation(canonical(REQUEST), { ...CONTEXT, nowMs: REQUEST.expiresAt - 1 })).toMatchObject({ ok: true });
    expect(parseCommerceLinkPreparation(canonical(REQUEST), { ...CONTEXT, nowMs: Number.NaN })).toMatchObject({ ok: false, reason: "invalid_time" });
  });

  it("autorise seulement l'URI complète du callback fixé, sans query ni fragment", () => {
    for (const redirectUri of [
      "https://evil.example/mes-boutiques/liaison/retour", `${CALLBACK}?etat=x`, `${CALLBACK}?`, `${CALLBACK}#`,
      "https://user:pass@antsia.example/mes-boutiques/liaison/retour", "/mes-boutiques/liaison/retour",
      "http://antsia.example/mes-boutiques/liaison/retour", "https://antsia.example/autre",
      "https://antsia.example/a/../mes-boutiques/liaison/retour",
    ]) expect(preparation({ redirectUri }), redirectUri).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
    const otherPath = "https://antsia.example/autre";
    expect(parseCommerceLinkPreparation(canonical({ ...REQUEST, redirectUri: otherPath }), {
      ...CONTEXT, allowedRedirectUris: [otherPath],
    })).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
  });

  it("admet HTTP loopback seulement en sandbox, sans host ressemblant", () => {
    for (const host of ["localhost:3030", "127.0.0.1:3030", "[::1]:3030"]) {
      const redirectUri = `http://${host}/mes-boutiques/liaison/retour`;
      const body = { ...REQUEST, redirectUri };
      expect(parseCommerceLinkPreparation(canonical(body), { ...CONTEXT, allowedRedirectUris: [redirectUri] })).toMatchObject({ ok: true });
      expect(parseCommerceLinkPreparation(canonical({ ...body, environment: "production" }), {
        ...CONTEXT, environment: "production", allowedRedirectUris: [redirectUri],
      })).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
    }
    const redirectUri = "http://localhost.evil.test/mes-boutiques/liaison/retour";
    expect(parseCommerceLinkPreparation(canonical({ ...REQUEST, redirectUri }), {
      ...CONTEXT, allowedRedirectUris: [redirectUri],
    })).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
  });

  it("borne les octets UTF-8 et refuse JSON malformé, doublons ou JSON non canonique", () => {
    expect(COMMERCE_LINK_MAX_BYTES).toBe(8192);
    expect(parseCommerceLinkPreparation(canonical({ z: "é".repeat(4096) }), CONTEXT)).toMatchObject({ ok: false, reason: "body_too_large" });
    expect(parseCommerceLinkPreparation("{", CONTEXT)).toMatchObject({ ok: false, reason: "invalid_body" });
    expect(parseCommerceLinkPreparation(`${canonical(REQUEST)}\n`, CONTEXT)).toMatchObject({ ok: false, reason: "not_canonical" });
    expect(parseCommerceLinkPreparation('{"state":"first","state":"second"}', CONTEXT)).toMatchObject({ ok: false, reason: "not_canonical" });
  });

  it("la signature de préparation utilise la clé et le scope link.confirm sans confondre les corps", () => {
    const input = commerceCommandSigningInput({
      bodySha256: "a".repeat(64), environment: "sandbox", issuedAtMs: NOW,
      keyId: "antsia-sandbox-commerce-k1", nonce: "n".repeat(24), operation: "link.confirm", source: "antsia",
    });
    expect(input).toContain("pro-ga-commerce-command-hmac/v1");
    expect(input).toContain("commerce.link.confirm");
    expect(REQUEST.contract).toBe("PRO-COMMERCE-LINK-V1");
  });
});

describe("réponse LINK — corrélation et URL PRO.GA", () => {
  it("rend seulement la réponse fermée corrélée", () => {
    expect(prepared()).toEqual({ ok: true, value: JSON.parse(preparedBody()) });
  });

  it("refuse chaque champ manquant, les champs supplémentaires et le mauvais contrat", () => {
    const row = JSON.parse(preparedBody()) as Record<string, unknown>;
    for (const key of Object.keys(row)) {
      const body = Object.fromEntries(Object.entries(row).filter(([name]) => name !== key));
      expect(parseCommerceLinkPrepared(canonical(body), { request: REQUEST, authorizationOrigin: ORIGIN, nowMs: NOW }), key).toMatchObject({ ok: false, reason: "invalid_response" });
    }
    expect(prepared({ extra: true })).toMatchObject({ ok: false, reason: "invalid_response" });
    expect(prepared({ contract: "PRO-COMMERCE-COMMAND-V1" })).toMatchObject({ ok: false, reason: "invalid_response" });
  });

  it("corrèle identifiant, état et expiration sans accepter un délai réduit", () => {
    for (const changes of [{ requestId: "another-request" }, { state: "x".repeat(32) }, { expiresAt: REQUEST.expiresAt - 1 }]) {
      expect(prepared(changes)).toMatchObject({ ok: false, reason: "correlation_mismatch" });
    }
    expect(parseCommerceLinkPrepared(preparedBody(), { request: REQUEST, authorizationOrigin: ORIGIN, nowMs: REQUEST.expiresAt })).toMatchObject({ ok: false, reason: "invalid_time" });
  });

  it("refuse origines, chemins, paramètres supplémentaires et identifiants trompeurs", () => {
    for (const authorizationUrl of [
      `https://evil.example/commerce/autoriser?defi=${REQUEST.requestId}`,
      `${ORIGIN}.evil.test/commerce/autoriser?defi=${REQUEST.requestId}`,
      `${ORIGIN}/commerce/autre?defi=${REQUEST.requestId}`,
      `${ORIGIN}/commerce/autoriser?defi=another-request`,
      `${ORIGIN}/commerce/autoriser?defi=${REQUEST.requestId}&code=x`,
      `${ORIGIN}/commerce/autoriser?defi=${REQUEST.requestId}&defi=${REQUEST.requestId}`,
      `${ORIGIN}/commerce/autoriser?%64efi=${REQUEST.requestId}`,
      `${ORIGIN}/commerce/autoriser?defi=${REQUEST.requestId}#`,
      `https://user@pro.example/commerce/autoriser?defi=${REQUEST.requestId}`,
      `http://pro.example/commerce/autoriser?defi=${REQUEST.requestId}`,
      `/commerce/autoriser?defi=${REQUEST.requestId}`,
    ]) expect(prepared({ authorizationUrl }), authorizationUrl).toMatchObject({ ok: false, reason: "invalid_authorization_url" });
  });

  it("vérifie l'origine configurée exacte et autorise loopback sandbox", () => {
    expect(parseCommerceLinkPrepared(preparedBody(), { request: REQUEST, authorizationOrigin: `${ORIGIN}/`, nowMs: NOW })).toMatchObject({ ok: false, reason: "invalid_authorization_url" });
    const authorizationOrigin = "http://localhost:3023";
    const body = preparedBody({ authorizationUrl: `${authorizationOrigin}/commerce/autoriser?defi=${REQUEST.requestId}` });
    expect(parseCommerceLinkPrepared(body, { request: REQUEST, authorizationOrigin, nowMs: NOW })).toMatchObject({ ok: true });
    expect(parseCommerceLinkPrepared(body, { request: { ...REQUEST, environment: "production" }, authorizationOrigin, nowMs: NOW })).toMatchObject({ ok: false, reason: "invalid_authorization_url" });
  });

  it("encode requestId sans permettre l'ajout de paramètres", () => {
    const request = { ...REQUEST, requestId: "antsia:link:request-0001" };
    const body = preparedBody({ requestId: request.requestId, authorizationUrl: `${ORIGIN}/commerce/autoriser?defi=${encodeURIComponent(request.requestId)}` });
    expect(parseCommerceLinkPrepared(body, { request, authorizationOrigin: ORIGIN, nowMs: NOW })).toMatchObject({ ok: true });
  });

  it("applique les mêmes limites d'octets et de canonicalisation à la réponse", () => {
    const context = { request: REQUEST, authorizationOrigin: ORIGIN, nowMs: NOW };
    expect(parseCommerceLinkPrepared(canonical({ z: "é".repeat(4096) }), context)).toMatchObject({ ok: false, reason: "body_too_large" });
    expect(parseCommerceLinkPrepared(`${preparedBody()} `, context)).toMatchObject({ ok: false, reason: "not_canonical" });
  });
});
