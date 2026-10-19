// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/spotlight.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, personnes entrées dans la racine, relations ACCEPTÉES posées par l'outillage) ; conférence POSÉE EN BASE et en direct par l'outillage de la fondation (`insertSession`) au lieu de `sessions.create` + `goLive`, et fin posée en base au lieu de `sessions.end` ; jeton par `access.authorizeToken` au nom de la personne ; cibles en `targetPersonId` (`sessions.setSpotlight` du lot des sessions, `speakers.muteMicrophone`), programme lu sur le DTO de `sessions.get` (`spotlight: { personId }`) et en base (`spotlightPersonId`) ; codes au lieu des libellés (`liveRoleRequired`, `LIVE_TARGET_NOT_ON_STAGE`, `LIVE_NOT_LIVE`, `LIVE_HOST_MUTES_SELF`) ; action planifiée sous `modules/live/livekitActions:muteDirectMicrophone` ; cas NEUFS : le micro coupé vise le SUJET d'authentification de la personne dans la salle de la conférence, une conférence d'un autre réseau n'offre ni mise en avant ni micro coupé (`notFound`, hôte compris), et `speakers.promote` refuse un membre EN ATTENTE (`LIVE_TARGET_CANNOT_JOIN_STAGE`, ni ligne ni action SFU) puis l'accepte une fois son adhésion déclarée.
/**
 * LE PROGRAMME DE L'HÔTE et LE MICRO COUPÉ — ce que ce fichier tient :
 *
 *  1. **Mettre en avant est un geste de gestion**, pas un rôle : la permission
 *     est `admitToStage` (qui décide QUI parle décide qui l'on regarde), donc
 *     un cohôte le peut et un spectateur non — avec un refus EXPLICITE, parce
 *     qu'il voit déjà la conférence.
 *  2. **On ne met en avant que quelqu'un À L'ANTENNE** — mettre en avant un
 *     spectateur ne désignerait aucune vignette.
 *  3. **Une mise en avant ne survit pas à sa personne** : rétrograder efface
 *     le programme dans la MÊME transaction, le DTO rend `null`.
 *  4. **Couper un micro FERME, et rien d'autre** : aucune écriture durable,
 *     l'hôte est hors d'atteinte, la cible doit être à l'antenne.
 *
 * ⚠️ Les deux gestes planifient (ou non) une action Node : `muteMicrophone`
 * planifie `livekitActions.muteDirectMicrophone`, et `speakers.demote` planifie
 * `applyDirectSfuState`. On ne fait JAMAIS tourner le planificateur ici — on
 * lit `_scheduled_functions`, la seule chose qu'une mutation puisse promettre.
 * Faire exécuter une action `"use node"` sous edge-runtime n'apprendrait rien
 * du contrat serveur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { codeOf, connect, enter, insertSession, joinAlso, type Person, ruleOf, seed, type T, T0 } from "./fixtures.setup"

const S = api.modules.live.speakers
const setSpotlight = api.modules.live.sessions.setSpotlight
const authorizeToken = internal.modules.live.access.authorizeToken

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function authorize(person: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) {
  return await person.as.mutation(authorizeToken, { networkId, sessionId })
}

/** Le délégué reçoit sa délégation de l'hôte, avec les drapeaux demandés. */
async function deleguer(
  root: Id<"networks">,
  host: Person,
  sessionId: Id<"liveSessions">,
  target: Person,
  kind: "cohost" | "moderator",
  flags: Partial<{ canAdmitToStage: boolean; canExclude: boolean; canEndOrTransfer: boolean }> = {},
): Promise<void> {
  await host.as.mutation(api.modules.live.delegations.grant, { networkId: root, sessionId, targetPersonId: target.personId, kind, ...flags })
}

/** La conférence se termine — posée en base (`sessions.end` a ses propres tests). */
async function endSession(t: T, sessionId: Id<"liveSessions">): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.patch(sessionId, { status: "ended", endedAt: now, endReason: "host", updatedAt: now })
  })
}

/**
 * Une salle EN COURS : Alice héberge, Bob est promu À L'ANTENNE, Carl reste
 * spectateur. C'est la configuration minimale des deux gestes — l'un vise une
 * vignette, l'autre un micro, et ni l'un ni l'autre n'a de sens sur Carl.
 */
async function salleAvecIntervenant() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carl = await enter(t, root, "carl")
  await connect(t, root, alice, bob)
  await connect(t, root, alice, carl)
  const sessionId = await insertSession(t, { networkId: root, host: alice, title: "Séance publique" })
  await authorize(bob, root, sessionId)
  await authorize(carl, root, sessionId)
  await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
  return { t, root, testClosed, sessionId, alice, bob, carl }
}

/** Une spectatrice de plus, en relation avec l'hôte, entrée dans la salle — sans aucune délégation. */
async function spectatrice(t: T, root: Id<"networks">, host: Person, sessionId: Id<"liveSessions">): Promise<Person> {
  const dora = await enter(t, root, "dora")
  await connect(t, root, host, dora)
  await authorize(dora, root, sessionId)
  return dora
}

const dtoDe = (root: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) => person.as.query(api.modules.live.sessions.get, { networkId: root, sessionId })

async function scheduled(t: T) {
  return await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(200))
}

async function setMembershipStatus(t: T, networkId: Id<"networks">, person: Person, status: "en_attente" | "declaree") {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (!row) throw new Error("adhésion inconnue")
    await ctx.db.patch(row._id, { status })
  })
}

describe("promouvoir — on ne confie pas un rôle qu'on ne peut pas exercer", () => {
  it("NEUF — `promote` refuse un membre EN ATTENTE (même refus, ni ligne ni action SFU) ; déclaré, il monte", async () => {
    const { t, root, sessionId, alice, carl } = await salleAvecIntervenant()
    const ligne = () =>
      t.run(async (ctx) =>
        ctx.db
          .query("liveSpeakers")
          .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", carl.personId))
          .unique(),
      )
    const sfu = async () => (await scheduled(t)).filter((job) => job.name === "modules/live/livekitActions:applyDirectSfuState").length
    const avant = await sfu()

    await setMembershipStatus(t, root, carl, "en_attente")
    // Il voit la conférence, il n'y monte pas : le refus de toute cible qui ne peut pas rejoindre l'antenne.
    expect(await ruleOf(alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: carl.personId }))).toBe("LIVE_TARGET_CANNOT_JOIN_STAGE")
    expect(await ligne()).toBeNull()
    expect(await sfu()).toBe(avant)

    await setMembershipStatus(t, root, carl, "declaree")
    await expect(alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: carl.personId })).resolves.toEqual({ promoted: true })
    expect((await ligne())?.removedAt).toBeUndefined()
    expect(await sfu()).toBe(avant + 1)
  })
})

describe("mettre en avant — le programme de l'hôte", () => {
  it("l'hôte met en avant un intervenant vivant, le DTO le porte", async () => {
    const { root, sessionId, alice, bob, carl } = await salleAvecIntervenant()

    await expect(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ updated: true })

    const dto = await dtoDe(root, alice, sessionId)
    expect(dto.spotlight).toEqual({ personId: bob.personId })
    // La salle voit le MÊME programme : c'est une proposition faite à tous,
    // pas un réglage privé de l'hôte.
    expect((await dtoDe(root, carl, sessionId)).spotlight).toEqual({ personId: bob.personId })
  })

  it("rejouer le même geste ne réécrit rien — idempotence", async () => {
    const { root, sessionId, alice, bob } = await salleAvecIntervenant()
    await alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })
    await expect(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ updated: false })
  })

  it("`null` RETIRE la mise en avant, et le retirer deux fois ne change rien", async () => {
    const { root, sessionId, alice, bob } = await salleAvecIntervenant()
    await alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })

    await expect(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: null })).resolves.toEqual({ updated: true })
    expect((await dtoDe(root, alice, sessionId)).spotlight).toBeNull()

    await expect(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: null })).resolves.toEqual({ updated: false })
  })

  it("l'hôte peut se mettre en avant LUI-MÊME — il a sa ligne d'intervenant", async () => {
    const { root, sessionId, alice } = await salleAvecIntervenant()
    await expect(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: alice.personId })).resolves.toEqual({ updated: true })
    expect((await dtoDe(root, alice, sessionId)).spotlight).toEqual({ personId: alice.personId })
  })

  it("un cohôte porteur d'`admitToStage` met en avant ; un spectateur est refusé EXPLICITEMENT", async () => {
    const { t, root, sessionId, alice, bob, carl } = await salleAvecIntervenant()
    await deleguer(root, alice, sessionId, carl, "cohost", { canAdmitToStage: true })

    await expect(carl.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ updated: true })

    // Dora est spectatrice et n'a AUCUNE délégation : elle voit la conférence,
    // donc le refus la nomme au lieu de la renvoyer sur `notFound`.
    const dora = await spectatrice(t, root, alice, sessionId)
    expect(await codeOf(dora.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("liveRoleRequired")
  })

  it("un modérateur SANS `canAdmitToStage` ne met personne en avant", async () => {
    const { root, sessionId, alice, bob, carl } = await salleAvecIntervenant()
    await deleguer(root, alice, sessionId, carl, "moderator")
    expect(await codeOf(carl.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("liveRoleRequired")
  })

  it("une cible qui n'est PAS à l'antenne est refusée", async () => {
    const { root, sessionId, alice, carl } = await salleAvecIntervenant()
    expect(await ruleOf(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: carl.personId }))).toBe("LIVE_TARGET_NOT_ON_STAGE")
  })

  it("un direct qui n'est pas EN COURS ne se programme pas", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    await endSession(t, sessionId)
    expect(await ruleOf(alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("LIVE_NOT_LIVE")
  })

  it("RÉTROGRADER la personne mise en avant efface le programme", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    await alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect((await dtoDe(root, alice, sessionId)).spotlight).toEqual({ personId: bob.personId })

    await alice.as.mutation(S.demote, { networkId: root, sessionId, targetPersonId: bob.personId })

    // Le DTO ne le sert plus — et la BASE non plus : laisser le champ derrière
    // ferait pointer le programme sur quelqu'un qui n'est plus à l'antenne.
    expect((await dtoDe(root, alice, sessionId)).spotlight).toBeNull()
    const session = await t.run(async (ctx) => ctx.db.get(sessionId))
    expect(session?.spotlightPersonId).toBeUndefined()
  })

  it("rétrograder QUELQU'UN D'AUTRE laisse le programme en place", async () => {
    const { root, sessionId, alice, bob, carl } = await salleAvecIntervenant()
    await alice.as.mutation(S.promote, { networkId: root, sessionId, targetPersonId: carl.personId })
    await alice.as.mutation(setSpotlight, { networkId: root, sessionId, targetPersonId: alice.personId })

    await alice.as.mutation(S.demote, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect((await dtoDe(root, alice, sessionId)).spotlight).toEqual({ personId: alice.personId })
  })
})

describe("couper le micro — on FERME, on n'ouvre jamais", () => {
  it("l'hôte coupe le micro d'un intervenant : le geste est DEMANDÉ au SFU", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    const avant = (await scheduled(t)).length

    await expect(alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ requested: true })

    const apres = await scheduled(t)
    expect(apres.length).toBe(avant + 1)
    expect(apres[apres.length - 1]?.name).toContain("muteDirectMicrophone")
  })

  it("NEUF — le geste vise le SUJET d'authentification de la personne, dans la salle de la conférence", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    await alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId })
    const session = await t.run(async (ctx) => ctx.db.get(sessionId))
    const job = (await scheduled(t)).find((row) => row.name === "modules/live/livekitActions:muteDirectMicrophone")
    // Le préfixe des identités de la salle est le sujet de l'action du jeton : `authUserId`.
    expect(job?.args[0]).toEqual({ roomName: session?.roomName, subject: "auth-bob" })
  })

  it("aucune écriture DURABLE : couper un micro est un acte de transport", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    const ligne = () =>
      t.run(async (ctx) =>
        ctx.db
          .query("liveSpeakers")
          .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
          .unique(),
      )
    const avant = await ligne()
    await alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId })
    const apres = await ligne()
    expect(apres?.grantEpoch).toBe(avant?.grantEpoch)
    expect(apres?.removedAt).toBeUndefined()
  })

  it("un cohôte porteur d'`admitToStage` coupe ; un spectateur est refusé", async () => {
    const { t, root, sessionId, alice, bob, carl } = await salleAvecIntervenant()
    await deleguer(root, alice, sessionId, carl, "cohost", { canAdmitToStage: true })
    await expect(carl.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ requested: true })

    const dora = await spectatrice(t, root, alice, sessionId)
    expect(await codeOf(dora.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("liveRoleRequired")
  })

  it("personne ne coupe le micro de l'HÔTE — il le fait lui-même", async () => {
    const { root, sessionId, alice, bob } = await salleAvecIntervenant()
    await deleguer(root, alice, sessionId, bob, "cohost", { canAdmitToStage: true })
    expect(await ruleOf(bob.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_MUTES_SELF")
    expect(await ruleOf(alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: alice.personId }))).toBe("LIVE_HOST_MUTES_SELF")
  })

  it("une cible HORS ANTENNE est refusée — un spectateur n'a aucune piste", async () => {
    const { root, sessionId, alice, carl } = await salleAvecIntervenant()
    expect(await ruleOf(alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: carl.personId }))).toBe("LIVE_TARGET_NOT_ON_STAGE")
  })

  it("un direct qui n'est pas EN COURS ne coupe aucun micro", async () => {
    const { t, root, sessionId, alice, bob } = await salleAvecIntervenant()
    await endSession(t, sessionId)
    expect(await ruleOf(alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId, targetPersonId: bob.personId }))).toBe("LIVE_NOT_LIVE")
  })

  it("NEUF — une conférence d'un AUTRE réseau : ni mise en avant, ni micro coupé (`notFound`, hôte compris)", async () => {
    const { t, root, testClosed, alice, bob } = await salleAvecIntervenant()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    await connect(t, testClosed, alice, bob)
    const elsewhere = await insertSession(t, { networkId: testClosed, host: alice })
    await alice.as.mutation(S.promote, { networkId: testClosed, sessionId: elsewhere, targetPersonId: bob.personId })

    expect(await codeOf(alice.as.mutation(setSpotlight, { networkId: root, sessionId: elsewhere, targetPersonId: bob.personId }))).toBe("notFound")
    expect(await codeOf(alice.as.mutation(S.muteMicrophone, { networkId: root, sessionId: elsewhere, targetPersonId: bob.personId }))).toBe("notFound")
    // Depuis son réseau, le même geste passe.
    await expect(alice.as.mutation(S.muteMicrophone, { networkId: testClosed, sessionId: elsewhere, targetPersonId: bob.personId })).resolves.toEqual({ requested: true })
  })
})
