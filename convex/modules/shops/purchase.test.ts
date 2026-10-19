// @vitest-environment edge-runtime
/** P13 : scénarios sources seulement, aucun test ni transport réel exécuté. */
import { commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_ORDER_CONTROL_CONTRACT, COMMERCE_ORDER_RECEIPT_VERSION, commerceOrderControlSigningInput, type CommerceOrderControlRequest, type CommerceOrderView } from "@antsia/social-domain/commerce-orders"
import { makeFunctionReference, type PaginationResult } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { exportableRecord } from "../people/dataInventory"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { base64url, sha256Hex } from "./commerceLinkCrypto"
import { revokePurchaseDataForPerson } from "./purchaseLifecycle"
import { sendPurchaseControl } from "./purchasesClient"
import type { CheckoutIntentLookup } from "./checkoutRules"
import type { Purchase, PurchaseActionResult } from "./purchaseRules"

const NOW = Date.UTC(2026, 9, 18, 12), BUYER = "p13-buyer-fixture", PURCHASE = "purchase-fixture-0001", CHECKOUT_ATTEMPT = "checkout-fixture-0001"
const SHOP = "pro.ga:structure:01JA00000000000000000000S1", OFFER = "pro.ga:offer:01JA00000000000000000000P1", CHECKOUT = "pro.ga:checkout:01JA00000000000000000000H1", PAYMENT = "pro.ga:payment_intent:01JA00000000000000000000Y1", ORDER = "pro.ga:order:01JA00000000000000000000D1"
const KEY = "p13-sandbox-fixture-key-not-a-credential-0123456789", SUBJECT = `antsia:sub:${"a".repeat(64)}`, amount = { amount: 1000, currency: "XAF" as const }
type Net = { networkId: Id<"networks"> }
const get = makeFunctionReference<"query", Net & { purchaseId: string }, Purchase | null>("modules/shops/purchases:get")
const list = makeFunctionReference<"query", Net & { paginationOpts: { cursor: string | null; numItems: number } }, PaginationResult<Purchase>>("modules/shops/purchases:listMy")
const refresh = makeFunctionReference<"action", Net & { purchaseId: string }, PurchaseActionResult>("modules/shops/purchasesActions:refresh")
const cancel = makeFunctionReference<"action", Net & { purchaseId: string; actionId: string; expectedRevision: number; reason: "changed_mind" | "delay" }, PurchaseActionResult>("modules/shops/purchasesActions:cancel")
const retryStored = makeFunctionReference<"action", Net & { purchaseId: string; actionId: string }, PurchaseActionResult>("modules/shops/purchasesActions:retryStored")
const receipt = makeFunctionReference<"action", Net & { purchaseId: string; actionId: string; expectedRevision: number; consentTextVersion: string }, PurchaseActionResult>("modules/shops/purchasesActions:confirmReceipt")
const find = makeFunctionReference<"query", Net & { clientRequestId: string }, CheckoutIntentLookup>("modules/shops/checkout:findByClientRequestId")
const purge = makeFunctionReference<"mutation", Record<string, never>, null>("modules/shops/purchaseLifecycle:purgeExpired")

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  vi.stubEnv("ANTSIA_COMMERCE_ENVIRONMENT", "sandbox"); vi.stubEnv("ANTSIA_COMMERCE_SOURCE", "antsia")
  vi.stubEnv("ANTSIA_COMMERCE_PRO_HTTP_ORIGIN", "http://localhost:4010"); vi.stubEnv("ANTSIA_COMMERCE_PRO_APP_ORIGIN", "http://localhost:4011")
  vi.stubEnv("ANTSIA_COMMERCE_ORIGIN", "http://localhost:3030"); vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "antsia-p13-test-key"); vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", KEY)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
const json = (value: unknown) => { const raw = commerceCanonicalJson(value); if (!raw) throw new Error("Fixture canonique invalide"); return raw }
function view(patch: Partial<CommerceOrderView> = {}): CommerceOrderView {
  return { orderRef: ORDER, checkoutRef: CHECKOUT, paymentRef: PAYMENT, shopRef: SHOP, reference: "COM-RECETTE-0001", sellerLabel: "Vendeur historique", createdAt: NOW, updatedAt: NOW, revision: 3, paymentRevision: 7,
    lines: [{ offerRef: OFFER, variantRef: null, label: "Article", quantity: 1, unitAmount: amount, lineAmount: amount }], fees: [], amount,
    orderState: "confirmed", paymentState: "succeeded", stockState: "consumed", refundState: "none", reviewRequired: false,
    fulfillment: { mode: "pickup", state: "ready", locality: null, leadTimeDays: null }, receipt: null, settlementState: "withheld", cancellationState: "none", returnState: "none",
    history: [{ status: "confirmed", at: NOW }], historyTruncated: false, messages: [{ messageRef: "message-fixture-0001", side: "seller", text: "Votre retrait est prêt.", createdAt: NOW }], messagesTruncated: false,
    capabilities: { canCancel: true, canConfirmReceipt: true, canRequestReturn: false, canMessage: true, canRequestRefund: true }, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION, ...patch }
}

async function fixture() {
  const t = testConvex({ automaticSessions: false }), { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const sessionId = await createTestSession(t, BUYER), as = t.withIdentity({ subject: BUYER, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "p13-buyer", displayName: "Acheteur" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  const config = await readCommerceLinkConfig(); if (!config) throw new Error("Configuration de fixture absente")
  const sessionDigest = await sha256Hex(sessionId)
  const saved = await t.run(async (ctx) => {
    // Vitrine et mapping FERMÉS : aucun accès historique ne dépend de leur publication.
    const shopId = await ctx.db.insert("shops", { networkId: root, ownerPersonId: personId, model: "products", storefront: "draft", visibility: "network", createdAt: NOW, updatedAt: NOW })
    const emitterId = await ctx.db.insert("federationEmitters", { networkId: root, slug: "p13-fixture", environment: "sandbox", enabled: false, keyEnvName: "P13_UNUSED_KEY", allowedContracts: [], revision: 1, createdAt: NOW, updatedAt: NOW })
    const mappingId = await ctx.db.insert("commerceCatalogMappings", { networkId: root, shopId, emitterId, environment: "sandbox", shopRef: SHOP, linkRef: "historic-link-reference", enabled: false, generation: 1, createdAt: NOW, updatedAt: NOW })
    const scope = { networkId: root, personId, shopId, handle: "withdrawn-store", sessionDigest, configFingerprint: config.fingerprint, source: "antsia", environment: "sandbox" as const, shopRef: SHOP, subjectRef: SUBJECT }
    await ctx.db.insert("checkoutAttempts", { ...scope, mappingId, mappingGeneration: 1, parentActivationRevision: 1, linkRef: "historic-link-reference", attemptId: CHECKOUT_ATTEMPT, clientRequestId: "checkout-client-0001", intentDigest: "a".repeat(64), state: "consumed", requestId: "original-checkout-0001", bodySha256: "b".repeat(64), issuedAt: NOW, requestExpiresAt: NOW + 60000, privateUntil: NOW + 1800000, expectedLines: [{ offerRef: OFFER, quantity: 1, expectedCatalogRevision: 1, expectedUnitAmount: amount }], expectedFees: [], expectedPolicyVersion: 1, consentedAt: NOW, consentTextVersion: "fixture-consent", checkoutRef: CHECKOUT, result: { checkoutRef: CHECKOUT, expiresAt: NOW + 900000, fees: [], lines: [{ offerRef: OFFER, quantity: 1, catalogRevision: 1, label: "Article", unitAmount: amount, lineAmount: amount }], state: "held", total: amount }, blocksUntil: 0, createdAt: NOW, updatedAt: NOW })
    const paymentId = await ctx.db.insert("shopPaymentAttempts", { ...scope, checkoutAttemptId: CHECKOUT_ATTEMPT, checkoutRef: CHECKOUT, paymentAttemptId: PURCHASE, clientRequestId: "payment-client-0001", readinessRef: "c".repeat(64), intentionSha256: "d".repeat(64), amount, consentedAt: NOW, consentTextVersion: "fixture-payment-consent", state: "succeeded", requestId: "original-payment-0001", requestSha256: "e".repeat(64), issuedAt: NOW, requestExpiresAt: NOW + 60000, privateUntil: NOW + 1800000, generation: 1, dispatchedAt: NOW, paymentRef: PAYMENT, orderRef: ORDER, paymentState: "succeeded", createdAt: NOW, updatedAt: NOW })
    return { shopId, paymentId }
  })
  return { t, as, root, personId, sessionId, config, ...saved, args: { networkId: root, purchaseId: PURCHASE } }
}
function peer() {
  const sent: { request: CommerceOrderControlRequest; raw: string; headers: Headers }[] = [], accepted = new Set<string>()
  let snapshot = view(), timeout = false, before: (() => Promise<void>) | null = null
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    const raw = String(init?.body), request = JSON.parse(raw) as CommerceOrderControlRequest
    sent.push({ request, raw, headers: new Headers(init?.headers) })
    if (before) await before()
    let action: { actionId: string; state: "accepted" | "not_found" } | null = null
    if (request.operation === "action_status") action = { actionId: request.payload.actionId, state: accepted.has(request.payload.actionId) ? "accepted" : "not_found" }
    else if (request.operation !== "read") {
      const first = !accepted.has(request.payload.actionId); accepted.add(request.payload.actionId)
      if (first) snapshot = view({ ...snapshot, revision: snapshot.revision + 1, ...(request.operation === "cancel_request" ? { cancellationState: "requested" } : request.operation === "receipt_confirm" ? { receipt: { confirmationRef: "receipt-fixture-0001", confirmedAt: Date.now() }, fulfillment: { mode: "pickup", state: "received", locality: null, leadTimeDays: null }, capabilities: { ...snapshot.capabilities, canConfirmReceipt: false } } : {}) })
      action = { actionId: request.payload.actionId, state: "accepted" }
      if (timeout) throw new Error("Réponse perdue après effet fictif")
    }
    return new Response(json({ contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, requestId: request.requestId, requestSha256: await sha256Hex(raw), outcome: "accepted", result: { order: snapshot, action } }), { status: 200 })
  })
  vi.stubGlobal("fetch", fetcher)
  return { sent, fetcher, accepted, setTimeout: (value: boolean) => { timeout = value }, setView: (value: CommerceOrderView) => { snapshot = value }, before: (callback: () => Promise<void>) => { before = callback } }
}

describe("P13 — achats privés historiques", () => {
  it("sert un placeholder sans HTTP puis la même commande après retrait de boutique", async () => {
    const f = await fixture(), p = peer()
    expect(await f.as.query(get, f.args)).toMatchObject({ order: null, stale: true, orderRef: ORDER })
    expect((await f.as.query(list, { networkId: f.root, paginationOpts: { cursor: null, numItems: 12 } })).page).toHaveLength(1)
    expect(p.sent).toHaveLength(0)
    expect(await f.as.action(refresh, f.args)).toMatchObject({ outcome: "purchase" })
    expect(await f.as.query(get, f.args)).toMatchObject({ stale: false, order: { orderState: "confirmed", paymentState: "succeeded", settlementState: "withheld" } })
  })
  it("recharge une intention existante par clé sans préparer de nouveau checkout", async () => {
    const f = await fixture(), p = peer()
    expect(await f.as.query(find, { networkId: f.root, clientRequestId: "checkout-client-0001" })).toMatchObject({ outcome: "attempt", attempt: { attemptId: CHECKOUT_ATTEMPT } })
    expect(await f.as.query(find, { networkId: f.root, clientRequestId: "client-absent-0001" })).toEqual({ outcome: "absent" })
    expect(p.sent).toHaveLength(0)
  })
  it("après timeout consulte la décision stable et ne répète aucun effet accepté", async () => {
    const f = await fixture(), p = peer(); await f.as.action(refresh, f.args); p.setTimeout(true)
    const intent = { ...f.args, actionId: "cancel-action-0001", expectedRevision: 3, reason: "changed_mind" as const }
    expect(await f.as.action(cancel, intent)).toMatchObject({ action: { state: "unknown" } })
    p.setTimeout(false); vi.setSystemTime(NOW + 61000)
    expect(await f.as.action(retryStored, { ...f.args, actionId: intent.actionId })).toMatchObject({ action: { state: "accepted" } })
    expect(p.sent.filter((s) => s.request.operation === "cancel_request")).toHaveLength(1)
    expect(p.sent.at(-1)?.request.operation).toBe("action_status")
    expect(await f.as.action(cancel, { ...intent, reason: "delay" })).toEqual({ outcome: "refused" })
  })
  it("not_found permet une enveloppe fraîche avec la même action et le même contenu", async () => {
    const f = await fixture(), p = peer(); await f.as.action(refresh, f.args); p.setTimeout(true)
    const intent = { ...f.args, actionId: "cancel-notfound-0001", expectedRevision: 3, reason: "changed_mind" as const }
    await f.as.action(cancel, intent)
    // Cette branche simule l'autre cause de timeout : aucun effet n'a finalement été admis.
    p.accepted.clear(); p.setView(view()); p.setTimeout(false); vi.setSystemTime(NOW + 61000)
    expect(await f.as.action(retryStored, { ...f.args, actionId: intent.actionId })).toMatchObject({ action: { state: "accepted" } })
    const requests = p.sent.filter((s) => s.request.operation === "cancel_request")
    expect(requests).toHaveLength(2)
    expect(requests[0]!.request.payload).toEqual(requests[1]!.request.payload)
    expect(requests[0]!.request.requestId).not.toBe(requests[1]!.request.requestId)
    expect(p.sent.at(-2)?.request.operation).toBe("action_status")
  })
  it("confirmation de réception explicite ne simule aucun reversement", async () => {
    const f = await fixture(), p = peer(); await f.as.action(refresh, f.args)
    expect(await f.as.action(receipt, { ...f.args, actionId: "receipt-action-0001", expectedRevision: 3, consentTextVersion: "old-version" })).toEqual({ outcome: "refused" })
    expect(await f.as.action(receipt, { ...f.args, actionId: "receipt-action-0001", expectedRevision: 3, consentTextVersion: COMMERCE_ORDER_RECEIPT_VERSION })).toMatchObject({ action: { state: "accepted" } })
    expect(await f.as.query(get, f.args)).toMatchObject({ order: { receipt: { confirmationRef: "receipt-fixture-0001" }, settlementState: "withheld" } })
    expect(p.sent.every((s) => s.request.operation === "read" || s.request.operation === "receipt_confirm")).toBe(true)
  })
  it("une réponse tardive après demande d'effacement n'alimente pas le cache", async () => {
    const f = await fixture(), p = peer()
    p.before(async () => { await f.t.run(async (ctx) => ctx.db.patch(f.personId, { deletionRequestedAt: NOW })) })
    await expect(f.as.action(refresh, f.args)).resolves.toEqual({ outcome: "refused" })
    expect(await f.as.query(get, f.args)).toBeNull()
    expect(await f.t.run(async (ctx) => ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", f.personId).eq("networkId", f.root).eq("purchaseId", PURCHASE)).unique())).toBeNull()
  })
  it("la session révoquée pendant le HTTP interdit l'adoption de sa réponse", async () => {
    const f = await fixture(), p = peer()
    p.before(async () => { await f.t.mutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: f.sessionId }] } }) })
    await expect(f.as.action(refresh, f.args)).rejects.toMatchObject({ data: { code: "unauthenticated" } })
    expect(await f.t.run(async (ctx) => ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", f.personId).eq("networkId", f.root).eq("purchaseId", PURCHASE)).unique())).toBeNull()
  })
  it("un autre acheteur ne lit ni ne rafraîchit cet achat", async () => {
    const f = await fixture(), p = peer(), otherId = await createTestSession(f.t, "p13-other-buyer"), other = f.t.withIdentity({ subject: "p13-other-buyer", sessionId: otherId })
    await other.mutation(api.modules.people.persons.ensureMyPerson, {})
    await other.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
    await other.mutation(api.modules.people.profile.publishMyProfile, { handle: "p13-other", displayName: "Autre" })
    await other.mutation(api.modules.people.memberships.joinNetwork, { networkId: f.root })
    expect(await other.query(get, f.args)).toBeNull()
    expect(await other.action(refresh, f.args)).toEqual({ outcome: "refused" }); expect(p.sent).toHaveLength(0)
  })
  it("refuse une autre référence de paiement et empêche la régression de l'état", async () => {
    const f = await fixture(), p = peer(); await f.as.action(refresh, f.args)
    p.setView(view({ revision: 2, paymentRevision: 6, orderState: "pending", paymentState: "pending" }))
    await f.as.action(refresh, f.args)
    expect(await f.as.query(get, f.args)).toMatchObject({ order: { revision: 3, paymentRevision: 7, paymentState: "succeeded" } })
    p.setView(view({ paymentRef: "pro.ga:payment_intent:01JA00000000000000000000Z1" }))
    expect(await f.as.action(refresh, f.args)).toEqual({ outcome: "refused" })
  })
  it("masque les messages à l'échéance même avant cron et les exclut de l'export", async () => {
    const f = await fixture(); peer(); await f.as.action(refresh, f.args)
    const cached = await f.t.run(async (ctx) => ctx.db.query("shopPurchaseSnapshots").withIndex("by_purchase", (q) => q.eq("personId", f.personId).eq("networkId", f.root).eq("purchaseId", PURCHASE)).unique())
    const exported = exportableRecord("shopPurchaseSnapshots", cached!, f.personId)
    expect(JSON.stringify(exported)).not.toContain("Votre retrait"); expect(exported).not.toHaveProperty("subjectRef")
    vi.setSystemTime(NOW + 1800001)
    expect(await f.as.query(get, f.args)).toMatchObject({ order: { messages: [], messagesTruncated: true } })
    expect(await f.as.action(retryStored, { ...f.args, actionId: "unknown-action-0001" })).toEqual({ outcome: "unavailable" })
    await f.t.mutation(purge, {})
    expect(await f.t.run(async (ctx) => revokePurchaseDataForPerson(ctx, f.personId))).toBe(true)
    expect(await f.as.query(get, f.args)).toMatchObject({ order: null })
  })
})

describe("P13 — transport privé simulé", () => {
  it("signe les octets exacts sur le profil orders et refuse les redirections/corrélations étrangères", async () => {
    const f = await fixture(), now = Date.now()
    const request: CommerceOrderControlRequest = { contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, source: "antsia", environment: "sandbox", requestId: "transport-read-0001", shopRef: SHOP, subject: { kind: "buyer", ref: SUBJECT, authVerifiedAt: now }, issuedAt: now, expiresAt: now + 60000, operation: "read", payload: { orderRef: ORDER } }
    const raw = json(request), fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toBe("http://localhost:4010/commerce/v1/orders/read"); expect(init).toMatchObject({ body: raw, redirect: "error", credentials: "omit" })
      const h = new Headers(init?.headers), input = commerceOrderControlSigningInput({ bodySha256: await sha256Hex(raw), environment: "sandbox", source: "antsia", issuedAtMs: Number(h.get("X-Pro-Timestamp")), keyId: f.config.keyId, nonce: h.get("X-Pro-Nonce")!, operation: "read" })!
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      expect(h.get("X-Pro-Signature")).toBe(base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)))))
      expect(h.get("Cookie")).toBeNull()
      return new Response(json({ contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, requestId: request.requestId, requestSha256: await sha256Hex(raw), outcome: "accepted", result: { order: view(), action: null } }))
    }
    expect(await sendPurchaseControl(f.config, raw, fetcher)).toMatchObject({ outcome: "accepted" })
    expect(await sendPurchaseControl(f.config, raw, async () => new Response(null, { status: 302, headers: { Location: "https://foreign.invalid" } }))).toBeNull()
    expect(await sendPurchaseControl(f.config, raw, async () => new Response(json({ contract: COMMERCE_ORDER_CONTROL_CONTRACT, version: 1, requestId: "another-request-0001", requestSha256: await sha256Hex(raw), outcome: "accepted", result: { order: view(), action: null } })))).toBeNull()
  })
})
