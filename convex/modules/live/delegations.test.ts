// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/delegations.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, personnes entrées dans la racine, relations ACCEPTÉES posées par l'outillage, nom publié distinct de l'identifiant posé sur la personne pour la console) ; conférences POSÉES EN BASE et en direct par l'outillage de la fondation (`insertSession`) au lieu de `sessions.create` + `goLive` ; jeton par `access.authorizeToken` au nom de la personne ; cibles en `targetPersonId`, DTO de la console en `personId`, matrice lue sur le DTO de `sessions.get` (lot des sessions) ; codes au lieu des libellés (`LIVE_NOT_DELEGABLE`, `liveRoleRequired`, `notFound`) ; instant de lecture fourni à la console de l'antenne (`now`, D16) ; cas NEUFS : une conférence d'un autre réseau ne se délègue ni ne se liste (`notFound`, hôte compris), une personne qui a quitté le réseau sort de la console et n'est plus délégable (V35), et un membre EN ATTENTE n'est pas délégable (même code, aucune ligne) jusqu'à son adhésion déclarée.
/**
 * DÉLÉGATIONS de gestion d'un direct (D-11, ADR-0144).
 *
 * Ce que ce fichier tient :
 *  1. l'hôte seul accorde et révoque — un délégué, même tout-puissant, ne
 *     re-délègue pas ;
 *  2. l'éligibilité est celle de l'antenne (relation ACCEPTÉE avec l'hôte,
 *     adhésion et audience, blocage, exclusion), à l'exception assumée de
 *     l'intervenant ;
 *  3. déléguer n'ouvre AUCUN micro : `liveSpeakers` n'est pas touchée et le
 *     jeton reste `viewer` ;
 *  4. ré-accorder rouvre la MÊME ligne, révoquer refuse IMMÉDIATEMENT.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { codeOf, connect, enter, insertSession, joinAlso, type Person, ruleOf, seed, type T, T0 } from "./fixtures.setup"

const D = api.modules.live.delegations
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

/** Une conférence EN COURS, posée en base (le passage en direct est du lot des sessions). */
async function liveDirect(t: T, networkId: Id<"networks">, host: Person, audience: "public" | "connections" = "public"): Promise<Id<"liveSessions">> {
  return await insertSession(t, { networkId, host, audience, title: "Conférence de presse" })
}

const dtoDe = (root: Id<"networks">, person: Person, sessionId: Id<"liveSessions">) => person.as.query(api.modules.live.sessions.get, { networkId: root, sessionId })

async function setMembershipStatus(t: T, networkId: Id<"networks">, person: Person, status: "en_attente" | "declaree" | "partie") {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    if (!row) throw new Error("adhésion inconnue")
    await ctx.db.patch(row._id, { status })
  })
}

/** Un hôte, une relation acceptée, un direct en cours. */
async function scene() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  await connect(t, root, alice, bob)
  const sessionId = await liveDirect(t, root, alice)
  return { t, root, testClosed, sessionId, alice, bob }
}

describe("F3b — candidats privés et règles partagées avec grant", () => {
  const candidates = async (host: Person, networkId: Id<"networks">, sessionId: Id<"liveSessions">) => {
    const pages = await Promise.all((["low", "high"] as const).map((side) => host.as.query(D.searchCandidates, { networkId, sessionId, side, search: "", paginationOpts: { cursor: null, numItems: 25 } })))
    return pages.flatMap((page) => page.page)
  }
  it("conserve une relation déjà invitée et à l’antenne", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(api.modules.live.invitees.add, { networkId: root, sessionId, personId: bob.personId, stageRole: "speaker" })
    expect((await candidates(alice, root, sessionId)).map((row) => row.personId)).toContain(bob.personId)
  })
  it("écarte les membres en attente, puis les exclus, avec la même garde que grant", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    await setMembershipStatus(t, root, bob, "en_attente")
    expect(await candidates(alice, root, sessionId)).toEqual([])
    await setMembershipStatus(t, root, bob, "declaree")
    expect(await candidates(alice, root, sessionId)).toHaveLength(1)
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(await candidates(alice, root, sessionId)).toEqual([])
  })
  it("réserve les candidats au titulaire, même contre un cohôte, et isole les réseaux", async () => {
    const { t, root, testClosed, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost" })
    const args = { networkId: root, sessionId, side: "low" as const, search: "", paginationOpts: { cursor: null, numItems: 25 } }
    expect(await codeOf(bob.as.query(D.searchCandidates, args))).toBe("liveRoleRequired")
    await joinAlso(t, testClosed, alice)
    expect(await codeOf(alice.as.query(D.searchCandidates, { ...args, networkId: testClosed }))).toBe("notFound")
  })
})

describe("accorder — l'hôte seul, sur une relation acceptée", () => {
  it("accorde, puis la matrice du DTO le dit à l'intéressé", async () => {
    const { root, sessionId, alice, bob } = await scene()
    const res = await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" })
    expect(res.granted).toBe(true)

    const dto = await dtoDe(root, bob, sessionId)
    // Modérer et fermer la conversation : le socle d'un modérateur.
    expect(dto.permissions.moderateChat).toBe(true)
    expect(dto.permissions.closeChat).toBe(true)
    // Sans drapeau, rien d'autre — et jamais l'audience ni la délégation.
    expect(dto.permissions.exclude).toBe(false)
    expect(dto.permissions.admitToStage).toBe(false)
    expect(dto.permissions.changeAudienceOrReplay).toBe(false)
    expect(dto.permissions.delegate).toBe(false)
    // ⚠️ Le rôle PUBLIANT n'a pas bougé : un modérateur n'est pas à l'antenne.
    expect(dto.viewerRole).toBe("viewer")
  })

  it("les DÉFAUTS du genre : un cohôte arrive avec l'antenne, pas un modérateur", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost" })
    const dto = await dtoDe(root, bob, sessionId)
    expect(dto.permissions.admitToStage).toBe(true)
    expect(dto.permissions.removeFromStage).toBe(true)
    // Exclure et terminer ne sont JAMAIS un défaut : ils se cochent.
    expect(dto.permissions.exclude).toBe(false)
    expect(dto.permissions.endOrTransfer).toBe(false)
  })

  it("les drapeaux explicites l'emportent sur le défaut du genre", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, {
      networkId: root,
      sessionId,
      targetPersonId: bob.personId,
      kind: "cohost",
      canAdmitToStage: false,
      canExclude: true,
      canEndOrTransfer: true,
    })
    const dto = await dtoDe(root, bob, sessionId)
    expect(dto.permissions.admitToStage).toBe(false)
    expect(dto.permissions.exclude).toBe(true)
    expect(dto.permissions.reinstate).toBe(true)
    expect(dto.permissions.endOrTransfer).toBe(true)
  })

  it("DÉLÉGUER N'OUVRE AUCUN MICRO — ni ligne d'antenne, ni jeton speaker", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost", canAdmitToStage: true })
    const speaker = await t.run(async (ctx) =>
      ctx.db
        .query("liveSpeakers")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
        .unique(),
    )
    expect(speaker).toBeNull()
    expect((await authorize(bob, root, sessionId)).role).toBe("viewer")
  })

  it("une relation NON acceptée n'est pas délégable, même sur un direct public", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const carl = await enter(t, root, "carl")
    const sessionId = await liveDirect(t, root, alice, "public")
    expect(await ruleOf(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: carl.personId, kind: "moderator" }))).toBe("LIVE_NOT_DELEGABLE")
  })

  it("une personne EXCLUE n'est pas délégable", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(api.modules.live.moderation.ban, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(await ruleOf(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" }))).toBe("LIVE_NOT_DELEGABLE")
  })

  it("l'hôte ne se délègue pas à lui-même", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const sessionId = await liveDirect(t, root, alice)
    expect(await ruleOf(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: alice.personId, kind: "cohost" }))).toBe("LIVE_NOT_DELEGABLE")
  })

  it("NEUF — un membre EN ATTENTE ne reçoit pas de délégation (même refus, aucune ligne) ; déclaré, il la reçoit", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    const lignes = () =>
      t.run(async (ctx) =>
        ctx.db
          .query("liveDelegations")
          .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
          .take(10),
      )
    await setMembershipStatus(t, root, bob, "en_attente")
    // On ne confie pas un rôle qu'on ne peut pas exercer — et le refus ne dit pas pourquoi.
    expect(await ruleOf(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" }))).toBe("LIVE_NOT_DELEGABLE")
    expect(await lignes()).toEqual([])

    await setMembershipStatus(t, root, bob, "declaree")
    await expect(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" })).resolves.toMatchObject({ granted: true })
    expect(await lignes()).toHaveLength(1)
  })

  it("un INTERVENANT peut recevoir une délégation — l'écart assumé à l'antenne", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(api.modules.live.speakers.promote, { networkId: root, sessionId, targetPersonId: bob.personId })
    await expect(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost" })).resolves.toMatchObject({ granted: true })
  })
})

describe("un délégué ne re-délègue pas, et ne lit pas la console des délégations", () => {
  it("`grant` lui est refusé EXPLICITEMENT", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    const carl = await enter(t, root, "carl")
    await connect(t, root, alice, carl)
    await alice.as.mutation(D.grant, {
      networkId: root,
      sessionId,
      targetPersonId: bob.personId,
      kind: "cohost",
      canAdmitToStage: true,
      canExclude: true,
      canEndOrTransfer: true,
    })
    // ⚠️ Refus EXPLICITE, pas `notFound` : Bob voit la session.
    expect(await codeOf(bob.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: carl.personId, kind: "moderator" }))).toBe("liveRoleRequired")
    expect(await codeOf(bob.as.query(D.listForSession, { networkId: root, sessionId }))).toBe("liveRoleRequired")
  })

  it("un tiers HORS AUDIENCE reçoit le refus indistinct, jamais le refus de droit", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const carl = await enter(t, root, "carl")
    const sessionId = await liveDirect(t, root, alice, "connections")
    expect(await codeOf(carl.as.query(D.listForSession, { networkId: root, sessionId }))).toBe("notFound")
  })

  it("NEUF — une conférence d'un AUTRE réseau ne se délègue ni ne se liste depuis celui-ci (`notFound`, hôte compris)", async () => {
    const { t, root, testClosed, alice, bob } = await scene()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    await connect(t, testClosed, alice, bob)
    const elsewhere = await liveDirect(t, testClosed, alice)

    expect(await codeOf(alice.as.mutation(D.grant, { networkId: root, sessionId: elsewhere, targetPersonId: bob.personId, kind: "moderator" }))).toBe("notFound")
    expect(await codeOf(alice.as.query(D.listForSession, { networkId: root, sessionId: elsewhere }))).toBe("notFound")
    // Depuis son réseau, avec la relation de CE réseau, la délégation passe.
    await expect(alice.as.mutation(D.grant, { networkId: testClosed, sessionId: elsewhere, targetPersonId: bob.personId, kind: "moderator" })).resolves.toMatchObject({ granted: true })
  })
})

describe("révoquer — immédiat, idempotent, et la trace demeure", () => {
  it("le droit tombe au premier acte suivant", async () => {
    const { root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost", canAdmitToStage: true })
    await expect(bob.as.query(api.modules.live.antenna.hostState, { networkId: root, sessionId, now: Date.now() })).resolves.toMatchObject({ status: "live" })

    const revoked = await alice.as.mutation(D.revoke, { networkId: root, sessionId, targetPersonId: bob.personId })
    expect(revoked.revoked).toBe(true)
    expect(await codeOf(bob.as.query(api.modules.live.antenna.hostState, { networkId: root, sessionId, now: Date.now() }))).toBe("liveRoleRequired")
    // Idempotente : révoquer deux fois ne réécrit rien.
    await expect(alice.as.mutation(D.revoke, { networkId: root, sessionId, targetPersonId: bob.personId })).resolves.toEqual({ revoked: false })
  })

  it("la LIGNE survit à la révocation, et ré-accorder la ROUVRE", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" })
    await alice.as.mutation(D.revoke, { networkId: root, sessionId, targetPersonId: bob.personId })
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost" })
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("liveDelegations")
        .withIndex("by_session_person", (q) => q.eq("sessionId", sessionId).eq("personId", bob.personId))
        .take(10),
    )
    // ⚠️ UNE seule ligne : `by_session_person` est lu en `.unique()`, une
    // seconde ferait lever TOUTES les gardes de la session d'un coup.
    expect(rows).toHaveLength(1)
    expect(rows[0]?.revokedAt).toBeUndefined()
    expect(rows[0]?.kind).toBe("cohost")
  })
})

describe("la console des délégations", () => {
  it("liste les lignes vivantes de l'hôte, et rien d'autre", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    const carl = await enter(t, root, "carl")
    await connect(t, root, alice, carl)
    // Le nom publié se distingue de l'identifiant : la console sert le NOM.
    await t.run(async (ctx) => ctx.db.patch(bob.personId, { displayName: "Nom publié bob" }))
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost", canExclude: true })
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: carl.personId, kind: "moderator" })
    await alice.as.mutation(D.revoke, { networkId: root, sessionId, targetPersonId: carl.personId })

    const list = await alice.as.query(D.listForSession, { networkId: root, sessionId })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      personId: bob.personId,
      kind: "cohost",
      canExclude: true,
      canAdmitToStage: true,
      displayName: "Nom publié bob",
    })
  })

  it("NEUF — une personne qui a QUITTÉ le réseau sort de la console et n'est plus délégable (V35)", async () => {
    const { t, root, sessionId, alice, bob } = await scene()
    await alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "moderator" })
    expect((await alice.as.query(D.listForSession, { networkId: root, sessionId })).map((row) => row.personId)).toEqual([bob.personId])

    await setMembershipStatus(t, root, bob, "partie")
    // Sa ligne survit en base, mais la console ne prétend pas qu'il gère encore.
    expect(await alice.as.query(D.listForSession, { networkId: root, sessionId })).toEqual([])
    expect(await ruleOf(alice.as.mutation(D.grant, { networkId: root, sessionId, targetPersonId: bob.personId, kind: "cohost" }))).toBe("LIVE_NOT_DELEGABLE")
  })
})
