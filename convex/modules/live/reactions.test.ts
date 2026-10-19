// @vitest-environment edge-runtime
/**
 * Les RÉACTIONS du direct (`reactions.ts`) — tests NEUFS, écrits pour le moteur :
 * au socle, les réactions n'avaient pas de fichier de test à elles (deux cas
 * dans `direct.test.ts`, portés par le lot des sessions). Ce fichier tient la
 * règle d'or du chemin chaud et les adaptations :
 *
 *  1. **UNE ligne par (personne, genre)** — chacun n'incrémente que SA ligne :
 *     cent spectateurs qui applaudissent ensemble n'écrivent jamais la même ;
 *  2. **ni la session ni ses compteurs** ne s'écrivent en réagissant (D28) : le
 *     total est recomposé par l'écrivain unique (`reap`) ;
 *  3. la rafale est re-bornée par le serveur (1 à 12), même illisible ;
 *  4. refus à CODE (`LIVE_NOT_LIVE`), refus indistinct (`notFound`), débit
 *     `live.reaction` par personne.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { sessionCountersOf } from "./access"
import { DIRECT_REACTION_BURST_MAX } from "./domain"
import { codeOf, enter, insertSession, joinAlso, type Person, ruleOf, seed, sessionDoc, type T, T0 } from "./fixtures.setup"

const L = api.modules.live

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

type Kind = Doc<"liveReactions">["kind"]

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carol = await enter(t, root, "carol")
  return { t, root, testClosed, alice, bob, carol }
}

const reagir = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">, kind: Kind, burst: number) =>
  person.as.mutation(L.reactions.react, { networkId, sessionId, kind, burst })

const resume = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) => person.as.query(L.reactions.summary, { networkId, sessionId })

/** Les lignes de réaction d'une session, réduites à (personne, genre, compte). */
async function lignes(t: T, sessionId: Id<"liveSessions">) {
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("liveReactions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .take(50),
  )
  return rows.map((row) => ({ personId: row.personId, kind: row.kind, count: row.count, networkId: row.networkId }))
}

describe("une ligne par personne — la règle d'or du chemin chaud", () => {
  it("la rafale s'ajoute à SA ligne (personne, genre), re-bornée à 12 ; ni la session ni ses compteurs ne bougent", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    const avant = await sessionDoc(t, sessionId)

    expect(await reagir(bob, root, sessionId, "bravo", 50)).toEqual({ credited: DIRECT_REACTION_BURST_MAX })
    expect(await reagir(bob, root, sessionId, "bravo", 3)).toEqual({ credited: 3 })
    expect(await reagir(bob, root, sessionId, "like", 1)).toEqual({ credited: 1 })

    // Deux lignes : (bob, bravo) et (bob, like) — jamais une ligne par rafale.
    expect(await lignes(t, sessionId)).toEqual(
      expect.arrayContaining([
        { personId: bob.personId, kind: "bravo", count: 15, networkId: root },
        { personId: bob.personId, kind: "like", count: 1, networkId: root },
      ]),
    )
    expect(await lignes(t, sessionId)).toHaveLength(2)

    // La SESSION n'a pas bougé, et aucun compteur n'a été écrit : l'écrivain unique n'est pas ce chemin.
    expect(await sessionDoc(t, sessionId)).toEqual(avant)
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("liveSessionCounters")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .unique(),
      ),
    ).toBeNull()
  })

  it("deux spectateurs, deux lignes : chacun n'écrit que la sienne", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    await reagir(bob, root, sessionId, "soutien", 2)
    await reagir(carol, root, sessionId, "soutien", 5)
    await reagir(bob, root, sessionId, "soutien", 1)

    const rows = await lignes(t, sessionId)
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        { personId: bob.personId, kind: "soutien", count: 3, networkId: root },
        { personId: carol.personId, kind: "soutien", count: 5, networkId: root },
      ]),
    )
  })

  it("le résumé : total, par genre, et MES envois seulement", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await reagir(bob, root, sessionId, "bravo", 4)
    await reagir(bob, root, sessionId, "instructif", 1)
    await reagir(carol, root, sessionId, "bravo", 2)

    const vueBob = await resume(bob, root, sessionId)
    expect(vueBob.total).toBe(7)
    expect(vueBob.byKind).toEqual(expect.arrayContaining([{ kind: "bravo", count: 6 }, { kind: "instructif", count: 1 }]))
    expect(vueBob.byKind).toHaveLength(2)
    expect(vueBob.mine).toEqual(expect.arrayContaining([{ kind: "bravo", count: 4 }, { kind: "instructif", count: 1 }]))
    expect(vueBob.mine).toHaveLength(2)

    // L'hôte n'a rien envoyé : rien n'est « à lui ».
    expect((await resume(alice, root, sessionId)).mine).toEqual([])
  })

  it("la récolte recompose le total : chaque ligne compte, une seule fois", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await reagir(bob, root, sessionId, "like", 2)
    await reagir(carol, root, sessionId, "like", 3)
    await reagir(carol, root, sessionId, "bravo", 1)

    await t.mutation(internal.modules.live.reap.reapStaleDirects, {})
    expect((await t.run(async (ctx) => sessionCountersOf(ctx, sessionId))).reactionCount).toBe(6)
  })
})

describe("adaptations du moteur — refus, débit, rafale illisible", () => {
  it("réagir exige une session EN DIRECT (`LIVE_NOT_LIVE`) ; hors audience ou d'un autre réseau → `notFound`", async () => {
    const { t, root, testClosed, alice, bob, carol } = await cast()
    const programmee = await insertSession(t, { networkId: root, host: alice, status: "scheduled" })
    const terminee = await insertSession(t, { networkId: root, host: alice, status: "ended" })
    // On ne réagit pas à un replay : le replay se regarde, le direct se vit.
    expect(await ruleOf(reagir(bob, root, programmee, "like", 1))).toBe("LIVE_NOT_LIVE")
    expect(await ruleOf(reagir(bob, root, terminee, "like", 1))).toBe("LIVE_NOT_LIVE")

    const reservee = await insertSession(t, { networkId: root, host: alice, audience: "connections" })
    expect(await codeOf(reagir(carol, root, reservee, "like", 1))).toBe("notFound")
    expect(await codeOf(resume(carol, root, reservee))).toBe("notFound")

    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice })
    expect(await codeOf(reagir(bob, root, ailleurs, "like", 1))).toBe("notFound")
    expect(await lignes(t, ailleurs)).toEqual([])
    // Dans SON réseau, la ligne porte ce réseau.
    await reagir(bob, testClosed, ailleurs, "like", 1)
    expect(await lignes(t, ailleurs)).toEqual([{ personId: bob.personId, kind: "like", count: 1, networkId: testClosed }])
  })

  it("débit `live.reaction` : au-delà de la capacité des rafales, `rateLimited` — le seau de la personne seule", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    for (let burst = 0; burst < 6; burst += 1) await reagir(bob, root, sessionId, "like", 12)

    expect(await codeOf(reagir(bob, root, sessionId, "like", 1))).toBe("rateLimited")
    // Le refus n'a rien crédité ; carol, elle, réagit librement.
    await reagir(carol, root, sessionId, "like", 1)
    expect((await resume(bob, root, sessionId)).mine).toEqual([{ kind: "like", count: 72 }])
  })

  it("une rafale illisible (`NaN`) crédite UNE réaction ; nulle ou négative aussi ; décimale tronquée", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    expect(await reagir(bob, root, sessionId, "bravo", Number.NaN)).toEqual({ credited: 1 })
    expect(await reagir(bob, root, sessionId, "bravo", 0)).toEqual({ credited: 1 })
    expect(await reagir(bob, root, sessionId, "bravo", -5)).toEqual({ credited: 1 })
    expect(await reagir(bob, root, sessionId, "bravo", 3.9)).toEqual({ credited: 3 })

    // La ligne reste un NOMBRE : le total recomposé aussi.
    expect(await lignes(t, sessionId)).toEqual([{ personId: bob.personId, kind: "bravo", count: 6, networkId: root }])
    await t.mutation(internal.modules.live.reap.reapStaleDirects, {})
    expect((await t.run(async (ctx) => sessionCountersOf(ctx, sessionId))).reactionCount).toBe(6)
  })
})
