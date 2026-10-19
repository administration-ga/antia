/** PA9B : publications de la page source, sans personne technique ni adoption locale. */
import { RESEAU_PUBLIC_CONTRACT } from "@antsia/social-domain/federationProtocol"
import type { ReseauPublicPostPublishedEvent, ReseauPublicPostRemovedEvent } from "@antsia/social-domain/reseauPublic"
import { extractHashtags } from "@antsia/social-domain/richText"
import { buildSearchableText } from "@antsia/social-domain/searchText"
import type { Doc } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { moderateFederatedPostWrite } from "../moderation/policy"
import { enqueueFanout } from "../notifications/fanout"
import { markPostRemoved } from "../posts/contentRemoval"
import { schedulePostFeed } from "../posts/feedMaterialization"
import { recordPagePost, unrecordPagePost } from "../posts/counters"
import { clearFederatedMedia, queueFederatedMedia, retryFederatedMedia } from "./mediaJobs"
import { isFederatedContentAvailable } from "./mirrorAccess"
import type { FederationApplyResult } from "./reseauPublic"
import { federationBodyDigest } from "./signature"

export async function applyAdministrativePost(ctx: MutationCtx, emitter: Doc<"federationEmitters">, network: Doc<"networks">, event: ReseauPublicPostPublishedEvent | ReseauPublicPostRemovedEvent, now: number): Promise<FederationApplyResult> {
  const mirror = await ctx.db.query("mirrors").withIndex("by_emitter_environment_object", (q) => q.eq("emitterId", emitter._id).eq("environment", emitter.environment).eq("objectRef", event.postRef)).unique()
  const digest = await federationBodyDigest(JSON.stringify(event))
  if (mirror) {
    if (mirror.networkId !== network._id || mirror.contract !== RESEAU_PUBLIC_CONTRACT || mirror.localTable !== "posts" || !mirror.sourceRevision || !mirror.sourceDigest || !mirror.sourceState) return { applied: false, reason: "source_conflict" }
    if (event.revision < mirror.sourceRevision) return { applied: true }
    if (event.revision === mirror.sourceRevision) {
      if (mirror.sourceDigest !== digest) return { applied: false, reason: "source_conflict" }
      await retryFederatedMedia(ctx, mirror)
      return { applied: true }
    }
    // Un retrait de publication est définitif pour sa référence ; une nouvelle publication exige une autre référence.
    if (mirror.sourceState === "withdrawn" && event.type === "post.published") return { applied: false, reason: "source_conflict" }
  }
  const postId = mirror?.localId ? ctx.db.normalizeId("posts", mirror.localId) : null
  const post = postId ? await ctx.db.get(postId) : null
  if (mirror?.localId && (!post || post.networkId !== network._id || post.authorPersonId !== undefined || post.federationSource?.emitterId !== emitter._id || post.federationSource.objectRef !== event.postRef || !post.pageId)) return { applied: false, reason: "source_conflict" }
  if (event.type === "post.removed") {
    if (mirror) await clearFederatedMedia(ctx, mirror)
    if (post) {
      await markPostRemoved(ctx, post, now)
      await ctx.db.patch(post._id, { body: "", searchText: "", tags: undefined, mentionedPersonIds: undefined, federationMedia: undefined })
    }
    const source = { sourceRevision: event.revision, sourceDigest: digest, sourceState: "withdrawn" as const, updatedAt: now }
    if (mirror) await ctx.db.patch(mirror._id, source)
    else await ctx.db.insert("mirrors", { networkId: network._id, emitterId: emitter._id, environment: emitter.environment, contract: RESEAU_PUBLIC_CONTRACT, objectRef: event.postRef, localTable: "posts", ...source })
    return { applied: true }
  }
  const parent = await ctx.db.query("mirrors").withIndex("by_emitter_environment_object", (q) => q.eq("emitterId", emitter._id).eq("environment", emitter.environment).eq("objectRef", event.pageRef)).unique()
  const pageId = parent?.localId ? ctx.db.normalizeId("pages", parent.localId) : null
  const page = pageId ? await ctx.db.get(pageId) : null
  if (!parent || parent.networkId !== network._id || parent.contract !== RESEAU_PUBLIC_CONTRACT || parent.localTable !== "pages" || parent.sourceState !== "active" || !parent.sourceRevision || !page || page.networkId !== network._id || page.ownerKind !== "institution" || page.status !== "active" || page.trust !== "official" || page.visibility !== "root" || !page.onRoot || !(await isFederatedContentAvailable(ctx, "pages", page._id))) return { applied: false, reason: "contract_not_allowed" }
  if (post && (post.pageId !== page._id || mirror?.parentObjectRef !== event.pageRef || post.publishedAt !== event.publishedAt)) return { applied: false, reason: "source_conflict" }
  if (mirror) await clearFederatedMedia(ctx, mirror)
  const tags = extractHashtags(event.body)
  const content = {
    body: event.body, tags: tags.length > 0 ? tags : undefined,
    searchText: buildSearchableText(event.body, tags.join(" ")),
    country: page.country, updatedAt: now,
    ...(event.media.length > 0 ? { federationMedia: { status: "pending" as const, items: event.media.map(({ kind, mimeType, width, height, durationMs, altText }) => ({ kind, mimeType, ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), ...(durationMs === undefined ? {} : { durationMs }), ...(altText === undefined ? {} : { altText }) })) } } : {}),
  }
  let localId = post?._id
  if (post) await ctx.db.patch(post._id, { ...content, editedAt: now })
  else localId = await ctx.db.insert("posts", {
    networkId: network._id, pageId: page._id, federationSource: { emitterId: emitter._id, objectRef: event.postRef },
    ...content, audience: "public", visibility: "root", onRoot: true, status: "published", publishedAt: event.publishedAt, createdAt: now,
  })
  if (!localId) throw new Error("Federated post insertion failed")
  const source = { localId, parentObjectRef: event.pageRef, parentSourceRevision: parent.sourceRevision, sourceRevision: event.revision, sourceDigest: digest, sourceState: "active" as const, updatedAt: now }
  let mirrorId = mirror?._id
  if (mirrorId) await ctx.db.patch(mirrorId, source)
  else mirrorId = await ctx.db.insert("mirrors", { networkId: network._id, emitterId: emitter._id, environment: emitter.environment, contract: RESEAU_PUBLIC_CONTRACT, objectRef: event.postRef, localTable: "posts", ...source })
  const admitted = await moderateFederatedPostWrite(ctx, { networkId: network._id, pageId: page._id, id: localId, text: event.body })
  const counted = { _id: localId, pageId: page._id, publishedAt: event.publishedAt }
  if (admitted && (!post || post.status === "published")) {
    await schedulePostFeed(ctx, localId)
    await recordPagePost(ctx, counted)
    if (!post) await enqueueFanout(ctx, { networkId: network._id, kind: "page_post", subject: { post: localId }, source: { kind: "pageFollowers", postId: localId } })
  } else await unrecordPagePost(ctx, counted)
  // Le manifeste reste durable même sous modération : sa reprise attendra un rétablissement local admis.
  if (event.media.length > 0) await queueFederatedMedia(ctx, mirrorId, event.revision, digest, event.media)
  return { applied: true }
}
