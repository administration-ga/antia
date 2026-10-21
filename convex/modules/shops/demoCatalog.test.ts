// @vitest-environment edge-runtime
/** Illustrations démo : vrais comptes, gardes de publication et aucun mandat PRO.GA simulé. */
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { COMMERCE_PUBLIC_CONTRACT, commerceCanonicalJson, parseCommerceRef } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_LINK_CONSENT_VERSION } from "@antsia/social-domain/commerce-link"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, components, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { DEMO_CONTENT_DEPLOYMENT, demoContentAllowed } from "../../seeds/demoContentConfig"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { moderateContentWrite, setContentModerationStatus } from "../moderation/policy"
import { catalogStorefrontBlocks, listCatalog, resolveCatalogOffer } from "./catalogRead"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { SHOP_PUBLIC_LISTING_TEXT_VERSION } from "./rules"

type T = ReturnType<typeof testConvex>
const NOW = Date.UTC(2026, 9, 20, 12)
const FIRST = { cursor: null, numItems: 8 }
const PRODUCT_HANDLE = "epicerie-moussavou-demo"

function idOf(row: unknown): string {
  if (!row || typeof row !== "object" || !("_id" in row) || typeof row._id !== "string") throw new Error("Compte de fixture absent")
  return row._id
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv("ANTSIA_DEV_TOOLS", "true")
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv("ANTSIA_DEMO_DEPLOYMENT", "")
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

async function shopFixture(t: T, root: Id<"networks">, options: { handle?: string; ownerHandle?: string; email?: string; verified?: boolean; model?: Doc<"shops">["model"] } = {}) {
  const handle = options.handle ?? PRODUCT_HANDLE
  const ownerHandle = options.ownerHandle ?? "commercant.demo"
  const authUserId = idOf(await t.mutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Compte FICTIF", email: options.email ?? "commercant@demo.antsia.test", emailVerified: options.verified ?? true, createdAt: NOW, updatedAt: NOW } } }))
  const sessionId = await createTestSession(t, authUserId)
  const entities = await t.run(async (ctx) => {
    const personId = await ctx.db.insert("persons", { authUserId, handle: ownerHandle, displayName: "Patrick MOUSSAVOU", publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const membershipId = await ctx.db.insert("networkMemberships", { networkId: root, personId, status: "declaree", role: "member", joinedAt: NOW, statusChangedAt: NOW })
    await moderateContentWrite(ctx, { networkId: root, ownerPersonId: personId, kind: "person", id: personId, text: "Compte fictif de démonstration" })
    const pageId = await ctx.db.insert("pages", { networkId: root, handle, name: "Activité fictive Démo", description: "Activité de démonstration", ownerKind: "company", trust: "community", trustRank: 1, visibility: "network", onRoot: true, status: "active", createdByPersonId: personId, searchText: "activité fictive démo", createdAt: NOW, updatedAt: NOW })
    const signatoryId = await ctx.db.insert("pageSignatories", { networkId: root, pageId, personId, role: "admin", acceptedAt: NOW, createdAt: NOW, updatedAt: NOW })
    await moderateContentWrite(ctx, { networkId: root, ownerPersonId: personId, kind: "page", id: pageId, text: "Activité fictive Démo" })
    const shopId = await ctx.db.insert("shops", { networkId: root, pageId, preparedByPersonId: personId, model: options.model ?? "products", storefront: "published", visibility: "network", publicConsentAt: NOW, publicConsentTextVersion: SHOP_PUBLIC_LISTING_TEXT_VERSION, publicConsentByPersonId: personId, publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    return { personId, membershipId, pageId, signatoryId, shopId }
  })
  return { ...entities, as: t.withIdentity({ subject: authUserId, sessionId }), authUserId, handle }
}

async function fixture(options: Parameters<typeof shopFixture>[2] = {}) {
  const t = testConvex({ automaticSessions: false })
  const { root, testClosed: child } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  await t.run(async (ctx) => ctx.db.insert("shopNetworkPolicies", { networkId: root, storefront: "review", updatedAt: NOW }))
  return { t, root, child, ...await shopFixture(t, root, options) }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

async function read(f: Fixture, options: Partial<Parameters<typeof listCatalog>[2]> = {}) {
  return await f.as.query(api.modules.shops.catalog.list, { networkId: f.root, handle: f.handle, paginationOpts: FIRST, ...options })
}
async function offer(f: Fixture, offerRef = "demo:offer:epicerie-produits") {
  return await f.as.query(api.modules.shops.catalog.offer, { networkId: f.root, handle: f.handle, offerRef })
}

describe("catalogue fictif — activation et propriété", () => {
  it("refuse la production même avec les drapeaux de la démo recopiés", async () => {
    const f = await fixture()
    vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud")
    vi.stubEnv("ANTSIA_DEMO_DEPLOYMENT", DEMO_CONTENT_DEPLOYMENT)
    expect(await offer(f)).toBeNull()
    expect((await read(f)).page).toEqual([])
    expect(demoContentAllowed({ CONVEX_CLOUD_URL: `https://${DEMO_CONTENT_DEPLOYMENT}.convex.cloud`, ANTSIA_DEMO_DEPLOYMENT: DEMO_CONTENT_DEPLOYMENT })).toBe(true)
  })
  it("reste fermé localement sans la déclaration des outils démo", async () => {
    const f = await fixture()
    vi.stubEnv("ANTSIA_DEV_TOOLS", "false")
    expect(await offer(f)).toBeNull()
  })
  it.each([
    { email: "commercant@example.test" },
    { verified: false },
    { ownerHandle: "proprietaire.reel" },
    { handle: "autre-boutique" },
    { model: "quote_services" as const },
  ])("refuse une boutique ou une identité hors de la déclaration : %j", async (options) => {
    const f = await fixture(options)
    expect(await offer(f)).toBeNull()
    expect((await read(f)).page).toEqual([])
  })
  it("ne confond pas une racine présentée par l'appelant avec la vraie racine ANTSIA", async () => {
    const f = await fixture()
    const result = await f.t.run(async (ctx) => {
      const root = (await ctx.db.get(f.root))!, child = (await ctx.db.get(f.child))!
      return await resolveCatalogOffer(ctx, { root, network: { ...child, kind: "root" } }, f.shopId, "demo:offer:epicerie-produits")
    })
    expect(result).toBeNull()
  })
})

describe("catalogue fictif — publication vivante et portée publique", () => {
  it.each(["withdrawn", "suspended"] as const)("ferme immédiatement une vitrine %s", async (storefront) => {
    const f = await fixture()
    expect(await offer(f)).not.toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(f.shopId, { storefront }))
    expect(await offer(f)).toBeNull()
  })
  it("refuse un propriétaire retiré ou dont le mandat n'est plus accepté", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => ctx.db.patch(f.personId, { withdrawnAt: NOW }))
    expect(await offer(f)).toBeNull()
    await f.t.run(async (ctx) => { await ctx.db.patch(f.personId, { withdrawnAt: undefined }); await ctx.db.patch(f.signatoryId, { acceptedAt: undefined }) })
    expect(await offer(f)).toBeNull()
  })
  it("ferme la vitrine d'un propriétaire suspendu et une page en prélecture, même pour son propriétaire", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => ctx.db.patch(f.membershipId, { status: "suspendue" }))
    expect(await f.t.run(async (ctx) => resolveCatalogOffer(ctx, { root: (await ctx.db.get(f.root))! }, f.shopId, "demo:offer:epicerie-produits"))).toBeNull()
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.membershipId, { status: "declaree" })
      const state = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "page").eq("targetId", f.pageId)).unique()
      await ctx.db.patch(state!._id, { status: "pending_review" })
    })
    expect(await offer(f)).toBeNull()
  })
  it("respecte le retrait de page et le consentement public dans les lectures membre et anonyme", async () => {
    const f = await fixture()
    const args = { networkId: f.root, handle: f.handle, offerRef: "demo:offer:epicerie-produits" }
    expect(await f.t.query(api.modules.public.catalog.offer, args)).not.toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(f.shopId, { publicConsentRevokedAt: NOW }))
    expect(await offer(f)).toBeNull()
    expect(await f.t.query(api.modules.public.catalog.offer, args)).toBeNull()
    await f.t.run(async (ctx) => { await ctx.db.patch(f.shopId, { publicConsentRevokedAt: undefined }); await ctx.db.patch(f.pageId, { status: "inactive" }) })
    expect(await offer(f)).toBeNull()
  })
  it("respecte la modération retirée de la page et la fermeture de politique", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => setContentModerationStatus(ctx, { networkId: f.root, kind: "page", id: f.pageId }, "removed"))
    expect(await offer(f)).toBeNull()
    await f.t.run(async (ctx) => {
      await setContentModerationStatus(ctx, { networkId: f.root, kind: "page", id: f.pageId }, "published")
      const policy = await ctx.db.query("shopNetworkPolicies").withIndex("by_network", (q) => q.eq("networkId", f.root)).unique()
      await ctx.db.patch(policy!._id, { storefront: "closed" })
    })
    expect(await offer(f)).toBeNull()
  })
})

describe("catalogue fictif — données et lectures raccordées", () => {
  it("sert quatre produits illustrés, sans disponibilité réelle ni action commerciale", async () => {
    const f = await fixture()
    const result = await read(f)
    expect(result.page).toHaveLength(4)
    expect(result.page.map((item) => item.price)).toEqual([1500, 8500, 2500, 12000].map((amount) => ({ mode: "fixed", currency: "XAF", amount })))
    for (const item of result.page) {
      expect(item.offerRef).toMatch(/^demo:offer:/)
      expect(parseCommerceRef(item.offerRef)).toBeNull()
      expect(item.actions).toEqual({ contact: false, quote: false, purchase: false })
      expect(item.availability).toEqual({ state: "unknown", indicative: true, updatedAt: null, stale: false })
      expect(item.media[0]?.url).toMatch(/^\/demo-media\/animation-20261020\/[a-z-]+\.png$/)
      expect(item.media[0]?.altText).toContain("Illustration générée")
    }
    expect(await f.t.run(async (ctx) => catalogStorefrontBlocks(ctx, (await ctx.db.get(f.root))!, (await ctx.db.get(f.shopId))!))).toEqual(["catalog"])
    const checkout = await f.as.query(api.modules.shops.checkout.context, { networkId: f.root, handle: f.handle, offerRef: result.page[0]!.offerRef })
    expect(checkout.available).toBe(false)
    expect(await f.t.run(async (ctx) => (await ctx.db.query("shopCommerceLinks").take(1)).length)).toBe(0)
  })
  it("filtre par texte sans accents, type et collection ; pagine sans doublon ni curseur croisé", async () => {
    const f = await fixture()
    expect((await read(f, { query: "epicerie" })).page.map((item) => item.offerRef)).toEqual(["demo:offer:epicerie-produits"])
    expect((await read(f, { kind: "service" })).page).toEqual([])
    const first = await read(f, { paginationOpts: { cursor: null, numItems: 2 } })
    const second = await read(f, { paginationOpts: { cursor: first.continueCursor, numItems: 2 } })
    expect(first.isDone).toBe(false)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.page, ...second.page].map((item) => item.offerRef)).size).toBe(4)
    expect((await read(f, { collectionRef: first.collections[0]!.collectionRef })).page).toHaveLength(4)
    expect((await read(f, { collectionRef: "demo:collection:autre" })).page).toEqual([])
    let error: unknown
    try { await read(f, { query: "wax", paginationOpts: { cursor: first.continueCursor, numItems: 2 } }) } catch (caught) { error = caught }
    expect(engineErrorCode(error)).toBe("invalidArgument")
  })
  it("affiche les quatre prestations dans Découvrir sans ouvrir la politique des commandes", async () => {
    const f = await fixture()
    await shopFixture(f.t, f.root, { handle: "studio-objectif-demo", ownerHandle: "verifie.demo", email: "verifie@demo.antsia.test", model: "quote_services" })
    await shopFixture(f.t, f.root, { handle: "atelier-tech-demo", ownerHandle: "membre.demo", email: "membre@demo.antsia.test", model: "quote_services" })
    expect(await f.as.query(api.modules.shops.services.discoverAvailability, { networkId: f.root })).toEqual({ available: true })
    const result = await f.as.query(api.modules.shops.services.discoverServices, { networkId: f.root, paginationOpts: FIRST })
    expect(result.page).toHaveLength(4)
    expect(result.page.every((item) => item.kind === "service" && !item.actions.purchase && !item.actions.quote && !item.actions.contact)).toBe(true)
    expect(result.page.find((item) => item.offerRef === "demo:offer:reportage-photo")?.price).toEqual({ mode: "quote", currency: "XAF" })
    expect(await f.t.run(async (ctx) => (await ctx.db.query("commerceServicePolicies").take(1)).length)).toBe(0)
    expect(await f.t.run(async (ctx) => (await ctx.db.query("commerceServiceRequests").take(1)).length)).toBe(0)
  })
  it("laisse une projection PRO.GA réellement lisible remplacer les illustrations démo", async () => {
    const f = await fixture()
    vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
    vi.stubEnv("ANTSIA_COMMERCE_ENVIRONMENT", "sandbox")
    vi.stubEnv("ANTSIA_COMMERCE_SOURCE", "antsia")
    vi.stubEnv("ANTSIA_COMMERCE_PRO_HTTP_ORIGIN", "http://localhost:4010")
    vi.stubEnv("ANTSIA_COMMERCE_PRO_APP_ORIGIN", "http://localhost:4011")
    vi.stubEnv("ANTSIA_COMMERCE_ORIGIN", "http://localhost:3030")
    vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "catalog-fixture-real")
    vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", "fixture-only-catalogue-sandbox-0123456789")
    const config = await readCommerceLinkConfig()
    if (!config) throw new Error("Configuration de fixture absente")
    const shopRef = "pro.ga:structure:01JA00000000000000000000S1", linkRef = "pro.ga:commerce_link:01JA00000000000000000000K1", offerRef = "pro.ga:offer:01JA00000000000000000000P1"
    await f.t.run(async (ctx) => {
      await ctx.db.insert("shopCommerceLinks", { networkId: f.root, shopId: f.shopId, pageId: f.pageId, personId: f.personId, state: "active", source: "antsia", environment: "sandbox", configFingerprint: config.fingerprint, subjectRef: `antsia:sub:${"a".repeat(32)}`, antsiaShopRef: `antsia:shop:${"b".repeat(32)}`, shopRef, linkRef, permissions: ["publish_catalog"], consentTextVersion: COMMERCE_LINK_CONSENT_VERSION, consentedAt: NOW, linkedAt: NOW, createdAt: NOW, updatedAt: NOW })
      await ctx.db.insert("shopCatalogPolicies", { networkId: f.root, enabled: true, updatedAt: NOW })
      const emitterId = await ctx.db.insert("federationEmitters", { networkId: f.root, slug: "catalog-fixture-real", environment: "sandbox", enabled: true, keyEnvName: "CATALOG_FIXTURE_KEY", allowedContracts: [COMMERCE_PUBLIC_CONTRACT], revision: 1, createdAt: NOW, updatedAt: NOW })
      const mappingId = await ctx.db.insert("commerceCatalogMappings", { networkId: f.root, shopId: f.shopId, emitterId, environment: "sandbox", shopRef, linkRef, enabled: true, generation: 1, createdAt: NOW, updatedAt: NOW })
      const fields = { networkId: f.root, shopId: f.shopId, mappingId, mappingGeneration: 1, emitterId, environment: "sandbox" as const, shopRef, sequence: "catalog" as const, state: "active" as const, revision: 1, digest: "a".repeat(64), changedAt: NOW, receivedAt: NOW, activationRevision: 1, gap: false }
      await ctx.db.insert("commerceCatalogHeads", { ...fields, objectRef: shopRef, objectKind: "shop", parentActivationRevision: 0, body: commerceCanonicalJson({ contract: COMMERCE_PUBLIC_CONTRACT, eventId: "real-shop-fixture", objectRef: shopRef, version: 1, payload: { type: "shop.published", shopRef, linkRef, revision: 1, changedAt: NOW, commercialName: "Catalogue réel", country: "GA", currency: "XAF", sellerVerification: "unverified", capabilities: ["catalog"], collections: [] } })! })
      const headId = await ctx.db.insert("commerceCatalogHeads", { ...fields, objectRef: offerRef, objectKind: "offer", kind: "product", parentActivationRevision: 1, body: commerceCanonicalJson({ contract: COMMERCE_PUBLIC_CONTRACT, eventId: "real-offer-fixture", objectRef: offerRef, version: 1, payload: { type: "offer.published", shopRef, offerRef, revision: 1, changedAt: NOW, kind: "product", title: "Catalogue réel", description: "Projection contractuelle de fixture.", collectionRefs: [], tags: [], price: { mode: "fixed", currency: "XAF", amount: 42 }, showsAvailability: false, variants: [], variantAxes: [], media: [] } })! })
      await setContentModerationStatus(ctx, { networkId: f.root, kind: "commerceOffer", id: headId }, "published")
    })
    expect((await read(f)).page.map((item) => item.offerRef)).toEqual([offerRef])
    expect(await offer(f)).toBeNull()
  })
})
