// @vitest-environment edge-runtime
/** P09 : scénarios backend rédigés seulement ; aucune commande de test exécutée. */
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { COMMERCE_PUBLIC_CONTRACT, commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { commercePublicEffect, type CommerceMedia, type CommerceOfferEvent, type CommercePublicEvent, type CommerceShopEvent } from "@antsia/social-domain/commerce/projection"
import { COMMERCE_LINK_CONSENT_VERSION } from "@antsia/social-domain/commerce-link"
import { federationSigningText } from "@antsia/social-domain/federationProtocol"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestOperatorProof, testConvex } from "../../test.setup"
import type { CatalogMediaLeaseArgs } from "../federation/commerceCatalogMedia"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { SHOP_PUBLIC_LISTING_TEXT_VERSION } from "./rules"
import type { CatalogList, CatalogOffer } from "./catalogValidators"

const NOW = Date.UTC(2026, 9, 18, 12)
const SHOP = "pro.ga:structure:01JA00000000000000000000S1", OFFER = "pro.ga:offer:01JA00000000000000000000P1"
const LINK = "pro.ga:commerce_link:01JA00000000000000000000K1", COLLECTION = "pro.ga:offer_collection:01JA00000000000000000000C1"
const VARIANT = "pro.ga:offer_variant:01JA00000000000000000000V1"
const KEY_NAME = "ANTSIA_FEDERATION_CATALOG_TEST_KEY", KEY = "catalogue-test-secret-key-sandbox-0123456789"
let eventSequence = 0
type ShopArgs = { networkId: Id<"networks">; shopId: Id<"shops"> }
const policy = makeFunctionReference<"mutation", { networkId: Id<"networks">; enabled: boolean; reason: string }, null>("modules/shops/catalogControl:setPolicy")
const mapping = makeFunctionReference<"mutation", ShopArgs & { emitterId: Id<"federationEmitters">; enabled: boolean; reason: string }, null>("modules/shops/catalogControl:configureMapping")
const getOffer = makeFunctionReference<"query", { networkId: Id<"networks">; handle: string; offerRef: string }, CatalogOffer | null>("modules/shops/catalog:offer")
const getPublicOffer = makeFunctionReference<"query", { networkId: Id<"networks">; handle: string; offerRef: string }, CatalogOffer | null>("modules/public/catalog:offer")
const list = makeFunctionReference<"query", { networkId: Id<"networks">; handle: string; query?: string; paginationOpts: { cursor: string | null; numItems: number } }, CatalogList>("modules/shops/catalog:list")
const slot = makeFunctionReference<"query", { networkId: Id<"networks">; postId: Id<"posts"> }, CatalogOffer | null>("modules/shops/catalog:postOffer")
const setSlot = makeFunctionReference<"mutation", ShopArgs & { postId: Id<"posts">; offerRef: string | null }, { changed: true }>("modules/shops/catalogPosts:setPostOffer")
const claim = makeFunctionReference<"mutation", CatalogMediaLeaseArgs, boolean>("modules/federation/commerceCatalogMedia:claim")
const stage = makeFunctionReference<"mutation", CatalogMediaLeaseArgs & { index: number; storageId: Id<"_storage">; publicToken: string }, boolean>("modules/federation/commerceCatalogMedia:stage")
const complete = makeFunctionReference<"mutation", CatalogMediaLeaseArgs, boolean>("modules/federation/commerceCatalogMedia:complete")

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW); eventSequence = 0
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
  vi.stubEnv(KEY_NAME, KEY)
  vi.stubEnv("ANTSIA_COMMERCE_ENVIRONMENT", "sandbox")
  vi.stubEnv("ANTSIA_COMMERCE_SOURCE", "antsia")
  vi.stubEnv("ANTSIA_COMMERCE_PRO_HTTP_ORIGIN", "http://localhost:4010")
  vi.stubEnv("ANTSIA_COMMERCE_PRO_APP_ORIGIN", "http://localhost:4011")
  vi.stubEnv("ANTSIA_COMMERCE_ORIGIN", "http://localhost:3030")
  vi.stubEnv("ANTSIA_COMMERCE_KEY_ID", "antsia-catalog-test")
  vi.stubEnv("ANTSIA_COMMERCE_SIGNING_KEY", KEY)
  vi.stubEnv("ANTSIA_CATALOG_MEDIA_ORIGIN", "http://localhost:3211")
  vi.stubEnv("FILE_GUARD", "off")
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function fixture() {
  const t = testConvex()
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const as = t.withIdentity({ subject: "catalogue-operator-fixture" })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: "catalogue-owner", displayName: "Catalogue" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  await t.run(async (ctx) => ctx.db.insert("operators", { personId, role: "platform_admin", grantedAt: NOW }))
  await createTestOperatorProof(t, as, personId)
  const config = await readCommerceLinkConfig()
  if (!config) throw new Error("Configuration de fixture absente")
  const owned = await t.run(async (ctx) => {
    const pageId = await ctx.db.insert("pages", { networkId: root, handle: "catalogue-test", name: "Boutique de recette", description: "Activité de recette", ownerKind: "company", trust: "community", trustRank: 1, visibility: "network", onRoot: true, status: "active", createdByPersonId: personId, searchText: "boutique recette", createdAt: NOW, updatedAt: NOW })
    const signatoryId = await ctx.db.insert("pageSignatories", { networkId: root, pageId, personId, role: "admin", acceptedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const shopId = await ctx.db.insert("shops", { networkId: root, pageId, preparedByPersonId: personId, model: "products", storefront: "published", visibility: "network", publicConsentAt: NOW, publicConsentTextVersion: SHOP_PUBLIC_LISTING_TEXT_VERSION, publicConsentByPersonId: personId, publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const linkId = await ctx.db.insert("shopCommerceLinks", { networkId: root, shopId, pageId, personId, state: "active", source: "antsia", environment: "sandbox", configFingerprint: config.fingerprint, subjectRef: `antsia:sub:${"a".repeat(32)}`, antsiaShopRef: `antsia:shop:${"b".repeat(32)}`, shopRef: SHOP, linkRef: LINK, permissions: ["publish_catalog"], consentTextVersion: COMMERCE_LINK_CONSENT_VERSION, consentedAt: NOW, linkedAt: NOW, createdAt: NOW, updatedAt: NOW })
    await ctx.db.insert("shopNetworkPolicies", { networkId: root, storefront: "review", updatedAt: NOW })
    await ctx.db.insert("moderationPolicies", { networkId: root, surface: "commerceOffer", preReview: false, maxLinks: 20, maxWrites: 100, windowMs: 60_000, updatedAt: NOW })
    return { pageId, signatoryId, shopId, linkId }
  })
  const emitterId = await as.mutation(api.modules.federation.emitters.configure, { networkId: root, slug: "pro-catalog-test", environment: "sandbox", enabled: true, keyEnvName: KEY_NAME, allowedContracts: [COMMERCE_PUBLIC_CONTRACT], reason: "Émetteur fictif du catalogue dans le harnais" })
  await as.mutation(policy, { networkId: root, enabled: true, reason: "Politique fictive de lecture du catalogue" })
  await as.mutation(mapping, { networkId: root, shopId: owned.shopId, emitterId, enabled: true, reason: "Mapping fictif de la boutique et du catalogue" })
  return { t, as, root, personId, emitterId, ...owned, offerArgs: { networkId: root, handle: "catalogue-test", offerRef: OFFER } }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

function shop(revision = 1, extra: Partial<CommerceShopEvent> = {}): CommerceShopEvent {
  return { type: revision === 1 ? "shop.published" : "shop.updated", shopRef: SHOP, linkRef: LINK, revision, changedAt: NOW, commercialName: "Activité", country: "GA", currency: "XAF", sellerVerification: "unverified", capabilities: ["catalog"], collections: [{ collectionRef: COLLECTION, label: "Collection", position: 0 }], ...extra }
}
function offer(revision = 1, extra: Partial<CommerceOfferEvent> = {}): CommerceOfferEvent {
  return { type: revision === 1 ? "offer.published" : "offer.updated", shopRef: SHOP, offerRef: OFFER, revision, changedAt: NOW, kind: "product", title: "Article de recette", description: "Une description publique du produit.", collectionRefs: [COLLECTION], tags: ["recette"], price: { mode: "fixed", currency: "XAF", amount: 12_000 }, showsAvailability: true, variants: [], variantAxes: [], media: [], ...extra }
}
async function deliver(f: Fixture, payload: CommercePublicEvent) {
  const raw = commerceCanonicalJson({ contract: COMMERCE_PUBLIC_CONTRACT, eventId: `catalog-event-${++eventSequence}`, objectRef: commercePublicEffect(payload).objectRef, payload, version: 1 })!
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(federationSigningText("sandbox", timestamp, raw)))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return await f.t.fetch("/federation/inbox", { method: "POST", body: raw, headers: { "x-antsia-emitter": "pro-catalog-test", "x-antsia-environment": "sandbox", "x-antsia-timestamp": timestamp, "x-antsia-signature": signature } })
}
async function applied(f: Fixture, payload: CommercePublicEvent) { const response = await deliver(f, payload); expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ status: "applied", applicationStatus: "applied" }) }
async function published(f: Fixture, payload = offer()) { await applied(f, shop()); await applied(f, payload) }
async function head(f: Fixture) { return await f.t.run(async (ctx) => ctx.db.query("commerceCatalogHeads").withIndex("by_emitter_object_sequence", (q) => q.eq("emitterId", f.emitterId).eq("objectRef", OFFER).eq("sequence", "catalog")).unique()) }
async function post(f: Fixture, pageId = f.pageId) { return await f.t.run(async (ctx) => ctx.db.insert("posts", { networkId: f.root, authorPersonId: f.personId, pageId, body: "Publication de recette", audience: "public", visibility: "root", onRoot: true, status: "published", searchText: "publication recette", publishedAt: NOW, createdAt: NOW, updatedAt: NOW })) }
async function code(work: Promise<unknown>) { try { await work; return null } catch (error) { return engineErrorCode(error) } }

async function image() {
  const binary = atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE6kAAAAASUVORK5CYII=")
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("")
  const descriptor: CommerceMedia = { byteSize: bytes.byteLength, mimeType: "image/png", sha256: digest, altText: "Image de recette", width: 1, height: 1 }
  return { blob: new Blob([bytes], { type: "image/png" }), descriptor }
}
async function attachImage(f: Fixture) {
  const media = await image()
  await published(f, offer(1, { media: [media.descriptor] }))
  const current = (await head(f))!
  const lease: CatalogMediaLeaseArgs = { networkId: f.root, headId: current._id, revision: current.revision, digest: current.digest, leaseToken: "catalogue-test-lease-0123456789abcdef" }
  expect(await f.t.mutation(claim, lease)).toBe(true)
  const storageId = await f.t.run(async (ctx) => ctx.storage.store(media.blob))
  const token = "c".repeat(64)
  expect(await f.t.mutation(stage, { ...lease, index: 0, storageId, publicToken: token })).toBe(true)
  expect(await f.t.mutation(complete, lease)).toBe(true)
  const scan = await f.t.run(async (ctx) => ctx.db.query("fileScans").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).unique())
  return { storageId, token, scan: scan! }
}

describe("P09 — publication, révisions et projection", () => {
  it("projette la même allowlist membre/anonyme et conserve le format prix/devis", async () => {
    const f = await fixture()
    await published(f, offer(1, { price: { mode: "quote", currency: "XAF" } }))
    expect((await f.as.query(getOffer, f.offerArgs))?.price).toEqual({ mode: "quote", currency: "XAF" })
    await applied(f, offer(2, { variants: [
      { variantRef: VARIANT, label: "Active", options: ["A"], amount: 13_000 },
      { variantRef: "pro.ga:offer_variant:01JA00000000000000000000V2", label: "Future", options: ["B"], amount: 15_000, effectiveFrom: NOW + 60_000 },
      { variantRef: "pro.ga:offer_variant:01JA00000000000000000000V3", label: "Expirée", options: ["C"], amount: 16_000, effectiveTo: NOW },
    ], variantAxes: ["Modèle"] }))
    const member = await f.as.query(getOffer, f.offerArgs), anonymous = await f.t.query(getPublicOffer, f.offerArgs)
    expect(member).toEqual(anonymous)
    expect(member?.price).toEqual({ mode: "fixed", currency: "XAF", amount: 12_000 })
    expect(member?.variants.map((variant) => variant.label)).toEqual(["Active"])
    expect(member?.actions).toEqual({ contact: false, quote: false, purchase: false })
    const serialized = JSON.stringify(member)
    for (const field of ["linkRef", "subjectRef", "storageId", "emitterId", "configFingerprint", "stock", "http://localhost:4010"]) expect(serialized).not.toContain(field)
    const page = await f.as.query(list, { networkId: f.root, handle: "catalogue-test", paginationOpts: { cursor: null, numItems: 12 } })
    expect(Object.keys(page).sort()).toEqual(["page", "continueCursor", "isDone", "collections", "filteredWindow"].sort())
    expect(page.page).toHaveLength(1)
    expect(await code(f.as.query(list, { networkId: f.root, handle: "catalogue-test", query: "a".repeat(121), paginationOpts: { cursor: null, numItems: 12 } }))).toBe("invalidArgument")
  })

  it("catalogue/disponibilité indépendants, stale explicite et conflit de même révision", async () => {
    const f = await fixture()
    await published(f)
    await applied(f, { type: "offer.availabilityChanged", shopRef: SHOP, offerRef: OFFER, availability: "in_stock", availabilityRevision: 9, changedAt: NOW, variants: [] })
    await applied(f, offer(3, { price: { mode: "range", currency: "XAF", minAmount: 14_000, maxAmount: 16_000 } }))
    expect(await f.as.query(getOffer, f.offerArgs)).toMatchObject({ revision: 3, price: { mode: "range", minAmount: 14_000 }, availability: { state: "in_stock", stale: false, indicative: true } })
    await applied(f, offer(1))
    expect((await head(f))?.revision).toBe(3)
    const conflict = await deliver(f, offer(3, { title: "Autre contenu même révision" }))
    expect(await conflict.json()).toMatchObject({ applicationStatus: "rejected", status: "dead_letter" })
    expect((await head(f))?.gap).toBe(true)
    vi.setSystemTime(NOW + 16 * 60_000)
    expect(await f.as.query(getOffer, f.offerArgs)).toMatchObject({ availability: { state: "unknown", stale: true } })
    await applied(f, { type: "offer.availabilityChanged", shopRef: SHOP, offerRef: OFFER, availability: "in_stock", availabilityRevision: 9, changedAt: NOW, variants: [] })
    expect(await f.as.query(getOffer, f.offerArgs)).toMatchObject({ availability: { state: "unknown", stale: true, updatedAt: NOW } })
    await applied(f, { type: "offer.availabilityChanged", shopRef: SHOP, offerRef: OFFER, availability: "in_stock", availabilityRevision: 10, changedAt: Date.now(), variants: [] })
    expect(await f.as.query(getOffer, f.offerArgs)).toMatchObject({ availability: { state: "in_stock", stale: false, updatedAt: Date.now() } })
  })

  it("tombstone d'offre et retrait/republication parent ne ressuscitent pas des révisions anciennes", async () => {
    const f = await fixture()
    await published(f)
    await applied(f, { type: "offer.withdrawn", shopRef: SHOP, offerRef: OFFER, revision: 2, changedAt: NOW, reason: "consent_withdrawn" })
    await applied(f, offer(1))
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    await applied(f, offer(3))
    await applied(f, { type: "shop.withdrawn", shopRef: SHOP, linkRef: LINK, revision: 2, changedAt: NOW, reason: "consent_withdrawn" })
    expect(await f.t.query(getPublicOffer, f.offerArgs)).toBeNull()
    await applied(f, shop(3))
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    expect(await (await deliver(f, offer(3))).json()).toMatchObject({ applicationStatus: "rejected" })
    await applied(f, offer(4))
    expect((await f.as.query(getOffer, f.offerArgs))?.revision).toBe(4)
  })

  it("retirer capacité catalog source ferme les offres et exige une nouvelle incarnation enfant", async () => {
    const f = await fixture()
    await published(f)
    await applied(f, shop(2, { capabilities: ["quote"] }))
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    await applied(f, shop(3))
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    await applied(f, offer(2))
    expect((await f.as.query(getOffer, f.offerArgs))?.revision).toBe(2)
  })

  it("réactiver le mapping n'adopte pas les anciens snapshots parent/enfant", async () => {
    const f = await fixture()
    await published(f)
    const args = { networkId: f.root, shopId: f.shopId, emitterId: f.emitterId, reason: "Réactivation explicite de mapping de recette" }
    await f.as.mutation(mapping, { ...args, enabled: false })
    await f.as.mutation(mapping, { ...args, enabled: true })
    expect(await (await deliver(f, shop())).json()).toMatchObject({ applicationStatus: "rejected" })
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    await applied(f, shop(2))
    expect(await (await deliver(f, offer())).json()).toMatchObject({ applicationStatus: "rejected" })
    await applied(f, offer(2))
    expect((await f.as.query(getOffer, f.offerArgs))?.revision).toBe(2)
  })

  it.each(["policy", "public_consent", "link", "permission", "admin", "moderation", "emitter"])("la lecture rejuge %s sans privilège auteur", async (variant) => {
    const f = await fixture()
    await published(f)
    const current = (await head(f))!
    await f.t.run(async (ctx) => {
      if (variant === "policy") { const row = await ctx.db.query("shopCatalogPolicies").withIndex("by_network", (q) => q.eq("networkId", f.root)).unique(); await ctx.db.patch(row!._id, { enabled: false }) }
      if (variant === "public_consent") await ctx.db.patch(f.shopId, { publicConsentRevokedAt: NOW })
      if (variant === "link") await ctx.db.patch(f.linkId, { state: "revoked", revokedAt: NOW })
      if (variant === "permission") await ctx.db.patch(f.linkId, { permissions: [] })
      if (variant === "admin") await ctx.db.delete(f.signatoryId)
      if (variant === "moderation") { const row = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "commerceOffer").eq("targetId", current._id)).unique(); await ctx.db.patch(row!._id, { status: "removed" }) }
      if (variant === "emitter") await ctx.db.patch(f.emitterId, { enabled: false })
    })
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
    expect(await f.t.query(getPublicOffer, f.offerArgs)).toBeNull()
  })

  it("un autre shopRef n'est jamais adopté ni créé depuis l'événement", async () => {
    const f = await fixture()
    const response = await deliver(f, shop(1, { shopRef: "pro.ga:structure:01JA00000000000000000000S2" }))
    expect(await response.json()).toMatchObject({ applicationStatus: "rejected" })
    expect(await f.t.run(async (ctx) => ctx.db.query("commerceCatalogHeads").take(2))).toEqual([])
    expect(await f.t.run(async (ctx) => ctx.db.query("shops").take(2))).toHaveLength(1)
  })

  it("une source modifiée ne republie pas une offre retirée par la modération", async () => {
    const f = await fixture()
    await published(f)
    const current = (await head(f))!
    await f.t.run(async (ctx) => { const row = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "commerceOffer").eq("targetId", current._id)).unique(); await ctx.db.patch(row!._id, { status: "removed" }) })
    await applied(f, offer(2))
    expect(await f.as.query(getOffer, f.offerArgs)).toBeNull()
  })
})

describe("P09 — slot et médias révoquables", () => {
  it("rattache l'offre de la même page puis le slot relit le prix courant", async () => {
    const f = await fixture()
    await published(f)
    const postId = await post(f)
    expect(await f.as.mutation(setSlot, { networkId: f.root, shopId: f.shopId, postId, offerRef: OFFER })).toEqual({ changed: true })
    expect(await f.as.query(slot, { networkId: f.root, postId })).toMatchObject({ offerRef: OFFER, price: { amount: 12_000 } })
    await applied(f, offer(2, { price: { mode: "unit", amount: 15_000, currency: "XAF", unit: "pièce" } }))
    expect(await f.as.query(slot, { networkId: f.root, postId })).toMatchObject({ revision: 2, price: { mode: "unit", amount: 15_000 } })
  })

  it("refuse une publication d'une autre page/boutique", async () => {
    const f = await fixture()
    await published(f)
    const otherPage = await f.t.run(async (ctx) => ctx.db.insert("pages", { networkId: f.root, handle: "other-catalogue-page", name: "Autre activité", ownerKind: "company", trust: "community", trustRank: 1, visibility: "network", onRoot: true, status: "active", createdByPersonId: f.personId, searchText: "autre", createdAt: NOW, updatedAt: NOW }))
    const postId = await post(f, otherPage)
    expect(await code(f.as.mutation(setSlot, { networkId: f.root, shopId: f.shopId, postId, offerRef: OFFER }))).toBe("notFound")
    expect(await f.as.query(slot, { networkId: f.root, postId })).toBeNull()
  })

  it.each(["offer", "consent"])("retrait %s retire slot et ancienne URL déjà émise", async (variant) => {
    const f = await fixture(), attached = await attachImage(f)
    expect((await f.as.query(getOffer, f.offerArgs))?.media[0]).toMatchObject({ url: null, withheld: "fileScanPending" })
    // Un skipped/clean sans preuve AV ne suffit jamais aux médias étrangers.
    await f.t.run(async (ctx) => ctx.db.patch(attached.scan._id, { status: "clean" }))
    expect((await f.as.query(getOffer, f.offerArgs))?.media[0]?.url).toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(attached.scan._id, { status: "clean", av: { provider: "fixture", verdict: "clean" } }))
    const before = await f.as.query(getOffer, f.offerArgs)
    const path = new URL(before!.media[0]!.url!).pathname
    expect(path).toBe(`/catalogue/media/${attached.token}`)
    expect((await f.t.fetch(path)).status).toBe(200)
    const postId = await post(f)
    await f.as.mutation(setSlot, { networkId: f.root, shopId: f.shopId, postId, offerRef: OFFER })
    if (variant === "offer") await applied(f, { type: "offer.withdrawn", shopRef: SHOP, offerRef: OFFER, revision: 2, changedAt: NOW, reason: "consent_withdrawn" })
    else await f.t.run(async (ctx) => ctx.db.patch(f.shopId, { publicConsentRevokedAt: NOW }))
    expect(await f.as.query(slot, { networkId: f.root, postId })).toBeNull()
    expect((await f.t.fetch(path)).status).toBe(404)
    expect(await f.t.query(getPublicOffer, f.offerArgs)).toBeNull()
  })
})
