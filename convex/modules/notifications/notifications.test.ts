// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/reseauPersonnel/notifications.test.ts (avec socle/convex/tests/notifications.test.ts) @ ad2e7fdc2 — adaptations : la cloche sociale du moteur, par réseau ; porte unique (soi-même, blocage, non-membre) ; pagination native seule (le curseur temporel qui levait est retiré, D18) ; non-lus bornés avec lacune (D19) ; résolution par le serveur ; diffusion par lots chaînés (patron icom/notifyFanout, D07) ; avis de verdict de la garde des fichiers ; titres, corps et liens administratifs retirés.
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { admitStoredUpload } from "../files/admission"
import { EICAR_SIGNATURE } from "../files/avProviders"
import { enqueueFanout, FANOUT_BATCH_SIZE } from "./fanout"
import { notifyPerson, resolveNotifications } from "./notify"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons"> }

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

async function enter(t: T, rootId: Id<"networks">, subject: string): Promise<Person> {
  const as = t.withIdentity({ subject })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle: subject, displayName: subject })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
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

const PAGE = { numItems: 50, cursor: null }

async function bell(person: Person, networkId: Id<"networks">) {
  return (await person.as.query(api.modules.notifications.bell.paginateNotifications, { networkId, paginationOpts: PAGE })).page
}

describe("porte unique d'écriture", () => {
  it("dédoublonne par genre|sujet|acteur (rafraîchit, ne s'empile pas) ; jamais soi-même", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await t.run(async (ctx) => {
      const db = ctx as unknown as MutationCtx
      await notifyPerson(db, { networkId: root, recipientPersonId: bob.personId, actorPersonId: alice.personId, kind: "new_follower" })
      await notifyPerson(db, { networkId: root, recipientPersonId: bob.personId, actorPersonId: alice.personId, kind: "new_follower" })
      expect(await notifyPerson(db, { networkId: root, recipientPersonId: bob.personId, actorPersonId: bob.personId, kind: "new_follower" })).toBeNull()
    })
    const rows = await bell(bob, root)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "new_follower", readAt: null, actor: { handle: "alice", displayName: "alice" } })
    // Lue, puis le même geste : la ligne est rouverte, pas doublée.
    await bob.as.mutation(api.modules.notifications.bell.markRead, { networkId: root, notificationId: rows[0]!.notificationId })
    await t.run(async (ctx) => notifyPerson(ctx as unknown as MutationCtx, { networkId: root, recipientPersonId: bob.personId, actorPersonId: alice.personId, kind: "new_follower" }))
    expect(await bob.as.query(api.modules.notifications.bell.unreadCount, { networkId: root })).toEqual({ count: 1, capped: false })
  })

  it("jamais à travers un blocage, jamais à un non-membre du réseau", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await bob.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: alice.personId })
    const written = await t.run(async (ctx) => {
      const db = ctx as unknown as MutationCtx
      return [
        await notifyPerson(db, { networkId: root, recipientPersonId: bob.personId, actorPersonId: alice.personId, kind: "new_follower" }),
        // Alice n'est pas membre du réseau fermé : rien ne sonne pour elle là-bas.
        await notifyPerson(db, { networkId: testClosed, recipientPersonId: alice.personId, kind: "file_withheld" }),
      ]
    })
    expect(written).toEqual([null, null])
  })
})

describe("lire la cloche", () => {
  it("ne saute aucune ligne quand plusieurs partagent la même date ; la cloche d'autrui ne se lit pas", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i += 1) {
        await ctx.db.insert("notifications", { networkId: root, recipientPersonId: bob.personId, kind: "new_follower", dedupKey: `cle-${i}`, createdAt: 1_000 })
      }
    })
    const seen: string[] = []
    let cursor: string | null = null
    for (;;) {
      const page: { page: { notificationId: string }[]; continueCursor: string; isDone: boolean } = await bob.as.query(api.modules.notifications.bell.paginateNotifications, {
        networkId: root,
        paginationOpts: { numItems: 2, cursor },
      })
      seen.push(...page.page.map((row) => row.notificationId))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(new Set(seen).size).toBe(5)
    expect(await bell(alice, root)).toEqual([])
    const [row] = await bell(bob, root)
    expect(engineErrorCode(await caught(alice.as.mutation(api.modules.notifications.bell.markRead, { networkId: root, notificationId: row!.notificationId as Id<"notifications"> })))).toBe("notFound")
  })

  it("le compteur de non-lus s'arrête à 99 et dit sa lacune", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const bob = await enter(t, root, "bob")
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i += 1) {
        await ctx.db.insert("notifications", { networkId: root, recipientPersonId: bob.personId, kind: "new_follower", dedupKey: `n-${i}`, createdAt: i })
      }
    })
    expect(await bob.as.query(api.modules.notifications.bell.unreadCount, { networkId: root })).toEqual({ count: 99, capped: true })
  })

  it("tout marquer lu traite plus d'un lot par continuations, sans absorber ce qui arrive après le clic", async () => {
    vi.useFakeTimers()
    const t = testConvex()
    const { root } = await seed(t)
    const bob = await enter(t, root, "bob")
    const clickAt = Date.now()
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i += 1) {
        await ctx.db.insert("notifications", { networkId: root, recipientPersonId: bob.personId, kind: "new_follower", dedupKey: `n-${i}`, createdAt: clickAt - 1_000 - i })
      }
      await ctx.db.insert("notifications", { networkId: root, recipientPersonId: bob.personId, kind: "new_follower", dedupKey: "futur", createdAt: clickAt + 60_000 })
    })
    expect(await bob.as.mutation(api.modules.notifications.bell.markAllRead, { networkId: root })).toEqual({ marked: 200, pending: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await bob.as.query(api.modules.notifications.bell.unreadCount, { networkId: root })).toEqual({ count: 1, capped: false })
  })
})

describe("résolution — le serveur tranche, la cloche suit", () => {
  it("résout toutes les lignes du sujet, quel que soit l'acteur, sans écraser la date de lecture ; rouvrir remet à zéro", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const carol = await enter(t, root, "carol")
    const bob = await enter(t, root, "bob")
    const connectionId = await t.run(async (ctx) =>
      ctx.db.insert("connections", {
        networkId: root,
        personIdLow: alice.personId < bob.personId ? alice.personId : bob.personId,
        personIdHigh: alice.personId < bob.personId ? bob.personId : alice.personId,
        requestedByPersonId: alice.personId,
        recipientPersonId: bob.personId,
        status: "requested",
        requestedAt: 1,
        updatedAt: 1,
      }),
    )
    await t.run(async (ctx) => {
      const db = ctx as unknown as MutationCtx
      for (const actor of [alice, carol]) {
        await notifyPerson(db, { networkId: root, recipientPersonId: bob.personId, actorPersonId: actor.personId, kind: "connection_request", subject: { connection: connectionId } })
      }
    })
    const [first] = await bell(bob, root)
    await bob.as.mutation(api.modules.notifications.bell.markRead, { networkId: root, notificationId: first!.notificationId })
    const resolved = await t.run(async (ctx) =>
      resolveNotifications(ctx as unknown as MutationCtx, { networkId: root, recipientPersonId: bob.personId, kind: "connection_request", subject: { connection: connectionId }, resolution: "accepted", at: 5 }),
    )
    expect(resolved).toEqual({ resolved: 2 })
    const rows = await bell(bob, root)
    expect(rows.every((row) => row.resolution?.kind === "accepted")).toBe(true)
    expect(rows.find((row) => row.notificationId === first!.notificationId)?.readAt).not.toBe(5)
    expect(rows.find((row) => row.notificationId !== first!.notificationId)?.readAt).toBe(5)
    await t.run(async (ctx) =>
      notifyPerson(ctx as unknown as MutationCtx, { networkId: root, recipientPersonId: bob.personId, actorPersonId: alice.personId, kind: "connection_request", subject: { connection: connectionId } }),
    )
    const reopened = (await bell(bob, root)).find((row) => row.actor?.handle === "alice")
    expect(reopened).toMatchObject({ resolution: null, readAt: null })
    expect(await bell(bob, root)).toHaveLength(2)
  })
})

describe("la cloche du graphe", () => {
  it("demande : sonne une fois, avec l'état VIVANT ; accepter résout la ligne et prévient le demandeur ; le rejeu ne ressuscite rien", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await alice.as.mutation(api.modules.graph.connections.requestConnection, { networkId: root, handle: "bob" })
    const [request] = await bell(bob, root)
    expect(request).toMatchObject({ kind: "connection_request", inviteState: { status: "requested", iAmRecipient: true }, actor: { handle: "alice" } })
    await bob.as.mutation(api.modules.notifications.bell.markRead, { networkId: root, notificationId: request!.notificationId })
    await alice.as.mutation(api.modules.graph.connections.requestConnection, { networkId: root, handle: "bob" })
    expect(await bob.as.query(api.modules.notifications.bell.unreadCount, { networkId: root })).toEqual({ count: 0, capped: false })
    // Lire n'est pas décider : tout marquer lu laisse la demande ouverte.
    await bob.as.mutation(api.modules.notifications.bell.markAllRead, { networkId: root })
    expect((await bell(bob, root))[0]).toMatchObject({ resolution: null, inviteState: { status: "requested" } })

    await bob.as.mutation(api.modules.graph.connections.respondToConnection, { networkId: root, connectionId: request!.subject!.id as Id<"connections">, accept: true })
    const [resolvedRequest] = await bell(bob, root)
    expect(resolvedRequest).toMatchObject({ resolution: { kind: "accepted" }, inviteState: { status: "accepted" } })
    expect((await bell(alice, root)).map((row) => row.kind)).toEqual(["connection_accepted"])
  })

  it("refuser résout la ligne du destinataire — et TOUJOURS rien pour le demandeur ; un abonnement se dit", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    await alice.as.mutation(api.modules.graph.connections.requestConnection, { networkId: root, handle: "bob" })
    const [request] = await bell(bob, root)
    await bob.as.mutation(api.modules.graph.connections.respondToConnection, { networkId: root, connectionId: request!.subject!.id as Id<"connections">, accept: false })
    expect((await bell(bob, root))[0]).toMatchObject({ resolution: { kind: "declined" } })
    expect(await bell(alice, root)).toEqual([])
    // Une demande après refus remet la ligne à zéro — jamais une seconde ligne.
    await alice.as.mutation(api.modules.graph.connections.requestConnection, { networkId: root, handle: "bob" })
    const reopened = await bell(bob, root)
    expect(reopened).toHaveLength(1)
    expect(reopened[0]).toMatchObject({ resolution: null, readAt: null, inviteState: { status: "requested", iAmRecipient: true } })
    await alice.as.mutation(api.modules.graph.follows.follow, { networkId: root, handle: "bob" })
    expect((await bell(bob, root)).map((row) => row.kind).sort()).toEqual(["connection_request", "new_follower"])
  })
})

describe("diffusion par lots chaînés", () => {
  it("une liste de plus d'un lot est servie en plusieurs transactions, dédoublonnée ; les abonnés d'une personne aussi", async () => {
    vi.useFakeTimers()
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const persons: Person[] = []
    for (let i = 0; i < 3; i += 1) persons.push(await enter(t, root, `membre${i}`))
    // Des personnes inventées (non-membres) remplissent le premier lot : la porte les écarte.
    const ghosts = await t.run(async (ctx) => {
      const ids: Id<"persons">[] = []
      for (let i = 0; i < FANOUT_BATCH_SIZE; i += 1) ids.push(await ctx.db.insert("persons", { authUserId: `fantome-${i}`, createdAt: 1, updatedAt: 1 }))
      return ids
    })
    await t.run(async (ctx) =>
      enqueueFanout(ctx as unknown as MutationCtx, {
        networkId: root,
        actorPersonId: alice.personId,
        kind: "group_added",
        source: { kind: "persons", personIds: [...ghosts, ...persons.map((p) => p.personId), persons[0]!.personId] },
      }),
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    for (const person of persons) expect((await bell(person, root)).map((row) => row.kind)).toEqual(["group_added"])
    const total = await t.run(async (ctx) => (await ctx.db.query("notifications").take(500)).length)
    expect(total).toBe(3)

    vi.useRealTimers()
    for (const person of persons) await person.as.mutation(api.modules.graph.follows.follow, { networkId: root, handle: "alice" })
    vi.useFakeTimers()
    await t.run(async (ctx) =>
      enqueueFanout(ctx as unknown as MutationCtx, { networkId: root, actorPersonId: alice.personId, kind: "live_started", source: { kind: "followers", targetPersonId: alice.personId } }),
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    for (const person of persons) expect((await bell(person, root)).some((row) => row.kind === "live_started")).toBe(true)
  })
})

describe("avis de la garde des fichiers", () => {
  it("un fichier infecté prévient son déposant et les modérateurs du réseau, avec le statut vivant de l'analyse", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const uploader = await enter(t, root, "deposant")
    const moderator = await enter(t, root, "moderatrice")
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", moderator.personId))
        .unique()
      if (membership) await ctx.db.patch(membership._id, { role: "network_moderator" })
    })
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([EICAR_SIGNATURE], { type: "text/plain" })))
    const { scanId } = await t.run(async (ctx) =>
      admitStoredUpload(ctx as unknown as MutationCtx, { storageId, usage: "chat_attachment", mimeType: "text/plain" }, { source: "message", networkId: root, uploadedByPersonId: uploader.personId }),
    )
    await t.action(internal.modules.files.scan.runScan, { scanId })
    for (const person of [uploader, moderator]) {
      const [notice] = await bell(person, root)
      expect(notice).toMatchObject({ kind: "file_withheld", subject: { kind: "fileScan", id: scanId }, fileScanStatus: "infected", actor: null })
    }
  })
})
