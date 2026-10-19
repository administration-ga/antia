// @vitest-environment edge-runtime
/** P08 : tests écrits, non exécutés pendant cette reprise. */
import { type CommerceCommandRequest, commerceCommandSigningInput } from "@antsia/social-domain/commerce/command"
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_LINK_CONSENT_VERSION, COMMERCE_LINK_CONTRACT, type CommerceLinkPreparation } from "@antsia/social-domain/commerce-link"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { base64url, readCommerceLinkResponse, sha256Hex } from "./commerceLinkCrypto"
import { liveShopCommerceLink, revokeCommerceForPerson } from "./commerceLinkLifecycle"
import type { BeginLinkResult, CompleteLinkResult } from "./commerceLinks"

type T = ReturnType<typeof testConvex>
type ShopArgs = { networkId: Id<"networks">; shopId: Id<"shops"> }
const begin = makeFunctionReference<"action", ShopArgs & { requestedPermissions: ["publish_catalog"]; consentTextVersion: string }, BeginLinkResult>("modules/shops/commerceLinkActions:beginLink")
const complete = makeFunctionReference<"action", { networkId: Id<"networks">; state: string; code: string }, CompleteLinkResult>("modules/shops/commerceLinkActions:completeLink")
const revoke = makeFunctionReference<"mutation", ShopArgs, null>("modules/shops/commerceLinks:revokeLink")
const status = makeFunctionReference<"query", ShopArgs, { available: boolean; reason: string | null; link: { state: string; permissions: string[] } | null; pending: { expiresAt: number } | null; consentTextVersion: string }>("modules/shops/commerceLinks:linkStatus")
const expire = makeFunctionReference<"mutation", { networkId: Id<"networks">; challengeId: Id<"shopCommerceLinkChallenges">; stateDigest: string }, null>("modules/shops/commerceLinks:expireLinkChallenge")
const KEY = "sandbox-commerce-key-for-tests-only-0123456789"
const CODE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG"
const PRO_HTTP = "http://localhost:4010"
const PRO_APP = "http://localhost:4011"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 9, 18, 12))
  vi.stubEnv("ANTSIA_COMMERCE_ENVIRONMENT", "sandbox")
  vi.stubEnv("ANTSIA_COMMERCE_SOURCE", "antsia")
  vi.stubEnv("ANTSIA_COMMERCE_PRO_HTTP_ORIGIN", PRO_HTTP)
  vi.stubEnv("ANTSIA_COMMERCE_PRO_APP_ORIGIN", PRO_APP)
  vi.stubEnv("ANTSIA_COMMERCE_ORIGIN", "http://localhost:3030")
  vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "antsia-sandbox-key")
  vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", KEY)
  vi.stubEnv("ANTSIA_COMMERCE_PRODUCTION_ENABLED", undefined)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function fixture() {
  const t = testConvex()
  const { root, testClosed: child } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const subject = "commerce-link-member"
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "commerce-member", displayName: "Commerce" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  const owned = await t.run(async (ctx) => {
    const now = Date.now()
    const pageId = await ctx.db.insert("pages", { networkId: root, handle: "commerce-activity", name: "Activité", ownerKind: "company", trust: "community", trustRank: 1, visibility: "network", onRoot: true, status: "active", createdByPersonId: personId, searchText: "activite", createdAt: now, updatedAt: now })
    const signatoryId = await ctx.db.insert("pageSignatories", { networkId: root, pageId, personId, role: "admin", acceptedAt: now, createdAt: now, updatedAt: now })
    const shopId = await ctx.db.insert("shops", { networkId: root, pageId, preparedByPersonId: personId, model: "products", storefront: "draft", visibility: "network", createdAt: now, updatedAt: now })
    return { pageId, signatoryId, shopId }
  })
  return { t, as, subject, root, child, personId, ...owned, args: { networkId: root, shopId: owned.shopId } }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

type Sent = { url: string; rawBody: string; headers: Headers; init: RequestInit }
function transport() {
  const sent: Sent[] = []
  let preparation: CommerceLinkPreparation | undefined
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const rawBody = String(init?.body)
    sent.push({ url, rawBody, headers: new Headers(init?.headers), init: init ?? {} })
    if (url.endsWith("/commerce/v1/link-challenges")) {
      preparation = JSON.parse(rawBody) as CommerceLinkPreparation
      return new Response(commerceCanonicalJson({ contract: COMMERCE_LINK_CONTRACT, version: 1, requestId: preparation.requestId, state: preparation.state, authorizationUrl: `${PRO_APP}/commerce/autoriser?defi=${encodeURIComponent(preparation.requestId)}`, expiresAt: preparation.expiresAt }), { status: 200 })
    }
    return accepted(rawBody)
  })
  vi.stubGlobal("fetch", fetcher)
  return { sent, fetcher, get preparation() { if (!preparation) throw new Error("Préparation de fixture absente"); return preparation } }
}

async function accepted(rawBody: string, correlation = true): Promise<Response> {
  const request = JSON.parse(rawBody) as Extract<CommerceCommandRequest, { command: "link.confirm" }>
  return new Response(commerceCanonicalJson({
    command: "link.confirm", contract: request.contract, version: 1, outcome: "accepted",
    requestId: correlation ? request.requestId : "wrong-request-id", requestSha256: await sha256Hex(rawBody), respondedAt: Date.now(),
    result: { state: "active", grantedPermissions: request.payload.requestedPermissions, linkRef: "pro.ga:commerce_link:0123456789ABCDEFGHJKMNPQRST", shopRef: "pro.ga:structure:1123456789ABCDEFGHJKMNPQRST", linkedAt: Date.now() },
  }), { status: 200 })
}

async function start(f: Fixture) {
  return await f.as.action(begin, { ...f.args, requestedPermissions: ["publish_catalog"], consentTextVersion: COMMERCE_LINK_CONSENT_VERSION })
}
async function rows(f: Fixture) {
  return await f.t.run(async (ctx) => ({
    link: await ctx.db.query("shopCommerceLinks").withIndex("by_network_shop", (q) => q.eq("networkId", f.root).eq("shopId", f.shopId)).unique(),
    challenge: await ctx.db.query("shopCommerceLinkChallenges").withIndex("by_network_shop", (q) => q.eq("networkId", f.root).eq("shopId", f.shopId)).unique(),
  }))
}

describe("P08 — double preuve ANTSIA", () => {
  it("sépare les origines HTTP/autorisation, signe le corps et ne publie aucune vitrine", async () => {
    const f = await fixture(), peer = transport()
    expect(await start(f)).toEqual({ outcome: "ready", authorizationUrl: `${PRO_APP}/commerce/autoriser?defi=${peer.preparation.requestId}`, expiresAt: peer.preparation.expiresAt })
    expect(peer.sent[0]!.url).toBe(`${PRO_HTTP}/commerce/v1/link-challenges`)
    expect(peer.sent[0]!.init.redirect).toBe("error")
    expect(peer.preparation.redirectUri).toBe("http://localhost:3030/mes-boutiques/liaison/retour")
    expect(peer.preparation).not.toHaveProperty("sessionId")
    expect(peer.preparation.subjectRef).toMatch(/^antsia:sub:[a-f0-9]{32}$/)
    expect(peer.preparation.antsiaShopRef).toMatch(/^antsia:shop:[a-f0-9]{32}$/)
    const first = peer.sent[0]!, headers = first.headers
    const input = commerceCommandSigningInput({ bodySha256: await sha256Hex(first.rawBody), issuedAtMs: Number(headers.get("X-Pro-Timestamp")), nonce: headers.get("X-Pro-Nonce")!, keyId: headers.get("X-Pro-Key-Id")!, source: "antsia", environment: "sandbox", operation: "link.confirm" })!
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    expect(headers.get("X-Pro-Signature")).toBe(base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)))))
    expect(await f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).toEqual({ outcome: "linked", shopId: f.shopId })
    const saved = await rows(f)
    expect(saved.link).toMatchObject({ state: "active", personId: f.personId, consentTextVersion: COMMERCE_LINK_CONSENT_VERSION, permissions: ["publish_catalog"] })
    expect(saved.challenge).toMatchObject({ status: "completed" })
    expect(saved.challenge?.codeVerifier).toBeUndefined()
    expect(saved.challenge?.preparationBody).toBeUndefined()
    expect(await f.t.run(async (ctx) => (await ctx.db.get(f.shopId))?.storefront)).toBe("draft")
  })

  it("configuration absente ou production non activée : indisponible, aucun HTTP", async () => {
    const f = await fixture(), peer = transport()
    vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", undefined)
    expect(await start(f)).toEqual({ outcome: "unavailable" })
    expect(await f.as.query(status, f.args)).toMatchObject({ available: false, reason: "configuration_missing" })
    vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", KEY)
    vi.stubEnv("ANTSIA_COMMERCE_ENVIRONMENT", "production")
    expect(await start(f)).toEqual({ outcome: "unavailable" })
    expect(peer.fetcher).not.toHaveBeenCalled()
  })

  it("brouillon sans page et consentement périmé ne créent aucun défi", async () => {
    const f = await fixture(), peer = transport()
    expect(await f.as.action(begin, { ...f.args, requestedPermissions: ["publish_catalog"], consentTextVersion: "old" })).toEqual({ outcome: "unavailable" })
    await f.t.run(async (ctx) => ctx.db.patch(f.shopId, { pageId: undefined, ownerPersonId: f.personId }))
    expect(await f.as.query(status, f.args)).toMatchObject({ reason: "page_required" })
    expect(await start(f)).toEqual({ outcome: "unavailable" })
    expect(peer.fetcher).not.toHaveBeenCalled()
    expect((await rows(f)).challenge).toBeNull()
  })

  it("la même personne avec une autre session ne consomme pas le défi", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    const sessionId = await createTestSession(f.t, f.subject)
    const otherSession = f.t.withIdentity({ subject: f.subject, sessionId })
    expect(await otherSession.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).toEqual({ outcome: "refused" })
    expect(peer.sent).toHaveLength(1)
    expect((await rows(f)).link).toBeNull()
  })

  it("un autre réseau ou un état/URL mal formé ne consomme rien", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    for (const state of ["https://evil.invalid", `${peer.preparation.state}\n`, "/retour?code=x"]) {
      expect(await f.as.action(complete, { networkId: f.root, state, code: CODE })).toEqual({ outcome: "refused" })
    }
    await expect(f.as.action(complete, { networkId: f.child, state: peer.preparation.state, code: CODE })).rejects.toBeDefined()
    expect(peer.sent).toHaveLength(1)
  })

  it("une panne après création distante reprend strictement requestId/corps avec une nouvelle signature", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    peer.fetcher.mockImplementationOnce(async (input, init) => {
      peer.sent.push({ url: String(input), rawBody: String(init?.body), headers: new Headers(init?.headers), init: init ?? {} })
      throw new Error("Simulated lost response")
    })
    const args = { networkId: f.root, state: peer.preparation.state, code: CODE }
    expect(await f.as.action(complete, args)).toEqual({ outcome: "unavailable" })
    const challengeId = (await rows(f)).challenge!._id
    const persisted = await f.t.run(async (ctx) => ctx.db.query("shopCommerceLinkCommands").withIndex("by_challenge", (q) => q.eq("challengeId", challengeId)).unique())
    expect(persisted?.rawBody).toBe(peer.sent[1]!.rawBody)
    vi.setSystemTime(Date.now() + 1000)
    expect(await f.as.action(complete, args)).toEqual({ outcome: "linked", shopId: f.shopId })
    expect(peer.sent[2]!.rawBody).toBe(peer.sent[1]!.rawBody)
    expect(peer.sent[2]!.headers.get("X-Pro-Nonce")).not.toBe(peer.sent[1]!.headers.get("X-Pro-Nonce"))
    expect(peer.sent[2]!.headers.get("X-Pro-Timestamp")).not.toBe(peer.sent[1]!.headers.get("X-Pro-Timestamp"))
    expect(await f.as.action(complete, args)).toEqual({ outcome: "linked", shopId: f.shopId })
    expect(peer.sent).toHaveLength(3)
  })

  it("annuler un défi sans lien ferme aussi une réponse de confirmation tardive", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    let arrived!: () => void, release!: () => void
    const entered = new Promise<void>((resolve) => { arrived = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    peer.fetcher.mockImplementationOnce(async (_input, init) => { arrived(); await gate; return accepted(String(init?.body)) })
    const completing = f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })
    await entered
    await f.as.mutation(revoke, f.args)
    await f.as.mutation(revoke, f.args)
    release()
    expect(await completing).toEqual({ outcome: "refused" })
    const saved = await rows(f)
    expect(saved.link).toBeNull()
    expect(saved.challenge).toMatchObject({ status: "revoked" })
    expect(saved.challenge?.codeVerifier).toBeUndefined()
  })

  it("révoquer le rôle pendant l'HTTP interdit la validation finale", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    let arrived!: () => void, release!: () => void
    const entered = new Promise<void>((resolve) => { arrived = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    peer.fetcher.mockImplementationOnce(async (_input, init) => { arrived(); await gate; return accepted(String(init?.body)) })
    const completing = f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })
    await entered
    await f.t.run(async (ctx) => ctx.db.delete(f.signatoryId))
    release()
    expect(await completing).toEqual({ outcome: "refused" })
    expect((await rows(f)).link).toBeNull()
  })

  it("une session supprimée avant confirmation refuse avant l'HTTP", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    const identity = await f.as.run(async (ctx) => ctx.auth.getUserIdentity())
    await f.t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: String(identity!.sessionId) }] } })
    await expect(f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).rejects.toBeDefined()
    expect(peer.sent).toHaveLength(1)
  })

  it("une session supprimée pendant l'HTTP n'applique pas le reçu distant", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    let arrived!: () => void, release!: () => void
    const entered = new Promise<void>((resolve) => { arrived = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    peer.fetcher.mockImplementationOnce(async (_input, init) => { arrived(); await gate; return accepted(String(init?.body)) })
    const completing = f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })
    await entered
    const identity = await f.as.run(async (ctx) => ctx.auth.getUserIdentity())
    await f.t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: String(identity!.sessionId) }] } })
    release()
    await expect(completing).rejects.toBeDefined()
    expect((await rows(f)).link).toBeNull()
  })

  it("un second clic pendant la confirmation ne lance pas un second HTTP", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    let arrived!: () => void, release!: () => void
    const entered = new Promise<void>((resolve) => { arrived = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    peer.fetcher.mockImplementationOnce(async (_input, init) => { arrived(); await gate; return accepted(String(init?.body)) })
    const args = { networkId: f.root, state: peer.preparation.state, code: CODE }
    const first = f.as.action(complete, args)
    await entered
    expect(await f.as.action(complete, args)).toEqual({ outcome: "unavailable" })
    expect(peer.fetcher).toHaveBeenCalledTimes(2)
    release()
    expect(await first).toEqual({ outcome: "linked", shopId: f.shopId })
  })

  it("une nouvelle incarnation conserve les références opaques stables", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    const original = peer.preparation
    await f.as.mutation(revoke, f.args)
    await start(f)
    expect(peer.preparation.state).not.toBe(original.state)
    expect(peer.preparation.subjectRef).toBe(original.subjectRef)
    expect(peer.preparation.antsiaShopRef).toBe(original.antsiaShopRef)
    expect(await f.as.action(complete, { networkId: f.root, state: original.state, code: CODE })).toEqual({ outcome: "refused" })
  })

  it("mauvaise corrélation du reçu ou URL d'autorisation étrangère : aucun lien", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    peer.fetcher.mockImplementationOnce(async (_input, init) => accepted(String(init?.body), false))
    expect(await f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).toEqual({ outcome: "unavailable" })
    expect((await rows(f)).link).toBeNull()
    await f.as.mutation(revoke, f.args)
    peer.fetcher.mockImplementationOnce(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as CommerceLinkPreparation
      return new Response(commerceCanonicalJson({ contract: request.contract, version: 1, requestId: request.requestId, state: request.state, expiresAt: request.expiresAt, authorizationUrl: `https://evil.invalid/commerce/autoriser?defi=${request.requestId}` }), { status: 200 })
    })
    expect(await start(f)).toEqual({ outcome: "unavailable" })
  })

  it("expiration et remplacement d'incarnation empêchent une reprise ancienne", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    const first = (await rows(f)).challenge!
    const oldState = peer.preparation.state
    vi.setSystemTime(first.expiresAt)
    await f.t.mutation(expire, { networkId: f.root, challengeId: first._id, stateDigest: first.stateDigest })
    expect((await rows(f)).challenge?.codeVerifier).toBeUndefined()
    expect(await f.as.action(complete, { networkId: f.root, state: oldState, code: CODE })).toEqual({ outcome: "refused" })
    await start(f)
    expect(peer.preparation.state).not.toBe(oldState)
    await f.t.mutation(expire, { networkId: f.root, challengeId: first._id, stateDigest: first.stateDigest })
    expect((await rows(f)).challenge?.status).toBe("pending")
    expect(await f.as.action(complete, { networkId: f.root, state: oldState, code: CODE })).toEqual({ outcome: "refused" })
  })

  it("rotation de configuration et demande d'effacement ferment immédiatement la preuve", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "antsia-rotated-key")
    expect(await f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).toEqual({ outcome: "refused" })
    vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "antsia-sandbox-key")
    await f.t.run(async (ctx) => ctx.db.patch(f.personId, { deletionRequestedAt: Date.now() }))
    expect(await f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })).toEqual({ outcome: "refused" })
    expect(await f.t.run(async (ctx) => revokeCommerceForPerson(ctx, f.personId))).toBe(true)
    expect((await rows(f)).challenge?.status).toBe("revoked")
    expect(peer.sent).toHaveLength(1)
  })

  it("lien actif révoqué localement et mandat perdu ne sont plus utilisables", async () => {
    const f = await fixture(), peer = transport()
    await start(f)
    await f.as.action(complete, { networkId: f.root, state: peer.preparation.state, code: CODE })
    expect(await f.t.run(async (ctx) => liveShopCommerceLink(ctx, f.root, f.shopId))).not.toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(f.signatoryId, { role: "signatory" }))
    expect(await f.t.run(async (ctx) => liveShopCommerceLink(ctx, f.root, f.shopId))).toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(f.signatoryId, { role: "admin" }))
    await f.as.mutation(revoke, f.args)
    expect(await f.as.query(status, f.args)).toMatchObject({ link: { state: "revoked" }, pending: null })
    expect(await f.t.run(async (ctx) => liveShopCommerceLink(ctx, f.root, f.shopId))).toBeNull()
  })
})

describe("P08 — lecture de transport bornée", () => {
  it("refuse réellement un corps trop grand sans dépendre du Content-Length", async () => {
    expect(await readCommerceLinkResponse(new Response("a".repeat(8193)), 8192)).toBeNull()
    const invalidUtf8 = new Uint8Array([0xc3, 0x28])
    expect(await readCommerceLinkResponse(new Response(invalidUtf8), 8192)).toBeNull()
  })
})
