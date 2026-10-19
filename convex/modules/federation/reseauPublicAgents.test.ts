// @vitest-environment edge-runtime
// PA9C : scénarios écrits contre les fonctions réelles ; aucune exécution dans ce lot.
import { CONSENT_TEXT_VERSIONS } from "@antsia/social-domain/consent"
import { federationSigningText, RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER, type FederationEnvelope } from "@antsia/social-domain/federationProtocol"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { dataTableNames } from "../people/dataInventory"
import { applyFederationEnvelope } from "./reseauPublic"
import { federationBodyDigest } from "./signature"

type T = ReturnType<typeof testConvex>
type TransferGrant = { consentRef: string; agentRef: string; textVersion: string; grantedAt: number }
type Fixture = { t: T; root: Id<"networks">; administration: Id<"networks">; emitterId: Id<"federationEmitters"> }
const GRANT = makeFunctionReference<"mutation", { accepted: true; textVersion: string }, null>("modules/federation/agents:grant")
const WITHDRAW = makeFunctionReference<"mutation", Record<string, never>, null>("modules/federation/agents:withdraw")
const MY_CONSENT = makeFunctionReference<"query", Record<string, never>, unknown>("modules/federation/agents:getMyAgentConsent")
const MY_TRANSFER_GRANT = makeFunctionReference<"query", Record<string, never>, TransferGrant | null>("modules/federation/agents:myTransferGrant")
const T0 = Date.UTC(2026, 9, 18, 12)
const ORG_REF = "administration:direction-pa9c-fixture"
const IDN_SUB = "IDN:Agent:Opaque-PA9C"
const KEY_NAME = "ANTSIA_FEDERATION_PA9C_TEST_KEY"
const PATH = "/federation/inbox"
const TEXT_VERSION = CONSENT_TEXT_VERSIONS.administration_reflection
let signingKey: string

beforeAll(async () => {
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  // Charger la route avant les fausses horloges, comme la suite de transport PA5.
  expect((await testConvex().fetch(PATH, { method: "POST" })).status).toBe(401)
}, 120_000)
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  signingKey = `${crypto.randomUUID()}${crypto.randomUUID()}`
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv(KEY_NAME, signingKey)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

function pageEnvelope(revision = 1, verifiedAt: number | null = T0 - 1_000): FederationEnvelope {
  return { eventId: `pa9c-page-${revision}`, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef: ORG_REF, payload: {
    type: "page.upserted", orgRef: ORG_REF, revision, name: "Administration de recette", country: "GA", verifiedAt,
  } }
}

async function fixture(): Promise<Fixture> {
  const t = testConvex({ automaticSessions: false })
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const ids = await t.run(async (ctx) => {
    const administration = await ctx.db.insert("networks", { slug: "administration", name: "Administration de recette", kind: "closed", parentId: root, membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [], theme: "antsia", status: "active", createdAt: T0, updatedAt: T0 })
    const emitterId = await ctx.db.insert("federationEmitters", { networkId: administration, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true, keyEnvName: KEY_NAME, allowedContracts: [RESEAU_PUBLIC_CONTRACT], revision: 1, createdAt: T0, updatedAt: T0 })
    return { administration, emitterId }
  })
  const f = { t, root, ...ids }
  await applyPage(f)
  return f
}

async function applyPage(f: Fixture, event = pageEnvelope()) {
  const result = await f.t.run(async (ctx) => {
    const emitter = await ctx.db.get(f.emitterId)
    if (!emitter) throw new Error("Émetteur de fixture absent")
    return await applyFederationEnvelope(ctx, emitter, event, Date.now())
  })
  expect(result).toEqual({ applied: true })
}

function idOf(value: unknown): string {
  if (value && typeof value === "object" && "_id" in value && typeof value._id === "string") return value._id
  throw new Error("Compte Better Auth de fixture absent")
}

async function member(f: Fixture, idn = true) {
  const userId = idOf(await f.t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Nom civil non publié", email: "pa9c-agent@example.test", emailVerified: true, createdAt: T0, updatedAt: T0 } } }))
  const sessionId = await createTestSession(f.t, userId)
  const as = f.t.withIdentity({ subject: userId, sessionId, applicationOrigin: "antsia" })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  if (idn) {
    await f.t.mutation(components.betterAuth.adapter.create, { input: { model: "account", data: { userId, providerId: "idn", accountId: IDN_SUB, createdAt: T0, updatedAt: T0 } } })
    await f.t.mutation(internal.modules.people.identity.recordIdnProof, { subject: IDN_SUB, loa: 2 })
    await as.mutation(api.modules.people.identity.linkIdn, {})
  }
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "agent.pa9c", displayName: "Jean-Rémy NDONG MBA" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: f.root })
  return { as, personId, userId }
}
type Member = Awaited<ReturnType<typeof member>>

async function grant(person: Member): Promise<TransferGrant> {
  expect(await person.as.mutation(GRANT, { accepted: true, textVersion: TEXT_VERSION })).toBeNull()
  const transfer = await person.as.query(MY_TRANSFER_GRANT, {})
  if (!transfer) throw new Error("Accord transférable de fixture absent")
  expect(transfer.agentRef).toBe(`agent:${await federationBodyDigest(transfer.consentRef)}`)
  expect(transfer.textVersion).toBe(TEXT_VERSION)
  return transfer
}

async function unrelatedGrant(): Promise<TransferGrant> {
  const consentRef = "a".repeat(64)
  return { consentRef, agentRef: `agent:${await federationBodyDigest(consentRef)}`, textVersion: TEXT_VERSION, grantedAt: Date.now() }
}

function personEnvelope(transfer: TransferGrant, revision = 1, type: "person.optin" | "person.optout" = "person.optin", eventId = `pa9c-${type}-${revision}`): FederationEnvelope {
  const common = { type, agentRef: transfer.agentRef, revision, idnSub: IDN_SUB, consentRef: transfer.consentRef }
  return { eventId, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef: transfer.agentRef, payload: type === "person.optout" ? common : {
    ...common, textVersion: transfer.textVersion, consentedAt: transfer.grantedAt,
    displayName: "Nom choisi au socle", orgRef: ORG_REF, roleLabel: "Chargé de mission",
  } }
}

async function post(f: Fixture, event: FederationEnvelope) {
  const rawBody = JSON.stringify(event)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(federationSigningText("sandbox", timestamp, rawBody)))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return await f.t.fetch(PATH, { method: "POST", body: rawBody, headers: {
    "Content-Type": "application/json", "x-antsia-emitter": RESEAU_PUBLIC_EMITTER,
    "x-antsia-environment": "sandbox", "x-antsia-timestamp": timestamp, "x-antsia-signature": signature,
  } })
}

async function state(f: Fixture) {
  return await f.t.run(async (ctx) => ({
    persons: await ctx.db.query("persons").take(20), memberships: await ctx.db.query("networkMemberships").take(20),
    links: await ctx.db.query("identityLinks").take(20), grants: await ctx.db.query("federationAgentGrants").take(20),
    receipts: await ctx.db.query("federationInboxReceipts").take(20), letters: await ctx.db.query("federationDeadLetters").take(20),
    mirrors: await ctx.db.query("mirrors").take(20), audit: await ctx.db.query("engineAudit").take(30),
  }))
}

async function expectApplied(response: Response) {
  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({ outcome: "accepted", status: "applied", applicationStatus: "applied" })
}
async function expectDiscarded(response: Response) {
  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({ outcome: "accepted", status: "discarded", applicationStatus: "rejected" })
}
async function expectNoAgent(person: Member) {
  expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.badges).not.toContain("public_agent")
}

describe("PA9C — consentement local, identité et inbox signée des agents", () => {
  it("un sujet inconnu ne crée ni personne, ni profil, ni lien ni adhésion, sans corps privé en DLQ", async () => {
    const f = await fixture(), before = await state(f), transfer = await unrelatedGrant()
    await expectDiscarded(await post(f, personEnvelope(transfer)))
    const after = await state(f)
    expect(after.persons).toEqual(before.persons)
    expect(after.memberships).toEqual(before.memberships)
    expect(after.links).toEqual(before.links)
    expect(after.grants).toEqual([])
    expect(after.mirrors).toEqual(before.mirrors)
    expect(after.letters).toEqual([])
    expect(after.receipts).toHaveLength(1)
    expect(after.receipts[0]).toMatchObject({ objectRef: transfer.agentRef, status: "discarded" })
    expect(JSON.stringify({ receipts: after.receipts, letters: after.letters, audit: after.audit })).not.toContain(IDN_SUB)
    expect(after.receipts[0]).not.toHaveProperty("rawBody")
  })

  it("le profil social et un nonce étranger ne remplacent pas l'accord local exact", async () => {
    const f = await fixture(), person = await member(f), foreign = await unrelatedGrant()
    await expectDiscarded(await post(f, personEnvelope(foreign, 1, "person.optin", "pa9c-without-local-consent")))
    await expectNoAgent(person)
    const transfer = await grant(person)
    await expectDiscarded(await post(f, personEnvelope(foreign, 2, "person.optin", "pa9c-foreign-nonce")))
    await expectNoAgent(person)
    const before = await state(f)
    await expectApplied(await post(f, personEnvelope(transfer)))
    const after = await state(f)
    expect(after.persons).toEqual(before.persons)
    expect(after.persons.find((row) => row._id === person.personId)).toMatchObject({ handle: "agent.pa9c", displayName: "Jean-Rémy NDONG MBA" })
    expect(after.grants).toHaveLength(1)
    expect(after.grants[0]).toMatchObject({ personId: person.personId, status: "active" })
    expect(after.memberships.filter((row) => row.networkId === f.administration && row.personId === person.personId)).toHaveLength(1)
    expect((await person.as.query(api.modules.people.persons.getMyPerson, {}))?.badges).toContain("public_agent")
  })

  it("une référence d'agent non corrélée au nonce est refusée avant tout nouveau reçu", async () => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    const event = personEnvelope(transfer)
    const agentRef = `agent:${"f".repeat(64)}`
    const payload = { ...(event.payload as Record<string, string | number>), agentRef }
    const before = await state(f)
    expect((await post(f, { ...event, objectRef: agentRef, payload })).status).toBe(400)
    const after = await state(f)
    expect(after.receipts).toEqual(before.receipts)
    expect(after.letters).toEqual([])
    await expectNoAgent(person)
  })

  it("le retrait local bloque toute révision ultérieure et renouvelle la génération à un nouvel accord", async () => {
    const f = await fixture(), person = await member(f), original = await grant(person)
    await expectApplied(await post(f, personEnvelope(original)))
    await person.as.mutation(WITHDRAW, {})
    await expectNoAgent(person)
    await expectDiscarded(await post(f, personEnvelope(original, 100, "person.optin", "pa9c-after-local-withdrawal")))
    const renewed = await grant(person)
    expect(renewed.consentRef).not.toBe(original.consentRef)
    expect(renewed.agentRef).not.toBe(original.agentRef)
    await expectDiscarded(await post(f, personEnvelope(original, 101, "person.optin", "pa9c-old-generation")))
    await expectNoAgent(person)
    await expectApplied(await post(f, personEnvelope(renewed, 1, "person.optin", "pa9c-new-generation")))
  })

  it("l'optout signé est idempotent et conserve l'adhésion ANTSIA indépendante", async () => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    await expectApplied(await post(f, personEnvelope(transfer)))
    const before = await state(f)
    const rootMembership = before.memberships.find((row) => row.networkId === f.root && row.personId === person.personId)
    if (!rootMembership) throw new Error("Adhésion ANTSIA indépendante de fixture absente")
    const event = personEnvelope(transfer, 2, "person.optout")
    await expectApplied(await post(f, event))
    await expectNoAgent(person)
    const after = await state(f)
    expect(after.memberships.find((row) => row._id === rootMembership._id)).toEqual(rootMembership)
    expect(after.memberships.filter((row) => row.networkId === f.administration && row.personId === person.personId).every((row) => row.status === "partie")).toBe(true)
    expect((await post(f, event)).status).toBe(200)
    expect(await state(f)).toEqual(after)
    await expectApplied(await post(f, { ...event, eventId: "pa9c-optout-redelivery" }))
    const redelivered = await state(f)
    expect(redelivered.memberships).toEqual(after.memberships)
    expect(redelivered.links).toEqual(after.links)
    expect(redelivered.grants).toEqual(after.grants)
  })

  it("la révocation du consentement générique ferme aussi le badge et les effets fédérés", async () => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    await expectApplied(await post(f, personEnvelope(transfer)))
    await person.as.mutation(api.modules.people.consents.revokeConsent, { purpose: "administration_reflection", networkId: f.administration })
    await expectNoAgent(person)
    await expectDiscarded(await post(f, personEnvelope(transfer, 2, "person.optin", "pa9c-revoked-purpose")))
  })

  it("une suspension racine n'est jamais réactivée par un accord distant", async () => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    const rootMembership = await f.t.run(async (ctx) => ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", f.root).eq("personId", person.personId)).unique())
    if (!rootMembership) throw new Error("Adhésion racine de fixture absente")
    await f.t.run(async (ctx) => ctx.db.patch(rootMembership._id, { status: "suspendue", statusBeforeSuspension: "verifiee", statusChangedAt: Date.now() }))
    await expectDiscarded(await post(f, personEnvelope(transfer)))
    const after = await state(f)
    expect(after.memberships.find((row) => row._id === rootMembership._id)).toMatchObject({ status: "suspendue", statusBeforeSuspension: "verifiee" })
    expect(after.memberships.some((row) => row.networkId === f.administration && row.personId === person.personId && row.status !== "partie")).toBe(false)
  })

  it.each(["emitter_disabled", "page_withdrawn", "idn_revoked"] as const)("le badge et les nouvelles applications relisent la garde %s", async (variant) => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    await expectApplied(await post(f, personEnvelope(transfer)))
    if (variant === "emitter_disabled") await f.t.run(async (ctx) => ctx.db.patch(f.emitterId, { enabled: false }))
    else if (variant === "page_withdrawn") await applyPage(f, pageEnvelope(2, null))
    else await f.t.run(async (ctx) => {
      const link = await ctx.db.query("identityLinks").withIndex("by_person_and_provider", (q) => q.eq("personId", person.personId).eq("provider", "idn")).unique()
      if (!link) throw new Error("Lien IDN de fixture absent")
      await ctx.db.patch(link._id, { revokedAt: Date.now() })
    })
    await expectNoAgent(person)
    const response = await post(f, personEnvelope(transfer, 2, "person.optin", `pa9c-guard-${variant}`))
    if (variant === "emitter_disabled") expect(response.status).toBe(401)
    else await expectDiscarded(response)
    expect((await state(f)).letters).toEqual([])
  })

  it("l'accord local exige un lien IDN prouvé", async () => {
    const f = await fixture(), person = await member(f, false)
    await expect(person.as.mutation(GRANT, { accepted: true, textVersion: TEXT_VERSION })).rejects.toThrow()
    expect(await person.as.query(MY_TRANSFER_GRANT, {})).toBeNull()
    expect((await state(f)).grants).toEqual([])
  })

  it("un titulaire IDN ne peut accorder un texte de consentement périmé", async () => {
    const f = await fixture(), person = await member(f)
    await expect(person.as.mutation(GRANT, { accepted: true, textVersion: "2026-10-14" })).rejects.toThrow()
    expect(await person.as.query(MY_TRANSFER_GRANT, {})).toBeNull()
    expect((await state(f)).grants).toEqual([])
  })

  it("l'export propre du grant exclut les empreintes, le nonce et les références de transfert", async () => {
    const f = await fixture(), person = await member(f), transfer = await grant(person)
    await expectApplied(await post(f, personEnvelope(transfer)))
    // L'export est un instantané à l'heure de sa demande (une ligne créée après est exclue, PA5) ;
    // l'horloge figée du harnais date les lignes à T0 + fractions : la demande vient ensuite.
    vi.setSystemTime(Date.now() + 1_000)
    const exported = await person.as.mutation(api.modules.people.erasure.exportMyData, {})
    const tableIndex = dataTableNames().indexOf("federationAgentGrants")
    expect(tableIndex).toBeGreaterThanOrEqual(0)
    const page = await person.as.query(api.modules.people.erasure.exportMyDataPage, { exportId: exported.exportId, tableIndex, cursor: null })
    const records: unknown = JSON.parse(page.json)
    expect(records).toEqual([expect.objectContaining({ personId: person.personId, status: "active" })])
    for (const field of ["subjectDigest", "consentRef", "agentRef", "sourceDigest", "identityLinkId", "idnSub"]) expect(page.json).not.toContain(`"${field}"`)
    expect(page.json).not.toContain(IDN_SUB)
    expect(page.json).not.toContain(transfer.consentRef)
    const myConsent = JSON.stringify(await person.as.query(MY_CONSENT, {}))
    for (const field of ["subjectDigest", "consentRef", "agentRef", "idnSub"]) expect(myConsent).not.toContain(`"${field}"`)
    const persisted = await state(f)
    expect(JSON.stringify({ receipts: persisted.receipts, letters: persisted.letters, audit: persisted.audit })).not.toContain(IDN_SUB)
  })
})
