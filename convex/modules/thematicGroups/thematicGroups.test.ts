// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauPersonnel/groupesThematiques.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations) ; codes de refus au lieu des libellés ; effectif lu dans l'agrégat ; cas de suspension (ADR-0087) rendus au statut d'adhésion par le constructeur ; cascade de suppression vérifiée jusqu'à la ligne d'analyse et au blob (D10) ; mur à curseur composite ; tests neufs : un groupe d'un autre réseau est introuvable, une clé rejouée ailleurs est refusée, la lacune du vivier.
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { admitStoredUpload } from "../files/admission"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; handle: string }

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const PAGE = { numItems: 50, cursor: null }

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string): Promise<Person> {
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  return { as, personId, handle }
}

async function connect(t: T, networkId: Id<"networks">, a: Person, b: Person): Promise<void> {
  await t.run(async (ctx) => {
    const [low, high] = a.personId < b.personId ? [a.personId, b.personId] : [b.personId, a.personId]
    await ctx.db.insert("connections", { networkId, personIdLow: low, personIdHigh: high, requestedByPersonId: a.personId, recipientPersonId: b.personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
  })
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
const ruleOf = async (promise: Promise<unknown>) => engineErrorRule(await caught(promise))?.rule ?? null

async function createGroup(owner: Person, networkId: Id<"networks">, name = "Cuisine du pays", key = `cle-${name}`) {
  return (await owner.as.mutation(api.modules.thematicGroups.thematicGroups.create, { networkId, name, idempotencyKey: key })).groupId
}

async function card(reader: Person, networkId: Id<"networks">, groupId: Id<"thematicGroups">) {
  return await reader.as.query(api.modules.thematicGroups.thematicGroups.getGroup, { networkId, groupId })
}

async function bellKinds(person: Person, networkId: Id<"networks">) {
  return (await person.as.query(api.modules.notifications.bell.paginateNotifications, { networkId, paginationOpts: PAGE })).page.map((row) => row.kind)
}

describe("cycle de vie d'un groupe", () => {
  it("créer est idempotent par (créateur, clé) et fait un owner unique ; la clé rejouée dans un autre réseau est refusée", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    await t.run(async (ctx) => ctx.db.insert("networkMemberships", { networkId: testClosed, personId: alice.personId, status: "declaree", role: "member", joinedAt: 1, statusChangedAt: 1 }))
    const first = await alice.as.mutation(api.modules.thematicGroups.thematicGroups.create, { networkId: root, name: "Entraide", idempotencyKey: "k" })
    expect(await alice.as.mutation(api.modules.thematicGroups.thematicGroups.create, { networkId: root, name: "Entraide", idempotencyKey: "k" })).toEqual({ groupId: first.groupId, created: false })
    expect(await codeOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.create, { networkId: testClosed, name: "Entraide", idempotencyKey: "k" }))).toBe("conflict")
    expect(await card(alice, root, first.groupId)).toMatchObject({ name: "Entraide", memberCount: 1, myRole: "owner", state: "active" })
    expect(await ruleOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.create, { networkId: root, name: "x", idempotencyKey: "k2" }))).toBe("GROUP_NAME_LENGTH")
  })

  it("rejoindre puis quitter tient l'effectif ; re-rejoindre reprend en simple membre ; l'owner ne quitte pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    expect((await card(bob, root, groupId)).memberCount).toBe(2)
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.setMemberRole, { networkId: root, groupId, memberPersonId: bob.personId, role: "moderator" })
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.leave, { networkId: root, groupId })
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.leave, { networkId: root, groupId })
    expect(await card(bob, root, groupId)).toMatchObject({ memberCount: 1, myRole: null })
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    expect(await card(bob, root, groupId)).toMatchObject({ memberCount: 2, myRole: "member" })
    expect(await ruleOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.leave, { networkId: root, groupId }))).toBe("GROUP_OWNER_CANNOT_LEAVE")
  })

  it("fermer gèle les actes et retire de la découverte, la fiche reste ; archiver est monotone", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const groupId = await createGroup(alice, root)
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.closeGroup, { networkId: root, groupId }))).toBe("groupMembershipRequired")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.closeGroup, { networkId: root, groupId })
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId }))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Encore ?", audience: "group", groupId }))).toBe("notFound")
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.discover, { networkId: root })).map((row) => row.groupId)).toEqual([])
    expect((await card(bob, root, groupId)).state).toBe("closed")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.archiveGroup, { networkId: root, groupId })
    const archivedAt = await t.run(async (ctx) => (await ctx.db.get(groupId))?.archivedAt)
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.archiveGroup, { networkId: root, groupId })
    expect(await t.run(async (ctx) => (await ctx.db.get(groupId))?.archivedAt)).toBe(archivedAt)
    expect((await card(alice, root, groupId)).state).toBe("archived")
  })

  it("supprime en cascade bornée : publications, réactions, commentaires, marques, signalements, membres, invitations, médias et lignes d'analyse", async () => {
    vi.useFakeTimers()
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    await connect(t, root, alice, carol)
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle: "carol" })
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([PNG as BlobPart], { type: "image/png" })))
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, {
      networkId: root,
      body: "Au menu",
      audience: "group",
      groupId,
      media: [{ storageId, kind: "image", mimeType: "image/png", sizeBytes: PNG.length }],
    })
    await bob.as.mutation(api.modules.engagement.engagement.toggleReaction, { networkId: root, postId, kind: "bravo" })
    await bob.as.mutation(api.modules.engagement.engagement.comment, { networkId: root, postId, body: "Miam" })
    await bob.as.mutation(api.modules.marks.marks.toggleMark, { networkId: root, postId, kind: "bookmark" })
    await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId, reason: "other" })

    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.deleteGroup, { networkId: root, groupId }))).toBe("groupRoleRequired")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.deleteGroup, { networkId: root, groupId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const remaining = await t.run(async (ctx) => ({
      group: await ctx.db.get(groupId),
      post: await ctx.db.get(postId),
      reactions: (await ctx.db.query("postReactions").take(10)).length,
      shards: (await ctx.db.query("postReactionShards").take(10)).length,
      comments: (await ctx.db.query("postComments").take(10)).length,
      marks: (await ctx.db.query("postMarks").take(10)).length,
      reports: (await ctx.db.query("contentReports").take(10)).length,
      members: (await ctx.db.query("thematicGroupMembers").take(10)).length,
      invites: (await ctx.db.query("thematicGroupInvites").take(10)).length,
      scans: (await ctx.db.query("fileScans").take(10)).length,
      blob: await ctx.storage.getUrl(storageId),
    }))
    expect(remaining).toEqual({ group: null, post: null, reactions: 0, shards: 0, comments: 0, marks: 0, reports: 0, members: 0, invites: 0, scans: 0, blob: null })
  })
})

describe("publier et lire dans un groupe", () => {
  it("un co-membre lit au titre `group`, un non-membre reçoit le refus INDISTINCT ; quitter referme ; aucune portée du fil, aucune recherche", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Recette secrète", audience: "group", groupId })
    expect(await t.run(async (ctx) => ctx.db.get(postId))).toMatchObject({ audience: "group", groupId })
    expect(await bob.as.query(api.modules.posts.posts.getPost, { networkId: root, postId })).toMatchObject({ reason: "group", groupId })
    expect(await codeOf(carla.as.query(api.modules.posts.posts.getPost, { networkId: root, postId }))).toBe("notFound")
    expect(await codeOf(carla.as.mutation(api.modules.engagement.engagement.comment, { networkId: root, postId, body: "Intrusion" }))).toBe("notFound")
    expect((await bob.as.query(api.modules.posts.posts.myFeed, { networkId: root, scope: "recents" })).items).toEqual([])
    expect((await alice.as.query(api.modules.posts.posts.myFeed, { networkId: root })).items).toEqual([])
    expect((await bob.as.query(api.modules.posts.posts.search, { networkId: root, query: "recette" })).items).toEqual([])
    expect(await codeOf(carla.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId }))).toBe("groupMembershipRequired")
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId })).items.map((item) => [item._id, item.reason])).toEqual([[postId, "group"]])
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.leave, { networkId: root, groupId })
    expect(await codeOf(bob.as.query(api.modules.posts.posts.getPost, { networkId: root, postId }))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Encore", audience: "group", groupId }))).toBe("groupMembershipRequired")
  })

  it("un blocage ferme le groupe entre deux co-membres : mur filtré et lecture refusée, dans les deux sens", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const fromAlice = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "D'Alice", audience: "group", groupId })
    const fromBob = await bob.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "De Bob", audience: "group", groupId })
    await alice.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: bob.personId })
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId })).items.map((item) => item._id)).toEqual([fromBob.postId])
    expect((await alice.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId })).items.map((item) => item._id)).toEqual([fromAlice.postId])
    expect(await codeOf(bob.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: fromAlice.postId }))).toBe("notFound")
    expect(await codeOf(alice.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: fromBob.postId }))).toBe("notFound")
  })

  it("une publication de groupe ne se partage jamais : règle pour le co-membre, refus indistinct pour le dehors", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Interne", audience: "group", groupId })
    expect(await ruleOf(bob.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "", sharedPostId: postId }))).toBe("POST_NOT_SHAREABLE")
    expect(await codeOf(carla.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "", sharedPostId: postId }))).toBe("notFound")
  })

  it("citer un co-membre le sonne ; une connexion hors du groupe, ou un co-membre bloqué par l'auteur, non", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const dan = await enter(t, root, "dan")
    await connect(t, root, alice, carla)
    const groupId = await createGroup(alice, root)
    for (const person of [bob, dan]) await person.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    await alice.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: dan.personId })
    await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Merci @bob, @carla et @dan", audience: "group", groupId })
    expect(await bellKinds(bob, root)).toEqual(["mention"])
    expect(await bellKinds(carla, root)).toEqual([])
    expect(await bellKinds(dan, root)).toEqual([])
  })

  it("le mur se parcourt sans perte quand des publications partagent le même instant (curseur composite)", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const groupId = await createGroup(alice, root)
    const ids = await t.run(async (ctx) => {
      const out: string[] = []
      for (let i = 0; i < 60; i += 1) {
        out.push(
          await ctx.db.insert("posts", {
            networkId: root,
            authorPersonId: alice.personId,
            body: `Sujet ${i}`,
            audience: "group",
            groupId,
            visibility: "network",
            onRoot: true,
            status: "published",
            searchText: "",
            publishedAt: 1_700_000_000_000,
            createdAt: 1,
            updatedAt: 1,
          }),
        )
      }
      return out
    })
    const seen: string[] = []
    let cursor: { publishedAt: number; postId: Id<"posts"> } | undefined
    for (let turn = 0; turn < 10; turn += 1) {
      const page = await alice.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId, limit: 25, ...(cursor ? { cursor } : {}) })
      seen.push(...page.items.map((item) => item._id))
      if (page.nextCursor === null) break
      cursor = page.nextCursor
    }
    expect(new Set(seen)).toEqual(new Set(ids))
    expect(seen).toHaveLength(60)
  })
})

describe("invitations", () => {
  it("inviter sonne l'invitée ; `alreadyInvited` distingue le rappel ; accepter rejoint et résout toutes les lignes", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, carla)
    await connect(t, root, bob, carla)
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const invite = (person: Person) => person.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle: "carla" })
    expect(await invite(alice)).toEqual({ invited: true, alreadyInvited: false })
    expect(await invite(bob)).toEqual({ invited: true, alreadyInvited: true })
    expect(await bellKinds(carla, root)).toEqual(["thematic_group_invite", "thematic_group_invite"])
    const [mine] = (await carla.as.query(api.modules.thematicGroups.thematicGroups.paginateMyInvites, { networkId: root, paginationOpts: PAGE })).page
    expect(mine).toMatchObject({ groupId, groupName: "Cuisine du pays", memberCount: 2 })
    expect(await carla.as.mutation(api.modules.thematicGroups.thematicGroups.respondInvite, { networkId: root, inviteId: mine!.inviteId, accept: true })).toEqual({ joined: true })
    const bell = await carla.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: PAGE })
    expect(bell.page.every((row) => row.resolution?.kind === "accepted")).toBe(true)
    expect((await card(carla, root, groupId)).memberCount).toBe(3)
    expect(await invite(alice)).toEqual({ invited: false, alreadyInvited: false })
  })

  it("anti-oracle : inconnue, non connectée ou bloquée — le MÊME refus ; décliner n'émet rien ; la réponse d'autrui est refusée", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const dan = await enter(t, root, "dan")
    await connect(t, root, alice, carla)
    await connect(t, root, alice, dan)
    const groupId = await createGroup(alice, root)
    await alice.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: dan.personId })
    for (const handle of ["personne", "bob", "dan"]) {
      expect(await codeOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle }))).toBe("notFound")
    }
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle: "carla" })
    const [pending] = (await carla.as.query(api.modules.thematicGroups.thematicGroups.paginateMyInvites, { networkId: root, paginationOpts: PAGE })).page
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.respondInvite, { networkId: root, inviteId: pending!.inviteId, accept: true }))).toBe("notFound")
    await carla.as.mutation(api.modules.thematicGroups.thematicGroups.respondInvite, { networkId: root, inviteId: pending!.inviteId, accept: false })
    expect(await bellKinds(alice, root)).toEqual([])
    expect((await carla.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: PAGE })).page[0]?.resolution?.kind).toBe("declined")
    expect(await codeOf(carla.as.mutation(api.modules.thematicGroups.thematicGroups.respondInvite, { networkId: root, inviteId: pending!.inviteId, accept: true }))).toBe("notFound")
  })

  it("déjà membre entre-temps (adhésion libre) : l'acceptation résout quand même, l'effectif ne bouge pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const carla = await enter(t, root, "carla")
    await connect(t, root, alice, carla)
    const groupId = await createGroup(alice, root)
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle: "carla" })
    const [pending] = (await carla.as.query(api.modules.thematicGroups.thematicGroups.paginateMyInvites, { networkId: root, paginationOpts: PAGE })).page
    await carla.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    expect((await carla.as.query(api.modules.notifications.bell.paginateNotifications, { networkId: root, paginationOpts: PAGE })).page[0]?.resolution?.kind).toBe("accepted")
    expect(await carla.as.mutation(api.modules.thematicGroups.thematicGroups.respondInvite, { networkId: root, inviteId: pending!.inviteId, accept: true })).toEqual({ joined: true })
    expect((await card(carla, root, groupId)).memberCount).toBe(2)
  })

  it("le vivier : réservé aux membres, il dit éligible, déjà membre ou déjà invitée ; une relation bloquée en sort ; chacun le sien", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const dan = await enter(t, root, "dan")
    const eve = await enter(t, root, "eve")
    for (const person of [bob, carla, dan, eve]) await connect(t, root, alice, person)
    const groupId = await createGroup(alice, root)
    expect(await codeOf(carla.as.query(api.modules.thematicGroups.thematicGroups.listInviteCandidates, { networkId: root, groupId }))).toBe("groupMembershipRequired")
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId, handle: "carla" })
    await alice.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: eve.personId })
    const pool = await alice.as.query(api.modules.thematicGroups.thematicGroups.listInviteCandidates, { networkId: root, groupId })
    expect(pool).toEqual({
      items: [
        expect.objectContaining({ handle: "bob", status: "member" }),
        expect.objectContaining({ handle: "carla", status: "invited" }),
        expect.objectContaining({ handle: "dan", status: "eligible" }),
      ],
      truncated: false,
    })
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.listInviteCandidates, { networkId: root, groupId })).items.map((row) => row.handle)).toEqual(["alice"])
  })
})

describe("rôles, effectif et modération de groupe", () => {
  it("l'owner promeut et rétrograde, un modérateur non ; un modérateur retire un simple membre, jamais un pair ; la liste est réservée aux membres", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const dan = await enter(t, root, "dan")
    const outsider = await enter(t, root, "dehors")
    const groupId = await createGroup(alice, root)
    for (const person of [bob, carla, dan]) await person.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.setMemberRole, { networkId: root, groupId, memberPersonId: bob.personId, role: "moderator" })
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.setMemberRole, { networkId: root, groupId, memberPersonId: carla.personId, role: "moderator" })
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.setMemberRole, { networkId: root, groupId, memberPersonId: dan.personId, role: "moderator" }))).toBe("groupRoleRequired")
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.removeMember, { networkId: root, groupId, memberPersonId: carla.personId }))).toBe("groupRoleRequired")
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.removeMember, { networkId: root, groupId, memberPersonId: dan.personId })
    expect((await card(alice, root, groupId)).memberCount).toBe(3)
    const members = await alice.as.query(api.modules.thematicGroups.thematicGroups.paginateMembers, { networkId: root, groupId, paginationOpts: PAGE })
    expect(members.page.map((row) => [row.handle, row.role])).toEqual([
      ["alice", "owner"],
      ["bob", "moderator"],
      ["carla", "moderator"],
    ])
    expect(await codeOf(outsider.as.query(api.modules.thematicGroups.thematicGroups.paginateMembers, { networkId: root, groupId, paginationOpts: PAGE }))).toBe("groupMembershipRequired")
  })

  it("owner et modérateur retirent et épinglent ; un simple membre non ; l'auteur garde la sienne ; l'épinglée est re-gardée", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carla = await enter(t, root, "carla")
    const outsider = await enter(t, root, "dehors")
    const groupId = await createGroup(alice, root)
    const otherGroup = await createGroup(alice, root, "Autre thème", "autre")
    for (const person of [bob, carla]) await person.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const pinnable = await carla.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "À épingler", audience: "group", groupId })
    const elsewhere = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Ailleurs", audience: "group", groupId: otherGroup })
    expect(await codeOf(carla.as.mutation(api.modules.thematicGroups.thematicGroups.pinGroupPost, { networkId: root, groupId, postId: pinnable.postId }))).toBe("groupRoleRequired")
    expect(await codeOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.pinGroupPost, { networkId: root, groupId, postId: elsewhere.postId }))).toBe("notFound")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.pinGroupPost, { networkId: root, groupId, postId: pinnable.postId })
    expect((await card(bob, root, groupId)).pinned?._id).toBe(pinnable.postId)
    expect((await card(outsider, root, groupId)).pinned).toBeNull()

    const open = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Hors groupe" })
    expect(await codeOf(alice.as.mutation(api.modules.thematicGroups.thematicGroups.removeGroupPost, { networkId: root, postId: open.postId }))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.removeGroupPost, { networkId: root, postId: pinnable.postId }))).toBe("groupRoleRequired")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.setMemberRole, { networkId: root, groupId, memberPersonId: bob.personId, role: "moderator" })
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.removeGroupPost, { networkId: root, postId: pinnable.postId })
    expect((await card(alice, root, groupId)).pinned).toBeNull()
    expect(await carla.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: pinnable.postId })).toMatchObject({ isMine: true })
    expect(await codeOf(alice.as.query(api.modules.posts.posts.getPost, { networkId: root, postId: pinnable.postId }))).toBe("notFound")
  })
})

describe("découverte", () => {
  it("la fiche est découvrable par un non-membre, avec son état ; mes groupes disent mon rôle ; un groupe d'un autre réseau est introuvable", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await connect(t, root, alice, bob)
    await t.run(async (ctx) => ctx.db.insert("networkMemberships", { networkId: testClosed, personId: alice.personId, status: "declaree", role: "member", joinedAt: 1, statusChangedAt: 1 }))
    const cooking = await createGroup(alice, root, "Cuisine gabonaise", "c")
    await createGroup(alice, root, "Randonnée", "r")
    const elsewhere = await createGroup(alice, testClosed, "Réseau fermé", "f")
    await alice.as.mutation(api.modules.thematicGroups.thematicGroups.invite, { networkId: root, groupId: cooking, handle: "bob" })
    const found = await bob.as.query(api.modules.thematicGroups.thematicGroups.discover, { networkId: root, query: "cuisine" })
    expect(found).toEqual([expect.objectContaining({ groupId: cooking, myRole: null, invited: true, memberCount: 1 })])
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.discover, { networkId: root })).map((row) => row.name).sort()).toEqual(["Cuisine gabonaise", "Randonnée"])
    expect((await alice.as.query(api.modules.thematicGroups.thematicGroups.myGroups, { networkId: root })).items.map((row) => row.myRole)).toEqual(["owner", "owner"])
    expect(await codeOf(alice.as.query(api.modules.thematicGroups.thematicGroups.getGroup, { networkId: root, groupId: elsewhere }))).toBe("notFound")
    expect(await codeOf(bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId: elsewhere }))).toBe("notFound")
  })
})

describe("le signalement d'une publication de groupe", () => {
  it("fonctionne pour un co-membre et masque pour le signaleur ; l'admission des fichiers garde le réseau", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const groupId = await createGroup(alice, root)
    await bob.as.mutation(api.modules.thematicGroups.thematicGroups.join, { networkId: root, groupId })
    const { postId } = await alice.as.mutation(api.modules.posts.posts.publish, { networkId: root, body: "Discutable", audience: "group", groupId })
    expect(await bob.as.mutation(api.modules.moderation.moderation.reportPost, { networkId: root, postId, reason: "misinformation" })).toMatchObject({ created: true, hidden: true })
    expect((await bob.as.query(api.modules.thematicGroups.thematicGroups.groupWall, { networkId: root, groupId })).items).toEqual([])
    // Une admission directe reste possible pour les écrivains du moteur : la ligne d'analyse porte le réseau.
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([PNG as BlobPart], { type: "image/png" })))
    const { scanId } = await t.run(async (ctx) =>
      admitStoredUpload(ctx as unknown as MutationCtx, { storageId, usage: "media_social", mimeType: "image/png" }, { source: "post_media", networkId: root, uploadedByPersonId: alice.personId }),
    )
    expect(await t.run(async (ctx) => (await ctx.db.get(scanId))?.networkId)).toBe(root)
  })
})
