// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { groupThread } from "../calls/fixtures.setup"
import { insertPage, insertSession } from "../live/fixtures.setup"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons"> }
const M = api.modules.moderation.cases
const P = api.modules.posts.posts
const PAGE = { numItems: 25, cursor: null }
afterEach(() => vi.useRealTimers())

async function enter(t: T, root: Id<"networks">, name: string, role?: "network_moderator" | "network_admin"): Promise<Person> {
  const as = t.withIdentity({ subject: `pa5-${name}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: name, displayName: name })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  if (role) await t.run(async (ctx) => {
    const row = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", personId)).unique()
    if (row) await ctx.db.patch(row._id, { role })
  })
  return { as, personId }
}

async function fixture() {
  const t = testConvex()
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const author = await enter(t, root, "auteur")
  const reader = await enter(t, root, "lectrice")
  const moderator = await enter(t, root, "moderateur", "network_moderator")
  const admin = await enter(t, root, "administratrice", "network_admin")
  const { postId } = await author.as.mutation(P.publish, { networkId: root, body: "Publication de recette" })
  const report = await reader.as.mutation(M.report, { networkId: root, target: { kind: "post", id: postId }, reason: "harassment" })
  return { t, root, author, reader, moderator, admin, postId, reportId: report.reportId }
}

async function errorCode(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("PA5 / R7 — cinq déclarants, retrait, suspension et recours", () => {
  it("masque chaque lien, suspend partout, prévient sans texte et accepte le recours du suspendu", async () => {
    const f = await fixture()
    for (let n = 0; n < 4; n++) {
      const person = await enter(f.t, f.root, `declarant${n}`)
      await person.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: f.postId }, reason: "harassment" })
      expect(await errorCode(person.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe("notFound")
    }
    expect((await f.moderator.as.query(M.paginateQueue, { networkId: f.root, paginationOpts: PAGE })).page).toHaveLength(5)
    expect(await errorCode(f.reader.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe("notFound")
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Harcèlement confirmé.", sanctions: [{ kind: "removal" }, { kind: "suspension", until: Date.now() + 60_000 }] })
    expect(await errorCode(f.author.as.mutation(P.publish, { networkId: f.root, body: "Refusé" }))).toBe("membershipSuspended")
    const decisions = await f.author.as.query(M.myDecisions, { paginationOpts: PAGE })
    expect(decisions.page.find((row) => row.reportId === f.reportId)?.sanctions).toHaveLength(2)
    expect(JSON.stringify(decisions)).not.toContain(f.reader.personId)
    const notices = await f.t.run(async (ctx) => await ctx.db.query("notifications").withIndex("by_network_recipient_dedupKey", (q) => q.eq("networkId", f.root).eq("recipientPersonId", f.author.personId)).take(20))
    expect(notices.some((row) => row.kind === "moderation_decision")).toBe(true)
    expect(JSON.stringify(notices)).not.toContain("Publication de recette")
    const { appealId } = await f.author.as.mutation(M.fileAppeal, { reportId: f.reportId, reason: "Je conteste cette décision." })
    // Décision initiale réseau : recours à la plateforme, par un décideur distinct.
    const operator = await enter(f.t, f.root, "operatrice")
    await f.t.run(async (ctx) => await ctx.db.insert("operators", { personId: operator.personId, role: "platform_operator", grantedAt: Date.now() }))
    await operator.as.mutation(M.reviewPlatformAppeal, { appealId, overturn: true, reason: "Réexamen favorable à l'auteur." })
    expect(await errorCode(f.author.as.mutation(P.publish, { networkId: f.root, body: "Accès rétabli" }))).toBe(null)
    expect(await f.admin.as.query(P.getPost, { networkId: f.root, postId: f.postId })).toMatchObject({ body: "Publication de recette" })
    const audit = await f.t.run(async (ctx) => await ctx.db.query("engineAudit").withIndex("by_network_at", (q) => q.eq("networkId", f.root)).take(30))
    expect(audit.map((row) => row.action)).toContain("moderation.appeal_decide")
  })
})

describe("PA5 — sanctions graduées", () => {
  it.each(["warning", "mute", "suspension", "exclusion"] as const)("applique %s sans transformer un avertissement en retrait", async (kind) => {
    const f = await fixture()
    const sanction = kind === "mute" || kind === "suspension" ? { kind, until: Date.now() + 60_000 } : { kind }
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Décision proportionnée.", sanctions: [sanction] })
    const write = await errorCode(f.author.as.mutation(P.publish, { networkId: f.root, body: "Nouvelle publication" }))
    expect(write).toBe(kind === "warning" ? null : kind === "mute" ? "policyRefused" : "membershipSuspended")
    if (kind === "warning" || kind === "mute") expect(await errorCode(f.admin.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe(null)
  })
  it("refuse une durée passée, manquante ou un terme sur une exclusion", async () => {
    const f = await fixture()
    for (const sanction of [{ kind: "mute" as const }, { kind: "suspension" as const, until: Date.now() - 1 }, { kind: "exclusion" as const, until: Date.now() + 1000 }]) {
      expect(await errorCode(f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Décision contrôlée.", sanctions: [sanction] }))).toBe("invalidArgument")
    }
    expect((await f.author.as.query(M.myDecisions, { paginationOpts: PAGE })).page[0]?.sanctions).toEqual([])
  })
  it("interprète l'échéance avant le cron puis restaure le statut et journalise", async () => {
    const f = await fixture()
    const now = Date.now()
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Suspension temporaire.", sanctions: [{ kind: "suspension", until: now + 10_000 }] })
    vi.useFakeTimers(); vi.setSystemTime(now + 10_001)
    expect(await errorCode(f.author.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe(null)
    expect((await f.author.as.query(api.modules.people.memberships.myMemberships, {})).find((membership) => membership.networkId === f.root)?.status).toBe("declaree")
    await f.t.mutation(internal.modules.moderation.maintenance.expireSanctions, {})
    const membership = await f.t.run(async (ctx) => await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", f.root).eq("personId", f.author.personId)).unique())
    expect(membership?.status).toBe("declaree")
    expect((await f.author.as.query(M.myDecisions, { paginationOpts: PAGE })).page[0]?.sanctions[0]?.status).toBe("expired")
  })
  it("un retrait temporaire se termine et rétablit le contenu", async () => {
    const f = await fixture()
    const now = Date.now()
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Retrait temporaire.", sanctions: [{ kind: "removal", until: now + 1000 }] })
    expect(await errorCode(f.admin.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe("notFound")
    vi.useFakeTimers(); vi.setSystemTime(now + 1001)
    await f.t.mutation(internal.modules.moderation.maintenance.expireSanctions, {})
    expect(await errorCode(f.admin.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe(null)
  })
  it("l'expiration d'un retrait ne supprime pas un autre retrait encore actif", async () => {
    const f = await fixture()
    const other = await enter(f.t, f.root, "seconddeclarant")
    const second = await other.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: f.postId }, reason: "other" })
    const now = Date.now()
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Retrait temporaire.", sanctions: [{ kind: "removal", until: now + 1000 }] })
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: second.reportId, decision: "actioned", reason: "Autre retrait toujours actif.", sanctions: [{ kind: "removal" }] })
    vi.useFakeTimers(); vi.setSystemTime(now + 1001)
    await f.t.mutation(internal.modules.moderation.maintenance.expireSanctions, {})
    expect(await errorCode(f.admin.as.query(P.getPost, { networkId: f.root, postId: f.postId }))).toBe("notFound")
  })
})

describe("PA5 — compétence relue et chaîne des recours", () => {
  it("retirer une compétence ferme immédiatement une décision, même avec le rôle de réseau", async () => {
    const f = await fixture()
    const { teamId } = await f.admin.as.mutation(M.createTeam, { networkId: f.root, name: "Publications", scope: "post", reason: "Équipe spécialisée." })
    await f.admin.as.mutation(M.setTeamMember, { networkId: f.root, teamId, personId: f.moderator.personId, active: true, reason: "Habilitation explicite." })
    // Dossier né avant l'équipe : test du périmètre après attribution serveur.
    await f.t.run(async (ctx) => await ctx.db.patch(f.reportId, { teamId, level: "team" }))
    await f.admin.as.mutation(M.setTeamMember, { networkId: f.root, teamId, personId: f.moderator.personId, active: false, reason: "Habilitation retirée." })
    expect(await errorCode(f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "dismissed", reason: "Classement tenté.", sanctions: [] }))).toBe("notFound")
  })
  it("fait appel équipe → réseau → plateforme sans réutiliser le décideur initial", async () => {
    const f = await fixture()
    const { teamId } = await f.admin.as.mutation(M.createTeam, { networkId: f.root, name: "Équipe", scope: "post", reason: "Équipe spécialisée." })
    await f.admin.as.mutation(M.setTeamMember, { networkId: f.root, teamId, personId: f.moderator.personId, active: true, reason: "Habilitation explicite." })
    await f.t.run(async (ctx) => await ctx.db.patch(f.reportId, { teamId, level: "team" }))
    await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId: f.reportId, decision: "actioned", reason: "Retrait motivé.", sanctions: [{ kind: "removal" }] })
    const first = await f.author.as.mutation(M.fileAppeal, { reportId: f.reportId, reason: "Premier réexamen." })
    await f.admin.as.mutation(M.reviewNetworkAppeal, { networkId: f.root, appealId: first.appealId, overturn: false, reason: "Décision confirmée." })
    const second = await f.author.as.mutation(M.fileAppeal, { reportId: f.reportId, reason: "Réexamen national." })
    expect(second.appealId).not.toBe(first.appealId)
    const row = await f.t.run(async (ctx) => await ctx.db.get(second.appealId))
    expect(row?.level).toBe("platform")
  })
})

describe("PA5 — relecture, mots et spam", () => {
  it("garde le pending privé jusqu'à une approbation motivée", async () => {
    const f = await fixture()
    await f.admin.as.mutation(M.setPolicy, { networkId: f.root, surface: "post", preReview: true, maxLinks: 2, maxWrites: 100, windowMs: 60_000, reason: "Relecture préalable." })
    const { postId } = await f.author.as.mutation(P.publish, { networkId: f.root, body: "En attente de relecture" })
    expect(await errorCode(f.reader.as.query(P.getPost, { networkId: f.root, postId }))).toBe("notFound")
    expect(await errorCode(f.author.as.query(P.getPost, { networkId: f.root, postId }))).toBe(null)
    await f.admin.as.mutation(M.reviewContent, { networkId: f.root, target: { kind: "post", id: postId }, approve: true, reason: "Contenu admissible." })
    expect(await errorCode(f.reader.as.query(P.getPost, { networkId: f.root, postId }))).toBe(null)
  })
  it("un refus de prépublication est consultable et contestable sans faux déclarant", async () => {
    const f = await fixture()
    await f.admin.as.mutation(M.setPolicy, { networkId: f.root, surface: "post", preReview: true, maxLinks: 2, maxWrites: 100, windowMs: 60_000, reason: "Relecture préalable." })
    const { postId } = await f.author.as.mutation(P.publish, { networkId: f.root, body: "Prépublication contestée" })
    await f.admin.as.mutation(M.reviewContent, { networkId: f.root, target: { kind: "post", id: postId }, approve: false, reason: "Refus motivé de publication." })
    const decisions = await f.author.as.query(M.myDecisions, { paginationOpts: PAGE })
    const decision = decisions.page.find((row) => row.target.id === postId)
    expect(decision?.status).toBe("actioned")
    if (!decision) throw new Error("décision absente")
    const report = await f.t.run(async (ctx) => await ctx.db.get(decision.reportId))
    expect(report?.reporterPersonId).toBeUndefined()
    expect(report?.source).toBe("pre_review")
    expect(await f.author.as.mutation(M.fileAppeal, { reportId: decision.reportId, reason: "Je demande un réexamen." })).toMatchObject({ created: true })
  })
  it("détecte un mot accentué et trop de liens sans stocker le texte dans la modération", async () => {
    const f = await fixture()
    await f.admin.as.mutation(M.setBlockedTerm, { networkId: f.root, term: "menace", active: true, reason: "Terme nécessitant examen." })
    await f.admin.as.mutation(M.setPolicy, { networkId: f.root, surface: "post", preReview: false, maxLinks: 1, maxWrites: 100, windowMs: 60_000, reason: "Contrôle simple de spam." })
    for (const body of ["MENÁCE", "www.example.test www.autre.test"]) {
      const { postId } = await f.author.as.mutation(P.publish, { networkId: f.root, body })
      expect(await errorCode(f.reader.as.query(P.getPost, { networkId: f.root, postId }))).toBe("notFound")
      const state = await f.t.run(async (ctx) => await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "post").eq("targetId", postId)).unique())
      expect(state?.status).toBe("pending_review")
      expect(JSON.stringify(state)).not.toContain(body)
    }
  })
  it("refuse une cible invisible, l'auto-signalement et dédoublonne après le masque", async () => {
    const f = await fixture()
    expect(await errorCode(f.author.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: f.postId }, reason: "other" }))).toBe("notFound")
    const duplicate = await f.reader.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: f.postId }, reason: "other" })
    expect(duplicate).toMatchObject({ created: false, reportId: f.reportId })
    const { postId } = await f.author.as.mutation(P.publish, { networkId: f.root, body: "Cercle privé", audience: "connections" })
    expect(await errorCode(f.reader.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: postId }, reason: "other" }))).toBe("notFound")
  })
})

describe("PA5 — cibles polymorphes et absence de lecture dérobée", () => {
  it("signale un commentaire et un profil, puis leur masque s'applique aux lectures ordinaires", async () => {
    const f = await fixture()
    const { commentId } = await f.author.as.mutation(api.modules.engagement.engagement.comment, { networkId: f.root, postId: f.postId, body: "Commentaire visible" })
    await f.admin.as.mutation(M.report, { networkId: f.root, target: { kind: "comment", id: commentId }, reason: "other" })
    const comments = await f.admin.as.query(api.modules.engagement.engagement.paginateComments, { networkId: f.root, postId: f.postId, paginationOpts: PAGE })
    expect(comments.page).toEqual([])
    await f.reader.as.mutation(M.report, { networkId: f.root, target: { kind: "person", id: f.author.personId }, reason: "other" })
    expect(await f.reader.as.query(api.modules.people.profile.getPublicProfile, { networkId: f.root, handle: "auteur" })).toBe(null)
  })
  it("signale page et direct, sans exposer leurs corps dans la file", async () => {
    const f = await fixture()
    const host = { ...f.author, handle: "auteur" }
    const pageId = await insertPage(f.t, f.root, host, "page-recette")
    const sessionId = await insertSession(f.t, { networkId: f.root, host })
    for (const target of [{ kind: "page" as const, id: pageId }, { kind: "live" as const, id: sessionId }]) {
      const { reportId } = await f.reader.as.mutation(M.report, { networkId: f.root, target, reason: "other" })
      await f.moderator.as.mutation(M.decide, { networkId: f.root, reportId, decision: "actioned", reason: "Retrait de la surface.", sanctions: [{ kind: "removal" }] })
    }
    expect(await f.admin.as.query(api.modules.pages.pages.getPage, { networkId: f.root, handle: "page-recette" })).toBe(null)
    expect(await errorCode(f.admin.as.query(api.modules.live.sessions.get, { networkId: f.root, sessionId }))).toBe("notFound")
  })
  it("un message de groupe ne se signale que par un membre vivant ayant accès à son histoire", async () => {
    const f = await fixture()
    const host = { ...f.author, handle: "auteur" }
    const reader = { ...f.reader, handle: "lectrice" }
    vi.useFakeTimers()
    const threadId = await groupThread(f.t, f.root, host, [reader, { ...f.moderator, handle: "moderateur" }])
    const messageId = await f.t.run(async (ctx) => await ctx.db.insert("groupMessages", { networkId: f.root, threadId, senderPersonId: f.author.personId, type: "text", content: "Propos de groupe", createdAt: Date.now() }))
    expect(await errorCode(f.admin.as.mutation(M.report, { networkId: f.root, target: { kind: "groupMessage", id: messageId }, reason: "other" }))).toBe("notFound")
    await f.reader.as.mutation(M.report, { networkId: f.root, target: { kind: "groupMessage", id: messageId }, reason: "other" })
    const messages = await f.reader.as.query(api.modules.groups.messages.paginateGroupMessages, { networkId: f.root, threadId, paginationOpts: PAGE })
    expect(messages.page.some((message) => message.messageId === messageId)).toBe(false)
    expect(JSON.stringify(messages.page)).not.toContain("Propos de groupe")
  })
  it("l'événement réservé ne se signale pas par un non-invité", async () => {
    const f = await fixture()
    const { eventId } = await f.author.as.mutation(api.modules.events.events.create, { networkId: f.root, title: "Rencontre de recette", startAt: Date.now() + 3600_000, endAt: Date.now() + 7200_000, timeZone: "Africa/Libreville", idempotencyKey: "pa5-event" })
    expect(await errorCode(f.reader.as.mutation(M.report, { networkId: f.root, target: { kind: "event", id: eventId }, reason: "other" }))).toBe("notFound")
  })
})

describe("PA5 — agrégation de transparence", () => {
  it("ne publie pas cinq signalements qui permettraient de reconnaître un auteur unique", async () => {
    const f = await fixture()
    for (let n = 0; n < 4; n++) {
      const reporter = await enter(f.t, f.root, `transp${n}`)
      await reporter.as.mutation(M.report, { networkId: f.root, target: { kind: "post", id: f.postId }, reason: "other" })
    }
    const periodEnd = Date.now() + 1000
    const periodStart = periodEnd - 86_400_000
    await f.t.mutation(internal.modules.moderation.maintenance.aggregateNetwork, { networkId: f.root, periodStart, periodEnd, cursor: null, cases: 0, distinctAuthors: 0, actioned: 0, dismissed: 0 })
    expect(await f.reader.as.query(api.modules.moderation.maintenance.transparency, { networkId: f.root, periodStart })).toBe(null)
    const row = await f.t.run(async (ctx) => await ctx.db.query("moderationTransparency").withIndex("by_network_period", (q) => q.eq("networkId", f.root).eq("periodStart", periodStart)).unique())
    expect(row).toMatchObject({ cases: 5, distinctAuthors: 1 })
    expect(JSON.stringify(row)).not.toContain(f.author.personId)
  })
})
