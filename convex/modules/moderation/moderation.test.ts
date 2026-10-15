// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauPersonnel/moderation.test.ts @ ad2e7fdc2 — adaptations : rôles `AdminSystem`/`SuperAdmin` → modérateur ou administrateur DU RÉSEAU du contenu, opérateur en dernier ressort ; décrément vérifié dans les agrégats (partages, commentaires) au lieu de `shareCount`/`commentCount` ; la décision écrit sa ligne dans le journal du moteur (patron `reseauPlatformActsAudit`) ; le signalement masque pour le déclarant.
import { engineErrorCode } from "@antia/social-contracts/errors"
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons"> }

afterEach(() => {
  vi.useRealTimers()
})

const PAGE = { numItems: 50, cursor: null }

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string, role?: "network_moderator" | "network_admin"): Promise<Person> {
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  if (role) {
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", rootId).eq("personId", personId))
        .unique()
      if (membership) await ctx.db.patch(membership._id, { role })
    })
  }
  return { as, personId }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

const codeOf = async (promise: Promise<unknown>) => engineErrorCode(await caught(promise))

describe("gardes de signalement", () => {
  it("refuse la file et les décisions à un simple membre ; l'opérateur tranche en dernier ressort", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const operator = await enter(t, root, "operateur")
    await t.run(async (ctx) => ctx.db.insert("operators", { personId: operator.personId, role: "platform_operator", grantedAt: 1 }))
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Litigieux" })
    const { reportId } = await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId, reason: "harassment" })
    expect(await codeOf(bob.as.query(api.modules.moderation.moderation.paginateQueue, { networkId: root, paginationOpts: PAGE }))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(api.modules.moderation.moderation.decide, { networkId: root, reportId, status: "dismissed", decisionReason: "Rien à redire." }))).toBe("notFound")
    expect(await operator.as.mutation(api.modules.moderation.moderation.decideAsOperator, { reportId, status: "dismissed", decisionReason: "Propos admissible." })).toEqual({ status: "dismissed" })
  })

  it("n'accepte que du contenu actuellement visible au déclarant ; refuse l'auto-signalement ; dédoublonne et masque", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const circle = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Cercle", audience: "connections" })
    expect(await codeOf(bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId: circle.postId, reason: "hate" }))).toBe("notFound")
    const open = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Ouvert" })
    expect(await codeOf(alice.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId: open.postId, reason: "hate" }))).toBe("notFound")
    const first = await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId: open.postId, reason: "hate" })
    const second = await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId: open.postId, reason: "other" })
    expect(first).toMatchObject({ created: true, hidden: true })
    expect(second).toEqual({ reportId: first.reportId, created: false, hidden: true })
    expect((await bob.as.query(api.modules.posts.posts.myFeed, { networkId: root, scope: "recents" })).items).toEqual([])
  })
})

describe("file et décisions", () => {
  it("anonymise le DTO : ni corps, ni auteur, ni déclarant", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const moderator = await enter(t, root, "moderatrice", "network_moderator")
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Texte secret du contenu" })
    await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId, reason: "misinformation", note: "Source douteuse" })
    const [row] = (await moderator.as.query(api.modules.moderation.moderation.paginateQueue, { networkId: root, paginationOpts: PAGE })).page
    expect(row).toMatchObject({ targetKind: "post", postId, reason: "misinformation", note: "Source douteuse", status: "open" })
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain("Texte secret")
    expect(serialized).not.toContain(bob.personId)
    expect(serialized).not.toContain(alice.personId)
  })

  it("conserve un dossier en examen jusqu'à sa décision terminale ; une décision terminale ne se refait pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const admin = await enter(t, root, "administratrice", "network_admin")
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "À examiner" })
    const { reportId } = await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId, reason: "violence" })
    const decide = (status: "reviewing" | "dismissed" | "actioned", decisionReason = "Examen en cours.") =>
      admin.as.mutation(api.modules.moderation.moderation.decide, { networkId: root, reportId, status, decisionReason })
    expect(await codeOf(decide("reviewing", " "))).toBe("invalidArgument")
    await decide("reviewing")
    expect((await admin.as.query(api.modules.moderation.moderation.paginateQueue, { networkId: root, status: "reviewing", paginationOpts: PAGE })).page).toHaveLength(1)
    expect(await codeOf(decide("reviewing"))).toBe("conflict")
    await decide("dismissed", "Propos admissible.")
    expect(await codeOf(decide("actioned", "Changement d'avis."))).toBe("conflict")
  })

  it("un retrait modéré retire le contenu (une racine avec ses réponses), décompte partages et commentaires, et écrit sa ligne de journal", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    const moderator = await enter(t, root, "moderateur", "network_moderator")
    const original = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Original" })
    const share = await bob.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "", sharedPostId: original.postId })
    const { commentId } = await bob.as.mutation(api.modules.engagement.engagement.comment, { networkId: root, postId: original.postId, body: "Commentaire fautif" })
    // Une réponse sous la racine fautive : elle part avec elle, le compte reste égal à ce qui se lit.
    await carol.as.mutation(api.modules.engagement.engagement.comment, { networkId: root, postId: original.postId, body: "Réponse", parentCommentId: commentId })
    const read = async () => await alice.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: original.postId })
    expect(await read()).toMatchObject({ shareCount: 1, commentCount: 2 })

    const onShare = await carol.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId: share.postId, reason: "other" })
    const onComment = await carol.as.mutation(api.modules.moderation.moderation.reportComment, { networkId: root, commentId, reason: "harassment" })
    await moderator.as.mutation(api.modules.moderation.moderation.decide, { networkId: root, reportId: onShare.reportId, status: "actioned", decisionReason: "Partage abusif." })
    await moderator.as.mutation(api.modules.moderation.moderation.decide, { networkId: root, reportId: onComment.reportId, status: "actioned", decisionReason: "Harcèlement avéré." })
    expect(await read()).toMatchObject({ shareCount: 0, commentCount: 0 })
    expect(engineErrorCode(await caught(carol.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: share.postId })))).toBe("notFound")

    const journal = await t.run(async (ctx) =>
      ctx.db
        .query("engineAudit")
        .withIndex("by_subject_at", (q) => q.eq("subjectTable", "contentReports").eq("subjectId", onComment.reportId))
        .take(5),
    )
    expect(journal).toMatchObject([
      {
        action: "moderation.report_decide",
        capacity: "network_moderator",
        actorPersonId: moderator.personId,
        networkId: root,
        details: { targetKind: "comment", previousStatus: "open", status: "actioned", decisionReason: "Harcèlement avéré.", targetRemoved: true },
      },
    ])
  })
})
