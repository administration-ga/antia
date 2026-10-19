// @vitest-environment edge-runtime
/** P08 : tests de raccord écrits, non exécutés ; aucune configuration réelle activée. */
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { COMMERCE_PUBLIC_CONTRACT, commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_TRANSPORT_TEST_CONTRACT, type FederationEnvironment, federationSigningText } from "@antsia/social-domain/federationProtocol"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestOperatorProof, testConvex } from "../../test.setup"
import { correlatedFederationReceipt, parseCommerceTransportProbe } from "./commerceTransport"
import { federationBodyDigest } from "./signature"

const KEY_NAME = "ANTSIA_FEDERATION_COMMERCE_TEST_KEY"
const KEY = "commerce-transport-sandbox-test-key-0123456789"
const PATH = "/federation/inbox"
const NOW = Date.UTC(2026, 9, 18, 12)
type T = ReturnType<typeof testConvex>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("ANTSIA_COMMERCE_TRANSPORT_TEST_ENABLED", "true")
  vi.stubEnv(KEY_NAME, KEY)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function fixture(environment: FederationEnvironment = "sandbox") {
  const t = testConvex()
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const subject = `commerce-transport-operator-${crypto.randomUUID()}`
  const personId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("persons", { authUserId: subject, createdAt: NOW, updatedAt: NOW })
    await ctx.db.insert("operators", { personId: id, role: "platform_admin", grantedAt: NOW })
    return id
  })
  const as = t.withIdentity({ subject })
  await createTestOperatorProof(t, as, personId)
  const emitterId = await as.mutation(api.modules.federation.emitters.configure, {
    networkId: root, slug: "pro-ga-test", environment, enabled: true, keyEnvName: KEY_NAME,
    allowedContracts: [COMMERCE_TRANSPORT_TEST_CONTRACT, COMMERCE_PUBLIC_CONTRACT], reason: "Fixture locale du transport commercial",
  })
  return { t, as, root, emitterId, environment }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

function probe(eventId = "commerce-probe-001", correlationId = "correlation-001") {
  return { contract: COMMERCE_TRANSPORT_TEST_CONTRACT, eventId, objectRef: `pro.ga:transport_test:${"a".repeat(32)}`, payload: { type: "transport.probe", correlationId, sentAt: NOW }, version: 1 }
}
function publicEvent() {
  const shopRef = "pro.ga:structure:01JA00000000000000000000S1"
  return { contract: COMMERCE_PUBLIC_CONTRACT, eventId: "commerce-public-001", objectRef: shopRef, payload: { type: "shop.withdrawn", shopRef, linkRef: "pro.ga:commerce_link:01JA00000000000000000000K1", revision: 1, changedAt: NOW, reason: "consent_withdrawn" }, version: 1 }
}
async function post(f: Fixture, rawBody: string, overrides: Record<string, string> = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(federationSigningText(f.environment, timestamp, rawBody)))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return await f.t.fetch(PATH, { method: "POST", body: rawBody, headers: { "Content-Type": "application/json", "x-antsia-emitter": "pro-ga-test", "x-antsia-environment": f.environment, "x-antsia-timestamp": timestamp, "x-antsia-signature": signature, ...overrides } })
}
async function rows(t: T) {
  return await t.run(async (ctx) => ({
    receipts: await ctx.db.query("federationInboxReceipts").take(20), letters: await ctx.db.query("federationDeadLetters").take(20),
    probes: await ctx.db.query("federationCommerceProbes").take(20), mirrors: await ctx.db.query("mirrors").take(20),
    shops: await ctx.db.query("shops").take(20), pages: await ctx.db.query("pages").take(20),
  }))
}
async function letterFixture(f: Fixture, rawBody: string) {
  const envelope = JSON.parse(rawBody) as { eventId: string; contract: string; objectRef: string }
  const digest = await federationBodyDigest(rawBody)
  return await f.t.run(async (ctx) => {
    const receiptId = await ctx.db.insert("federationInboxReceipts", { networkId: f.root, emitterId: f.emitterId, environment: f.environment, eventId: envelope.eventId, contract: envelope.contract, version: 1, objectRef: envelope.objectRef, bodySha256: digest, status: "dead_letter", receivedAt: NOW, updatedAt: NOW })
    return await ctx.db.insert("federationDeadLetters", { networkId: f.root, emitterId: f.emitterId, environment: f.environment, receiptId, eventId: envelope.eventId, contract: envelope.contract, objectRef: envelope.objectRef, bodySha256: digest, rawBody, reason: "unsupported_contract", status: "dead_letter", attempts: 1, firstFailedAt: NOW, lastAttemptAt: NOW })
  })
}
async function errorCode(work: Promise<unknown>) {
  try { await work; return null } catch (error) { return engineErrorCode(error) }
}

describe("P08 — réception commerciale honnête", () => {
  it("applique seulement une preuve technique, avec reçu corrélé et déduplication", async () => {
    const f = await fixture(), raw = commerceCanonicalJson(probe())!
    const before = await rows(f.t), digest = await federationBodyDigest(raw)
    const first = await post(f, raw)
    expect(first.status).toBe(202)
    expect(await first.json()).toEqual({ outcome: "accepted", status: "applied", eventId: "commerce-probe-001", bodySha256: digest, applicationStatus: "applied" })
    const after = await rows(f.t)
    expect(after.probes).toHaveLength(1)
    expect(Object.keys(after.probes[0]!).sort()).toEqual(["_id", "_creationTime", "networkId", "emitterId", "eventId", "correlationId", "sentAt", "receivedAt"].sort())
    expect(after.probes[0]).toMatchObject({ networkId: f.root, emitterId: f.emitterId, correlationId: "correlation-001", sentAt: NOW, receivedAt: NOW })
    expect(after.shops).toEqual(before.shops)
    expect(after.pages).toEqual(before.pages)
    expect(after.mirrors).toEqual(before.mirrors)
    expect(after.letters).toEqual([])
    const duplicate = await post(f, raw)
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toEqual({ outcome: "duplicate", status: "applied", eventId: "commerce-probe-001", bodySha256: digest, applicationStatus: "applied" })
    expect((await rows(f.t)).probes).toEqual(after.probes)
    expect((await post(f, commerceCanonicalJson(probe("commerce-probe-001", "another-correlation"))!)).status).toBe(409)
  })

  it("PUBLIC valide sans mapping P09 devient refus métier, jamais une application de catalogue", async () => {
    const f = await fixture(), raw = commerceCanonicalJson(publicEvent())!
    const before = await rows(f.t)
    const response = await post(f, raw)
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ outcome: "accepted", status: "dead_letter", eventId: "commerce-public-001", bodySha256: await federationBodyDigest(raw), applicationStatus: "rejected" })
    const saved = await rows(f.t)
    expect(saved.letters[0]).toMatchObject({ reason: "contract_not_allowed", rawBody: raw })
    expect(saved.shops).toEqual(before.shops)
    expect(saved.pages).toEqual(before.pages)
    expect(saved.probes).toEqual([])
    const duplicate = await post(f, raw)
    expect(await duplicate.json()).toMatchObject({ outcome: "duplicate", applicationStatus: "rejected" })
  })

  it.each(["whitespace", "duplicate_key", "unknown_payload"])("PUBLIC %s refusé avant reçu", async (variant) => {
    const f = await fixture()
    let raw = commerceCanonicalJson(publicEvent())!
    if (variant === "whitespace") raw += " "
    if (variant === "duplicate_key") raw = raw.replace('"revision":1', '"revision":1,"revision":1')
    if (variant === "unknown_payload") raw = commerceCanonicalJson({ ...publicEvent(), payload: { type: "unknown" } })!
    expect((await post(f, raw)).status).toBe(400)
    expect((await rows(f.t)).receipts).toEqual([])
    expect((await rows(f.t)).letters).toEqual([])
  })

  it.each([undefined, "false", "TRUE"])("sans flag exact true (%s), aucune preuve ni reçu", async (flag) => {
    const f = await fixture()
    vi.stubEnv("ANTSIA_COMMERCE_TRANSPORT_TEST_ENABLED", flag)
    expect((await post(f, commerceCanonicalJson(probe())!)).status).toBe(401)
    expect((await rows(f.t)).receipts).toEqual([])
    expect((await rows(f.t)).probes).toEqual([])
  })

  it("production refuse toujours la recette même avec le flag true", async () => {
    const f = await fixture("production")
    vi.stubEnv("FEDERATION_ENVIRONMENT", "production")
    expect((await post(f, commerceCanonicalJson(probe())!)).status).toBe(401)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("contrat non autorisé et signature incorrecte restent sans effet", async () => {
    const f = await fixture(), raw = commerceCanonicalJson(probe())!
    expect((await post(f, raw, { "x-antsia-signature": "0".repeat(64) })).status).toBe(401)
    await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { allowedContracts: [COMMERCE_PUBLIC_CONTRACT] }))
    expect((await post(f, raw)).status).toBe(401)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("le replay applique la même recette et ne produit pas une seconde preuve", async () => {
    const f = await fixture()
    const letterId = await letterFixture(f, commerceCanonicalJson(probe())!)
    const args = { deadLetterId: letterId, reason: "Rejeu explicite du contrat de recette" }
    expect((await f.as.mutation(api.modules.federation.replay.replay, args)).outcome).toBe("applied")
    expect((await f.as.mutation(api.modules.federation.replay.replay, args)).outcome).toBe("deduplicated")
    expect((await rows(f.t)).probes).toHaveLength(1)
  })

  it("le replay relit le flag et la forme canonique avant tout effet", async () => {
    const f = await fixture(), raw = commerceCanonicalJson(probe())!
    const letterId = await letterFixture(f, raw + " ")
    const args = { deadLetterId: letterId, reason: "Contrôle des octets persistés en recette" }
    expect(await errorCode(f.as.mutation(api.modules.federation.replay.replay, args))).toBe("conflict")
    vi.stubEnv("ANTSIA_COMMERCE_TRANSPORT_TEST_ENABLED", "false")
    expect(await errorCode(f.as.mutation(api.modules.federation.replay.replay, args))).toBe("policyRefused")
    expect((await rows(f.t)).probes).toEqual([])
    expect((await rows(f.t)).receipts[0]?.status).toBe("dead_letter")
  })
})

describe("P08 — forme fermée de la preuve et statut d'application", () => {
  it.each([
    { ...probe(), extra: true },
    { ...probe(), objectRef: `pro.ga:transport_test:${"A".repeat(32)}` },
    { ...probe(), payload: { ...probe().payload, extra: true } },
    { ...probe(), payload: { ...probe().payload, correlationId: "x" } },
    { ...probe(), payload: { ...probe().payload, correlationId: "abcdefgh\n" } },
    { ...probe(), payload: { ...probe().payload, sentAt: NOW + 300_001 } },
    { ...probe(), payload: { ...probe().payload, sentAt: 0.5 } },
  ])("refuse %j", (body) => { expect(parseCommerceTransportProbe(commerceCanonicalJson(body)!, NOW)).toBeNull() })
  it("refuse espaces/2Kio dépassés et distingue les trois états de reçu", () => {
    const raw = commerceCanonicalJson(probe())!
    expect(parseCommerceTransportProbe(raw + " ", NOW)).toBeNull()
    expect(parseCommerceTransportProbe(raw + " ".repeat(2048), NOW)).toBeNull()
    expect(correlatedFederationReceipt("event-001", "a".repeat(64), "received").applicationStatus).toBe("received")
    expect(correlatedFederationReceipt("event-001", "a".repeat(64), "applied").applicationStatus).toBe("applied")
    for (const state of ["discarded", "dead_letter"] as const) expect(correlatedFederationReceipt("event-001", "a".repeat(64), state).applicationStatus).toBe("rejected")
  })
})
