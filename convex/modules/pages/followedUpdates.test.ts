// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauPages/followedUpdates.test.ts @ ad2e7fdc2 — adaptations : personnes, réseaux et pages du moteur (créées par un membre vérifié) ; la note de service devenue la note aux abonnés (`followers`) ; le cas de l'extrait passé au domaine pur (`pages.test.ts`) ; cas neuf : depuis la racine, seuls les communiqués de la racine des pages suivies.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; handle: string }

const P = api.modules.pages.pages
const U = api.modules.pages.followedUpdates

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 9, 15, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string): Promise<Person> {
  vi.setSystemTime(Date.now() + 1000)
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  return { as, personId, handle }
}

async function verifiedIn(t: T, networkId: Id<"networks">, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (membership) await ctx.db.patch(membership._id, { status: "verifiee" })
    else await ctx.db.insert("networkMemberships", { networkId, personId: person.personId, status: "verifiee", role: "member", joinedAt: 1, statusChangedAt: 1 })
  })
}

async function publishAs(person: Person, networkId: Id<"networks">, pageId: Id<"pages">, body: string, audience: "public" | "followers" = "public") {
  vi.setSystemTime(Date.now() + 1000)
  return await person.as.mutation(P.publishAsPage, { networkId, pageId, body, audience })
}

describe("rappels des pages suivies", () => {
  it("ne rend que les COMMUNIQUÉS lisibles des pages suivies — ni la note aux abonnés, ni une page retirée, ni une page non suivie", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const reader = await enter(t, root, "lecteur")
    await verifiedIn(t, root, alice)
    const followed = await alice.as.mutation(P.createPage, { networkId: root, name: "Page suivie", ownerKind: "association" })
    const retired = await alice.as.mutation(P.createPage, { networkId: root, name: "Page retiree", ownerKind: "association" })
    const unfollowed = await alice.as.mutation(P.createPage, { networkId: root, name: "Page ignoree", ownerKind: "association" })
    await reader.as.mutation(P.follow, { networkId: root, handle: followed.handle })
    await reader.as.mutation(P.follow, { networkId: root, handle: retired.handle })
    const statement = await publishAs(alice, root, followed.pageId, "<p>Le   communiqué</p>")
    await publishAs(alice, root, followed.pageId, "La note aux abonnés", "followers")
    await publishAs(alice, root, retired.pageId, "Communiqué d'une page retirée")
    await publishAs(alice, root, unfollowed.pageId, "Communiqué d'une page non suivie")
    await t.run(async (ctx) => await ctx.db.patch(retired.pageId, { status: "inactive" }))
    expect(await reader.as.query(U.list, { networkId: root })).toMatchObject([{ postId: statement.postId, excerpt: "Le communiqué", page: { pageId: followed.pageId, name: "Page suivie" } }])
  })

  it("trie du plus récent au plus ancien et s'arrête à cinq", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const reader = await enter(t, root, "lecteur")
    await verifiedIn(t, root, alice)
    await verifiedIn(t, root, bob)
    const first = await alice.as.mutation(P.createPage, { networkId: root, name: "Premiere page", ownerKind: "media" })
    const second = await bob.as.mutation(P.createPage, { networkId: root, name: "Seconde page", ownerKind: "media" })
    await reader.as.mutation(P.follow, { networkId: root, handle: first.handle })
    await reader.as.mutation(P.follow, { networkId: root, handle: second.handle })
    const published: Id<"posts">[] = []
    for (let index = 0; index < 4; index += 1) {
      published.push((await publishAs(alice, root, first.pageId, `Alice ${index}`)).postId)
      published.push((await publishAs(bob, root, second.pageId, `Bob ${index}`)).postId)
    }
    expect((await reader.as.query(U.list, { networkId: root })).map((row) => row.postId)).toEqual(published.slice(-5).reverse())
  })

  it("depuis la racine : seuls les communiqués de la racine d'une page suivie d'un réseau fermé", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const reader = await enter(t, root, "lecteur")
    await verifiedIn(t, testClosed, alice)
    const rooted = await alice.as.mutation(P.createPage, { networkId: testClosed, name: "Consulat de Paris", ownerKind: "community", visibility: "root" })
    await reader.as.mutation(P.follow, { networkId: root, handle: rooted.handle })
    const statement = await publishAs(alice, testClosed, rooted.pageId, "Fermeture exceptionnelle vendredi")
    await publishAs(alice, testClosed, rooted.pageId, "Note aux abonnés", "followers")
    expect((await reader.as.query(U.list, { networkId: root })).map((row) => row.postId)).toEqual([statement.postId])
  })
})
