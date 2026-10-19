// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest"
import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { directlyOwned, exportableRecord } from "./dataInventory"
import { revokePaymentDataForPerson } from "./erasure"

const privateMarker = "private-proof-not-exported"
const metadata = { _id: "row", _creationTime: 1, networkId: "network", personId: "person", createdAt: 1, updatedAt: 1 }
const amount = { amount: 1500, currency: "XAF" as const }
const action = { kind: "provider_redirect" as const, url: "https://provider.example/private-action" }
const snapshot = { checkoutRef: "checkout-ref", paymentRef: "payment-ref", orderRef: "order-ref", paymentState: "requires_action" as const, orderState: "pending" as const, stockState: "held" as const, refundState: "none" as const, reviewRequired: false, revision: 2, updatedAt: 1, amount, action }

describe("P12 — export personnel du paiement", () => {
  it("exporte seulement les faits personnels, sans action, bail, readiness ni contexte serveur", () => {
    const row = { ...metadata, paymentAttemptId: "payment-attempt", checkoutAttemptId: "checkout-attempt", checkoutRef: "checkout-ref", state: "requires_action", amount, consentedAt: 1, consentTextVersion: "2026-10-18-p12-v1", snapshot,
      rawBody: privateMarker, readinessRef: privateMarker, startAction: action, leaseToken: privateMarker, leaseUntil: 2, sessionDigest: privateMarker, subjectRef: privateMarker, configFingerprint: privateMarker, requestSha256: privateMarker }
    const exported = exportableRecord("shopPaymentAttempts", row, "person")
    expect(exported).toMatchObject({ paymentAttemptId: "payment-attempt", state: "requires_action", amount, snapshot: { paymentState: "requires_action", refundState: "none", revision: 2 } })
    expect(JSON.stringify(exported)).not.toContain(privateMarker)
    expect(JSON.stringify(exported)).not.toContain("private-action")
    expect(exported).not.toHaveProperty("startAction")
    expect(exported).not.toHaveProperty("snapshot.action")
    expect(exportableRecord("shopPaymentAttempts", row, "other")).toBeNull()
    expect(directlyOwned("shopPaymentAttempts", row, "person")).toBe(true)
    expect(directlyOwned("shopPaymentAttempts", row, "other")).toBe(false)
  })
  it("exclut politiques/requêtes et n'exporte pas le reçu de préparation des options", () => {
    const row = { ...metadata, checkoutAttemptId: "checkout-attempt", checkoutRef: "checkout-ref", sessionDigest: privateMarker, options: { available: true, amount, providerLabel: "Provider", beneficiaryLabel: "Atelier", modes: ["mobile_money"], consentTextVersion: "2026-10-18-p12-v1", readinessRef: privateMarker, readinessExpiresAt: 2, action } }
    const exported = exportableRecord("shopPaymentOptions", row, "person")
    expect(exported).toMatchObject({ options: { available: true, amount, beneficiaryLabel: "Atelier" } })
    expect(JSON.stringify(exported)).not.toContain(privateMarker)
    expect(exported).not.toHaveProperty("options.action")
    expect(exportableRecord("shopPaymentOptions", row, "other")).toBeNull()
    expect(exportableRecord("shopPaymentRequests", row, "person")).toBeNull()
    expect(exportableRecord("shopPaymentPolicies", { ...metadata, updatedByPersonId: "person" }, "person")).toBeNull()
    expect(directlyOwned("shopPaymentPolicies", { ...metadata, updatedByPersonId: "person" }, "person")).toBe(false)
  })
})

async function fixture() {
  const t = testConvex(), now = Date.now()
  const data = await t.run(async (ctx) => {
    const personId = await ctx.db.insert("persons", { authUserId: "payment-erasure-person", handle: "payment.erasure", createdAt: now, updatedAt: now })
    const otherId = await ctx.db.insert("persons", { authUserId: "payment-erasure-other", handle: "payment.other", createdAt: now, updatedAt: now })
    const networkId = await ctx.db.insert("networks", { slug: "payment-erasure", name: "Payment", kind: "root", status: "active", membershipPolicy: "open", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: now, updatedAt: now })
    const shopId = await ctx.db.insert("shops", { networkId, ownerPersonId: personId, model: "products", storefront: "draft", visibility: "network", createdAt: now, updatedAt: now })
    const scope = { networkId, shopId, checkoutAttemptId: "checkout-attempt-0001", checkoutRef: "checkout-ref", handle: "atelier", sessionDigest: privateMarker, configFingerprint: privateMarker, source: "antsia", environment: "sandbox" as const, shopRef: "shop-ref", subjectRef: privateMarker }
    const attempts: Id<"shopPaymentAttempts">[] = []
    for (const [owner, count] of [[personId, 25], [otherId, 1]] as const) for (let index = 0; index < count; index++) {
      const tag = `${owner}-${index}`
      attempts.push(await ctx.db.insert("shopPaymentAttempts", { ...scope, personId: owner, paymentAttemptId: `payment-${tag}`, clientRequestId: `client-${tag}`, readinessRef: privateMarker, intentionSha256: "a".repeat(64), amount, consentedAt: now, consentTextVersion: "2026-10-18-p12-v1", state: "requires_action", requestId: `request-${tag}`, requestSha256: "b".repeat(64), rawBody: privateMarker, issuedAt: now, requestExpiresAt: now + 60_000, privateUntil: now + 1_800_000, leaseToken: privateMarker, leaseUntil: now + 30_000, generation: 7, authorizationExpiresAt: now + 60_000, paymentRef: "payment-ref", orderRef: "order-ref", paymentState: "requires_action", startAction: action, snapshot, createdAt: now, updatedAt: now }))
      await ctx.db.insert("shopPaymentOptions", { ...scope, personId: owner, options: { checkoutRef: "checkout-ref", available: true, reason: null, amount, expiresAt: now + 900_000, providerLabel: "Provider", beneficiaryLabel: "Atelier", modes: ["mobile_money"], consentTextVersion: "2026-10-18-p12-v1", readinessRef: privateMarker, readinessExpiresAt: now + 60_000 }, observedAt: now, validUntil: now + 60_000 })
      await ctx.db.insert("shopPaymentRequests", { ...scope, personId: owner, kind: "status", requestId: `control-${tag}`, rawBody: privateMarker, bodySha256: "c".repeat(64), leaseToken: privateMarker, leaseUntil: now + 30_000, generation: 7, expiresAt: now + 60_000, privateUntil: now + 1_800_000, createdAt: now })
    }
    return { personId, otherId, networkId, attempts }
  })
  return { t, now, ...data }
}

describe("P12 — révocation locale bornée", () => {
  it("traverse plus d'une page, invalide les retours tardifs et garde les faits financiers", async () => {
    const f = await fixture()
    expect(await f.t.run(ctx => revokePaymentDataForPerson(ctx, f.personId))).toBe(false)
    expect(await f.t.run(ctx => ctx.db.query("shopPaymentAttempts").withIndex("by_person_revoked", q => q.eq("personId", f.personId).eq("privacyRevokedAt", undefined)).take(26))).toHaveLength(5)
    expect(await f.t.run(ctx => ctx.db.query("shopPaymentOptions").withIndex("by_person", q => q.eq("personId", f.personId)).take(26))).toHaveLength(5)
    expect(await f.t.run(ctx => ctx.db.query("shopPaymentRequests").withIndex("by_person", q => q.eq("personId", f.personId)).take(26))).toHaveLength(5)
    expect(await f.t.run(ctx => revokePaymentDataForPerson(ctx, f.personId))).toBe(true)
    expect(await f.t.run(ctx => revokePaymentDataForPerson(ctx, f.personId))).toBe(true)
    const row = await f.t.run(ctx => ctx.db.get(f.attempts[0]!))
    expect(row).toMatchObject({ generation: 8, state: "requires_action", paymentState: "requires_action", paymentRef: "payment-ref", orderRef: "order-ref", amount, snapshot: { paymentState: "requires_action", action: null } })
    expect(row?.privacyRevokedAt).toBeDefined()
    for (const key of ["rawBody", "leaseToken", "leaseUntil", "authorizationExpiresAt", "startAction"] as const) expect(row?.[key]).toBeUndefined()
    expect(row!.privateUntil).toBeLessThanOrEqual(Date.now())
    const foreign = await f.t.run(ctx => ctx.db.query("shopPaymentAttempts").withIndex("by_person", q => q.eq("personId", f.otherId)).unique())
    expect(foreign).toMatchObject({ generation: 7, rawBody: privateMarker, startAction: action })
    expect(foreign?.privacyRevokedAt).toBeUndefined()
    expect(await f.t.run(ctx => ctx.db.query("shopPaymentOptions").withIndex("by_person", q => q.eq("personId", f.personId)).take(1))).toEqual([])
    expect(await f.t.run(ctx => ctx.db.query("shopPaymentRequests").withIndex("by_person", q => q.eq("personId", f.personId)).take(1))).toEqual([])
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").take(1))).toEqual([])
  })
  it("n'applique aucune continuation sans demande d'effacement vivante", async () => {
    const f = await fixture()
    await f.t.mutation(internal.modules.people.erasure.continuePaymentRevocation, { personId: f.personId })
    expect((await f.t.run(ctx => ctx.db.get(f.attempts[0]!)))?.generation).toBe(7)
    await f.t.run(ctx => ctx.db.patch(f.personId, { deletionRequestedAt: f.now }))
    await f.t.mutation(internal.modules.people.erasure.continuePaymentRevocation, { personId: f.personId })
    expect((await f.t.run(ctx => ctx.db.get(f.attempts[0]!)))?.generation).toBe(7)
  })
})
