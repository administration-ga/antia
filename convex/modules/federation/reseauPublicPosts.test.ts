// @vitest-environment edge-runtime
// PA9B : scénarios écrits contre les helpers réels ; exécution différée par le propriétaire.
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { RESEAU_PUBLIC_CONTRACT, RESEAU_PUBLIC_EMITTER, type FederationEnvelope, type FederationJson } from "@antsia/social-domain/federationProtocol"
import type { ReseauPublicMedia } from "@antsia/social-domain/reseauPublic"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { createTestSession, testConvex } from "../../test.setup"
import { canReadModeratedContent, contentState, setContentModerationStatus } from "../moderation/policy"
import { markPostRemoved } from "../posts/contentRemoval"
import { countPagePosts } from "../posts/counters"
import { hasNativePostAuthor, requireNativePostAuthor } from "../posts/nativeAuthor"
import type { MediaJobArgs, MediaLeaseArgs } from "./mediaJobs"
import { isFederatedContentAvailable } from "./mirrorAccess"
import { applyFederationEnvelope, validImplementedFederationPayload } from "./reseauPublic"

type T = ReturnType<typeof testConvex>
type Fixture = {
  t: T
  root: Id<"networks">
  administration: Id<"networks">
  emitterId: Id<"federationEmitters">
}

const T0 = Date.UTC(2026, 9, 18, 12)
const PAGE_REF = "administration:direction-fixture"
const POST_REF = "publication:communique-fixture"
const IMAGE = { url: "https://cdn.example.org/communique.png", kind: "image", mimeType: "image/png", sizeBytes: 1200, sha256: "a".repeat(64), altText: "Image du communiqué" }
const POSTS = api.modules.posts.posts
const PUBLIC = api.modules.public.projections
const CLAIM = makeFunctionReference<"mutation", MediaJobArgs, { leaseToken: string } | null>("modules/federation/mediaJobs:claim")
const SNAPSHOT = makeFunctionReference<"query", MediaLeaseArgs, { manifest: ReseauPublicMedia[] } | null>("modules/federation/mediaJobs:snapshot")
const STAGE = makeFunctionReference<"mutation", MediaLeaseArgs & { storageId: Id<"_storage">; index: number }, boolean>("modules/federation/mediaJobs:stage")
const COMPLETE = makeFunctionReference<"mutation", MediaLeaseArgs, boolean>("modules/federation/mediaJobs:complete")
const WITHDRAW_PAGE = makeFunctionReference<"mutation", { pageMirrorId: Id<"mirrors">; revision: number; cursor: string | null; withdrawnAt: number }, null>("modules/federation/withdrawal:continuePageWithdrawal")

beforeEach(() => {
  // Les jobs restent en attente : aucune action de téléchargement ni analyse n'est lancée par ces scénarios.
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.stubEnv("FEDERATION_ENVIRONMENT", "sandbox")
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function pageEnvelope(overrides: Record<string, FederationJson> = {}, objectRef = PAGE_REF): FederationEnvelope {
  return {
    eventId: `page-fixture-${objectRef}`, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef,
    payload: { type: "page.upserted", orgRef: objectRef, revision: 1, name: "Direction de recette", country: "GA", verifiedAt: T0 - 1000, ...overrides },
  }
}

function postEnvelope(overrides: Record<string, FederationJson> = {}, objectRef = POST_REF): FederationEnvelope {
  return {
    eventId: `post-fixture-${objectRef}`, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef,
    payload: { type: "post.published", postRef: objectRef, pageRef: PAGE_REF, revision: 1, body: "Communiqué public #recette", audience: "public", publishToAntsia: true, media: [], publishedAt: T0 - 500, ...overrides },
  }
}

function removedEnvelope(revision = 2): FederationEnvelope {
  return { eventId: `post-fixture-removed-${revision}`, contract: RESEAU_PUBLIC_CONTRACT, version: 1, objectRef: POST_REF, payload: { type: "post.removed", postRef: POST_REF, revision } }
}

async function apply(f: Fixture, envelope = postEnvelope(), now = T0, emitterId = f.emitterId) {
  return await f.t.run(async (ctx) => {
    const emitter = await ctx.db.get(emitterId)
    if (!emitter) throw new Error("Émetteur de fixture absent")
    return await applyFederationEnvelope(ctx, emitter, envelope, now)
  })
}

async function fixture(withPage = true): Promise<Fixture> {
  const t = testConvex({ automaticSessions: false })
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const ids = await t.run(async (ctx) => {
    const administration = await ctx.db.insert("networks", {
      slug: "administration", name: "Administration de recette", kind: "closed", parentId: root,
      membershipPolicy: "mirror", defaultVisibility: "network", reachValues: [],
      theme: "antsia", status: "active", createdAt: T0, updatedAt: T0,
    })
    const emitterId = await ctx.db.insert("federationEmitters", {
      networkId: administration, slug: RESEAU_PUBLIC_EMITTER, environment: "sandbox", enabled: true,
      keyEnvName: "ANTSIA_FEDERATION_RESEAU_PUBLIC_TEST_KEY", allowedContracts: [RESEAU_PUBLIC_CONTRACT],
      revision: 1, createdAt: T0, updatedAt: T0,
    })
    return { administration, emitterId }
  })
  const f = { t, root, ...ids }
  if (withPage && !(await apply(f, pageEnvelope())).applied) throw new Error("Page de fixture refusée")
  return f
}

async function member(f: Fixture, handle = "lecteur.pa9b") {
  const subject = `pa9b-${handle}`
  const sessionId = await createTestSession(f.t, subject)
  const as = f.t.withIdentity({ subject, sessionId })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: "Lecteur de recette" })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: f.root })
  return { as, personId }
}

async function objectState(f: Fixture, objectRef = POST_REF) {
  return await f.t.run(async (ctx) => {
    const mirror = await ctx.db.query("mirrors").withIndex("by_emitter_environment_object", (q) => q.eq("emitterId", f.emitterId).eq("environment", "sandbox").eq("objectRef", objectRef)).unique()
    const postId = mirror?.localId ? ctx.db.normalizeId("posts", mirror.localId) : null
    return { mirror, post: postId ? await ctx.db.get(postId) : null }
  })
}

async function publication(f: Fixture) {
  const state = await objectState(f)
  if (!state.mirror || !state.post) throw new Error("Publication de fixture absente")
  return { mirror: state.mirror, post: state.post }
}

async function copies(f: Fixture) {
  return await f.t.run(async (ctx) => ({
    posts: await ctx.db.query("posts").take(50),
    mirrors: await ctx.db.query("mirrors").take(50),
    people: await ctx.db.query("persons").take(50),
    memberships: await ctx.db.query("networkMemberships").take(50),
    identities: await ctx.db.query("identityLinks").take(50),
    signatories: await ctx.db.query("pageSignatories").take(50),
    receipts: await ctx.db.query("federationInboxReceipts").take(50),
    deadLetters: await ctx.db.query("federationDeadLetters").take(50),
  }))
}

async function engagement(f: Fixture, postId: Id<"posts">) {
  return await f.t.run(async (ctx) => ({
    reactions: await ctx.db.query("postReactions").withIndex("by_post_and_person", (q) => q.eq("postId", postId)).take(20),
    shards: await ctx.db.query("postReactionShards").withIndex("by_post_and_shard", (q) => q.eq("postId", postId)).take(8),
    comments: await ctx.db.query("postComments").withIndex("by_post_parent_status_createdAt", (q) => q.eq("postId", postId)).take(20),
    marks: await ctx.db.query("postMarks").withIndex("by_post_and_kind", (q) => q.eq("postId", postId)).take(20),
  }))
}

async function codeOf(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("PA9B — publications administratives dans la table posts", () => {
  it("crée un reflet de page sans personne, identité, adhésion ou signataire technique", async () => {
    const f = await fixture()
    const before = await copies(f)
    expect(await apply(f)).toEqual({ applied: true })
    const { post, mirror } = await publication(f)
    const after = await copies(f)
    expect(post).toMatchObject({
      networkId: f.administration, body: "Communiqué public #recette", tags: ["recette"],
      audience: "public", visibility: "root", onRoot: true, status: "published", country: "GA",
      federationSource: { emitterId: f.emitterId, objectRef: POST_REF }, publishedAt: T0 - 500, createdAt: T0,
    })
    expect(post.authorPersonId).toBeUndefined()
    expect(post.pageId).toBeDefined()
    expect(mirror).toMatchObject({ localTable: "posts", localId: post._id, parentObjectRef: PAGE_REF, parentSourceRevision: 1, sourceRevision: 1, sourceState: "active" })
    expect(after.posts).toHaveLength(1)
    expect(after.people).toEqual(before.people)
    expect(after.memberships).toEqual(before.memberships)
    expect(after.identities).toEqual(before.identities)
    expect(after.signatories).toEqual(before.signatories)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toMatchObject({ id: post._id, author: { kind: "page", displayName: "Direction de recette" }, media: [] })
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, post.pageId!))).toBe(1)
  })

  it("met à jour le même identifiant et la même date en conservant réactions, commentaires, relais et marques locaux", async () => {
    const f = await fixture()
    await apply(f)
    const reader = await member(f)
    const original = await publication(f)
    await reader.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: f.root, postId: original.post._id, kind: "like" })
    await reader.as.mutation(api.modules.engagement.engagement.comment, { networkId: f.root, postId: original.post._id, body: "Commentaire local conservé" })
    await reader.as.mutation(api.modules.marks.marks.toggleMark, { networkId: f.root, postId: original.post._id, kind: "bookmark" })
    const share = await reader.as.mutation(POSTS.publish, { networkId: f.root, body: "Relais local conservé", sharedPostId: original.post._id, alsoOnRoot: true })
    const before = await engagement(f, original.post._id)
    const shareBefore = await f.t.run(async (ctx) => ctx.db.get(share.postId))
    expect(await apply(f, postEnvelope({ revision: 2, body: "Communiqué actualisé #nouveau" }), T0 + 10_000)).toEqual({ applied: true })
    const after = await publication(f)
    expect(after.post).toMatchObject({ _id: original.post._id, publishedAt: original.post.publishedAt, createdAt: original.post.createdAt, body: "Communiqué actualisé #nouveau", tags: ["nouveau"], editedAt: T0 + 10_000 })
    expect(after.mirror).toMatchObject({ _id: original.mirror._id, sourceRevision: 2, localId: original.post._id })
    expect(await engagement(f, original.post._id)).toEqual(before)
    expect(await f.t.run(async (ctx) => ctx.db.get(share.postId))).toEqual(shareBefore)
    // Le DTO membre garde un objet auteur NEUTRE, identifiant nul, sans aucune donnée de personne (ADR-0014 §1, docs/16).
    const neutralAuthor = { personId: null, handle: null, displayName: null, headline: null, avatarUrl: null, badges: [] }
    expect(await reader.as.query(POSTS.getPost, { networkId: f.root, postId: original.post._id })).toMatchObject({ author: neutralAuthor, isMine: false, reactions: { total: 1, mine: "like" }, commentCount: 1, shareCount: 1, viewer: { bookmarked: true } })
    expect(await reader.as.query(POSTS.getPost, { networkId: f.root, postId: share.postId })).toMatchObject({ share: { available: true, body: "Communiqué actualisé #nouveau" } })
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, original.post.pageId!))).toBe(1)
  })

  it("dédoublonne une même révision, ignore une ancienne et refuse une contradiction sans copie supplémentaire", async () => {
    const f = await fixture()
    await apply(f, postEnvelope({ revision: 2 }))
    const before = await copies(f)
    expect(await apply(f, { ...postEnvelope({ revision: 2 }), eventId: "autre-livraison" }, T0 + 10_000)).toEqual({ applied: true })
    expect(await apply(f, postEnvelope({ revision: 1, body: "Ancien corps" }), T0 + 20_000)).toEqual({ applied: true })
    expect(await apply(f, postEnvelope({ revision: 2, body: "Corps contradictoire" }), T0 + 30_000)).toEqual({ applied: false, reason: "source_conflict" })
    expect(await copies(f)).toEqual(before)
  })

  it("refuse les gestes natifs, même si une personne est greffée sur un reflet", async () => {
    const f = await fixture()
    await apply(f)
    const reader = await member(f)
    const { post } = await publication(f)
    expect(hasNativePostAuthor(post)).toBe(false)
    expect(await codeOf(f.t.run(async () => requireNativePostAuthor(post)))).toBe("notFound")
    for (const operation of [
      () => reader.as.mutation(POSTS.edit, { networkId: f.root, postId: post._id, body: "Édition native interdite" }),
      () => reader.as.mutation(POSTS.remove, { networkId: f.root, postId: post._id }),
      () => reader.as.mutation(POSTS.withdrawFromRoot, { networkId: f.root, postId: post._id }),
    ]) expect(await codeOf(operation())).toBe("notFound")
    await f.t.run(async (ctx) => ctx.db.patch(post._id, { authorPersonId: reader.personId }))
    const forged = await publication(f)
    expect(hasNativePostAuthor(forged.post)).toBe(false)
    expect(await codeOf(f.t.run(async () => requireNativePostAuthor(forged.post)))).toBe("notFound")
    expect(await codeOf(reader.as.mutation(POSTS.withdrawFromRoot, { networkId: f.root, postId: post._id }))).toBe("notFound")
    expect((await publication(f)).post).toMatchObject({ body: post.body, status: "published", visibility: "root" })
  })
})

describe("PA9B — retraits source et décisions locales", () => {
  it("retire le corps et les médias importés, garde la tombe et ferme les relais sans effacer leur parole locale", async () => {
    const f = await fixture()
    await apply(f)
    const reader = await member(f)
    const { post } = await publication(f)
    await reader.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: f.root, postId: post._id, kind: "bravo" })
    await reader.as.mutation(api.modules.engagement.engagement.comment, { networkId: f.root, postId: post._id, body: "Réponse locale" })
    const share = await reader.as.mutation(POSTS.publish, { networkId: f.root, body: "Mon commentaire sur le communiqué", sharedPostId: post._id, alsoOnRoot: true })
    const before = await engagement(f, post._id)
    const storageId = await f.t.run(async (ctx) => {
      const blob = new Blob(["média importé de fixture"], { type: "image/png" })
      const id = await ctx.storage.store(blob)
      await ctx.db.insert("fileScans", { storageId: id, source: "post_media", networkId: f.administration, status: "pending", requiresFullScan: true, attempts: 0, createdAt: T0, updatedAt: T0 })
      await ctx.db.patch(post._id, { media: [{ storageId: id, kind: "image", mimeType: "image/png", sizeBytes: blob.size }] })
      return id
    })
    expect(await apply(f, removedEnvelope(), T0 + 10_000)).toEqual({ applied: true })
    const after = await publication(f)
    expect(after.post).toMatchObject({ _id: post._id, body: "", searchText: "", status: "removed", removedAt: T0 + 10_000 })
    expect(after.post.tags).toBeUndefined()
    expect(after.post.media).toBeUndefined()
    expect(after.post.federationMedia).toBeUndefined()
    expect(after.mirror).toMatchObject({ localId: post._id, sourceRevision: 2, sourceState: "withdrawn" })
    expect(await f.t.run(async (ctx) => ctx.storage.get(storageId))).toBeNull()
    expect(await f.t.run(async (ctx) => ctx.db.query("fileScans").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).unique())).toBeNull()
    expect(await engagement(f, post._id)).toEqual(before)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: share.postId })).toMatchObject({ body: "Mon commentaire sur le communiqué", shared: { available: false } })
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, post.pageId!))).toBe(0)
  })

  it("conserve un retrait reçu avant toute création et rend sa référence définitivement non republiable", async () => {
    const f = await fixture(false)
    expect(await apply(f, removedEnvelope(3))).toEqual({ applied: true })
    const tombstone = await objectState(f)
    expect(tombstone.post).toBeNull()
    expect(tombstone.mirror).toMatchObject({ sourceRevision: 3, sourceState: "withdrawn", localTable: "posts" })
    expect(tombstone.mirror?.localId).toBeUndefined()
    expect(await apply(f, pageEnvelope())).toEqual({ applied: true })
    expect(await apply(f, postEnvelope({ revision: 2 }))).toEqual({ applied: true })
    expect(await apply(f, postEnvelope({ revision: 4 }))).toEqual({ applied: false, reason: "source_conflict" })
    expect(await objectState(f)).toEqual(tombstone)
    const newRef = "publication:nouveau-communique"
    expect(await apply(f, postEnvelope({}, newRef))).toEqual({ applied: true })
    expect((await objectState(f, newRef)).post).toMatchObject({ federationSource: { objectRef: newRef }, status: "published" })
  })

  it("fait primer une source retirée sur un statut local de publication rétabli", async () => {
    const f = await fixture()
    await apply(f)
    const reader = await member(f)
    const { post } = await publication(f)
    await apply(f, removedEnvelope())
    await f.t.run(async (ctx) => ctx.db.patch(post._id, { status: "published", removedAt: undefined, body: "Corps local rétabli abusivement" }))
    expect(await f.t.run(async (ctx) => isFederatedContentAvailable(ctx, "posts", post._id))).toBe(false)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    expect(await codeOf(reader.as.query(POSTS.getPost, { networkId: f.root, postId: post._id }))).toBe("notFound")
  })

  it("ferme les publications dès le retrait de leur page, même réactivée localement, puis purge leur corps par la cascade", async () => {
    const f = await fixture()
    await apply(f)
    const reader = await member(f)
    const { post } = await publication(f)
    if (!post.pageId) throw new Error("Page de publication absente")
    expect(await apply(f, pageEnvelope({ revision: 2, verifiedAt: null }), T0 + 10_000)).toEqual({ applied: true })
    await f.t.run(async (ctx) => ctx.db.patch(post.pageId!, { status: "active", trust: "official", trustRank: 2, visibility: "root", onRoot: true }))
    expect((await publication(f)).post.status).toBe("published")
    expect(await f.t.run(async (ctx) => isFederatedContentAvailable(ctx, "posts", post._id))).toBe(false)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    expect(await codeOf(reader.as.query(POSTS.getPost, { networkId: f.root, postId: post._id }))).toBe("notFound")
    const parent = await f.t.run(async (ctx) => ctx.db.query("mirrors").withIndex("by_local", (q) => q.eq("localTable", "pages").eq("localId", post.pageId!)).unique())
    if (!parent) throw new Error("Miroir de page absent")
    await f.t.mutation(WITHDRAW_PAGE, { pageMirrorId: parent._id, revision: 2, cursor: null, withdrawnAt: T0 + 10_000 })
    expect((await publication(f)).post).toMatchObject({ status: "removed", body: "", searchText: "" })
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, post.pageId!))).toBe(0)
  })

  it("ne sert jamais anonymement une prélecture sans propriétaire personne et la conserve après une nouvelle version source", async () => {
    const f = await fixture()
    const policyId = await f.t.run(async (ctx) => ctx.db.insert("moderationPolicies", { networkId: f.administration, surface: "post", preReview: true, maxLinks: 20, maxWrites: 100, windowMs: 60_000, updatedAt: T0 }))
    await apply(f)
    const { post } = await publication(f)
    const moderation = await f.t.run(async (ctx) => contentState(ctx, "post", post._id))
    expect(moderation).toMatchObject({ status: "pending_review", ownerPageId: post.pageId })
    expect(moderation?.ownerPersonId).toBeUndefined()
    expect(await f.t.run(async (ctx) => canReadModeratedContent(ctx, "post", post._id))).toBe(false)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    await f.t.run(async (ctx) => ctx.db.patch(policyId, { preReview: false }))
    expect(await apply(f, postEnvelope({ revision: 2, body: "Nouveau texte sans mot bloqué" }))).toEqual({ applied: true })
    expect(await f.t.run(async (ctx) => contentState(ctx, "post", post._id))).toMatchObject({ status: "pending_review", ownerPageId: post.pageId })
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, post.pageId!))).toBe(0)
  })

  it("ne lève jamais une décision locale removed après une nouvelle révision source", async () => {
    const f = await fixture()
    await apply(f)
    const { post } = await publication(f)
    await f.t.run(async (ctx) => {
      await setContentModerationStatus(ctx, { networkId: f.administration, kind: "post", id: post._id }, "removed")
      await markPostRemoved(ctx, post, T0 + 1000)
    })
    expect(await apply(f, postEnvelope({ revision: 2, body: "Version source corrigée" }), T0 + 10_000)).toEqual({ applied: true })
    const after = await publication(f)
    expect(after.post).toMatchObject({ _id: post._id, status: "removed", removedAt: T0 + 1000 })
    expect(after.mirror).toMatchObject({ sourceState: "active", sourceRevision: 2 })
    expect(await f.t.run(async (ctx) => contentState(ctx, "post", post._id))).toMatchObject({ status: "removed" })
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
    expect(await f.t.run(async (ctx) => countPagePosts(ctx, post.pageId!))).toBe(0)
  })

  it("conserve le manifeste média d'une nouvelle révision sous retrait local sans inventer de personne", async () => {
    const f = await fixture()
    await apply(f)
    const { post } = await publication(f)
    const before = await copies(f)
    await f.t.run(async (ctx) => {
      await setContentModerationStatus(ctx, { networkId: f.administration, kind: "post", id: post._id }, "removed")
      await markPostRemoved(ctx, post, T0 + 1000)
    })
    expect(await apply(f, postEnvelope({ revision: 2, body: "Version source avec média retenu", media: [IMAGE] }), T0 + 10_000)).toEqual({ applied: true })
    const after = await publication(f)
    expect(after.post).toMatchObject({ _id: post._id, status: "removed", removedAt: T0 + 1000, federationMedia: { status: "pending", items: [{ kind: "image", mimeType: "image/png", altText: IMAGE.altText }] } })
    expect(after.post.authorPersonId).toBeUndefined()
    expect(after.post.media).toBeUndefined()
    expect(after.mirror).toMatchObject({ localId: post._id, sourceState: "active", sourceRevision: 2, mediaStatus: "pending", mediaAttempts: 0, mediaManifest: [IMAGE] })
    expect(after.mirror.mediaLeaseToken).toBeUndefined()
    expect(await f.t.run(async (ctx) => contentState(ctx, "post", post._id))).toMatchObject({ status: "removed" })
    const copiesAfter = await copies(f)
    expect(copiesAfter.people).toEqual(before.people)
    expect(copiesAfter.memberships).toEqual(before.memberships)
    expect(await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: post._id })).toBeNull()
  })
})

describe("PA9B — frontières de contrat et de provenance", () => {
  it.each(["audience_organisation", "geste_absent"] as const)("refuse %s au parseur avant toute copie", async (scenario) => {
    const f = await fixture()
    const event = postEnvelope(scenario === "audience_organisation" ? { audience: "organisation" } : {})
    if (scenario === "geste_absent") delete (event.payload as Record<string, FederationJson>).publishToAntsia
    const before = await copies(f)
    expect(await validImplementedFederationPayload(event, T0)).toBe(false)
    expect(await apply(f, event)).toEqual({ applied: false, reason: "invalid_payload" })
    expect(await copies(f)).toEqual(before)
  })

  it("refuse une page inconnue et une page reçue sous un autre émetteur/environnement", async () => {
    const f = await fixture()
    const otherEmitter = await f.t.run(async (ctx) => ctx.db.insert("federationEmitters", {
      networkId: f.administration, slug: RESEAU_PUBLIC_EMITTER, environment: "production", enabled: true,
      keyEnvName: "ANTSIA_FEDERATION_RESEAU_PUBLIC_OTHER_KEY", allowedContracts: [RESEAU_PUBLIC_CONTRACT], revision: 1, createdAt: T0, updatedAt: T0,
    }))
    const before = await copies(f)
    expect(await apply(f, postEnvelope({ pageRef: "administration:inconnue" }))).toEqual({ applied: false, reason: "contract_not_allowed" })
    expect(await apply(f, postEnvelope(), T0, otherEmitter)).toEqual({ applied: false, reason: "contract_not_allowed" })
    await f.t.run(async (ctx) => ctx.db.patch(otherEmitter, { slug: "autre-source", environment: "sandbox" }))
    expect(await apply(f, postEnvelope(), T0, otherEmitter)).toEqual({ applied: false, reason: "contract_not_allowed" })
    expect(await copies(f)).toEqual(before)
  })

  it("refuse de déplacer un reflet vers une autre page ou de modifier sa date de publication", async () => {
    const f = await fixture()
    await apply(f)
    const otherPageRef = "administration:autre-direction"
    expect(await apply(f, pageEnvelope({ name: "Autre direction" }, otherPageRef))).toEqual({ applied: true })
    const before = await copies(f)
    expect(await apply(f, postEnvelope({ revision: 2, pageRef: otherPageRef }))).toEqual({ applied: false, reason: "source_conflict" })
    expect(await apply(f, postEnvelope({ revision: 2, publishedAt: T0 - 499 }))).toEqual({ applied: false, reason: "source_conflict" })
    expect(await copies(f)).toEqual(before)
  })
})

describe("PA9B — manifeste média et révision des jobs", () => {
  it("expose un emplacement retenu sans URL distante et rend l'ancien bail incapable de rattacher un média après révision", async () => {
    const f = await fixture()
    expect(await apply(f, postEnvelope({ media: [IMAGE] }))).toEqual({ applied: true })
    const initial = await publication(f)
    expect(initial.post.media).toBeUndefined()
    expect(initial.post.federationMedia).toEqual({ status: "pending", items: [{ kind: "image", mimeType: "image/png", altText: "Image du communiqué" }] })
    expect(initial.mirror).toMatchObject({ mediaStatus: "pending", mediaAttempts: 0, mediaManifest: [IMAGE] })
    const dto = await f.t.query(PUBLIC.getPost, { networkId: f.root, postId: initial.post._id })
    expect(dto).toMatchObject({ media: [{ url: null, withheld: "fileScanPending", kind: "image", mimeType: "image/png" }] })
    expect(JSON.stringify(dto)).not.toContain(IMAGE.url)
    if (!initial.mirror.sourceDigest) throw new Error("Digest média absent")
    const oldArgs = { mirrorId: initial.mirror._id, revision: 1, digest: initial.mirror.sourceDigest }
    const lease = await f.t.mutation(CLAIM, oldArgs)
    expect(lease).not.toBeNull()
    if (!lease) throw new Error("Bail de fixture refusé")
    const oldLease = { ...oldArgs, leaseToken: lease.leaseToken }
    expect(await f.t.query(SNAPSHOT, oldLease)).toEqual({ manifest: [IMAGE] })
    expect(await apply(f, postEnvelope({ revision: 2, body: "Version désormais sans média", media: [] }), T0 + 10_000)).toEqual({ applied: true })
    const current = await publication(f)
    expect(current.post).toMatchObject({ _id: initial.post._id, body: "Version désormais sans média" })
    expect(current.post.federationMedia).toBeUndefined()
    expect(current.mirror.mediaManifest).toBeUndefined()
    expect(await f.t.query(SNAPSHOT, oldLease)).toBeNull()
    expect(await f.t.mutation(COMPLETE, oldLease)).toBe(false)
    expect(await f.t.mutation(CLAIM, oldArgs)).toBeNull()
    const provisional = await f.t.run(async (ctx) => ctx.storage.store(new Blob(["octets du job périmé"], { type: "image/png" })))
    expect(await f.t.mutation(STAGE, { ...oldLease, storageId: provisional, index: 0 })).toBe(false)
    expect(await f.t.run(async (ctx) => ctx.storage.get(provisional))).toBeNull()
    expect(await publication(f)).toEqual(current)
  })
})
