// @vitest-environment edge-runtime
// PA9D : scénarios du transfert privé écrits sans exécution dans ce lot.
import { AGENT_CONSENT_TRANSFER_PATH, agentConsentTransferSigningText, parseAgentConsentTransferResponse, type AgentConsentTransferGrant } from "@antsia/social-domain/agentConsentTransfer"
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER } from "@antsia/social-domain/federationProtocol"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { dataTableNames } from "../people/dataInventory"
import { ERASURE_GRACE_MS } from "../people/erasure"
import { federationBodyDigest } from "./signature"

type T = ReturnType<typeof testConvex>
type Fixture = { t: T; root: Id<"networks">; administration: Id<"networks">; emitterId: Id<"federationEmitters"> }
type PreparedTransfer = { url: string; expiresAt: number }
const GRANT = makeFunctionReference<"mutation", { accepted: true; textVersion: string }, null>("modules/federation/agents:grant")
const WITHDRAW = makeFunctionReference<"mutation", Record<string, never>, null>("modules/federation/agents:withdraw")
const PREPARE = makeFunctionReference<"mutation", Record<string, never>, PreparedTransfer>("modules/federation/agents:prepareTransfer")
const MY_GRANT = makeFunctionReference<"query", Record<string, never>, AgentConsentTransferGrant | null>("modules/federation/agents:myTransferGrant")
const T0 = Date.UTC(2026, 9, 18, 12)
const IDN_SUB = "IDN:Private:Agent-Transfer-PA9D"
const KEY_NAME = "ANTSIA_FEDERATION_PA9D_TRANSFER_TEST_KEY"
const ADMINISTRATION_ORIGIN = "https://administration.example.test"
const TEXT_VERSION = CONSENT_TEXT_VERSIONS.administration_reflection
let signingKey: string

beforeAll(async () => {
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  // Charger la route réelle avant les fausses horloges, comme la suite PA9C.
  expect((await testConvex().fetch(AGENT_CONSENT_TRANSFER_PATH, { method: "POST" })).status).toBe(401)
}, 120_000)
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  signingKey = `${crypto.randomUUID()}${crypto.randomUUID()}`
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv("ANTSIA_ADMINISTRATION_PUBLIC_ORIGIN", ADMINISTRATION_ORIGIN)
  vi.stubEnv(KEY_NAME, signingKey)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function fixture(): Promise<Fixture> {
  const t = testConvex({ automaticSessions: false })
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const source = await t.run(async (ctx) => {
    const administration = await ctx.db.insert("networks", { slug: "administration", name: "Administration de recette", kind: "closed", parentId: root, membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [], theme: "antsia", status: "active", createdAt: T0, updatedAt: T0 })
    const emitterId = await ctx.db.insert("federationEmitters", { networkId: administration, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true, keyEnvName: KEY_NAME, allowedContracts: [RESEAU_PUBLIC_CONTRACT], revision: 1, createdAt: T0, updatedAt: T0 })
    return { administration, emitterId }
  })
  return { t, root, ...source }
}

function idOf(value: unknown): string {
  if (value && typeof value === "object" && "_id" in value && typeof value._id === "string") return value._id
  throw new Error("Compte Better Auth de fixture absent")
}

async function member(f: Fixture, idn = true) {
  const userId = idOf(await f.t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "État civil non transféré", email: "pa9d-transfer@example.test", emailVerified: true, createdAt: T0, updatedAt: T0 } } }))
  const sessionId = await createTestSession(f.t, userId)
  const as = f.t.withIdentity({ subject: userId, sessionId, applicationOrigin: "antsia" })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  if (idn) {
    await f.t.mutation(components.betterAuth.adapter.create, { input: { model: "account", data: { userId, providerId: "idn", accountId: IDN_SUB, createdAt: T0, updatedAt: T0 } } })
    await f.t.mutation(internal.modules.people.identity.recordIdnProof, { subject: IDN_SUB, loa: 2 })
    await as.mutation(api.modules.people.identity.linkIdn, {})
  }
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "agent.pa9d", displayName: "Jean-Rémy NDONG MBA" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: f.root })
  return { as, personId, userId, sessionId }
}
type Member = Awaited<ReturnType<typeof member>>

async function grant(person: Member): Promise<AgentConsentTransferGrant> {
  await person.as.mutation(GRANT, { accepted: true, textVersion: TEXT_VERSION })
  const granted = await person.as.query(MY_GRANT, {})
  if (!granted) throw new Error("Accord transférable de fixture absent")
  return granted
}

function tokenOf(prepared: PreparedTransfer): string {
  const token = new URLSearchParams(new URL(prepared.url).hash.slice(1)).get("antsia-transfer")
  if (!token || !/^[a-f0-9]{64}$/u.test(token)) throw new Error("Code de transfert de fixture absent")
  return token
}

async function grantRow(f: Fixture, person: Member) {
  const row = await f.t.run(async (ctx) => ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", person.personId)).unique())
  if (!row) throw new Error("Accord personnel de fixture absent")
  return row
}

async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")
}

function requestBody(token: string, idnSub = IDN_SUB): string { return JSON.stringify({ token, idnSub }) }

async function post(f: Fixture, token: string, idnSub = IDN_SUB, overrides: Record<string, string> = {}) {
  const rawBody = requestBody(token, idnSub)
  const timestamp = overrides["x-antsia-timestamp"] ?? String(Math.floor(Date.now() / 1000))
  const environment = overrides["x-antsia-environment"] === "production" ? "production" : "sandbox"
  const signature = await hmac(agentConsentTransferSigningText(environment, timestamp, rawBody))
  return await f.t.fetch(AGENT_CONSENT_TRANSFER_PATH, { method: "POST", body: rawBody, headers: {
    "Content-Type": "application/json", "x-antsia-emitter": RESEAU_PUBLIC_EMITTER,
    "x-antsia-environment": environment, "x-antsia-timestamp": timestamp, "x-antsia-signature": signature, ...overrides,
  } })
}

async function expectUnauthorized(response: Response) {
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ outcome: "unauthorized" })
}

describe("PA9D — transfert privé du consentement administratif", () => {
  it("prépare pour le titulaire vivant un code court en fragment, dont seule l'empreinte est stockée", async () => {
    const f = await fixture(), person = await member(f), granted = await grant(person)
    const prepared = await person.as.mutation(PREPARE, {}), token = tokenOf(prepared)
    const url = new URL(prepared.url), persisted = await grantRow(f, person)
    expect(url.origin).toBe(ADMINISTRATION_ORIGIN)
    expect(url.pathname).toBe("/espace/profil")
    expect(url.search).toBe("?section=reseau")
    expect(prepared.expiresAt).toBe(T0 + 10 * 60 * 1000)
    expect(persisted.transferExpiresAt).toBe(prepared.expiresAt)
    expect(persisted.transferTokenHash).toBe(await federationBodyDigest(token))
    expect(persisted.transferUsedAt).toBeUndefined()
    expect(persisted.transferRevision).toBe(1)
    for (const value of [IDN_SUB, granted.consentRef, granted.agentRef]) expect(decodeURIComponent(prepared.url)).not.toContain(value)
    url.hash = ""
    expect(url.toString()).not.toContain(token)
    expect(JSON.stringify(persisted)).not.toContain(token)
  })

  it("refuse une préparation sans accord ou sans session vivante et ne provisionne aucune personne", async () => {
    const f = await fixture(), person = await member(f)
    await expect(person.as.mutation(PREPARE, {})).rejects.toThrow()
    await grant(person)
    const expiredSessionId = await createTestSession(f.t, person.userId, T0)
    const expired = f.t.withIdentity({ subject: person.userId, sessionId: expiredSessionId })
    await expect(expired.mutation(PREPARE, {})).rejects.toThrow()
    await expect(f.t.mutation(PREPARE, {})).rejects.toThrow()
    expect((await grantRow(f, person)).transferTokenHash).toBeUndefined()
    expect(await f.t.run(async ctx => ctx.db.query("persons").take(10))).toHaveLength(1)
    expect(await f.t.run(async ctx => ctx.db.query("networkMemberships").take(10))).toHaveLength(1)
  })

  it("un compte sans preuve IDN ne prépare aucun code", async () => {
    const f = await fixture(), person = await member(f, false)
    await expect(person.as.mutation(GRANT, { accepted: true, textVersion: TEXT_VERSION })).rejects.toThrow()
    await expect(person.as.mutation(PREPARE, {})).rejects.toThrow()
    expect(await f.t.run(async ctx => ctx.db.query("federationAgentGrants").take(10))).toEqual([])
  })

  it.each([
    ["signature absente", { "x-antsia-signature": "" }],
    ["signature invalide", { "x-antsia-signature": "0".repeat(64) }],
    ["autre source", { "x-antsia-emitter": "autre-source" }],
    ["autre environnement", { "x-antsia-environment": "production" }],
    ["date périmée", { "x-antsia-timestamp": String(Math.floor(T0 / 1000) - 301) }],
  ] satisfies Array<[string, Record<string, string>]>)("refuse %s sans consommer le code", async (_label, overrides) => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {})), before = await grantRow(f, person)
    await expectUnauthorized(await post(f, token, IDN_SUB, overrides))
    expect(await grantRow(f, person)).toEqual(before)
    expect((await post(f, token)).status).toBe(200)
  })

  it("une source désactivée ou une configuration absente ferme la résolution", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {}))
    await f.t.run(async ctx => ctx.db.patch(f.emitterId, { enabled: false }))
    await expectUnauthorized(await post(f, token))
    vi.stubEnv("FEDERATION_ENVIRONMENT", "")
    const response = await post(f, token)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ outcome: "unavailable" })
    expect((await grantRow(f, person)).transferUsedAt).toBeUndefined()
  })

  it("une autre identité IDN ne consomme pas le code du titulaire", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {})), before = await grantRow(f, person)
    await expectUnauthorized(await post(f, token, "IDN:Other:Authenticated-Person"))
    expect(await grantRow(f, person)).toEqual(before)
    expect((await post(f, token)).status).toBe(200)
  })

  it("rend exactement l'accord signé lié aux octets de la requête, une seule fois, sans adhésion créée", async () => {
    const f = await fixture(), person = await member(f), granted = await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {}))
    const memberships = await f.t.run(async ctx => ctx.db.query("networkMemberships").take(10))
    const response = await post(f, token), rawResponse = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(parseAgentConsentTransferResponse(rawResponse, Date.now())).toEqual({ ok: true, response: { outcome: "granted", grant: granted } })
    expect(Object.keys(JSON.parse(rawResponse).grant).sort()).toEqual(["agentRef", "consentRef", "grantedAt", "textVersion"])
    const responseTimestamp = response.headers.get("x-antsia-timestamp")
    if (!responseTimestamp) throw new Error("Horodatage signé absent")
    expect(response.headers.get("x-antsia-environment")).toBe("sandbox")
    const signature = response.headers.get("x-antsia-signature")
    expect(signature).toBe(await hmac(agentConsentTransferSigningText("sandbox", responseTimestamp, rawResponse, await federationBodyDigest(requestBody(token)))))
    expect(signature).not.toBe(await hmac(agentConsentTransferSigningText("sandbox", responseTimestamp, rawResponse)))
    expect(signature).not.toBe(await hmac(agentConsentTransferSigningText("sandbox", responseTimestamp, rawResponse, await federationBodyDigest(requestBody(token, "IDN:Other:Request")))))
    expect(rawResponse).not.toContain(IDN_SUB)
    expect(rawResponse).not.toContain(token)
    const persisted = await grantRow(f, person)
    expect(persisted.transferUsedAt).toBe(T0)
    expect(persisted.transferTokenHash).toBeUndefined()
    await expectUnauthorized(await post(f, token))
    expect(await f.t.run(async ctx => ctx.db.query("networkMemberships").take(10))).toEqual(memberships)
    expect(await f.t.run(async ctx => ctx.db.query("persons").take(10))).toHaveLength(1)
    expect(await f.t.run(async ctx => ctx.db.query("identityLinks").withIndex("by_person_and_provider", q => q.eq("personId", person.personId).eq("provider", "administration")).take(2))).toEqual([])
  })

  it("refuse le code dès l'instant exact de son expiration", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const prepared = await person.as.mutation(PREPARE, {}), token = tokenOf(prepared)
    vi.setSystemTime(prepared.expiresAt)
    await expectUnauthorized(await post(f, token))
    expect((await grantRow(f, person)).transferUsedAt).toBeUndefined()
  })

  it("un nouveau code invalide le précédent, même préparé au même instant", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const oldToken = tokenOf(await person.as.mutation(PREPARE, {}))
    const newToken = tokenOf(await person.as.mutation(PREPARE, {}))
    expect(newToken).not.toBe(oldToken)
    expect((await grantRow(f, person)).transferRevision).toBe(2)
    await expectUnauthorized(await post(f, oldToken))
    expect((await post(f, newToken)).status).toBe(200)
  })

  it("retrait puis nouvel accord ferment définitivement le code de l'ancienne génération", async () => {
    const f = await fixture(), person = await member(f), previous = await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {}))
    await person.as.mutation(WITHDRAW, {})
    expect((await grantRow(f, person)).transferTokenHash).toBeUndefined()
    await expectUnauthorized(await post(f, token))
    const current = await grant(person)
    expect(current.consentRef).not.toBe(previous.consentRef)
    expect(current.agentRef).not.toBe(previous.agentRef)
    await expectUnauthorized(await post(f, token))
    expect((await post(f, tokenOf(await person.as.mutation(PREPARE, {})))).status).toBe(200)
  })

  it("l'export réel exclut le code et son empreinte pendant qu'ils sont encore présents", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {})), persisted = await grantRow(f, person)
    expect(persisted.transferTokenHash).toBe(await federationBodyDigest(token))
    // L'export est un instantané à l'heure de sa demande (une ligne créée après est exclue, PA5) ;
    // l'horloge figée du harnais date les lignes à T0 + fractions : la demande vient ensuite,
    // bien avant l'échéance du code (AGENT_TRANSFER_TTL_MS), toujours présent dans la ligne.
    vi.setSystemTime(Date.now() + 1_000)
    const exported = await person.as.mutation(api.modules.people.erasure.exportMyData, {})
    const tableIndex = dataTableNames().indexOf("federationAgentGrants")
    expect(tableIndex).toBeGreaterThanOrEqual(0)
    const page = await person.as.query(api.modules.people.erasure.exportMyDataPage, { exportId: exported.exportId, tableIndex, cursor: null })
    expect(JSON.parse(page.json)).toEqual([expect.objectContaining({ personId: person.personId, status: "waiting" })])
    for (const field of ["transferTokenHash", "transferExpiresAt", "transferUsedAt", "transferRevision", "subjectDigest", "consentRef", "agentRef"]) expect(page.json).not.toContain(`"${field}"`)
    expect(page.json).not.toContain(token)
    expect(page.json).not.toContain(persisted.transferTokenHash)
    expect(page.json).not.toContain(IDN_SUB)
  })

  it("la demande d'effacement ferme immédiatement le code, puis la purge supprime le grant personnel", async () => {
    const f = await fixture(), person = await member(f)
    await grant(person)
    const token = tokenOf(await person.as.mutation(PREPARE, {})), tokenHash = await federationBodyDigest(token)
    const { dueAt } = await person.as.mutation(api.modules.people.erasure.requestErasure, { confirmation: "DELETE_MY_ANTSIA_ACCOUNT" })
    expect(dueAt).toBe(T0 + ERASURE_GRACE_MS)
    expect((await grantRow(f, person)).transferTokenHash).toBeUndefined()
    await expectUnauthorized(await post(f, token))
    const job = await f.t.run(async ctx => ctx.db.query("dataErasureJobs").withIndex("by_person", q => q.eq("personId", person.personId)).unique())
    if (!job) throw new Error("Travail d'effacement de fixture absent")
    vi.setSystemTime(dueAt + 1)
    await f.t.mutation(internal.modules.people.erasure.continueErasure, { jobId: job._id })
    // Même reprise bornée que la recette PA5 pour traverser tout l'inventaire réel.
    for (let step = 0; step < 1500 && await f.t.run(async ctx => ctx.db.get(job._id)); step++) {
      vi.runAllTimers()
      await f.t.finishInProgressScheduledFunctions()
    }
    expect(await f.t.run(async ctx => ctx.db.get(job._id))).toBeNull()
    expect(await f.t.run(async ctx => ctx.db.query("federationAgentGrants").withIndex("by_person", q => q.eq("personId", person.personId)).take(2))).toEqual([])
    expect(await f.t.run(async ctx => ctx.db.query("federationAgentGrants").withIndex("by_transfer_token_hash", q => q.eq("transferTokenHash", tokenHash)).take(2))).toEqual([])
    await expectUnauthorized(await post(f, token))
  })
})
