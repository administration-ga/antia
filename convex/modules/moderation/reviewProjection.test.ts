// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { describe, expect, it } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

const PREVIEW = api.modules.moderation.reviewProjection.preview
const CASES = api.modules.moderation.cases
type T = ReturnType<typeof testConvex>

async function person(t: T, root: Id<"networks">, name: string, role: "member" | "network_admin" = "member") {
  const as = t.withIdentity({ subject: `pa8-review-${name}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: name, displayName: name })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  await t.run(async (ctx) => {
    const membership = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", personId)).unique()
    if (membership) await ctx.db.patch(membership._id, { role })
  })
  return { as, personId }
}

async function fixture() {
  const t = testConvex()
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const author = await person(t, root, "pa8auteur")
  const reader = await person(t, root, "pa8lecteur")
  const admin = await person(t, root, "pa8admin", "network_admin")
  const { postId } = await author.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Extrait à examiner" })
  const { reportId } = await reader.as.mutation(CASES.report, { networkId: root, target: { kind: "post", id: postId }, reason: "harassment" })
  return { t, root, testClosed, author, reader, admin, postId, reportId }
}

async function errorCode(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("PA8 — aperçu de modération sous compétence vivante", () => {
  it("refuse anonyme, simple membre et choix ambigu de dossier", async () => {
    const f = await fixture()
    expect(await errorCode(f.t.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))).toBe("unauthenticated")
    expect(await errorCode(f.reader.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))).toBe("notFound")
    expect(await errorCode(f.admin.as.query(PREVIEW, { networkId: f.root }))).toBe("notFound")
    expect(await errorCode(f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId, target: { kind: "post", id: f.postId } }))).toBe("notFound")
  })

  it("rend seulement les champs allowlistés du contenu signalé", async () => {
    const f = await fixture()
    expect(await f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId })).toEqual({ kind: "post", available: true, title: null, body: "Extrait à examiner", media: [] })
    const serialized = JSON.stringify(await f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))
    expect(serialized).not.toContain(f.author.personId)
    expect(serialized).not.toContain(f.reader.personId)
    expect(serialized).not.toContain("authUserId")
  })

  it("relit le membre d'équipe et referme immédiatement à sa révocation", async () => {
    const f = await fixture()
    const { teamId } = await f.admin.as.mutation(CASES.createTeam, { networkId: f.root, name: "Équipe publications", scope: "post", reason: "Recette de compétence." })
    await f.admin.as.mutation(CASES.setTeamMember, { networkId: f.root, teamId, personId: f.reader.personId, active: true, reason: "Recette de compétence." })
    await f.t.run(async (ctx) => await ctx.db.patch(f.reportId, { teamId, level: "team" }))
    expect((await f.reader.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId })).available).toBe(true)
    await f.admin.as.mutation(CASES.setTeamMember, { networkId: f.root, teamId, personId: f.reader.personId, active: false, reason: "Fin de compétence." })
    expect(await errorCode(f.reader.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))).toBe("notFound")
  })

  it("ne permet jamais d'inventer une prélecture ou d'ouvrir une cible d'un autre réseau", async () => {
    const f = await fixture()
    expect(await errorCode(f.admin.as.query(PREVIEW, { networkId: f.root, target: { kind: "post", id: f.postId } }))).toBe("notFound")
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.postId, { networkId: f.testClosed })
    })
    expect(await f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId })).toEqual({ kind: "post", available: false, title: null, body: null, media: [] })
  })

  it("ouvre une vraie prélecture au décideur et la ferme après conclusion", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => {
      const state = await ctx.db.query("moderationContentStates").withIndex("by_target", (q) => q.eq("targetKind", "post").eq("targetId", f.postId)).unique()
      if (!state) throw new Error("État de fixture absent")
      await ctx.db.patch(state._id, { status: "pending_review" })
    })
    expect((await f.admin.as.query(PREVIEW, { networkId: f.root, target: { kind: "post", id: f.postId } })).body).toBe("Extrait à examiner")
    expect(await errorCode(f.reader.as.query(PREVIEW, { networkId: f.root, target: { kind: "post", id: f.postId } }))).toBe("notFound")
    await f.admin.as.mutation(CASES.decide, { networkId: f.root, reportId: f.reportId, decision: "dismissed", reason: "Signalement classé après lecture.", sanctions: [] })
    expect(await errorCode(f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))).toBe("notFound")
  })

  it("borne l'extrait et refuse une session dont l'adhésion racine est suspendue", async () => {
    const f = await fixture()
    await f.t.run(async (ctx) => await ctx.db.patch(f.postId, { body: "x".repeat(5_000) }))
    expect((await f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId })).body).toHaveLength(4_000)
    await f.t.run(async (ctx) => {
      const membership = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", f.root).eq("personId", f.admin.personId)).unique()
      if (membership) await ctx.db.patch(membership._id, { status: "suspendue" })
    })
    expect(await errorCode(f.admin.as.query(PREVIEW, { networkId: f.root, reportId: f.reportId }))).toBe("membershipSuspended")
  })
})
