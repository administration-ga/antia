/** PA10 : admission vivante des candidats, indépendante de leur provenance. */
import { feedAdmissionFor, type FeedReason } from "@antsia/social-domain/content"
import { pageFeedAdmissionFor } from "@antsia/social-domain/pages"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isConnectedTo, isFollowingPerson } from "../graph/graph"
import { liveSignatoryRole } from "../pages/access"
import { isFollowingPage } from "../pages/follows"
import { canSeePostDoc, type ReaderContext } from "./access"
import { hasNativePostAuthor } from "./nativeAuthor"
import { effectiveMembershipStatus, getMembership, getRootNetwork } from "../../lib/access"

type ReadCtx = Pick<QueryCtx, "db">

/** Version privée : une adhésion réactivée ou une suspension échue impose un rattrapage. */
export async function feedAccessVersion(ctx: ReadCtx, reader: ReaderContext): Promise<string> {
  const root = reader.network.kind === "root" ? reader.network : await getRootNetwork(ctx)
  const [person, membership, rootMembership] = await Promise.all([
    ctx.db.get(reader.personId), getMembership(ctx, reader.network._id, reader.personId),
    root ? getMembership(ctx, root._id, reader.personId) : Promise.resolve(null),
  ])
  const version = (row: Doc<"networkMemberships"> | null) => row ? [row._id, row.status, row.statusChangedAt, row.suspendedUntil ?? null, effectiveMembershipStatus(row)] : null
  return JSON.stringify([person?.updatedAt ?? null, reader.network.updatedAt, root?.updatedAt ?? null, version(membership), version(rootMembership)])
}

/** Signal privé opaque : jamais les versions d'adhésion ou leurs identifiants dans le DTO. */
export async function feedPreparationKey(accessVersion: string, generation: number): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([accessVersion, generation]))))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
}

/** Le graphe peut être très grand : les paires exactes ferment les révocations immédiatement. */
export async function liveFeedReason(ctx: ReadCtx, reader: ReaderContext, post: Doc<"posts">, scope: "pour_vous" | "recents"): Promise<FeedReason | null> {
  if (post.status !== "published" || !await canSeePostDoc(ctx, reader, post)) return null
  if (post.pageId !== undefined) {
    const page = await ctx.db.get(post.pageId)
    if (!page || page.status !== "active") return null
    return pageFeedAdmissionFor({ scope, isSignatory: await liveSignatoryRole(ctx, page, reader.personId) !== null, isFollowedPage: await isFollowingPage(ctx, page._id, reader.personId), isRestrictedToFollowers: post.audience === "followers" })
  }
  if (!hasNativePostAuthor(post)) return null
  const isAuthor = post.authorPersonId === reader.personId
  const [isConnected, isFollowing] = isAuthor ? [false, false] : await Promise.all([
    isConnectedTo(ctx, reader.network._id, reader.personId, post.authorPersonId),
    isFollowingPerson(ctx, reader.network._id, reader.personId, post.authorPersonId),
  ])
  return feedAdmissionFor({ scope, isAuthor, isConnected, isFollowing, audience: post.audience })
}

/** Les gestes silencieux restent exacts, même au-delà des ensembles bornés du lecteur. */
export async function exactFeedHidden(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">, postId: Id<"posts">): Promise<boolean> {
  return await ctx.db.query("postMarks").withIndex("by_network_person_kind_post", q => q.eq("networkId", networkId).eq("personId", personId).eq("kind", "hidden").eq("postId", postId)).unique() !== null
}
export async function exactFeedMuted(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">, mutedPersonId: Id<"persons">): Promise<boolean> {
  return await ctx.db.query("mutes").withIndex("by_network_person_muted", q => q.eq("networkId", networkId).eq("personId", personId).eq("mutedPersonId", mutedPersonId)).unique() !== null
}
