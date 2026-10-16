// @vitest-environment edge-runtime
// Réécrit d'après socle/convex/modules/direct/revocation.test.ts @ ad2e7fdc2 — page et adhésion au lieu de l'organisation : « expulse uniquement des directs organisationnels concernés » devient la sortie du CERCLE d'une page (désabonnement, signature retirée) qui ne coupe que ses directs `followers`, la décision d'accès seule juge ; « le retrait d'un rattachement programme l'expulsion organisationnelle » devient la PERTE D'ADHÉSION (départ d'un réseau, suspension à la racine) qui programme `kickUserFromNetworkDirects`, et son passage ne coupe que là où la personne a été admise et ne voit plus ; « désactiver une page termine ses directs » et « la désactivation publique d'une page programme sa fermeture » portés sur la console du moteur (`pages/admin.setPageStatus`) et l'index des directs d'une page ; « un blocage programme les deux expulsions symétriques » porté sur `graph/connections.blockPerson` (une mutation interne `revokeConnectionDirects` fan-out, une fois par paire fermée) ; sessions et pages posées en base (`fixtures.setup.ts`), personnes et réseaux de la graine des fondations ; jobs lus dans `_scheduled_functions` sous l'horloge simulée. Cas neufs (intégration du lot 16) : se désabonner d'une page et retirer un signataire PROGRAMMENT la coupure (`pages.unfollow`, `pages.signatories.revokePageRole`).
/**
 * La RÉVOCATION temps réel des accès au direct — ce que ce fichier tient :
 *
 *  1. chaque geste qui retire un droit PLANIFIE sa coupure (blocage, départ,
 *     suspension, retrait d'une page), après sa transaction ;
 *  2. chaque coupure ne vise QUE les salles où la décision d'accès ne laisse
 *     plus entrer la personne — une autre porte ouverte la garde dans la salle ;
 *  3. retirer une page TERMINE ses directs (`revoked`), ferme salle et capture,
 *     et solde les invitations en job.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { connect, enter, followPage, grantAt, insertPage, insertSession, joinAlso, type Person, seed, type T, T0 } from "./fixtures.setup"

const SFU_STATE = "modules/live/livekitActions:applyDirectSfuState"
const REVOCATION = internal.modules.live.revocation

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function scheduled(t: T) {
  return await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect())
}

async function jobsNamed(t: T, name: string): Promise<unknown[]> {
  return (await scheduled(t)).filter((job) => job.name === name).map((job) => job.args[0])
}

/** Les salles d'où une personne est expulsée (coupures SFU planifiées). */
async function kicksFor(t: T, person: Person): Promise<string[]> {
  const subject = (await t.run(async (ctx) => ctx.db.get(person.personId)))?.authUserId
  return (await scheduled(t))
    .filter((job) => {
      const args = job.args[0] as { subject?: string; mode?: string }
      return job.name === SFU_STATE && args.subject === subject && args.mode === "kick"
    })
    .map((job) => (job.args[0] as { roomName: string }).roomName)
}

async function roomOf(t: T, sessionId: Id<"liveSessions">): Promise<string> {
  const row = await t.run(async (ctx) => ctx.db.get(sessionId))
  if (!row) throw new Error("session inconnue")
  return row.roomName
}

async function sessionDoc(t: T, sessionId: Id<"liveSessions">): Promise<Doc<"liveSessions"> | null> {
  return await t.run(async (ctx) => ctx.db.get(sessionId))
}

async function membershipOf(t: T, networkId: Id<"networks">, person: Person): Promise<Doc<"networkMemberships">> {
  const row = await t.run(async (ctx) =>
    ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique(),
  )
  if (!row) throw new Error("adhésion inconnue")
  return row
}

/** Retire l'abonnement de `person` à la page (la ligne, comme `pages.unfollow`). */
async function unfollowPage(t: T, pageId: Id<"pages">, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("pageFollows")
      .withIndex("by_page_person", (q) => q.eq("pageId", pageId).eq("personId", person.personId))
      .unique()
    if (row) await ctx.db.delete(row._id)
  })
}

async function operatorIn(t: T, root: Id<"networks">): Promise<Person> {
  const operator = await enter(t, root, "console")
  await t.run(async (ctx) => ctx.db.insert("operators", { personId: operator.personId, role: "platform_operator", grantedAt: 1 }))
  return operator
}

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const host = await enter(t, root, "host")
  const member = await enter(t, root, "member")
  const other = await enter(t, root, "other")
  return { t, root, testClosed, host, member, other }
}

describe("révocation temps réel — le cercle d'une page", () => {
  it("sortir du cercle d'une page coupe de ses SEULS directs réservés aux abonnés", async () => {
    const { t, root, host, member, other } = await cast()
    const pageId = await insertPage(t, root, host, "page-revocation")
    const otherPageId = await insertPage(t, root, other, "autre-page")
    for (const page of [pageId, otherPageId]) await followPage(t, page, member)
    const followers = await insertSession(t, { networkId: root, host, audience: "followers", pageId })
    const publicOfPage = await insertSession(t, { networkId: root, host, audience: "public", pageId })
    const otherFollowers = await insertSession(t, { networkId: root, host: other, audience: "followers", pageId: otherPageId })

    await unfollowPage(t, pageId, member)
    await t.mutation(REVOCATION.kickUserFromPageDirects, { personId: member.personId, pageId, cursor: null })

    expect(await kicksFor(t, member)).toEqual([await roomOf(t, followers)])
    for (const untouched of [publicOfPage, otherFollowers]) expect(await kicksFor(t, member)).not.toContain(await roomOf(t, untouched))
  })

  it("la décision reste seule juge : un signataire retiré qui suit encore la page reste ; sans abonnement, il sort", async () => {
    const { t, root, host, member } = await cast()
    const pageId = await insertPage(t, root, host, "page-signataires")
    await t.run(async (ctx) => ctx.db.insert("pageSignatories", { networkId: root, pageId, personId: member.personId, role: "signatory", acceptedAt: 1, createdAt: 1, updatedAt: 1 }))
    await followPage(t, pageId, member)
    const followers = await insertSession(t, { networkId: root, host, audience: "followers", pageId })

    // Signature retirée (la ligne, comme `signatories.revokePageRole`), abonnement gardé.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("pageSignatories")
        .withIndex("by_page_person", (q) => q.eq("pageId", pageId).eq("personId", member.personId))
        .unique()
      if (row) await ctx.db.delete(row._id)
    })
    await t.mutation(REVOCATION.kickUserFromPageDirects, { personId: member.personId, pageId, cursor: null })
    expect(await kicksFor(t, member)).toEqual([])

    await unfollowPage(t, pageId, member)
    await t.mutation(REVOCATION.kickUserFromPageDirects, { personId: member.personId, pageId, cursor: null })
    expect(await kicksFor(t, member)).toEqual([await roomOf(t, followers)])
  })
})

describe("révocation temps réel — une page retirée", () => {
  it("retirer une page termine ses directs en live, ferme salle et capture, et solde en job ; le reste ne bouge pas", async () => {
    const { t, root, host, other } = await cast()
    const pageId = await insertPage(t, root, host, "page-close")
    const otherPageId = await insertPage(t, root, other, "autre-page")
    const live = await insertSession(t, { networkId: root, host, audience: "public", pageId })
    await t.run(async (ctx) => ctx.db.patch(live, { egressId: "egress-1", replayStatus: "pending" }))
    const programmed = await insertSession(t, { networkId: root, host, audience: "followers", pageId, status: "scheduled" })
    const elsewhere = await insertSession(t, { networkId: root, host: other, audience: "public", pageId: otherPageId })

    await t.mutation(REVOCATION.closePageDirects, { pageId, cursor: null, revokedAt: 42 })

    expect(await sessionDoc(t, live)).toMatchObject({ status: "ended", endedAt: 42, endReason: "revoked", updatedAt: 42 })
    expect((await sessionDoc(t, programmed))?.status).toBe("scheduled")
    expect((await sessionDoc(t, elsewhere))?.status).toBe("live")
    expect(await jobsNamed(t, "modules/live/livekitActions:closeDirectRoom")).toEqual([{ roomName: await roomOf(t, live) }])
    expect(await jobsNamed(t, "modules/live/livekitActions:stopDirectEgress")).toEqual([{ egressId: "egress-1" }])
    expect(await jobsNamed(t, "modules/live/invitationSettle:expireSessionInvitations")).toEqual([{ sessionId: live, endedAt: 42 }])
  })

  it("la console qui retire une page programme sa fermeture ; la rétablir ne programme rien", async () => {
    const { t, root, host } = await cast()
    const operator = await operatorIn(t, root)
    const pageId = await insertPage(t, root, host, "page-hook")

    await operator.as.mutation(api.modules.pages.admin.setPageStatus, { pageId, status: "inactive", reason: "Page retirée après examen." })
    const jobs = (await jobsNamed(t, "modules/live/revocation:closePageDirects")) as { pageId: Id<"pages">; cursor: string | null; revokedAt: number }[]
    expect(jobs).toEqual([{ pageId, cursor: null, revokedAt: expect.any(Number) }])

    await operator.as.mutation(api.modules.pages.admin.setPageStatus, { pageId, status: "active", reason: "Rétablie après examen." })
    expect(await jobsNamed(t, "modules/live/revocation:closePageDirects")).toHaveLength(1)
  })
})

describe("révocation temps réel — les portes du cercle d'une page", () => {
  it("se désabonner programme la coupure de ses directs ; un désabonnement sans abonnement ne programme rien", async () => {
    const { t, root, host, member } = await cast()
    const pageId = await insertPage(t, root, host, "page-desabonnement")
    await followPage(t, pageId, member)

    await member.as.mutation(api.modules.pages.pages.unfollow, { networkId: root, pageId })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromPageDirects")).toEqual([{ personId: member.personId, pageId, cursor: null }])

    await member.as.mutation(api.modules.pages.pages.unfollow, { networkId: root, pageId })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromPageDirects")).toHaveLength(1)
  })

  it("retirer un signataire programme la coupure de ses directs", async () => {
    const { t, root, host, member } = await cast()
    const pageId = await insertPage(t, root, host, "page-signataire")
    await t.run(async (ctx) => ctx.db.insert("pageSignatories", { networkId: root, pageId, personId: member.personId, role: "signatory", acceptedAt: 1, createdAt: 1, updatedAt: 1 }))

    await host.as.mutation(api.modules.pages.signatories.revokePageRole, { networkId: root, pageId, personId: member.personId })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromPageDirects")).toEqual([{ personId: member.personId, pageId, cursor: null }])
  })
})

describe("révocation temps réel — une relation rompue", () => {
  it("un blocage programme les deux expulsions symétriques, une fois par paire fermée", async () => {
    const { t, root, host, member } = await cast()
    await connect(t, root, host, member)

    await host.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: member.personId })
    expect(await jobsNamed(t, "modules/live/revocation:revokeConnectionDirects")).toEqual([{ firstPersonId: host.personId, secondPersonId: member.personId }])
    // L'autre bloque à son tour : la paire était déjà fermée, rien de plus.
    await member.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: host.personId })
    expect(await jobsNamed(t, "modules/live/revocation:revokeConnectionDirects")).toHaveLength(1)

    await t.mutation(REVOCATION.revokeConnectionDirects, { firstPersonId: host.personId, secondPersonId: member.personId })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromConnectionDirects")).toEqual(
      expect.arrayContaining([
        { revokedPersonId: member.personId, hostPersonId: host.personId, cursor: null },
        { revokedPersonId: host.personId, hostPersonId: member.personId, cursor: null },
      ]),
    )
  })
})

describe("révocation temps réel — une adhésion perdue", () => {
  it("quitter un réseau, être suspendu à la racine : la coupure des directs est programmée, dans le réseau perdu", async () => {
    const { t, root, testClosed, member, other } = await cast()
    await joinAlso(t, testClosed, member)
    await member.as.mutation(api.modules.people.memberships.leaveNetwork, { networkId: testClosed })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromNetworkDirects")).toEqual([{ personId: member.personId, networkId: testClosed, cursor: null }])

    const operator = await operatorIn(t, root)
    await operator.as.mutation(api.modules.people.memberships.suspendEverywhere, { personId: other.personId, reason: "Suspension après examen." })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromNetworkDirects")).toEqual([
      { personId: member.personId, networkId: testClosed, cursor: null },
      { personId: other.personId, networkId: root, cursor: null },
    ])
    // Lever la suspension ne coupe rien.
    await operator.as.mutation(api.modules.people.memberships.liftSuspension, { personId: other.personId, reason: "Levée après examen." })
    expect(await jobsNamed(t, "modules/live/revocation:kickUserFromNetworkDirects")).toHaveLength(2)
  })

  it("la coupure ne vise que les salles où la personne a été admise et qu'elle ne voit plus ; la racine vaut partout", async () => {
    const { t, root, testClosed, host, member } = await cast()
    for (const person of [host, member]) await joinAlso(t, testClosed, person)
    const admitted = await insertSession(t, { networkId: testClosed, host, audience: "public" })
    const neverJoined = await insertSession(t, { networkId: testClosed, host, audience: "public" })
    const atRoot = await insertSession(t, { networkId: root, host, audience: "public" })
    const now = Date.now()
    await grantAt(t, admitted, member, now)
    await grantAt(t, atRoot, member, now)

    // Encore membre partout : rien à couper.
    await t.mutation(REVOCATION.kickUserFromNetworkDirects, { personId: member.personId, networkId: testClosed, cursor: null })
    expect(await kicksFor(t, member)).toEqual([])

    // Partie du réseau fermé : la seule salle où elle était admise, dans ce réseau.
    const closedMembership = await membershipOf(t, testClosed, member)
    await t.run(async (ctx) => ctx.db.patch(closedMembership._id, { status: "partie" }))
    await t.mutation(REVOCATION.kickUserFromNetworkDirects, { personId: member.personId, networkId: testClosed, cursor: null })
    expect(await kicksFor(t, member)).toEqual([await roomOf(t, admitted)])
    expect(await kicksFor(t, member)).not.toContain(await roomOf(t, neverJoined))

    // Suspendue à la racine : la racine gouverne tous les réseaux.
    const rootMembership = await membershipOf(t, root, member)
    await t.run(async (ctx) => ctx.db.patch(rootMembership._id, { status: "suspendue" }))
    await t.mutation(REVOCATION.kickUserFromNetworkDirects, { personId: member.personId, networkId: root, cursor: null })
    expect(await kicksFor(t, member)).toContain(await roomOf(t, atRoot))
    expect(await kicksFor(t, member)).not.toContain(await roomOf(t, neverJoined))
  })
})
