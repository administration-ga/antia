// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/presence.test.ts @ ad2e7fdc2 — adaptations : harnais et outillage du moteur (`test.setup`, `live/fixtures.setup` : réseau racine amorcé, personnes membres, session posée EN BASE, jeton par `access.authorizeToken` au nom de la personne et dans son réseau) ; compteurs lus dans `liveSessionCounters` (D28) au lieu de la session ; la fin par `sessions.end` (lot des sessions) remplacée par son effet — statut posé en base puis recomposition par l'écrivain unique (`reap.recomputeAggregates`) ; « admission LEGACY » du socle → admission jamais battue, inscrite à l'agrégat des admissions (une ligne de compteurs s'écrit donc, présents à zéro ; l'absence d'écriture quand rien ne change est tenue par `reap.test`) ; cas NEUFS : session d'un autre réseau (même silence, aucune écriture), débit `live.presence` ATTRAPÉ (battement de trop refusé en silence, sans écriture, puis repris quand le seau se remplit), garde du constructeur (membre parti : `notFound`, qui lève), membre redevenu `en_attente` qui ne bat plus mais peut encore partir.
/**
 * LE BAIL DES SPECTATEURS (D-09) — ce que ce fichier tient :
 *
 *  1. **Un battement n'écrit QUE la ligne de l'appelant.** Jamais
 *     `liveSessions` ni `liveSessionCounters` : une écriture de la session
 *     réveille la souscription de toute la salle, deux fois par minute et par
 *     personne. C'est la raison d'être du bail, et le test qui l'exprime est le
 *     plus important du fichier.
 *  2. **Il ne LÈVE jamais** (passé la garde du constructeur). Sans admission,
 *     sur une session terminée, inconnue, d'un autre réseau, ou au-delà du
 *     seau : le MÊME `{ accepted: false }`, sans écriture.
 *  3. **Deux onglets, une seule place** — dédoublonné par construction, une
 *     personne n'ayant qu'une ligne.
 *  4. **Partir libère tout de suite, revenir re-présente.**
 *  5. **Le TTL rend la place** : un onglet mort cesse d'occuper la salle au
 *     bout de 90 s, et un jeton dont la connexion n'a jamais abouti aussi.
 *  6. **L'agrégateur FAIT FOI** : il recompose les présents par une lecture
 *     indexée bornée, corrige une dérive, et met zéro à la fin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { recordViewerGrant, sessionCountersOf } from "./access"
import { DIRECT_PRESENCE_TTL_MS } from "./domain"
import { codeOf, enter, grantAt, grantsOf, insertSession, joinAlso, type Person, seed, sessionDoc, type T, T0, tick } from "./fixtures.setup"
import { recomputeAggregates } from "./reap"

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

/** Le réseau racine, une hôtesse et deux personnes de la salle. */
async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carla = await enter(t, root, "carla")
  return { t, root, testClosed, alice, bob, carla }
}

/** Le jeton — c'est LUI qui crée l'admission et pose le premier bail. */
const jeton = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) =>
  person.as.mutation(internal.modules.live.access.authorizeToken, { networkId, sessionId })

const battre = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) => person.as.mutation(L.presence.heartbeat, { networkId, sessionId })

const partir = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) => person.as.mutation(L.presence.leave, { networkId, sessionId })

/** La récolte : c'est elle qui recompose les compteurs (cron 60 s). */
const recolter = (t: T) => t.mutation(internal.modules.live.reap.reapStaleDirects, {})

/** Les compteurs SERVIS (ligne absente = zéros). */
const compteurs = (t: T, sessionId: Id<"liveSessions">) => t.run(async (ctx) => sessionCountersOf(ctx, sessionId))

/** La ligne de compteurs elle-même, ou `null` si la récolte ne l'a jamais écrite. */
const ligneDeCompteurs = (t: T, sessionId: Id<"liveSessions">) =>
  t.run(async (ctx) =>
    ctx.db
      .query("liveSessionCounters")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique(),
  )

/** L'effet de `sessions.end` sur ce module : la session passe `ended`, et l'écrivain unique recompose. */
async function terminer(t: T, sessionId: Id<"liveSessions">): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.patch(sessionId, { status: "ended", endedAt: now, endReason: "host", updatedAt: now })
    await recomputeAggregates(ctx, sessionId)
  })
}

/** Vieillir un bail : l'onglet est mort il y a `ageMs`. */
async function vieillirBail(t: T, sessionId: Id<"liveSessions">, person: Person, ageMs: number): Promise<void> {
  await t.run(async (ctx) => {
    const row = must(
      await ctx.db
        .query("liveViewerGrants")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", person.personId))
        .unique(),
    )
    await ctx.db.patch(row._id, { lastSeenAt: Date.now() - ageMs })
  })
}

async function setMembershipStatus(t: T, networkId: Id<"networks">, person: Person, status: "en_attente" | "declaree" | "suspendue" | "partie"): Promise<void> {
  await t.run(async (ctx) => {
    const row = must(
      await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
        .unique(),
    )
    await ctx.db.patch(row._id, { status })
  })
}

describe("le battement n'écrit que la ligne de l'appelant", () => {
  it("ne touche JAMAIS `liveSessions` ni ses compteurs — c'est toute la raison du bail", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)

    const avant = await sessionDoc(t, sessionId)
    tick()
    const res = await battre(bob, root, sessionId)
    expect(res.accepted).toBe(true)
    expect(must(res.presentUntil)).toBe(Date.now() + DIRECT_PRESENCE_TTL_MS)

    // Pas une écriture : ni la session, ni ses compteurs (D28).
    expect(await sessionDoc(t, sessionId)).toEqual(avant)
    expect(await ligneDeCompteurs(t, sessionId)).toBeNull()

    // Ma ligne, en revanche, a bien été rafraîchie.
    const [row] = await grantsOf(t, sessionId)
    expect(must(row).personId).toBe(bob.personId)
    expect(must(must(row).lastSeenAt)).toBeGreaterThan(must(row).firstGrantedAt)
  })

  it("sans admission : no-op silencieux, jamais une erreur", async () => {
    const { t, root, alice, carla } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Elle n'a jamais demandé de jeton : rien à tenir, rien à dire.
    expect(await battre(carla, root, sessionId)).toEqual({ accepted: false, presentUntil: null })
    expect(await partir(carla, root, sessionId)).toEqual({ released: false })
    expect(await grantsOf(t, sessionId)).toHaveLength(0)
  })

  it("une session qui n'est plus en direct refuse le battement, sans lever", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await terminer(t, sessionId)

    expect(await battre(bob, root, sessionId)).toEqual({ accepted: false, presentUntil: null })
    // Partir, en revanche, reste enregistrable : une conférence peut se
    // terminer pendant qu'on la quitte.
    expect(await partir(bob, root, sessionId)).toEqual({ released: true })
  })
})

describe("partir, revenir, et les deux onglets", () => {
  it("partir libère tout de suite ; revenir re-présente", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)

    expect(await partir(bob, root, sessionId)).toEqual({ released: true })
    // Idempotent : partir deux fois n'est pas une erreur.
    expect(await partir(bob, root, sessionId)).toEqual({ released: false })
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(0)
    // La LIGNE demeure : partir n'efface pas être venu.
    expect((await compteurs(t, sessionId)).viewerGrantCount).toBe(1)
    expect(await grantsOf(t, sessionId)).toHaveLength(1)

    expect((await battre(bob, root, sessionId)).accepted).toBe(true)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)
    const [row] = await grantsOf(t, sessionId)
    expect(must(row).leftAt).toBeUndefined()
  })

  it("deux onglets d'une même personne ne font qu'une place", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Deux entrées, deux battements : la MÊME ligne est réécrite.
    await jeton(bob, root, sessionId)
    await jeton(bob, root, sessionId)
    await battre(bob, root, sessionId)
    await battre(bob, root, sessionId)

    expect(await grantsOf(t, sessionId)).toHaveLength(1)
    await recolter(t)
    const row = await compteurs(t, sessionId)
    expect(row.viewerPresentCount).toBe(1)
    expect(row.viewerGrantCount).toBe(1)
  })

  it("le `leave` d'un onglet est effacé par le battement de l'autre", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)

    await partir(bob, root, sessionId) // l'onglet fermé
    await battre(bob, root, sessionId) // celui qui est resté
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)
  })
})

describe("le TTL rend la place, et l'agrégateur fait foi", () => {
  it("un onglet mort cesse d'occuper la salle au bout du TTL", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await battre(bob, root, sessionId)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)

    // Juste DANS la fenêtre : encore présent — le bail pardonne une pulsation.
    await vieillirBail(t, sessionId, bob, DIRECT_PRESENCE_TTL_MS - 1_000)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)

    await vieillirBail(t, sessionId, bob, DIRECT_PRESENCE_TTL_MS + 1_000)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(0)
    // Mais il A rejoint : le cumulé, lui, ne redescend jamais.
    expect((await compteurs(t, sessionId)).viewerGrantCount).toBe(1)
  })

  it("un jeton dont la connexion échoue tient sa place, puis la rend", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Aucun battement : la salle ne s'est jamais ouverte chez lui.
    await jeton(bob, root, sessionId)
    await recolter(t)
    // Le jeton RÉSERVE : sans cela, la place serait reprise avant même que la
    // salle ait fini de s'ouvrir.
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)

    await vieillirBail(t, sessionId, bob, DIRECT_PRESENCE_TTL_MS + 1)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(0)
  })

  it("la recomposition CORRIGE une dérive du compteur", async () => {
    const { t, root, alice, bob, carla } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await jeton(carla, root, sessionId)

    // Une valeur fantaisiste, comme une dérive.
    await t.run(async (ctx) =>
      ctx.db.insert("liveSessionCounters", { networkId: root, sessionId, viewerGrantCount: 2, viewerPresentCount: 47, commentCount: 0, reactionCount: 0, updatedAt: Date.now() }),
    )
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(2)
  })

  it("une admission jamais battue (sans `lastSeenAt`) n'est pas présente", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Une admission sans bail, comptée parmi les admis comme l'aurait fait l'admission.
    const grantId = await grantAt(t, sessionId, bob, undefined)
    await t.run(async (ctx) => {
      const grant = must(await ctx.db.get(grantId))
      await recordViewerGrant(ctx, { _id: grant._id, sessionId, firstGrantedAt: grant.firstGrantedAt })
    })

    await recolter(t)
    // Sinon les salles d'hier resteraient éternellement pleines.
    expect(await compteurs(t, sessionId)).toEqual({ viewerGrantCount: 1, viewerPresentCount: 0, commentCount: 0, reactionCount: 0 })

    // ⚠️ Et un second passage ne réécrit rien : la valeur n'a pas changé. Une
    // réécriture à l'identique réveillerait toute la salle pour rien.
    const ecrite = must(await ligneDeCompteurs(t, sessionId))
    tick(60_000)
    await recolter(t)
    expect(must(await ligneDeCompteurs(t, sessionId)).updatedAt).toBe(ecrite.updatedAt)
  })

  it("une conférence TERMINÉE n'a plus personne en ligne", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await battre(bob, root, sessionId)
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(1)

    // La fin passe par le même écrivain unique : zéro, sans attendre le cron.
    await terminer(t, sessionId)
    const close = await compteurs(t, sessionId)
    expect(close.viewerPresentCount).toBe(0)
    expect(close.viewerGrantCount).toBe(1)
  })
})

describe("adaptations du moteur — réseau, débit, garde du constructeur", () => {
  it("une session d'un AUTRE réseau : le même silence, aucune écriture", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, bob)
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice })
    await jeton(bob, testClosed, ailleurs)
    const [admission] = await grantsOf(t, ailleurs)

    // Demandée au nom de la racine (bob est pourtant membre des deux réseaux).
    tick()
    expect(await battre(bob, root, ailleurs)).toEqual({ accepted: false, presentUntil: null })
    expect(await partir(bob, root, ailleurs)).toEqual({ released: false })
    expect(await grantsOf(t, ailleurs)).toEqual([must(admission)])

    // Dans SON réseau, le battement passe.
    expect((await battre(bob, testClosed, ailleurs)).accepted).toBe(true)
  })

  it("débit `live.presence` : le battement de trop est refusé EN SILENCE, sans écriture, puis le seau se remplit", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)

    // La capacité du seau (huit) : tous acceptés.
    for (let beat = 0; beat < 8; beat += 1) expect((await battre(bob, root, sessionId)).accepted).toBe(true)
    const tenu = must(must((await grantsOf(t, sessionId))[0]).lastSeenAt)

    // Le neuvième : la même VALEUR que tout refus — jamais une exception —, et rien d'écrit.
    tick(1_000)
    expect(await battre(bob, root, sessionId)).toEqual({ accepted: false, presentUntil: null })
    expect(must((await grantsOf(t, sessionId))[0]).lastSeenAt).toBe(tenu)

    // Une minute plus tard, le seau s'est rempli : le battement tient de nouveau la place.
    tick(60_000)
    expect((await battre(bob, root, sessionId)).accepted).toBe(true)
    expect(must((await grantsOf(t, sessionId))[0]).lastSeenAt).toBe(Date.now())
  })

  it("la garde du CONSTRUCTEUR lève, comme partout : un membre parti reçoit `notFound`, son bail n'est pas tenu", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    const [admission] = await grantsOf(t, sessionId)

    await setMembershipStatus(t, root, bob, "partie")
    tick()
    expect(await codeOf(battre(bob, root, sessionId))).toBe("notFound")
    expect(await codeOf(partir(bob, root, sessionId))).toBe("notFound")
    expect(await grantsOf(t, sessionId)).toEqual([must(admission)])
  })

  it("un membre redevenu `en_attente` ne tient plus de place (adhésion du jeton), mais peut encore partir", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)

    await setMembershipStatus(t, root, bob, "en_attente")
    expect(await codeOf(battre(bob, root, sessionId))).toBe("statusInsufficient")
    // Rendre sa place ne donne rien : ouvert à tout membre actif.
    expect(await partir(bob, root, sessionId)).toEqual({ released: true })
    await recolter(t)
    expect((await compteurs(t, sessionId)).viewerPresentCount).toBe(0)
  })
})
