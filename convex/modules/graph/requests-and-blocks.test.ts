// @vitest-environment edge-runtime
/** Contrat 08 : annulations versionnées et intentions personnelles, sans migration des marqueurs. */
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { canonicalPair } from "@antsia/social-domain/connectionState"
import type { MembershipStatus } from "@antsia/social-domain/membership"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { acceptedCounterpartIds, blockedCounterpartIds, isBlockedBetween, isConnectedTo, pendingCounterpartIds } from "./graph"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; subject: string }
const NOW = Date.UTC(2026, 9, 16, 22)
const C = api.modules.graph.connections
const B = api.modules.graph.blocks

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function enter(t: T, root: Id<"networks">, subject: string): Promise<Person> {
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: subject, displayName: subject })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  return { as, personId, subject }
}

async function fixture() {
  const t = testConvex()
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carol = await enter(t, root, "carol")
  return { t, root, testClosed, alice, bob, carol }
}

async function setStatus(t: T, networkId: Id<"networks">, personId: Id<"persons">, status: MembershipStatus) {
  await t.run(async (ctx) => {
    const row = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", personId)).unique()
    if (!row) throw new Error("Adhésion de test absente")
    await ctx.db.patch(row._id, { status })
  })
}

async function caught(promise: Promise<unknown>) {
  try { await promise } catch (error) { return error }
  return null
}
const codeOf = async (promise: Promise<unknown>) => engineErrorCode(await caught(promise))

async function connection(t: T, networkId: Id<"networks">, first: Person, second: Person) {
  return await t.run(async (ctx) => {
    const pair = canonicalPair(first.personId, second.personId)
    const row = await ctx.db.query("connections").withIndex("by_network_pair", (q) => q.eq("networkId", networkId).eq("personIdLow", pair.low).eq("personIdHigh", pair.high)).unique()
    if (!row) throw new Error("Connexion de test absente")
    return row
  })
}

async function graphSnapshot(t: T) {
  return await t.run(async (ctx) => ({
    connections: await ctx.db.query("connections").take(110),
    intents: await ctx.db.query("personBlocks").take(110),
    follows: await ctx.db.query("follows").take(110),
    notifications: await ctx.db.query("notifications").take(110),
  }))
}

async function request(t: T, networkId: Id<"networks">, from: Person, to: Person) {
  await from.as.mutation(C.requestConnection, { networkId, targetPersonId: to.personId })
  return await connection(t, networkId, from, to)
}

const cancelArgs = (networkId: Id<"networks">, row: Doc<"connections">) => ({ networkId, connectionId: row._id, expectedRequestedAt: row.requestedAt })
const pageArgs = (networkId: Id<"networks">, source: "intents" | "legacy", cursor: string | null = null, numItems = 50) => ({ networkId, source, paginationOpts: { numItems, cursor } })

describe("annuler une demande envoyée — version et autorité", () => {
  it("l'auteur en attente annule et rejoue sans nouvelle notification ; la cloche reçue est résolue en cancelled", async () => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    const before = await graphSnapshot(t)
    expect(before.notifications).toHaveLength(1)
    await setStatus(t, root, alice.personId, "en_attente")
    expect((await alice.as.query(api.modules.suggestions.suggestions.paginateSentInvitations, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })).page).toMatchObject([{ connectionId: row._id, at: row.requestedAt }])

    expect(await alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row))).toBeNull()
    const after = await graphSnapshot(t)
    expect(after.connections[0]).toMatchObject({ status: "declined", cancelledRequestedAt: row.requestedAt, requestedByPersonId: alice.personId })
    expect(after.notifications).toHaveLength(1)
    expect(after.notifications[0]).toMatchObject({ recipientPersonId: bob.personId, kind: "connection_request", resolution: "cancelled", resolvedAt: NOW, readAt: NOW })
    expect(after.follows).toEqual(before.follows)
    expect((await alice.as.query(api.modules.suggestions.suggestions.paginateSentInvitations, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([])
    vi.setSystemTime(NOW + 1000)
    expect(await alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row))).toBeNull()
    expect(await graphSnapshot(t)).toEqual(after)
  })

  it("le rejeu d'une version annulée reste muet après un blocage inverse et préserve ce blocage", async () => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    await alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row))
    await bob.as.mutation(C.blockPerson, { networkId: root, targetPersonId: alice.personId })
    const before = await graphSnapshot(t)
    expect(before.connections[0]).toMatchObject({ status: "blocked", blockedByPersonId: bob.personId, cancelledRequestedAt: row.requestedAt })
    expect(before.intents).toMatchObject([{ blockerPersonId: bob.personId, targetPersonId: alice.personId }])
    expect(await alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row))).toBeNull()
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it("destinataire, tiers, autre réseau et version différente reçoivent le même refus sans effet", async () => {
    const { t, root, testClosed, alice, bob, carol } = await fixture()
    const row = await request(t, root, alice, bob)
    await alice.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    const before = await graphSnapshot(t)
    for (const attempt of [
      () => bob.as.mutation(C.cancelSentRequest, cancelArgs(root, row)),
      () => carol.as.mutation(C.cancelSentRequest, cancelArgs(root, row)),
      () => alice.as.mutation(C.cancelSentRequest, cancelArgs(testClosed, row)),
      () => alice.as.mutation(C.cancelSentRequest, { ...cancelArgs(root, row), expectedRequestedAt: row.requestedAt + 1 }),
    ]) expect(await codeOf(attempt())).toBe("notFound")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it.each(["accepted", "declined", "blocked"] as const)("une demande %s n'est pas une annulation rejouable", async (status) => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    if (status === "blocked") await bob.as.mutation(C.blockPerson, { networkId: root, targetPersonId: alice.personId })
    else await bob.as.mutation(C.respondToConnection, { networkId: root, connectionId: row._id, accept: status === "accepted" })
    const before = await graphSnapshot(t)
    expect(await codeOf(alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row)))).toBe("notFound")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it("la réémission sous horloge fixe avance la version et efface la marque ; l'ancien bouton n'annule rien", async () => {
    const { t, root, alice, bob } = await fixture()
    const first = await request(t, root, alice, bob)
    await alice.as.mutation(C.cancelSentRequest, cancelArgs(root, first))
    const next = await request(t, root, alice, bob)
    expect(next._id).toBe(first._id)
    expect(next.requestedAt).toBe(first.requestedAt + 1)
    expect(next.cancelledRequestedAt).toBeUndefined()
    const before = await graphSnapshot(t)
    expect(await codeOf(alice.as.mutation(C.cancelSentRequest, cancelArgs(root, first)))).toBe("notFound")
    expect(await graphSnapshot(t)).toEqual(before)
    expect(before.notifications).toHaveLength(1)
    expect(before.notifications[0]?.resolution).toBeUndefined()
    await bob.as.mutation(C.respondToConnection, { networkId: root, connectionId: next._id, accept: false })
    const reversed = await request(t, root, bob, alice)
    expect(reversed.requestedAt).toBe(next.requestedAt + 1)
    expect(await codeOf(alice.as.mutation(C.cancelSentRequest, cancelArgs(root, reversed)))).toBe("notFound")
  })

  it.each(["accept-first", "cancel-first"] as const)("une réponse et une annulation concurrentes ne peuvent réussir ensemble (%s)", async (order) => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    const accept = () => bob.as.mutation(C.respondToConnection, { networkId: root, connectionId: row._id, accept: true })
    const cancel = () => alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row))
    const outcomes = await Promise.allSettled(order === "accept-first" ? [accept(), cancel()] : [cancel(), accept()])
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1)
    const current = await connection(t, root, alice, bob)
    expect(["accepted", "declined"]).toContain(current.status)
    const notifications = (await graphSnapshot(t)).notifications
    if (current.status === "declined") {
      expect(current.cancelledRequestedAt).toBe(row.requestedAt)
      expect(notifications).toHaveLength(1)
      expect(notifications[0]?.resolution).toBe("cancelled")
    } else expect(notifications.some((notification) => notification.kind === "connection_accepted")).toBe(true)
  })

  it("la session et les sanctions demeurent des gardes avant l'annulation", async () => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    const before = await graphSnapshot(t)
    expect(await codeOf(t.mutation(C.cancelSentRequest, cancelArgs(root, row)))).toBe("unauthenticated")
    const stale = t.withIdentity({ subject: alice.subject, sessionId: "session-absente" })
    expect(await codeOf(stale.mutation(C.cancelSentRequest, cancelArgs(root, row)))).toBe("unauthenticated")
    await setStatus(t, root, alice.personId, "suspendue")
    expect(await codeOf(alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row)))).toBe("membershipSuspended")
    expect(await graphSnapshot(t)).toEqual(before)
  })
})

describe("blocages personnels — coexistence et lecture", () => {
  it.each(["deletionRequestedAt", "erasedAt"] as const)("une cible marquée %s ne reçoit aucune référence de blocage tardive", async (marker) => {
    const { t, root, alice, bob } = await fixture()
    await t.run(async (ctx) => {
      if (marker === "deletionRequestedAt") await ctx.db.patch(bob.personId, { deletionRequestedAt: NOW })
      else await ctx.db.patch(bob.personId, { erasedAt: NOW, authUserId: "erased:bob", handle: undefined, displayName: undefined, publishedAt: undefined })
    })
    const before = await graphSnapshot(t)
    expect(await codeOf(alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: bob.personId }))).toBe("notFound")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it.each(["alice", "bob"] as const)("les blocages réciproques survivent à un premier déblocage, quel que soit l'ordre (%s)", async (firstName) => {
    const { t, root, alice, bob } = await fixture()
    const first = firstName === "alice" ? alice : bob
    const second = firstName === "alice" ? bob : alice
    await setStatus(t, root, first.personId, "en_attente")
    await setStatus(t, root, second.personId, "en_attente")
    await first.as.mutation(C.blockPerson, { networkId: root, targetPersonId: second.personId })
    await second.as.mutation(C.blockPerson, { networkId: root, targetPersonId: first.personId })
    const original = await graphSnapshot(t)
    expect(original.intents).toHaveLength(2)
    expect(original.notifications).toEqual([])
    expect(await first.as.query(C.connectionWith, { networkId: root, otherPersonId: second.personId })).toMatchObject({ state: "blocked_by_me" })
    expect(await second.as.query(C.connectionWith, { networkId: root, otherPersonId: first.personId })).toMatchObject({ state: "blocked_by_me" })
    vi.setSystemTime(NOW + 1000)
    await second.as.mutation(C.blockPerson, { networkId: root, targetPersonId: first.personId })
    expect((await graphSnapshot(t)).intents).toEqual(original.intents)

    await first.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: second.personId })
    expect(await t.run((ctx) => isBlockedBetween(ctx, first.personId, second.personId))).toBe(true)
    expect(await first.as.query(C.connectionWith, { networkId: root, otherPersonId: second.personId })).toEqual({ state: "none" })
    expect(await second.as.query(C.connectionWith, { networkId: root, otherPersonId: first.personId })).toMatchObject({ state: "blocked_by_me" })
    const afterFirst = await graphSnapshot(t)
    expect(afterFirst.intents.map((intent) => intent.blockerPersonId)).toEqual([second.personId])
    expect(afterFirst.connections.every((row) => row.status === "declined")).toBe(true)

    await second.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: first.personId })
    expect(await t.run((ctx) => isBlockedBetween(ctx, first.personId, second.personId))).toBe(false)
    const final = await graphSnapshot(t)
    expect(final.intents).toEqual([])
    expect(final.connections.every((row) => row.status === "declined")).toBe(true)
    expect(final.follows).toEqual(original.follows)
    expect(final.notifications).toEqual(original.notifications)
  })

  it("une intention seule se lit sans inventer d'identifiant de connexion ; le blocage inverse reste muet", async () => {
    const { t, root, alice, bob } = await fixture()
    await t.run((ctx) => ctx.db.insert("personBlocks", { networkId: root, blockerPersonId: alice.personId, targetPersonId: bob.personId, createdAt: NOW, updatedAt: NOW }))
    expect(await alice.as.query(C.connectionWith, { networkId: root, otherPersonId: bob.personId })).toEqual({ state: "blocked_by_me", connectionId: null })
    expect(await bob.as.query(C.connectionWith, { networkId: root, otherPersonId: alice.personId })).toEqual({ state: "none" })
    expect(await alice.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "bob" })).toBeNull()
    expect(await bob.as.query(api.modules.people.profile.getPublicProfile, { networkId: root, handle: "alice" })).toBeNull()
    expect(await bob.as.mutation(C.requestConnection, { networkId: root, handle: "alice" })).toEqual({ status: "requested" })
    expect((await graphSnapshot(t)).connections).toEqual([])
    expect((await graphSnapshot(t)).notifications).toEqual([])
  })

  it("les lecteurs privés et façades de liens acceptés/en attente respectent une intention hors du réseau", async () => {
    const { t, root, testClosed, alice, bob, carol } = await fixture()
    const pair = canonicalPair(alice.personId, bob.personId)
    const pendingPair = canonicalPair(alice.personId, carol.personId)
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert("personBlocks", { networkId: testClosed, blockerPersonId: bob.personId, targetPersonId: alice.personId, createdAt: NOW, updatedAt: NOW })
      await ctx.db.insert("personBlocks", { networkId: testClosed, blockerPersonId: carol.personId, targetPersonId: alice.personId, createdAt: NOW, updatedAt: NOW })
      const accepted = await ctx.db.insert("connections", { networkId: root, personIdLow: pair.low, personIdHigh: pair.high, requestedByPersonId: alice.personId, recipientPersonId: bob.personId, status: "accepted", requestedAt: NOW, respondedAt: NOW, updatedAt: NOW })
      const pending = await ctx.db.insert("connections", { networkId: root, personIdLow: pendingPair.low, personIdHigh: pendingPair.high, requestedByPersonId: carol.personId, recipientPersonId: alice.personId, status: "requested", requestedAt: NOW, updatedAt: NOW })
      return { accepted, pending }
    })
    expect(await t.run((ctx) => isConnectedTo(ctx, root, alice.personId, bob.personId))).toBe(false)
    const readers = await t.run(async (ctx) => {
      const [accepted, pending, blocked] = await Promise.all([
        acceptedCounterpartIds(ctx, root, alice.personId),
        pendingCounterpartIds(ctx, root, alice.personId),
        blockedCounterpartIds(ctx, alice.personId),
      ])
      return { accepted: [...accepted.ids], pendingByThem: [...pending.byThem], blocked: [...blocked.ids] }
    })
    expect(readers.accepted).toEqual([])
    expect(readers.pendingByThem).toEqual([])
    expect(readers.blocked).toHaveLength(2)
    expect(readers.blocked).toEqual(expect.arrayContaining([bob.personId, carol.personId]))
    const listed = await alice.as.query(C.paginateMine, { networkId: root, lowPaginationOpts: { numItems: 10, cursor: null }, highPaginationOpts: { numItems: 10, cursor: null } })
    expect([...listed.low.page, ...listed.high.page]).toEqual([])
    expect((await alice.as.query(C.paginatePendingForMe, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([])
    expect(await alice.as.query(C.pendingState, { networkId: root, connectionId: ids.pending })).toEqual({ status: "declined", iAmRecipient: true })
    expect(await codeOf(alice.as.mutation(C.respondToConnection, { networkId: root, connectionId: ids.pending, accept: true }))).toBe("notFound")
  })

  it("les marqueurs historiques seuls restent fermés, listables et déblocables sans créer d'intention", async () => {
    const { t, root, testClosed, alice, bob } = await fixture()
    const pair = canonicalPair(alice.personId, bob.personId)
    await t.run(async (ctx) => {
      for (const networkId of [root, testClosed]) await ctx.db.insert("connections", { networkId, personIdLow: pair.low, personIdHigh: pair.high, requestedByPersonId: alice.personId, recipientPersonId: bob.personId, status: "blocked", blockedByPersonId: alice.personId, requestedAt: NOW - 1, updatedAt: NOW })
    })
    expect((await alice.as.query(B.paginateMine, pageArgs(root, "intents"))).page).toEqual([])
    const legacy = await alice.as.query(B.paginateMine, pageArgs(root, "legacy", null, 1))
    expect(legacy.isDone).toBe(false)
    const tail = await alice.as.query(B.paginateMine, pageArgs(root, "legacy", legacy.continueCursor, 1))
    expect(tail.isDone).toBe(true)
    expect([...legacy.page, ...tail.page]).toEqual([{ targetPersonId: bob.personId, at: NOW }, { targetPersonId: bob.personId, at: NOW }])
    expect((await bob.as.query(B.paginateMine, pageArgs(root, "legacy"))).page).toEqual([])
    expect(await t.run((ctx) => isBlockedBetween(ctx, alice.personId, bob.personId))).toBe(true)
    expect(await codeOf(bob.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: alice.personId }))).toBe("notFound")
    await alice.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: bob.personId })
    const after = await graphSnapshot(t)
    expect(after.intents).toEqual([])
    expect(after.connections.every((row) => row.status === "declined" && row.blockedByPersonId === undefined)).toBe(true)
    expect(after.notifications).toEqual([])
    expect(after.follows).toEqual([])
  })

  it("débloquer ne reconstitue ni une connexion acceptée ni un abonnement retiré ni une notification", async () => {
    const { t, root, alice, bob } = await fixture()
    const row = await request(t, root, alice, bob)
    await bob.as.mutation(C.respondToConnection, { networkId: root, connectionId: row._id, accept: true })
    await alice.as.mutation(api.modules.graph.follows.follow, { networkId: root, handle: "bob" })
    await alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: bob.personId })
    await alice.as.mutation(api.modules.graph.follows.unfollow, { networkId: root, targetPersonId: bob.personId })
    const before = await graphSnapshot(t)

    await alice.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: bob.personId })
    const after = await graphSnapshot(t)
    expect(after.connections).toHaveLength(1)
    expect(after.connections[0]).toMatchObject({ _id: row._id, status: "declined" })
    expect(after.follows).toEqual([])
    expect(after.notifications).toEqual(before.notifications)
    expect(await alice.as.query(api.modules.graph.follows.isFollowing, { networkId: root, targetPersonId: bob.personId })).toBe(false)
  })

  it("les sources natives sont exhaustives, bornées à 50, sans identité ni blocages entrants", async () => {
    const { t, root, alice, bob, carol } = await fixture()
    const targetIds = await t.run(async (ctx) => {
      const ids: Id<"persons">[] = []
      for (let index = 0; index < 55; index += 1) {
        const targetPersonId = await ctx.db.insert("persons", { authUserId: `hidden-${index}`, createdAt: NOW, updatedAt: NOW })
        ids.push(targetPersonId)
        await ctx.db.insert("personBlocks", { networkId: root, blockerPersonId: alice.personId, targetPersonId, createdAt: NOW + index, updatedAt: NOW + index })
      }
      await ctx.db.insert("personBlocks", { networkId: root, blockerPersonId: bob.personId, targetPersonId: alice.personId, createdAt: NOW, updatedAt: NOW })
      return ids
    })
    const first = await alice.as.query(B.paginateMine, pageArgs(root, "intents", null, 1000))
    expect(first.page).toHaveLength(50)
    expect(first.isDone).toBe(false)
    const second = await alice.as.query(B.paginateMine, pageArgs(root, "intents", first.continueCursor, 1000))
    expect(second.page).toHaveLength(5)
    expect(second.isDone).toBe(true)
    const all = [...first.page, ...second.page]
    expect(new Set(all.map((row) => row.targetPersonId))).toEqual(new Set(targetIds))
    for (const row of all) expect(Object.keys(row).sort()).toEqual(["at", "targetPersonId"])
    expect((await carol.as.query(B.paginateMine, pageArgs(root, "intents"))).page).toEqual([])
    expect((await bob.as.query(B.paginateMine, pageArgs(root, "intents"))).page).toEqual([{ targetPersonId: alice.personId, at: NOW }])
    expect((await alice.as.query(B.paginateMine, pageArgs(root, "legacy"))).page).toEqual([])
  })

  it("la liste reste personnelle depuis tout réseau autorisé ; profils retirés et inconnus ne divulguent aucune identité", async () => {
    const { t, root, testClosed, alice, bob } = await fixture()
    await alice.as.mutation(api.modules.people.memberships.joinNetwork, { networkId: testClosed, facet: { values: { countryOfResidence: "FR" }, visibilities: {} } })
    await bob.as.mutation(api.modules.people.profile.withdrawMyProfile, {})
    await alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: bob.personId })
    const expected = [{ targetPersonId: bob.personId, at: NOW }]
    expect((await alice.as.query(B.paginateMine, pageArgs(testClosed, "intents"))).page).toEqual(expected)
    expect((await alice.as.query(B.paginateMine, pageArgs(testClosed, "legacy"))).page).toEqual(expected)
    const missing = await t.run(async (ctx) => {
      const id = await ctx.db.insert("persons", { authUserId: "gone", createdAt: NOW, updatedAt: NOW })
      await ctx.db.delete(id)
      return id
    })
    const before = await graphSnapshot(t)
    expect(await codeOf(alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: missing }))).toBe("notFound")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it.each(["block", "unblock"] as const)("101 lignes historiques refusent %s avant toute mutation partielle", async (operation) => {
    const { t, root, testClosed, alice, bob } = await fixture()
    const pair = canonicalPair(alice.personId, bob.personId)
    await t.run(async (ctx) => {
      const template = await ctx.db.get(testClosed)
      if (!template) throw new Error("Réseau de test absent")
      const { _id: _networkId, _creationTime: _creation, ...networkFields } = template
      if (operation === "unblock") await ctx.db.insert("personBlocks", { networkId: root, blockerPersonId: alice.personId, targetPersonId: bob.personId, createdAt: NOW, updatedAt: NOW })
      for (let index = 0; index < 101; index += 1) {
        const networkId = await ctx.db.insert("networks", { ...networkFields, slug: `pair-network-${index}` })
        await ctx.db.insert("connections", { networkId, personIdLow: pair.low, personIdHigh: pair.high, requestedByPersonId: alice.personId, recipientPersonId: bob.personId, status: operation === "unblock" ? "blocked" : "declined", ...(operation === "unblock" ? { blockedByPersonId: alice.personId } : {}), requestedAt: NOW, updatedAt: NOW })
      }
    })
    const before = await graphSnapshot(t)
    const command = operation === "block" ? C.blockPerson : C.unblockPerson
    expect(await codeOf(alice.as.mutation(command, { networkId: root, targetPersonId: bob.personId }))).toBe("conflict")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it("une session absente/périmée, un non-membre et une suspension ne lisent ni ne lèvent les protections", async () => {
    const { t, root, testClosed, alice, bob } = await fixture()
    await alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: bob.personId })
    const before = await graphSnapshot(t)
    expect(await codeOf(t.query(B.paginateMine, pageArgs(root, "intents")))).toBe("unauthenticated")
    const stale = t.withIdentity({ subject: alice.subject, sessionId: "session-absente" })
    expect(await codeOf(stale.query(B.paginateMine, pageArgs(root, "intents")))).toBe("unauthenticated")
    expect(await codeOf(alice.as.query(B.paginateMine, pageArgs(testClosed, "intents")))).toBe("notFound")
    await setStatus(t, root, alice.personId, "en_attente")
    expect((await alice.as.query(B.paginateMine, pageArgs(root, "intents"))).page).toHaveLength(1)
    await setStatus(t, root, alice.personId, "suspendue")
    expect(await codeOf(alice.as.query(B.paginateMine, pageArgs(root, "intents")))).toBe("membershipSuspended")
    expect(await codeOf(alice.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: bob.personId }))).toBe("membershipSuspended")
    expect(await graphSnapshot(t)).toEqual(before)
  })

  it.each(["suspension", "mute"] as const)("la sanction PA5 %s garde son effet sans ouvrir l'annulation ni le déblocage", async (kind) => {
    const { t, root, alice, bob, carol } = await fixture()
    const row = await request(t, root, alice, bob)
    await alice.as.mutation(C.blockPerson, { networkId: root, targetPersonId: carol.personId })
    await setStatus(t, root, alice.personId, "en_attente")
    await t.run(async (ctx) => {
      const target = { kind: "person" as const, id: alice.personId }
      const reportId = await ctx.db.insert("reports", { networkId: root, target, targetKind: "person", targetId: alice.personId, ownerPersonId: alice.personId, reason: "Recette de garde", level: "platform", status: "actioned", createdAt: NOW, updatedAt: NOW })
      await ctx.db.insert("sanctions", { networkId: root, reportId, personId: alice.personId, kind, status: "active", reason: "Recette de garde", target, createdAt: NOW, updatedAt: NOW })
    })
    const before = await graphSnapshot(t)
    if (kind === "suspension") expect(await codeOf(alice.as.query(B.paginateMine, pageArgs(root, "intents")))).toBe("membershipSuspended")
    else expect((await alice.as.query(B.paginateMine, pageArgs(root, "intents"))).page).toHaveLength(1)
    const expected = kind === "suspension" ? "membershipSuspended" : "policyRefused"
    expect(await codeOf(alice.as.mutation(C.cancelSentRequest, cancelArgs(root, row)))).toBe(expected)
    expect(await codeOf(alice.as.mutation(C.unblockPerson, { networkId: root, targetPersonId: carol.personId }))).toBe(expected)
    expect(await graphSnapshot(t)).toEqual(before)
  })
})
