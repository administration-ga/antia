// @vitest-environment edge-runtime
/**
 * `listMyConnectionsForGroup` — qui proposer à la composition d'un groupe :
 * EXACTEMENT ceux que `createGroup` acceptera (relation acceptée dans le réseau,
 * sans blocage, membre active au profil publié). Plus large, la liste
 * fabriquerait des refus ; ce n'est donc pas l'annuaire du réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "../../_generated/api"
import { testConvex } from "../../test.setup"
import { block, connect, enter, joinAlso, seed, T0 } from "../calls/fixtures.setup"

const G = api.modules.groups

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("listMyConnectionsForGroup — les relations invitables", () => {
  it("rend mes relations acceptées du réseau, triées par nom, avec leur identifiant", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const zoe = await enter(t, root, "zoe")
    const bob = await enter(t, root, "bob")
    await connect(t, root, alice, zoe)
    await connect(t, root, alice, bob)

    const list = await alice.as.query(G.invites.listMyConnectionsForGroup, { networkId: root })
    expect(list.map((item) => item.handle)).toEqual(["bob", "zoe"])
    expect(list[0]).toEqual({ personId: bob.personId, handle: "bob", displayName: "bob", headline: null, avatarUrl: null })
  })

  it("écarte ce que la création refuserait : sans relation, bloqué, profil retiré, relation d'un autre réseau", async () => {
    const t = testConvex()
    const { root, testClosed } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    const dan = await enter(t, root, "dan")
    const eve = await enter(t, root, "eve")
    await enter(t, root, "stranger")
    await connect(t, root, alice, bob)
    await connect(t, root, alice, carol)
    await connect(t, root, alice, dan)
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, eve)
    await connect(t, testClosed, alice, eve)
    // carol bloque alice (dans un autre réseau : le blocage vaut pour toute la paire)
    await joinAlso(t, testClosed, carol)
    await block(t, testClosed, carol, alice)
    // dan retire son profil
    await dan.as.mutation(api.modules.people.profile.withdrawMyProfile, {})

    const list = await alice.as.query(G.invites.listMyConnectionsForGroup, { networkId: root })
    expect(list.map((item) => item.handle)).toEqual(["bob"])
  })

  it("chaque proposition est acceptée par `createGroup`", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    await connect(t, root, alice, bob)
    await connect(t, root, alice, carol)

    const list = await alice.as.query(G.invites.listMyConnectionsForGroup, { networkId: root })
    const created = await alice.as.mutation(G.threads.createGroup, { networkId: root, title: "Amis", memberHandles: list.map((item) => item.handle), idempotencyKey: "k-1" })
    expect(created.created).toBe(true)
  })
})
