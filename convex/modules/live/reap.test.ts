// @vitest-environment edge-runtime
/**
 * La RÉCOLTE du direct (`reap.ts`) — tests NEUFS, écrits pour le moteur : au
 * socle, la récolte n'avait pas de fichier de test à elle (ses cas vivaient dans
 * `direct.test.ts`, « récolte — … », portés par le lot des sessions, et dans les
 * tests de présence et de commentaires). Ce fichier tient d'abord D28 :
 *
 *  1. **ÉCRIVAIN UNIQUE** : les compteurs servis (`liveSessionCounters`) ne sont
 *     écrits QUE par la recomposition — ni l'admission, ni un battement, ni un
 *     commentaire, ni une réaction ne les touchent ;
 *  2. **SEULEMENT SUR CHANGEMENT** : une session dont tout vaut zéro n'a pas de
 *     ligne ; un passage sans nouveauté ne réécrit rien (chaque écriture
 *     réveillerait la salle) ;
 *  3. **JAMAIS LA SESSION** : la recomposer ne touche ni son statut ni son
 *     horodatage — seules les TRANSITIONS l'écrivent ;
 *  4. **les quatre sources** : admissions distinctes (l'agrégat), présents (les
 *     baux), commentaires PUBLIÉS, réactions ;
 *
 * puis les transitions de la récolte, sur des sessions POSÉES EN BASE : limite
 * de 4 h, hôte absent au-delà de la grâce, absence constatée une fois, session
 * programmée oubliée, fail-open sans bail — et le passage SYSTÈME, tous réseaux ;
 *
 * enfin les TRANCHES CHAÎNÉES : plus de cinquante directs vivants tous
 * récoltés, `REAP_LIVE_BATCH` au plus par transaction (compté transaction par
 * transaction, en rejouant soi-même chaque suite planifiée avec son curseur),
 * la vraie chaîne du planificateur, et le pire cas d'une session MESURÉ par la
 * comptabilité du harnais (celle de Convex) contre les limites de lecture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import {
  AGGREGATE_COMMENTS_SCAN,
  DIRECT_COMMENT_MAX_LENGTH,
  DIRECT_HOST_GRACE_MS,
  DIRECT_HOST_LEASE_MS,
  DIRECT_LIVE_MAX_DURATION_MS,
  DIRECT_MAX_VIEWERS_CAP,
  DIRECT_SCHEDULED_MAX_AGE_MS,
} from "./domain"
import { enter, insertSession, joinAlso, type Person, seed, sessionDoc, type T, T0, tick } from "./fixtures.setup"
import { loadHostLease } from "./hostPresence"
import { REAP_LIVE_BATCH, recomputeAggregates } from "./reap"

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

const recolter = (t: T) => t.mutation(internal.modules.live.reap.reapStaleDirects, {})

const jeton = (person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) =>
  person.as.mutation(internal.modules.live.access.authorizeToken, { networkId, sessionId })

/** La ligne de compteurs elle-même, ou `null` si la récolte ne l'a jamais écrite. */
const ligneDeCompteurs = (t: T, sessionId: Id<"liveSessions">) =>
  t.run(async (ctx) =>
    ctx.db
      .query("liveSessionCounters")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique(),
  )

/** Pose le bail de l'hôte, dont le dernier battement remonte à `ageMs`. */
async function poserBail(t: T, sessionId: Id<"liveSessions">, host: Person, ageMs: number): Promise<void> {
  await t.run(async (ctx) => {
    const session = must(await ctx.db.get(sessionId))
    const lastSeenAt = Date.now() - ageMs
    await ctx.db.insert("liveHostPresence", {
      networkId: session.networkId,
      sessionId,
      hostPersonId: host.personId,
      state: "connected",
      lastSeenAt,
      leaseUntil: lastSeenAt + DIRECT_HOST_LEASE_MS,
      updatedAt: lastSeenAt,
    })
  })
}

async function bail(t: T, sessionId: Id<"liveSessions">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("liveHostPresence")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique(),
  )
}

/** Les fonctions planifiées, réduites à (nom, arguments). */
async function planifiees(t: T): Promise<{ name: string; args: unknown }[]> {
  const rows = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(50))
  return rows.map((row) => ({ name: row.name, args: row.args[0] }))
}

const SUITE_DE_RECOLTE = "modules/live/reap:reapStaleDirects"

/** Les suites de la récolte planifiées : identifiant, curseur et état du job. */
async function suites(t: T): Promise<{ id: string; cursor: unknown; state: string }[]> {
  const rows = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(200))
  return rows
    .filter((row) => row.name === SUITE_DE_RECOLTE)
    .map((row) => ({ id: String(row._id), cursor: (row.args[0] as { cursor?: unknown }).cursor, state: row.state.kind }))
}

/** Les directs dont la récolte a écrit la ligne de compteurs — la trace de leur examen. */
async function examines(t: T): Promise<number> {
  return (await t.run(async (ctx) => ctx.db.query("liveSessionCounters").take(1_000))).length
}

/** `count` directs vivants, chacun avec UNE réaction : examiné, chacun écrit sa ligne de compteurs. */
async function directsVivants(t: T, networkId: Id<"networks">, host: Person, reacteur: Person, count: number): Promise<Id<"liveSessions">[]> {
  const sessions: Id<"liveSessions">[] = []
  for (let i = 0; i < count; i++) sessions.push(await insertSession(t, { networkId, host, title: `Direct ${i + 1}` }))
  await t.run(async (ctx) => {
    for (const sessionId of sessions) {
      await ctx.db.insert("liveReactions", { networkId, sessionId, personId: reacteur.personId, kind: "like", count: 1, updatedAt: Date.now() })
    }
  })
  return sessions
}

describe("D28 — l'écrivain unique, et seulement sur changement", () => {
  it("rien à compter, rien d'écrit : ni ligne de compteurs, ni la session", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    const avant = await sessionDoc(t, sessionId)

    await recolter(t)
    tick(60_000)
    await recolter(t)

    // Ligne absente = zéros : la créer pour y écrire des zéros réveillerait la salle pour rien.
    expect(await ligneDeCompteurs(t, sessionId)).toBeNull()
    expect(await sessionDoc(t, sessionId)).toEqual(avant)
  })

  it("un passage sans nouveauté ne réécrit pas la ligne ; une nouveauté la réécrit", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "like", burst: 2 })

    await recolter(t)
    const premiere = must(await ligneDeCompteurs(t, sessionId))
    expect(premiere).toMatchObject({ networkId: root, reactionCount: 2, updatedAt: T0 })

    // Une minute plus tard, rien n'a bougé : la ligne n'est PAS réécrite.
    tick(60_000)
    await recolter(t)
    expect(await ligneDeCompteurs(t, sessionId)).toEqual(premiere)

    // Une réaction de plus : la ligne change, une fois.
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "like", burst: 1 })
    tick(60_000)
    await recolter(t)
    const seconde = must(await ligneDeCompteurs(t, sessionId))
    expect(seconde._id).toBe(premiere._id)
    expect(seconde.reactionCount).toBe(3)
    expect(seconde.updatedAt).toBe(Date.now())
  })

  it("les quatre sources : admissions distinctes (agrégat), présents (baux), commentaires PUBLIÉS, réactions", async () => {
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Deux admissions, dont une partie : deux admis, un présent.
    await jeton(bob, root, sessionId)
    await jeton(carol, root, sessionId)
    await carol.as.mutation(L.presence.leave, { networkId: root, sessionId })
    // Deux commentaires, dont un retiré : un seul compte.
    await bob.as.mutation(L.comments.send, { networkId: root, sessionId, body: "Un" })
    const { commentId } = await bob.as.mutation(L.comments.send, { networkId: root, sessionId, body: "Deux" })
    await bob.as.mutation(L.comments.remove, { networkId: root, commentId })
    // Des réactions de deux personnes.
    await carol.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "bravo", burst: 3 })
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "like", burst: 1 })

    await recolter(t)
    expect(await ligneDeCompteurs(t, sessionId)).toMatchObject({
      networkId: root,
      sessionId,
      viewerGrantCount: 2,
      viewerPresentCount: 1,
      commentCount: 1,
      reactionCount: 4,
    })
  })

  it("le chemin chaud n'écrit JAMAIS les compteurs — jeton, battement, départ, commentaire, réaction : seule la récolte", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    await jeton(bob, root, sessionId)
    await bob.as.mutation(L.presence.heartbeat, { networkId: root, sessionId })
    await alice.as.mutation(L.hostPresence.heartbeat, { networkId: root, sessionId, state: "connected" })
    await bob.as.mutation(L.comments.send, { networkId: root, sessionId, body: "Bonjour" })
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "soutien", burst: 5 })
    await bob.as.mutation(L.presence.leave, { networkId: root, sessionId })
    expect(await ligneDeCompteurs(t, sessionId)).toBeNull()

    await recolter(t)
    expect(await ligneDeCompteurs(t, sessionId)).toMatchObject({ viewerGrantCount: 1, viewerPresentCount: 0, commentCount: 1, reactionCount: 5 })
  })

  it("la recomposition n'écrit JAMAIS la session : ni statut, ni horodatage", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "like", burst: 4 })
    const avant = await sessionDoc(t, sessionId)

    tick(60_000)
    await recolter(t)

    expect(must(await ligneDeCompteurs(t, sessionId)).reactionCount).toBe(4)
    expect(await sessionDoc(t, sessionId)).toEqual(avant)
  })
})

describe("les transitions de la récolte", () => {
  it("limite de 4 h : `max_duration`, compteurs DÉFINITIFS (présents à zéro), Egress arrêté et invitations soldées en job", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await jeton(bob, root, sessionId)
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "bravo", burst: 2 })
    await t.run(async (ctx) => ctx.db.patch(sessionId, { startedAt: Date.now() - DIRECT_LIVE_MAX_DURATION_MS - 60_000, egressId: "EG_MARATHON" }))

    await recolter(t)

    const session = must(await sessionDoc(t, sessionId))
    expect(session.status).toBe("ended")
    expect(session.endReason).toBe("max_duration")
    expect(session.endedAt).toBe(T0)
    // Les compteurs définitifs : plus personne en ligne, mais il A rejoint.
    expect(await ligneDeCompteurs(t, sessionId)).toMatchObject({ viewerGrantCount: 1, viewerPresentCount: 0, reactionCount: 2 })
    expect(await planifiees(t)).toEqual(
      expect.arrayContaining([
        { name: "modules/live/livekitActions:stopDirectEgress", args: { egressId: "EG_MARATHON" } },
        { name: "modules/live/invitationSettle:expireSessionInvitations", args: { sessionId, endedAt: T0 } },
      ]),
    )
  })

  it("bail éteint ET grâce écoulée → `host_absent` en deux minutes, pas en quatre heures", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    // Dernier battement : bail (30 s) + grâce (120 s) + 10 s.
    await poserBail(t, sessionId, alice, DIRECT_HOST_LEASE_MS + DIRECT_HOST_GRACE_MS + 10_000)
    // PA10 : les trois entrées de `cast()` (`joinNetwork`) ont déjà planifié le rattrapage de leur fil,
    // qui ne part pas seul sous l'horloge simulée. Relevé AVANT la récolte, comme dans `direct.test.ts`
    // (même scénario, avec Egress) : convex-test garde chaque ligne dans l'ordre de création, la suite
    // du relevé est donc exactement ce que la récolte a planifié.
    const avant = (await planifiees(t)).length

    await recolter(t)

    const session = must(await sessionDoc(t, sessionId))
    expect(session.status).toBe("ended")
    expect(session.endReason).toBe("host_absent")
    expect(must(session.endedAt) - must(session.startedAt)).toBeLessThan(DIRECT_LIVE_MAX_DURATION_MS)
    // Sans Egress, rien à arrêter ; le solde des invitations, lui, part toujours.
    expect((await planifiees(t)).slice(avant).map((job) => job.name)).toEqual(["modules/live/invitationSettle:expireSessionInvitations"])
  })

  it("bail éteint DANS la grâce → session intacte, absence CONSTATÉE une seule fois sur le bail, compteurs rafraîchis", async () => {
    const { t, root, alice, bob } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    // Bail éteint depuis 20 s : la grâce (120 s) court toujours.
    await poserBail(t, sessionId, alice, DIRECT_HOST_LEASE_MS + 20_000)
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId, kind: "like", burst: 1 })
    const avant = await sessionDoc(t, sessionId)

    await recolter(t)

    expect(await sessionDoc(t, sessionId)).toEqual(avant)
    const ligne = must(await bail(t, sessionId))
    expect(ligne.state).toBe("absent")
    expect(ligne.absentSince).toBe(ligne.leaseUntil)
    expect(must(await ligneDeCompteurs(t, sessionId)).reactionCount).toBe(1)

    // Un second passage ne repousse pas `absentSince` : l'absence a UNE date.
    tick(10_000)
    await recolter(t)
    expect(await bail(t, sessionId)).toEqual(ligne)
  })

  it("programmée oubliée (> 24 h) → `never_started`, sans solde ; SANS bail, la règle des 4 h reste seule juge", async () => {
    const { t, root, alice } = await cast()
    const oubliee = await insertSession(t, { networkId: root, host: alice, status: "scheduled", title: "Oubliée" })
    const recente = await insertSession(t, { networkId: root, host: alice, status: "scheduled", title: "Demain" })
    const jeune = await insertSession(t, { networkId: root, host: alice, title: "Sans bail, jeune" })
    const vieille = await insertSession(t, { networkId: root, host: alice, title: "Sans bail, vieille" })
    await t.run(async (ctx) => {
      await ctx.db.patch(oubliee, { createdAt: Date.now() - DIRECT_SCHEDULED_MAX_AGE_MS - 60_000 })
      await ctx.db.patch(vieille, { startedAt: Date.now() - DIRECT_LIVE_MAX_DURATION_MS - 60_000 })
    })

    await recolter(t)

    expect(must(await sessionDoc(t, oubliee))).toMatchObject({ status: "ended", endReason: "never_started" })
    expect(must(await sessionDoc(t, recente)).status).toBe("scheduled")
    // Un client ancien qui ne bat pas ne fait pas fermer sa conférence.
    expect(must(await sessionDoc(t, jeune)).status).toBe("live")
    expect(must(await sessionDoc(t, vieille))).toMatchObject({ status: "ended", endReason: "max_duration" })
    // Aucune cloche n'a sonné avant le direct : rien à solder pour la programmée oubliée.
    const soldes = (await planifiees(t)).filter((job) => job.name === "modules/live/invitationSettle:expireSessionInvitations")
    expect(soldes.map((job) => job.args)).toEqual([{ sessionId: vieille, endedAt: T0 }])
  })

  it("passage SYSTÈME, tous réseaux : la session d'un autre réseau est récoltée, sa ligne de compteurs porte SON réseau", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const ici = await insertSession(t, { networkId: root, host: alice })
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice })
    await bob.as.mutation(L.reactions.react, { networkId: root, sessionId: ici, kind: "like", burst: 1 })
    await bob.as.mutation(L.reactions.react, { networkId: testClosed, sessionId: ailleurs, kind: "bravo", burst: 2 })

    await recolter(t)

    expect(await ligneDeCompteurs(t, ici)).toMatchObject({ networkId: root, reactionCount: 1 })
    expect(await ligneDeCompteurs(t, ailleurs)).toMatchObject({ networkId: testClosed, reactionCount: 2 })
  })
})

describe("les tranches chaînées — aucun direct oublié au-delà du cinquantième", () => {
  it("cinquante programmées jeunes ne masquent pas les 51 oubliées suivantes ; leur chaîne ne relance pas celle des directs vivants", async () => {
    const { t, root, testClosed, alice, bob } = await cast()
    const jeunes: Id<"liveSessions">[] = []
    const oubliees: Id<"liveSessions">[] = []
    for (let index = 0; index < 50; index += 1) jeunes.push(await insertSession(t, { networkId: root, host: alice, status: "scheduled" }))
    for (let index = 0; index < 51; index += 1) {
      const sessionId = await insertSession(t, { networkId: testClosed, host: alice, status: "scheduled" })
      await t.run((ctx) => ctx.db.patch(sessionId, { createdAt: T0 - DIRECT_SCHEDULED_MAX_AGE_MS - 1 }))
      oubliees.push(sessionId)
    }
    jeunes.push(await insertSession(t, { networkId: root, host: alice, status: "scheduled" }))
    const vivants = await directsVivants(t, root, alice, bob, REAP_LIVE_BATCH + 2)

    await recolter(t)
    expect(await examines(t)).toBe(REAP_LIVE_BATCH)
    expect((await planifiees(t)).filter((job) => job.name === "modules/live/reap:sweepScheduledDirects")).toEqual([
      { name: "modules/live/reap:sweepScheduledDirects", args: { cursor: null, now: T0 } },
    ])
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    for (const sessionId of oubliees) expect(await sessionDoc(t, sessionId)).toMatchObject({ status: "ended", endReason: "never_started", endedAt: T0 })
    for (const sessionId of jeunes) expect(must(await sessionDoc(t, sessionId)).status).toBe("scheduled")
    for (const sessionId of vivants) expect(must(await sessionDoc(t, sessionId)).status).toBe("live")
    expect(await examines(t)).toBe(REAP_LIVE_BATCH + 2)
    expect(await suites(t)).toHaveLength(1)
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(50))
    const scheduledJobs = jobs.filter((job) => job.name === "modules/live/reap:sweepScheduledDirects")
    expect(scheduledJobs).toHaveLength(3)
    expect(scheduledJobs.every((job) => job.state.kind === "success")).toBe(true)
    expect(scheduledJobs.map((job) => job.args[0])).toEqual([
      { cursor: null, now: T0 },
      { cursor: expect.any(String), now: T0 },
      { cursor: expect.any(String), now: T0 },
    ])
  })

  it("123 programmées oubliées : un lot de 50 en tête, les suivantes par le planificateur, sans réécrire une fin au rejeu", async () => {
    const { t, root, alice } = await cast()
    for (let index = 0; index < 123; index += 1) {
      const sessionId = await insertSession(t, { networkId: root, host: alice, status: "scheduled" })
      await t.run((ctx) => ctx.db.patch(sessionId, { createdAt: T0 - DIRECT_SCHEDULED_MAX_AGE_MS - 1 }))
    }
    const endedCount = () => t.run(async (ctx) => (await ctx.db.query("liveSessions").withIndex("by_status", (q) => q.eq("status", "ended")).take(200)).length)
    await recolter(t)
    expect(await endedCount()).toBe(50)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await endedCount()).toBe(123)
    const before = await t.run((ctx) => ctx.db.query("liveSessions").take(200))
    tick(60_000)
    await recolter(t)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.run((ctx) => ctx.db.query("liveSessions").take(200))).toEqual(before)
  })

  it(`53 directs vivants : TOUS récoltés, ${REAP_LIVE_BATCH} au plus par transaction, chaque suite planifiée avec son curseur`, async () => {
    const { t, root, alice, bob } = await cast()
    const total = 53
    const sessions = await directsVivants(t, root, alice, bob, total)
    // Le DERNIER ouvert a dépassé la limite de 4 h : il doit être clos, bien qu'il soit le cinquante-troisième.
    const dernier = sessions[total - 1] as Id<"liveSessions">
    await t.run(async (ctx) => ctx.db.patch(dernier, { startedAt: Date.now() - DIRECT_LIVE_MAX_DURATION_MS - 60_000 }))

    // La tête de passage : l'appel du cron, SANS argument.
    const tranches: number[] = []
    let avant = await examines(t)
    await recolter(t)
    let apres = await examines(t)
    tranches.push(apres - avant)

    // Puis chaque suite, rejouée ici avec SON curseur : une transaction à la fois, comptée.
    const rejouees = new Set<string>()
    for (;;) {
      const nouvelles = (await suites(t)).filter((suite) => !rejouees.has(suite.id))
      if (nouvelles.length === 0) break
      // Une transaction ne planifie qu'UNE suite : jamais deux chaînes pour un passage.
      expect(nouvelles).toHaveLength(1)
      const suite = nouvelles[0] as (typeof nouvelles)[number]
      expect(typeof suite.cursor).toBe("string")
      rejouees.add(suite.id)
      avant = apres
      await t.mutation(internal.modules.live.reap.reapStaleDirects, { cursor: suite.cursor as string })
      apres = await examines(t)
      tranches.push(apres - avant)
    }

    // Plusieurs tranches, aucune au-delà de la borne, et la dernière clôt la chaîne.
    const attendues = Array.from({ length: Math.ceil(total / REAP_LIVE_BATCH) }, (_, index) => Math.min(REAP_LIVE_BATCH, total - index * REAP_LIVE_BATCH))
    expect(tranches).toEqual(attendues)
    expect(tranches.length).toBeGreaterThan(1)
    expect(Math.max(...tranches)).toBeLessThanOrEqual(REAP_LIVE_BATCH)
    // TOUS examinés — le cinquante-troisième compris, clos par la limite absolue.
    expect(apres).toBe(total)
    expect(must(await sessionDoc(t, dernier))).toMatchObject({ status: "ended", endReason: "max_duration" })
    for (const sessionId of sessions.slice(0, total - 1)) expect(must(await sessionDoc(t, sessionId)).status).toBe("live")
  })

  it("la VRAIE chaîne du planificateur : le cron sans argument, puis ses suites `{ cursor }`, jusqu'au bout de l'index", async () => {
    const { t, root, alice, bob } = await cast()
    const total = 2 * REAP_LIVE_BATCH + 2
    await directsVivants(t, root, alice, bob, total)

    await recolter(t)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await examines(t)).toBe(total)
    // Deux suites (trois tranches), jouées avec succès, chacune avec son curseur.
    const jouees = await suites(t)
    expect(jouees).toHaveLength(Math.ceil(total / REAP_LIVE_BATCH) - 1)
    expect(jouees.every((suite) => suite.state === "success" && typeof suite.cursor === "string")).toBe(true)
  })

  it("le PIRE cas d'une session, MESURÉ : une tranche tient sous les trois limites de lecture avec un quart de marge — sept sessions tiendraient, huit non", async () => {
    const { t, root, alice } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })

    // Saturer ce que la récolte lit d'une session : 1 000 commentaires au corps MAXIMAL (500 caractères de
    // 3 octets, retirés : un champ de plus), 1 000 réactions (le genre le plus long), 1 001 admissions battues
    // à l'instant, avec départ (lues, puis écartées).
    const corps = "語".repeat(DIRECT_COMMENT_MAX_LENGTH)
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let i = 0; i < AGGREGATE_COMMENTS_SCAN; i++) {
        await ctx.db.insert("liveComments", { networkId: root, sessionId, authorPersonId: alice.personId, body: corps, status: "removed", offsetMs: i, createdAt: now + i, removedAt: now })
      }
      for (let i = 0; i < 1_000; i++) {
        await ctx.db.insert("liveReactions", { networkId: root, sessionId, personId: alice.personId, kind: "instructif", count: 1, updatedAt: now })
      }
      for (let i = 0; i <= DIRECT_MAX_VIEWERS_CAP; i++) {
        await ctx.db.insert("liveViewerGrants", { networkId: root, sessionId, personId: alice.personId, firstGrantedAt: now, lastGrantedAt: now, lastSeenAt: now, leftAt: now })
      }
    })

    // Ce que la récolte lit pour UNE session vivante : sa ligne de page, son bail, sa recomposition.
    const mesure = await t.run(async (ctx) => {
      const avant = await ctx.meta.getTransactionMetrics()
      await ctx.db.get(sessionId)
      await loadHostLease(ctx, sessionId)
      await recomputeAggregates(ctx, sessionId)
      const apres = await ctx.meta.getTransactionMetrics()
      const cout = (cle: "bytesRead" | "documentsRead" | "databaseQueries") => apres[cle].used - avant[cle].used
      const limite = (cle: "bytesRead" | "documentsRead" | "databaseQueries") => apres[cle].used + apres[cle].remaining
      return {
        octets: cout("bytesRead"),
        documents: cout("documentsRead"),
        plages: cout("databaseQueries"),
        limites: { octets: limite("bytesRead"), documents: limite("documentsRead"), plages: limite("databaseQueries") },
      }
    })

    // Le calcul annoncé dans `reap.ts` : ≈ 3 010 documents, ≈ 2,3 Mo.
    expect(mesure.documents).toBeGreaterThan(3_000)
    expect(mesure.documents).toBeLessThan(3_020)
    // L'OCTET mord : sept sessions saturées tiendraient dans une transaction, huit non.
    expect(7 * mesure.octets).toBeLessThan(mesure.limites.octets)
    expect(8 * mesure.octets).toBeGreaterThan(mesure.limites.octets)
    // La tranche retenue tient sous les TROIS limites avec un quart de marge au moins
    // (pour la page, les fins de conférence et, en tête de passage, les sessions programmées).
    expect(REAP_LIVE_BATCH * mesure.octets).toBeLessThan(0.75 * mesure.limites.octets)
    expect(REAP_LIVE_BATCH * mesure.documents).toBeLessThan(0.75 * mesure.limites.documents)
    expect(REAP_LIVE_BATCH * mesure.plages).toBeLessThan(0.75 * mesure.limites.plages)
  })
})
