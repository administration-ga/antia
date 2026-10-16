// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { FEDERATION_BODY_MAX_BYTES, FEDERATION_IMPLEMENTED_CONTRACTS, federationSigningText } from "@antsia/social-domain/federationProtocol"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { readFederationBody } from "./http"

type T = ReturnType<typeof testConvex>
const PATH = "/federation/inbox"
const KEY_NAME = "ANTSIA_FEDERATION_TEST_SANDBOX_KEY"
const T0 = Date.UTC(2026, 9, 16, 12)
const CONFIG_REASON = "Configuration de la recette fictive"
let key: string

beforeAll(async () => {
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  expect((await testConvex().fetch(PATH, { method: "POST" })).status).toBe(401)
}, 120_000)
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  key = `${crypto.randomUUID()}${crypto.randomUUID()}`
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv(KEY_NAME, key)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function admin(t: T, role: "platform_admin" | "platform_operator" = "platform_admin", strong = true) {
  const subject = `federation-test-${crypto.randomUUID()}`
  const personId = await t.run(async (ctx) => {
    const personId = await ctx.db.insert("persons", { authUserId: subject, createdAt: T0, updatedAt: T0 })
    await ctx.db.insert("operators", { personId, role, grantedAt: T0 })
    if (strong) await ctx.db.insert("identityLinks", { personId, provider: "idn", subject: `proof-${subject}`, loa: 2, linkedAt: T0 })
    return personId
  })
  return { personId, as: t.withIdentity({ subject }) }
}

async function fixture() {
  const t = testConvex()
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const actor = await admin(t)
  const emitterId = await actor.as.mutation(api.modules.federation.emitters.configure, { networkId: root, slug: "socle-test", environment: "sandbox", enabled: true, keyEnvName: KEY_NAME, allowedContracts: ["RESEAU-PUBLIC-V1"], reason: CONFIG_REASON })
  return { t, root, testClosed, actor, emitterId }
}

function body(eventId = "event-001", payload: unknown = { title: "Information publique fictive" }, contract = "RESEAU-PUBLIC-V1") {
  return JSON.stringify({ eventId, contract, version: 1, objectRef: "page:test-public", payload })
}
async function signedHeaders(rawBody: string, overrides: Record<string, string> = {}) {
  const environment = overrides["x-antsia-environment"] ?? "sandbox"
  const timestamp = overrides["x-antsia-timestamp"] ?? String(Math.floor(Date.now() / 1000))
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(federationSigningText(environment === "production" ? "production" : "sandbox", timestamp, rawBody)))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return { "Content-Type": "application/json", "x-antsia-emitter": "socle-test", "x-antsia-environment": environment, "x-antsia-timestamp": timestamp, "x-antsia-signature": signature, ...overrides }
}
async function post(t: T, rawBody = body(), overrides: Record<string, string> = {}) {
  return await t.fetch(PATH, { method: "POST", body: rawBody, headers: await signedHeaders(rawBody, overrides) })
}
async function rows(t: T) {
  return await t.run(async (ctx) => ({ receipts: await ctx.db.query("federationInboxReceipts").take(100), letters: await ctx.db.query("federationDeadLetters").take(100), mirrors: await ctx.db.query("mirrors").take(100), people: await ctx.db.query("persons").take(100), memberships: await ctx.db.query("networkMemberships").take(100) }))
}
async function codeOf(promise: Promise<unknown>) { try { await promise; return null } catch (error) { return engineErrorCode(error) } }

describe("PA5 — inbox signée réelle, registre fermé et rejeu audité", () => {
  it("un contrat autorisé mais non branché devient une seule lettre morte sans personne ni miroir", async () => {
    const f = await fixture(), before = await rows(f.t)
    const response = await post(f.t)
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ outcome: "accepted", status: "dead_letter" })
    const after = await rows(f.t)
    expect(after.receipts).toHaveLength(1)
    expect(after.receipts[0]?.networkId).toBe(f.root)
    expect(after.letters[0]?.reason).toBe("unsupported_contract")
    expect(after.letters[0]?.rawBody).toBe(body())
    expect(after.people).toHaveLength(before.people.length)
    expect(after.memberships).toHaveLength(before.memberships.length)
    expect(after.mirrors).toEqual([])
    expect(FEDERATION_IMPLEMENTED_CONTRACTS).toEqual([])
    expect(JSON.stringify(await f.t.run(async (ctx) => ctx.db.get(f.emitterId)))).not.toContain(key)
  })

  it("la redélivrance identique ne réécrit ni reçu ni DLQ", async () => {
    const f = await fixture()
    await post(f.t)
    const before = await rows(f.t)
    expect((await post(f.t)).status).toBe(200)
    const after = await rows(f.t)
    expect(after.receipts).toEqual(before.receipts)
    expect(after.letters).toEqual(before.letters)
  })

  it("la même clé d'évènement avec un autre corps exact reçoit409", async () => {
    const f = await fixture()
    await post(f.t)
    expect((await post(f.t, body("event-001", { title: "Autre corps" }))).status).toBe(409)
    // Même contenu JSON avec des espaces différents : l'empreinte porte les octets exacts.
    expect((await post(f.t, body() + " ")).status).toBe(409)
    expect((await rows(f.t)).letters).toHaveLength(1)
  })

  it.each(["wrong_signature", "tampered_body", "past", "future", "other_environment", "unknown_emitter"])("refuse %s avant tout reçu/DLQ", async (variant) => {
    const f = await fixture()
    let rawBody = body()
    const overrides: Record<string, string> = {}
    if (variant === "wrong_signature") overrides["x-antsia-signature"] = "0".repeat(64)
    if (variant === "past") overrides["x-antsia-timestamp"] = String(T0 / 1000 - 301)
    if (variant === "future") overrides["x-antsia-timestamp"] = String(T0 / 1000 + 301)
    if (variant === "other_environment") overrides["x-antsia-environment"] = "production"
    if (variant === "unknown_emitter") overrides["x-antsia-emitter"] = "unknown-test"
    if (variant === "tampered_body") {
      const headers = await signedHeaders(rawBody)
      rawBody = body("event-001", { title: "Corps altéré" })
      expect((await f.t.fetch(PATH, { method: "POST", body: rawBody, headers })).status).toBe(401)
    } else expect((await post(f.t, rawBody, overrides)).status).toBe(401)
    expect((await rows(f.t)).receipts).toEqual([])
    expect((await rows(f.t)).letters).toEqual([])
  })

  it.each(["", "dev"])("sans environnement explicite %s, le transport est indisponible", async (environment) => {
    const f = await fixture()
    vi.stubEnv("FEDERATION_ENVIRONMENT", environment)
    expect((await post(f.t)).status).toBe(503)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("une clé absente ne produit aucun effet", async () => {
    const f = await fixture()
    vi.stubEnv(KEY_NAME, "")
    expect((await post(f.t)).status).toBe(503)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("borne les octets UTF8 même avec un Content-Length mensonger", async () => {
    const f = await fixture()
    const rawBody = body("too-large", "é".repeat(FEDERATION_BODY_MAX_BYTES / 2))
    expect(rawBody.length).toBeLessThan(FEDERATION_BODY_MAX_BYTES)
    expect((await post(f.t, rawBody, { "content-length": "1" })).status).toBe(413)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("borne aussi un flux sans Content-Length et rejette un UTF8 invalide", async () => {
    const chunk = new Uint8Array(FEDERATION_BODY_MAX_BYTES / 2 + 1)
    const options = { method: "POST", duplex: "half", body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(chunk); controller.enqueue(chunk); controller.close() } }) }
    expect(await readFederationBody(new Request("http://localhost/federation-test", options))).toEqual({ ok: false, status: 413 })
    expect(await readFederationBody(new Request("http://localhost/federation-test", { method: "POST", body: new Uint8Array([0xff]) }))).toEqual({ ok: false, status: 400 })
  })

  it.each([body("forbidden", { networkId: "foreign-internal" }), body("private", { email: "fiction@example.test" }), JSON.stringify({ eventId: "extra", contract: "RESEAU-PUBLIC-V1", version: 1, objectRef: "page", payload: {}, networkId: "external" }), "{"])("un corps signé invalide n'ouvre aucun réseau (%s)", async (rawBody) => {
    const f = await fixture()
    expect((await post(f.t, rawBody)).status).toBe(400)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("un contrat non autorisé ne devient pas une lettre morte", async () => {
    const f = await fixture()
    expect((await post(f.t, body("other-contract", {}, "DIASPORA-ATTESTATION-V1"))).status).toBe(401)
    expect((await rows(f.t)).letters).toEqual([])
  })

  it("désactivation et changement de révision empêchent une admission déjà préparée", async () => {
    const f = await fixture(), rawBody = body(), headers = await signedHeaders(rawBody)
    const emitter = await f.t.run(async (ctx) => ctx.db.get(f.emitterId))
    if (!emitter) throw new Error("Émetteur de fixture absent")
    await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { revision: emitter.revision + 1 }))
    const args = { emitterId: f.emitterId, emitterRevision: emitter.revision, environment: "sandbox" as const, timestamp: headers["x-antsia-timestamp"], signature: headers["x-antsia-signature"], rawBody }
    expect((await f.t.mutation(internal.modules.federation.inbox.admit, args)).outcome).toBe("unauthorized")
    await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { enabled: false }))
    expect((await post(f.t)).status).toBe(401)
    expect((await rows(f.t)).receipts).toEqual([])
  })

  it("le quota système est indépendant du réseau et refuse la61e redélivrance", async () => {
    const f = await fixture()
    for (let index = 0; index < 60; index++) expect((await post(f.t)).status).toBe(index === 0 ? 202 : 200)
    expect((await post(f.t)).status).toBe(429)
    expect((await rows(f.t)).receipts).toHaveLength(1)
  }, 20_000)

  it("configurer exige administrateur + IDN fort vivant et un motif", async () => {
    const f = await fixture()
    const args = { networkId: f.root, slug: "another-test", environment: "sandbox" as const, enabled: true, keyEnvName: KEY_NAME, allowedContracts: ["RESEAU-PUBLIC-V1"], reason: CONFIG_REASON }
    const operator = await admin(f.t, "platform_operator"), weakAdmin = await admin(f.t, "platform_admin", false)
    expect(await codeOf(operator.as.mutation(api.modules.federation.emitters.configure, args))).toBe("notFound")
    expect(await codeOf(weakAdmin.as.mutation(api.modules.federation.emitters.configure, args))).toBe("notFound")
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.emitters.configure, { ...args, reason: "x" }))).toBe("invalidArgument")
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.emitters.configure, { ...args, keyEnvName: "AUTH_SECRET" }))).toBe("invalidArgument")
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.emitters.configure, args))).toBe("conflict") // une variable de clé par émetteur/environnement.
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.emitters.configure, { ...args, slug: "socle-test", networkId: f.testClosed }))).toBe("conflict")
    const proof = await f.t.run(async (ctx) => ctx.db.query("identityLinks").withIndex("by_person_and_provider", (q) => q.eq("personId", f.actor.personId).eq("provider", "idn")).unique())
    if (!proof) throw new Error("Preuve de fixture absente")
    await f.t.run(async (ctx) => ctx.db.patch(proof._id, { revokedAt: T0 }))
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.emitters.configure, args))).toBe("notFound")
  })

  it("DLQ opérateur seule ; rejeu motivé laisse les deux traces sans changer d'identifiants", async () => {
    const f = await fixture()
    await post(f.t)
    const letter = (await rows(f.t)).letters[0]
    if (!letter) throw new Error("DLQ de fixture absente")
    expect(await codeOf(f.t.query(api.modules.federation.replay.getDeadLetter, { deadLetterId: letter._id }))).toBe("unauthenticated")
    const ordinarySubject = `ordinary-${crypto.randomUUID()}`
    await f.t.run(async (ctx) => ctx.db.insert("persons", { authUserId: ordinarySubject, createdAt: T0, updatedAt: T0 }))
    expect(await codeOf(f.t.withIdentity({ subject: ordinarySubject }).query(api.modules.federation.replay.getDeadLetter, { deadLetterId: letter._id }))).toBe("operatorRequired")
    expect((await f.actor.as.query(api.modules.federation.replay.getDeadLetter, { deadLetterId: letter._id })).rawBody).toBe(body())
    const weakAdmin = await admin(f.t, "platform_admin", false), basicOperator = await admin(f.t, "platform_operator")
    const replayArgs = { deadLetterId: letter._id, reason: "Relecture après contrôle de recette" }
    expect(await codeOf(weakAdmin.as.mutation(api.modules.federation.replay.replay, replayArgs))).toBe("notFound")
    expect(await codeOf(basicOperator.as.mutation(api.modules.federation.replay.replay, replayArgs))).toBe("notFound")
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.replay.replay, { deadLetterId: letter._id, reason: "x" }))).toBe("invalidArgument")
    const replayed = await f.actor.as.mutation(api.modules.federation.replay.replay, { deadLetterId: letter._id, reason: "Relecture après contrôle de recette" })
    expect(replayed).toEqual({ outcome: "still_failing", eventId: letter.eventId })
    const after = await rows(f.t)
    expect(after.letters[0]?._id).toBe(letter._id)
    expect(after.letters[0]?.receiptId).toBe(letter.receiptId)
    expect(after.letters[0]?.attempts).toBe(2)
    expect(after.mirrors).toEqual([])
    expect(await f.t.run(async (ctx) => ctx.db.query("federationReplayAudit").withIndex("by_dead_letter_at", (q) => q.eq("deadLetterId", letter._id)).take(10))).toHaveLength(1)
    expect((await f.t.run(async (ctx) => ctx.db.query("engineAudit").withIndex("by_subject_at", (q) => q.eq("subjectTable", "federationDeadLetters").eq("subjectId", letter._id)).take(10)))[0]?.action).toBe("federation.replay")
  })

  it("un reçu déjà appliqué n'est pas appliqué une seconde fois au rejeu", async () => {
    const f = await fixture()
    await post(f.t)
    const letter = (await rows(f.t)).letters[0]
    if (!letter) throw new Error("DLQ de fixture absente")
    // État futur PA9, posé uniquement par la fixture ; aucun handler PA5 ne l'écrit.
    await f.t.run(async (ctx) => {
      await ctx.db.patch(letter.receiptId, { status: "applied" })
      await ctx.db.patch(letter._id, { status: "resolved", resolvedAt: T0 })
    })
    const before = await rows(f.t)
    expect((await f.actor.as.mutation(api.modules.federation.replay.replay, { deadLetterId: letter._id, reason: "Vérification du reçu déjà appliqué" })).outcome).toBe("deduplicated")
    const after = await rows(f.t)
    expect(after.receipts).toEqual(before.receipts)
    expect(after.letters).toEqual(before.letters)
  })

  it.each(["disabled", "contract_removed", "archived_network", "tampered_payload"])("le rejeu recontrôle %s", async (variant) => {
    const f = await fixture()
    await post(f.t)
    const letter = (await rows(f.t)).letters[0]
    if (!letter) throw new Error("DLQ de fixture absente")
    await f.t.run(async (ctx) => {
      if (variant === "disabled") await ctx.db.patch(f.emitterId, { enabled: false })
      if (variant === "contract_removed") await ctx.db.patch(f.emitterId, { allowedContracts: [] })
      if (variant === "archived_network") await ctx.db.patch(f.root, { status: "archived" })
      if (variant === "tampered_payload") await ctx.db.patch(letter._id, { rawBody: body("event-001", { title: "Corps altéré" }) })
    })
    expect(await codeOf(f.actor.as.mutation(api.modules.federation.replay.replay, { deadLetterId: letter._id, reason: "Relecture de la même lettre morte" }))).toBe(variant === "tampered_payload" ? "conflict" : "policyRefused")
    expect((await rows(f.t)).letters[0]?.attempts).toBe(1)
  })
})
