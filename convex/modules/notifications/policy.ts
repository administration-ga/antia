/** PA5 — admission et relecture identiques avant le transport différé. */
import { isConsentInForce, type ConsentPurpose } from "@antsia/social-domain/consent"
import { notificationCategory } from "@antsia/social-domain/notificationDelivery"
import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { getMembership, isActiveMember, memberHasStatus } from "../../lib/access"
import { canSeeAlbum } from "../albums/access"
import { isBlockedBetween } from "../graph/graph"
import { liveMembershipOrNull } from "../groups/access"
import { directReplayAccessDecision, directSessionAccessDecision } from "../live/access"
import { canSeePostDoc } from "../posts/access"
import { deliveryPreferences } from "./preferences"

type ReadCtx = Pick<QueryCtx, "db">

export async function notificationConsent(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">, purpose: ConsentPurpose): Promise<boolean> {
  const rows = await ctx.db.query("consents").withIndex("by_person_and_purpose", (q) => q.eq("personId", personId).eq("purpose", purpose)).take(101)
  // Une troncature ne devient jamais un accord ; portée EXACTE du réseau.
  return rows.length <= 100 && isConsentInForce(rows.filter((row) => row.networkId === networkId), purpose)
}

/** Exception étroite : seule sa propre décision, aucun accès aux contenus du réseau. */
export async function moderationNoticeRecipient(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">, reportId: Id<"reports">): Promise<boolean> {
  const report = await ctx.db.get(reportId)
  const network = await ctx.db.get(networkId)
  const member = await getMembership(ctx, networkId, personId)
  const person = await ctx.db.get(personId)
  return !!report && report.networkId === networkId && report.ownerPersonId === personId
    && !!network && network.status === "active" && !!member && member.status !== "partie"
    && !!person && person.deletionRequestedAt === undefined
}

export async function notificationStillVisible(ctx: ReadCtx, row: Doc<"notifications">): Promise<boolean> {
  if (row.kind === "moderation_decision") return row.subjectReportId !== undefined && await moderationNoticeRecipient(ctx, row.networkId, row.recipientPersonId, row.subjectReportId)
  if (!(await isActiveMember(ctx, row.networkId, row.recipientPersonId))) return false
  const person = await ctx.db.get(row.recipientPersonId)
  if (!person || person.deletionRequestedAt !== undefined) return false
  if (row.actorPersonId && await isBlockedBetween(ctx, row.actorPersonId, row.recipientPersonId)) return false
  if (row.subjectPostId) {
    const post = await ctx.db.get(row.subjectPostId)
    const network = await ctx.db.get(row.networkId)
    return !!post && !!network && await canSeePostDoc(ctx, { personId: row.recipientPersonId, network }, post)
  }
  if (row.subjectAlbumId) {
    const album = await ctx.db.get(row.subjectAlbumId)
    return !!album && await canSeeAlbum(ctx, album, { personId: row.recipientPersonId, networkId: row.networkId })
  }
  if (row.subjectGroupThreadId) {
    const thread = await ctx.db.get(row.subjectGroupThreadId)
    return !!thread && thread.networkId === row.networkId && thread.deletingAt === undefined && !!await liveMembershipOrNull(ctx, thread._id, row.recipientPersonId)
  }
  if (row.subjectLiveSessionId) {
    const session = await ctx.db.get(row.subjectLiveSessionId)
    if (!session || session.networkId !== row.networkId) return false
    return row.kind === "live_replay_published" ? await directReplayAccessDecision(ctx, row.recipientPersonId, session) === "allowed" : await directSessionAccessDecision(ctx, row.recipientPersonId, session) === "allowed"
  }
  return true
}

export async function pushAllowed(ctx: ReadCtx, row: Doc<"notifications">): Promise<boolean> {
  if (!(await notificationStillVisible(ctx, row)) || !(await notificationConsent(ctx, row.networkId, row.recipientPersonId, "notifications"))) return false
  const prefs = await deliveryPreferences(ctx, row.networkId, row.recipientPersonId)
  return prefs.weeklyLimit > 0 && prefs.pushCategories[notificationCategory(row.kind)]
}

export async function incomingCallAllowed(ctx: ReadCtx, networkId: Id<"networks">, personId: Id<"persons">, callId: Id<"calls">): Promise<boolean> {
  const call = await ctx.db.get(callId)
  if (!call || call.networkId !== networkId || call.status !== "active" || (call.kind === "direct" && call.callStatus !== "ringing") || !(await memberHasStatus(ctx, networkId, personId, "declaree"))) return false
  if (await isBlockedBetween(ctx, call.createdByPersonId, personId)) return false
  const person = await ctx.db.get(personId)
  if (!person || person.deletionRequestedAt !== undefined) return false
  if (call.kind !== "direct") {
    const invite = await ctx.db.query("callInvites").withIndex("by_call_person", (q) => q.eq("callId", callId).eq("personId", personId)).unique()
    if (!invite || invite.status !== "ringing") return false
  } else if (call.calleePersonId !== personId) return false
  const prefs = await ctx.db.query("callPreferences").withIndex("by_person", (q) => q.eq("personId", personId)).unique()
  const delivery = await deliveryPreferences(ctx, networkId, personId)
  return prefs?.pushIncoming !== false && (!prefs?.dnd || prefs.dnd.until <= Date.now()) && delivery.weeklyLimit > 0 && delivery.pushCategories.calls && await notificationConsent(ctx, networkId, personId, "notifications")
}
