// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/hostPresence.test.ts @ ad2e7fdc2 — adaptations : harnais et outillage du moteur (`test.setup`, `live/fixtures.setup` : réseau racine amorcé, personnes membres, session posée EN BASE — programmée, puis passée en direct, puis terminée par son statut, au lieu de `sessions.create`, `goLive` et `end` du lot des sessions ; relation acceptée posée en base au lieu de `reseau.connections.request`/`respond`) ; `presence` reçoit l'instant de l'écran (`now`, D16) ; refus indistinct lu par son CODE (`notFound`), comparé à celui de la garde de visibilité elle-même (`assertVisibleDirectSession`, que `sessions.get` emprunte) au lieu de la phrase « introuvable » ; cas NEUFS : session d'un autre réseau (même silence, aucune ligne), débit `live.hostPresence` ATTRAPÉ (battement de trop refusé en silence, sans écriture, puis repris), instant de l'écran (le même bail lu à deux instants).
/**
 * Le BAIL DE PRÉSENCE DE L'HÔTE (D-14) — ce que ce fichier tient :
 *
 *  1. **Un battement ne LÈVE jamais** (passé la garde du constructeur).
 *     Non-hôte, session programmée, session terminée, session inconnue ou
 *     d'un autre réseau, battement de trop : le MÊME `{ accepted: false }`.
 *     Une exception toutes les quinze secondes serait un bruit, et distinguer
 *     les refus apprendrait l'existence d'un direct réservé.
 *  2. **UNE ligne par session.** Le bail est réécrit, jamais empilé.
 *  3. **`presence` dit l'état à l'instant de l'écran, et rend les faits BRUTS**
 *     pour que le client re-dérive à sa montre (une query ne re-tourne pas
 *     parce que l'heure avance).
 *  4. **La visibilité est celle de `sessions.get`** : un tiers hors audience
 *     reçoit le refus indistinct, pas « l'hôte est absent ».
 *  5. **Le battement n'écrit PAS `liveSessions`** — c'est toute la raison
 *     d'être de la table séparée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { assertVisibleDirectSession } from "./access"
import { DIRECT_HOST_GRACE_MS, DIRECT_HOST_LEASE_MS } from "./domain"
import { codeOf, connect, enter, insertSession, joinAlso, type Person, seed, sessionDoc, type T, T0, tick } from "./fixtures.setup"

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

function must<V>(value: V | null | undefined): V {
  if (value === null || value === undefined) {
    throw new Error("ligne attendue absente")
  }
  return value
}

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carol = await enter(t, root, "carol")
  return { t, root, testClosed, alice, bob, carol }
}

const refus = { accepted: false, leaseUntil: null }

const battre = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">, state: "connected" | "reconnecting" = "connected") =>
  person.as.mutation(L.hostPresence.heartbeat, { networkId, sessionId, state })

/** La présence lue à l'instant que fournit l'écran (par défaut : maintenant). */
const presence = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">, now = Date.now()) =>
  person.as.query(L.hostPresence.presence, { networkId, sessionId, now })

const recolter = (t: T) => t.mutation(internal.modules.live.reap.reapStaleDirects, {})

/** La session passe EN DIRECT (au socle : `sessions.goLive`). */
async function demarrer(t: T, sessionId: Id<"liveSessions">): Promise<void> {
  await t.run(async (ctx) => ctx.db.patch(sessionId, { status: "live", startedAt: Date.now(), updatedAt: Date.now() }))
}

/** La session est TERMINÉE (au socle : `sessions.end`). */
async function terminer(t: T, sessionId: Id<"liveSessions">): Promise<void> {
  await t.run(async (ctx) => ctx.db.patch(sessionId, { status: "ended", endedAt: Date.now(), endReason: "host", updatedAt: Date.now() }))
}

async function baux(t: T, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("liveHostPresence")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .take(10),
  )
}

/** Le bail s'est éteint il y a `sinceMs` (dernier battement : bail + `sinceMs`). */
async function eteindreBail(t: T, sessionId: Id<"liveSessions">, sinceMs: number): Promise<void> {
  await t.run(async (ctx) => {
    const row = must(
      await ctx.db
        .query("liveHostPresence")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .unique(),
    )
    const lastSeenAt = Date.now() - sinceMs - DIRECT_HOST_LEASE_MS
    await ctx.db.patch(row._id, { lastSeenAt, leaseUntil: lastSeenAt + DIRECT_HOST_LEASE_MS })
  })
}

describe("bail de présence — le battement ne lève jamais", () => {
  it("refuse indistinctement le non-hôte, le programmé et le terminé", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice, status: "scheduled" })

    // Programmé : l'hôte lui-même n'a rien à annoncer, la salle n'est pas ouverte.
    expect(await battre(alice, root, sessionId)).toEqual(refus)

    await demarrer(t, sessionId)
    // Un spectateur (même connecté et admis) n'est pas l'hôte.
    await connect(t, root, alice, bob)
    await bob.as.mutation(internal.modules.live.access.authorizeToken, { networkId: root, sessionId })
    expect(await battre(bob, root, sessionId)).toEqual(refus)

    await terminer(t, sessionId)
    expect(await battre(alice, root, sessionId)).toEqual(refus)

    // Aucun refus n'a laissé de ligne derrière lui.
    expect(await baux(t, sessionId)).toHaveLength(0)
  })

  it("crée UNE ligne puis la réécrit — jamais un journal de battements", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    const premier = await battre(alice, root, sessionId)
    expect(premier.accepted).toBe(true)
    expect(must(premier.leaseUntil)).toBe(Date.now() + DIRECT_HOST_LEASE_MS)

    for (let i = 0; i < 4; i++) {
      tick()
      await battre(alice, root, sessionId)
    }

    const lignes = await baux(t, sessionId)
    expect(lignes).toHaveLength(1)
    const [ligne] = lignes
    expect(must(ligne).state).toBe("connected")
    expect(must(ligne).networkId).toBe(root)
    expect(must(ligne).hostPersonId).toBe(alice.personId)
    expect(must(ligne).lastSeenAt).toBe(Date.now())
    expect(must(ligne).leaseUntil - must(ligne).lastSeenAt).toBe(DIRECT_HOST_LEASE_MS)
  })

  it("n'écrit JAMAIS liveSessions — c'est la raison d'être de la table", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    const avant = await sessionDoc(t, sessionId)
    for (let i = 0; i < 3; i++) {
      tick()
      await battre(alice, root, sessionId, i === 1 ? "reconnecting" : "connected")
    }
    const apres = must(await sessionDoc(t, sessionId))
    expect(apres).toEqual(avant)
    expect(apres.status).toBe("live")
  })
})

describe("bail de présence — la REPRISE", () => {
  it("l'hôte revenu dans la grâce efface l'absence et sauve la conférence", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await battre(alice, root, sessionId)

    // Le réseau tombe : le bail s'éteint, la récolte CONSTATE l'absence.
    await eteindreBail(t, sessionId, 40_000)
    await recolter(t)
    expect((await presence(alice, root, sessionId)).hostState).toBe("interrupted")

    // Il revient AVANT la fin de la grâce.
    tick()
    await battre(alice, root, sessionId, "reconnecting")
    const lignes = await baux(t, sessionId)
    expect(lignes).toHaveLength(1)
    expect(must(lignes[0]).state).toBe("reconnecting")
    // ⚠️ L'absence constatée est EFFACÉE : la laisser ferait dire
    // « interrompue » à une conférence qui parle de nouveau.
    expect(must(lignes[0]).absentSince).toBeUndefined()

    tick()
    await battre(alice, root, sessionId)
    expect((await presence(alice, root, sessionId)).hostState).toBe("on_air")

    // Et la récolte ne la termine plus : le bail est frais.
    await recolter(t)
    const session = must(await sessionDoc(t, sessionId))
    expect(session.status).toBe("live")
    expect(session.endReason).toBeUndefined()
  })
})

describe("bail de présence — ce que `presence` rend", () => {
  it("unknown sans bail, on_air avec un bail frais, reconnecting sur déclaration", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    expect(await presence(alice, root, sessionId)).toEqual({
      hostState: "unknown",
      since: null,
      graceUntil: null,
      lease: null,
    })

    await battre(alice, root, sessionId)
    const enAntenne = await presence(alice, root, sessionId)
    expect(enAntenne.hostState).toBe("on_air")
    expect(enAntenne.graceUntil).toBeNull()
    expect(must(enAntenne.lease).state).toBe("connected")
    expect(must(enAntenne.since)).toBe(must(enAntenne.lease).lastSeenAt)

    tick()
    await battre(alice, root, sessionId, "reconnecting")
    const enReprise = await presence(alice, root, sessionId)
    expect(enReprise.hostState).toBe("reconnecting")
    // La grâce est ANNONCÉE dès qu'il y a un doute : c'est la date au-delà de
    // laquelle la conférence sera close.
    expect(must(enReprise.graceUntil)).toBe(must(enReprise.lease).leaseUntil + DIRECT_HOST_GRACE_MS)
  })

  it("interrupted quand le bail est éteint mais la grâce court encore", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await battre(alice, root, sessionId)

    // Le bail s'est éteint il y a 40 s : hors bail, dans la grâce (120 s).
    await eteindreBail(t, sessionId, 40_000)

    const vue = await presence(alice, root, sessionId)
    expect(vue.hostState).toBe("interrupted")
    expect(must(vue.since)).toBe(must(vue.lease).leaseUntil)
    expect(must(vue.graceUntil)).toBeGreaterThan(Date.now())

    // La SESSION, elle, n'a pas bougé : interrompu n'est pas terminé.
    expect(must(await sessionDoc(t, sessionId)).status).toBe("live")
  })

  it("la visibilité est celle de sessions.get : un tiers ne distingue rien", async () => {
    const { t, root, alice, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice, audience: "connections" })
    await battre(alice, root, sessionId)

    // Carol n'est pas en relation avec Alice : le MÊME refus que la garde de `sessions.get`.
    const refusPresence = await codeOf(presence(carol, root, sessionId))
    const refusGarde = await codeOf(t.run(async (ctx) => assertVisibleDirectSession(ctx, { networkId: root, personId: carol.personId }, sessionId)))
    expect(refusPresence).toBe("notFound")
    expect(refusGarde).toBe("notFound")
  })
})

describe("adaptations du moteur — réseau, débit, instant de l'écran", () => {
  it("une session d'un AUTRE réseau : le même silence, aucune ligne ; dans son réseau, le bail porte ce réseau", async () => {
    const { t, root, testClosed, alice } = await cast()
    await joinAlso(t, testClosed, alice)
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice })

    // L'hôte elle-même, mais au nom de la racine.
    expect(await battre(alice, root, ailleurs)).toEqual(refus)
    expect(await baux(t, ailleurs)).toHaveLength(0)

    expect((await battre(alice, testClosed, ailleurs)).accepted).toBe(true)
    expect(must((await baux(t, ailleurs))[0]).networkId).toBe(testClosed)
  })

  it("débit `live.hostPresence` : le battement de trop se tait, sans écrire, puis le seau se remplit", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // La capacité du seau (douze) : tous acceptés.
    for (let beat = 0; beat < 12; beat += 1) expect((await battre(alice, root, sessionId)).accepted).toBe(true)
    const tenu = must((await baux(t, sessionId))[0]).lastSeenAt

    // Le treizième : la même VALEUR que tout refus, et le bail n'est pas réécrit.
    tick(1_000)
    expect(await battre(alice, root, sessionId, "reconnecting")).toEqual(refus)
    const inchange = must((await baux(t, sessionId))[0])
    expect(inchange.lastSeenAt).toBe(tenu)
    expect(inchange.state).toBe("connected")

    tick(60_000)
    expect((await battre(alice, root, sessionId)).accepted).toBe(true)
    expect(must((await baux(t, sessionId))[0]).lastSeenAt).toBe(Date.now())
  })

  it("l'instant vient de l'ÉCRAN (D16) : le même bail se lit à l'instant fourni, sans rien écrire", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    const { leaseUntil } = await battre(alice, root, sessionId)
    const echeance = must(leaseUntil)

    expect((await presence(alice, root, sessionId, Date.now())).hostState).toBe("on_air")
    // Le même bail, lu une seconde après son échéance : interrompu, grâce annoncée.
    const plusTard = await presence(alice, root, sessionId, echeance + 1_000)
    expect(plusTard.hostState).toBe("interrupted")
    expect(plusTard.since).toBe(echeance)
    expect(plusTard.graceUntil).toBe(echeance + DIRECT_HOST_GRACE_MS)
    // Lire ne constate rien : seule la récolte écrit l'absence.
    expect(must((await baux(t, sessionId))[0]).state).toBe("connected")
  })
})
