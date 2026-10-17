/** PA5 : dossiers polymorphes, compétence vivante, décisions et recours sans copie de contenu. */
import { assertDecisionReason, type AuditCapacity } from "@antsia/social-domain/audit"
import { normalizeBlockedTerm, validSanctionDuration } from "@antsia/social-domain/moderationPolicy"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { getMembership, getRootNetwork, isActiveMember } from "../../lib/access"
import { checked, fail, notFound } from "../../lib/errors"
import { networkMutation, networkQuery, operatorMutation, operatorQuery, personMutation, personQuery } from "../../lib/functions"
import { enforceRateLimit } from "../../lib/rateLimit"
import { notifyPerson } from "../notifications/notify"
import { liveSignatoryRole } from "../pages/access"
import { appendAudit, networkRoleCapacity, operatorCapacity } from "../platform/audit"
import { contentState } from "./policy"
import { refreshSuspension } from "./sanctions"
import { contentReportStatusValidator, moderationSurfaceValidator, moderationTargetValidator, sanctionKindValidator } from "./tables"
import { removeTarget, resolveVisibleTarget, restoreTarget } from "./targets"

type ReadCtx = Pick<QueryCtx, "db">
type NetworkActor = { networkId: Id<"networks">; person: Doc<"persons">; membership: Doc<"networkMemberships"> }

const motiveOf = (reason: string) => checked(() => assertDecisionReason(reason, 3))
const pageOptions = (opts: { cursor: string | null; numItems: number }) => ({ ...opts, numItems: Math.max(1, Math.min(50, opts.numItems)) })

export async function teamCapacity(ctx: ReadCtx, actor: NetworkActor, scope: string, teamId?: Id<"moderationTeams">): Promise<AuditCapacity | null> {
  if (actor.membership.role === "network_admin") return "network_admin"
  if (teamId === undefined) return networkRoleCapacity(actor.membership.role)
  const team = await ctx.db.get(teamId)
  if (!team || !team.active || team.networkId !== actor.networkId || (team.scope !== undefined && team.scope !== scope)) return null
  const member = await ctx.db.query("moderationTeamMembers").withIndex("by_team_person", (q) => q.eq("teamId", teamId).eq("personId", actor.person._id)).unique()
  return member?.active ? "network_moderator" : null
}

export async function requireReportCapacity(ctx: ReadCtx, actor: NetworkActor, row: Doc<"reports">): Promise<AuditCapacity | null> {
  return await teamCapacity(ctx, actor, row.targetKind, row.teamId)
}

async function requireNetworkAdmin(actor: NetworkActor): Promise<void> {
  if (actor.membership.role !== "network_admin") return notFound()
}

function queueDto(row: Doc<"reports">) {
  return { reportId: row._id, networkId: row.networkId, target: row.target, teamId: row.teamId ?? null, level: row.level, reason: row.reason, status: row.status, createdAt: row.createdAt, decisionReason: row.decisionReason ?? null }
}

/** Capacités vivantes pour l'entrée nationale, sans création de rôle ni divulgation des coéquipiers. */
export const myCapacity = networkQuery({
  minStatus: "declaree",
  args: {},
  returns: v.object({ networkWide: v.boolean(), canReviewAppeals: v.boolean(), teams: v.array(v.object({ teamId: v.id("moderationTeams"), name: v.string(), scope: v.union(moderationSurfaceValidator, v.null()) })) }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(101)
    if (rows.length > 100) return fail("policyRefused")
    const teams = []
    for (const team of rows) {
      const member = await ctx.db.query("moderationTeamMembers").withIndex("by_team_person", (q) => q.eq("teamId", team._id).eq("personId", ctx.person._id)).unique()
      if (ctx.membership.role === "network_admin" || member?.active) teams.push({ teamId: team._id, name: team.name, scope: team.scope ?? null })
    }
    return { networkWide: ctx.membership.role === "network_admin" || ctx.membership.role === "network_moderator", canReviewAppeals: ctx.membership.role === "network_admin", teams }
  },
})

export const report = networkMutation({
  minStatus: "en_attente",
  args: { target: moderationTargetValidator, reason: v.string() },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "report.create", ctx.person._id)
    const reason = args.reason.trim()
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(reason)) return fail("invalidArgument", { field: "reason" })
    const existing = await ctx.db.query("reports").withIndex("by_reporter_target", (q) => q.eq("reporterPersonId", ctx.person._id).eq("targetKind", args.target.kind).eq("targetId", args.target.id)).unique()
    if (existing) return { reportId: existing._id, created: false, hidden: true }
    const target = await resolveVisibleTarget(ctx, ctx.network, ctx.person._id, args.target)
    if (target.ownerPersonId === ctx.person._id) return notFound()
    const teams = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", target.networkId).eq("active", true)).take(101)
    if (teams.length > 100) return fail("policyRefused")
    const team = teams.find((row) => row.scope === args.target.kind) ?? teams.find((row) => row.scope === undefined)
    const now = Date.now()
    const reportId = await ctx.db.insert("reports", { ...target, targetKind: args.target.kind, targetId: args.target.id, reporterPersonId: ctx.person._id, reason, ...(team ? { teamId: team._id } : {}), level: team ? "team" : "network", status: "open", createdAt: now, updatedAt: now })
    return { reportId, created: true, hidden: true }
  },
})

export const createTeam = networkMutation({
  args: { name: v.string(), scope: v.optional(moderationSurfaceValidator), reason: v.string() },
  handler: async (ctx, args) => {
    await requireNetworkAdmin(ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const name = args.name.trim()
    if (name.length < 2 || name.length > 100) return fail("invalidArgument", { field: "name" })
    const reason = motiveOf(args.reason)
    const existing = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(100)
    if (existing.length >= 100) return fail("policyRefused")
    const teamId = await ctx.db.insert("moderationTeams", { networkId: ctx.networkId, name, ...(args.scope ? { scope: args.scope } : {}), active: true, createdAt: Date.now() })
    await appendAudit(ctx, { action: "moderation.team_create", capacity: "network_admin", actorPersonId: ctx.person._id, networkId: ctx.networkId, subject: { table: "moderationTeams", id: teamId }, details: { reason, scope: args.scope ?? null } })
    return { teamId }
  },
})

export const setTeamMember = networkMutation({
  args: { teamId: v.id("moderationTeams"), personId: v.id("persons"), active: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    await requireNetworkAdmin(ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const reason = motiveOf(args.reason)
    const team = await ctx.db.get(args.teamId)
    if (!team || team.networkId !== ctx.networkId || !team.active || (args.active && !(await isActiveMember(ctx, ctx.networkId, args.personId)))) return notFound()
    const member = await ctx.db.query("moderationTeamMembers").withIndex("by_team_person", (q) => q.eq("teamId", team._id).eq("personId", args.personId)).unique()
    if (member) await ctx.db.patch(member._id, { active: args.active, updatedAt: Date.now() })
    else await ctx.db.insert("moderationTeamMembers", { networkId: ctx.networkId, teamId: team._id, personId: args.personId, active: args.active, updatedAt: Date.now() })
    await appendAudit(ctx, { action: "moderation.team_member_set", capacity: "network_admin", actorPersonId: ctx.person._id, networkId: ctx.networkId, subject: { table: "moderationTeams", id: team._id }, details: { reason, personId: args.personId, active: args.active } })
    return null
  },
})

export const paginateQueue = networkQuery({
  args: { teamId: v.optional(v.id("moderationTeams")), status: v.optional(contentReportStatusValidator), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId)
      if (!team || !(await teamCapacity(ctx, ctx, team.scope ?? "", team._id))) return notFound()
    } else if (!networkRoleCapacity(ctx.membership.role)) return notFound()
    const result = args.teamId
      ? await ctx.db.query("reports").withIndex("by_team_status_createdAt", (q) => q.eq("teamId", args.teamId).eq("status", args.status ?? "open")).paginate(pageOptions(args.paginationOpts))
      : await ctx.db.query("reports").withIndex("by_network_status_createdAt", (q) => q.eq("networkId", ctx.networkId).eq("status", args.status ?? "open")).paginate(pageOptions(args.paginationOpts))
    const page = []
    for (const row of result.page) if (await teamCapacity(ctx, ctx, row.targetKind, row.teamId)) page.push(queueDto(row))
    return { ...result, page }
  },
})

export const paginatePlatformQueue = operatorQuery({
  args: { networkId: v.optional(v.id("networks")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = args.networkId
      ? await ctx.db.query("appeals").withIndex("by_network_status_createdAt", (q) => q.eq("networkId", args.networkId as Id<"networks">).eq("status", "open")).paginate(pageOptions(args.paginationOpts))
      : await ctx.db.query("appeals").withIndex("by_level_status_createdAt", (q) => q.eq("level", "platform").eq("status", "open")).paginate(pageOptions(args.paginationOpts))
    return { ...page, page: page.page.filter((row) => row.level === "platform").map((row) => ({ appealId: row._id, reportId: row.reportId, networkId: row.networkId, status: row.status, reason: row.reason, createdAt: row.createdAt })) }
  },
})

const sanctionInput = v.object({ kind: sanctionKindValidator, until: v.optional(v.number()) })

async function applyDecision(ctx: MutationCtx, row: Doc<"reports">, actorPersonId: Id<"persons">, capacity: AuditCapacity, decision: "dismissed" | "actioned", reason: string, sanctions: { kind: Doc<"sanctions">["kind"]; until?: number }[]) {
  if (row.status !== "open" && row.status !== "reviewing") return fail("conflict")
  if (sanctions.length > 5 || new Set(sanctions.map((item) => item.kind)).size !== sanctions.length || (decision === "dismissed" && sanctions.length > 0)) return fail("invalidArgument", { field: "sanctions" })
  const now = Date.now()
  for (const item of sanctions) if (!validSanctionDuration(item.kind, item.until, now)) return fail("invalidArgument", { field: "until" })
  if (row.ownerPersonId === actorPersonId) return notFound()
  const root = await getRootNetwork(ctx)
  const membership = row.ownerPersonId && root ? await getMembership(ctx, root._id, row.ownerPersonId) : null
  const previous = membership?.status === "suspendue" ? membership.statusBeforeSuspension : membership?.status
  if (membership?.status === "suspendue" && sanctions.some((item) => item.kind === "suspension" || item.kind === "exclusion")) {
    const active = await ctx.db.query("sanctions").withIndex("by_person_status", (q) => q.eq("personId", membership.personId).eq("status", "active")).take(101)
    if (!active.some((item) => item.kind === "suspension" || item.kind === "exclusion")) return fail("conflict")
  }
  const removesTarget = decision === "actioned" && (sanctions.length === 0 || sanctions.some((item) => item.kind === "removal"))
  if (removesTarget) await removeTarget(ctx, { target: row.target, networkId: row.networkId, ownerPersonId: row.ownerPersonId })
  for (const item of sanctions) {
    if (!row.ownerPersonId) { if (item.kind !== "removal") return fail("invalidArgument", { field: "sanctions" }); continue }
    if ((item.kind === "suspension" || item.kind === "exclusion") && (!membership || previous === "partie" || previous === undefined)) return notFound()
    await ctx.db.insert("sanctions", { networkId: row.networkId, reportId: row._id, target: row.target, personId: row.ownerPersonId, kind: item.kind, status: "active", reason, ...(item.until !== undefined ? { until: item.until } : {}), ...(previous === "en_attente" || previous === "declaree" || previous === "verifiee" ? { previousMembershipStatus: previous } : {}), createdAt: now, updatedAt: now })
  }
  if (row.ownerPersonId && sanctions.some((item) => item.kind === "suspension" || item.kind === "exclusion")) await refreshSuspension(ctx, row.ownerPersonId)
  await ctx.db.patch(row._id, { status: decision, decisionReason: reason, reviewedByPersonId: actorPersonId, reviewedAt: now, updatedAt: now, removedTarget: removesTarget })
  const legacy = await ctx.db.query("contentReports").withIndex("by_reportId", (q) => q.eq("reportId", row._id)).unique()
  if (legacy) await ctx.db.patch(legacy._id, { status: decision, decisionReason: reason, reviewedByPersonId: actorPersonId, reviewedAt: now, updatedAt: now })
  await appendAudit(ctx, { action: "moderation.report_decide", capacity, actorPersonId, networkId: row.networkId, subject: { table: "reports", id: row._id }, details: { reason, targetKind: row.targetKind, decision, sanctionCount: sanctions.length } })
  if (row.ownerPersonId) await notifyPerson(ctx, { networkId: row.networkId, recipientPersonId: row.ownerPersonId, kind: "moderation_decision", subject: { report: row._id } })
  return { status: decision }
}

export const decide = networkMutation({
  args: { reportId: v.id("reports"), decision: v.union(v.literal("dismissed"), v.literal("actioned")), reason: v.string(), sanctions: v.array(sanctionInput) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.reportId)
    if (!row || row.networkId !== ctx.networkId) return notFound()
    const capacity = await teamCapacity(ctx, ctx, row.targetKind, row.teamId)
    if (!capacity) return notFound()
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    return await applyDecision(ctx, row, ctx.person._id, capacity, args.decision, motiveOf(args.reason), args.sanctions)
  },
})

async function ownsCase(ctx: ReadCtx, row: Doc<"reports">, personId: Id<"persons">): Promise<boolean> {
  if (row.ownerPersonId === personId) return true
  if (row.ownerPersonId !== undefined || row.target.kind !== "page") return false
  const page = await ctx.db.get(row.target.id)
  return page !== null && (await liveSignatoryRole(ctx, page, personId)) !== null
}

/** @selfScoped L'auteur (même suspendu) conteste uniquement sa décision, jamais un contenu d'autrui. */
export const fileAppeal = personMutation({
  args: { reportId: v.id("reports"), reason: v.string() },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "moderation.appeal", ctx.person._id)
    const row = await ctx.db.get(args.reportId)
    if (!row || row.status !== "actioned" || !(await ownsCase(ctx, row, ctx.person._id))) return notFound()
    const reason = motiveOf(args.reason)
    const first = await ctx.db.query("appeals").withIndex("by_report_level", (q) => q.eq("reportId", row._id).eq("level", "network")).unique()
    const level = row.level === "team" && first?.status !== "upheld" ? "network" as const : "platform" as const
    const existing = await ctx.db.query("appeals").withIndex("by_report_level", (q) => q.eq("reportId", row._id).eq("level", level)).unique()
    if (existing) return { appealId: existing._id, created: false }
    const now = Date.now()
    const appealId = await ctx.db.insert("appeals", { networkId: row.networkId, reportId: row._id, personId: ctx.person._id, level, reason, status: "open", createdAt: now, updatedAt: now })
    await appendAudit(ctx, { action: "moderation.appeal_file", capacity: "member", actorPersonId: ctx.person._id, networkId: row.networkId, subject: { table: "appeals", id: appealId }, details: { level } })
    return { appealId, created: true }
  },
})

async function decideAppeal(ctx: MutationCtx, appeal: Doc<"appeals">, actorPersonId: Id<"persons">, capacity: AuditCapacity, overturn: boolean, reason: string) {
  const row = await ctx.db.get(appeal.reportId)
  if (!row || appeal.status !== "open") return fail("conflict")
  if (row.reviewedByPersonId === actorPersonId || appeal.personId === actorPersonId) return notFound()
  if (overturn) {
    const sanctions = await ctx.db.query("sanctions").withIndex("by_report", (q) => q.eq("reportId", row._id)).take(6)
    for (const sanction of sanctions) if (sanction.status === "active") await ctx.db.patch(sanction._id, { status: "revoked", updatedAt: Date.now() })
    if (row.ownerPersonId) await refreshSuspension(ctx, row.ownerPersonId)
    await ctx.db.patch(row._id, { status: "dismissed", updatedAt: Date.now() })
    const remaining = await ctx.db.query("reports").withIndex("by_target_status", (q) => q.eq("targetKind", row.targetKind).eq("targetId", row.targetId).eq("status", "actioned")).take(101)
    if (row.removedTarget && remaining.length < 101 && !remaining.some((item) => item.removedTarget)) await restoreTarget(ctx, { target: row.target, networkId: row.networkId, ownerPersonId: row.ownerPersonId })
  }
  await ctx.db.patch(appeal._id, { status: overturn ? "overturned" : "upheld", decisionReason: reason, reviewedByPersonId: actorPersonId, updatedAt: Date.now() })
  if (row.ownerPersonId) await notifyPerson(ctx, { networkId: row.networkId, recipientPersonId: row.ownerPersonId, kind: "moderation_decision", subject: { report: row._id } })
  return { action: "moderation.appeal_decide" as const, capacity, actorPersonId, networkId: row.networkId, subject: { table: "appeals" as const, id: appeal._id }, details: { reason, overturn, level: appeal.level } }
}

export const reviewNetworkAppeal = networkMutation({
  args: { appealId: v.id("appeals"), overturn: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    await requireNetworkAdmin(ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const row = await ctx.db.get(args.appealId)
    if (!row || row.networkId !== ctx.networkId || row.level !== "network") return notFound()
    await appendAudit(ctx, await decideAppeal(ctx, row, ctx.person._id, "network_admin", args.overturn, motiveOf(args.reason)))
    return null
  },
})

export const reviewPlatformAppeal = operatorMutation({
  args: { appealId: v.id("appeals"), overturn: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const row = await ctx.db.get(args.appealId)
    if (!row || row.level !== "platform") return notFound()
    await appendAudit(ctx, await decideAppeal(ctx, row, ctx.person._id, operatorCapacity(ctx.operator), args.overturn, motiveOf(args.reason)))
    return null
  },
})

/** @selfScoped Décisions et sanctions de la personne appelante, y compris suspendue. Aucun déclarant ni contenu. */
export const myDecisions = personQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("reports").withIndex("by_owner_createdAt", (q) => q.eq("ownerPersonId", ctx.person._id)).order("desc").paginate(pageOptions(args.paginationOpts))
    const page = []
    for (const row of result.page) {
      const sanctions = await ctx.db.query("sanctions").withIndex("by_report", (q) => q.eq("reportId", row._id)).take(6)
      const appeals = await ctx.db.query("appeals").withIndex("by_report_level", (q) => q.eq("reportId", row._id)).take(2)
      page.push({ ...queueDto(row), sanctions: sanctions.map((sanction) => ({ sanctionId: sanction._id, kind: sanction.kind, status: sanction.status, until: sanction.until ?? null, reason: sanction.reason })), appeals: appeals.map((appeal) => ({ appealId: appeal._id, level: appeal.level, status: appeal.status, decisionReason: appeal.decisionReason ?? null })) })
    }
    return { ...result, page }
  },
})

export const setPolicy = networkMutation({
  args: { surface: moderationSurfaceValidator, preReview: v.boolean(), maxLinks: v.number(), maxWrites: v.number(), windowMs: v.number(), reason: v.string() },
  handler: async (ctx, args) => {
    await requireNetworkAdmin(ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const reason = motiveOf(args.reason)
    if (![args.maxLinks, args.maxWrites, args.windowMs].every(Number.isSafeInteger) || args.maxLinks < 0 || args.maxLinks > 20 || args.maxWrites < 1 || args.maxWrites > 100 || args.windowMs < 1_000 || args.windowMs > 86_400_000) return fail("invalidArgument")
    const existing = await ctx.db.query("moderationPolicies").withIndex("by_network_surface", (q) => q.eq("networkId", ctx.networkId).eq("surface", args.surface)).unique()
    const data = { networkId: ctx.networkId, surface: args.surface, preReview: args.preReview, maxLinks: args.maxLinks, maxWrites: args.maxWrites, windowMs: args.windowMs, updatedAt: Date.now() }
    const policyId = existing ? existing._id : await ctx.db.insert("moderationPolicies", data)
    if (existing) await ctx.db.patch(existing._id, data)
    await appendAudit(ctx, { action: "moderation.policy_set", capacity: "network_admin", actorPersonId: ctx.person._id, networkId: ctx.networkId, subject: { table: "moderationPolicies", id: policyId }, details: { reason, surface: args.surface, preReview: args.preReview } })
    return { policyId }
  },
})

export const setBlockedTerm = networkMutation({
  args: { term: v.string(), active: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    await requireNetworkAdmin(ctx)
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const reason = motiveOf(args.reason)
    const term = normalizeBlockedTerm(args.term)
    if (term.length < 2 || term.length > 80) return fail("invalidArgument", { field: "term" })
    const existing = await ctx.db.query("blockedTerms").withIndex("by_network_term", (q) => q.eq("networkId", ctx.networkId).eq("term", term)).unique()
    const active = await ctx.db.query("blockedTerms").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(100)
    if (args.active && !existing?.active && active.length >= 100) return fail("policyRefused")
    const termId = existing ? existing._id : await ctx.db.insert("blockedTerms", { networkId: ctx.networkId, term, active: args.active, updatedAt: Date.now() })
    if (existing) await ctx.db.patch(existing._id, { active: args.active, updatedAt: Date.now() })
    await appendAudit(ctx, { action: "moderation.term_set", capacity: "network_admin", actorPersonId: ctx.person._id, networkId: ctx.networkId, subject: { table: "blockedTerms", id: termId }, details: { reason, active: args.active } })
    return { termId }
  },
})

export const reviewContent = networkMutation({
  args: { target: moderationTargetValidator, approve: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "moderation.decide", ctx.person._id)
    const state = await contentState(ctx, args.target.kind, args.target.id)
    if (!state || state.networkId !== ctx.networkId || state.status !== "pending_review") return notFound()
    if (state.ownerPersonId === ctx.person._id) return notFound()
    const teams = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(101)
    const team = teams.find((row) => row.scope === args.target.kind) ?? teams.find((row) => row.scope === undefined)
    const capacity = await teamCapacity(ctx, ctx, args.target.kind, team?._id)
    if (!capacity) return notFound()
    const reason = motiveOf(args.reason)
    if (args.approve) await restoreTarget(ctx, { target: args.target, networkId: ctx.networkId, ownerPersonId: state.ownerPersonId })
    else await removeTarget(ctx, { target: args.target, networkId: ctx.networkId, ownerPersonId: state.ownerPersonId })
    const now = Date.now()
    const reportId = await ctx.db.insert("reports", { networkId: ctx.networkId, target: args.target, targetKind: args.target.kind, targetId: args.target.id, ...(state.ownerPersonId ? { ownerPersonId: state.ownerPersonId } : {}), source: "pre_review", reason: "pre_review", ...(team ? { teamId: team._id } : {}), level: team ? "team" : "network", status: args.approve ? "dismissed" : "actioned", removedTarget: !args.approve, decisionReason: reason, reviewedByPersonId: ctx.person._id, reviewedAt: now, createdAt: now, updatedAt: now })
    if (state.ownerPersonId) await notifyPerson(ctx, { networkId: ctx.networkId, recipientPersonId: state.ownerPersonId, kind: "moderation_decision", subject: { report: reportId } })
    await appendAudit(ctx, { action: "moderation.content_review", capacity, actorPersonId: ctx.person._id, networkId: ctx.networkId, subject: { table: "moderationContentStates", id: state._id }, details: { reason, approve: args.approve, surface: args.target.kind } })
    return null
  },
})

export const paginatePending = networkQuery({
  args: { teamId: v.optional(v.id("moderationTeams")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId)
      if (!team || !(await teamCapacity(ctx, ctx, team.scope ?? "", team._id))) return notFound()
    } else if (!networkRoleCapacity(ctx.membership.role)) return notFound()
    const teams = await ctx.db.query("moderationTeams").withIndex("by_network_active", (q) => q.eq("networkId", ctx.networkId).eq("active", true)).take(101)
    if (teams.length > 100) return notFound()
    const result = await ctx.db.query("moderationContentStates").withIndex("by_network_status_updatedAt", (q) => q.eq("networkId", ctx.networkId).eq("status", "pending_review")).paginate(pageOptions(args.paginationOpts))
    const page = []
    for (const row of result.page) {
      const team = teams.find((item) => item.scope === row.targetKind) ?? teams.find((item) => item.scope === undefined)
      if (args.teamId && team?._id !== args.teamId) continue
      if (await teamCapacity(ctx, ctx, row.targetKind, team?._id)) page.push({ stateId: row._id, targetKind: row.targetKind, targetId: row.targetId, updatedAt: row.updatedAt })
    }
    return { ...result, page }
  },
})
