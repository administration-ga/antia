// @vitest-environment edge-runtime
/**
 * Signataires d'une page, console des pages et groupe d'adhérents — tests neufs
 * (le socle n'avait ni signataires ni console de pages au-delà de l'activation,
 * dont le patron d'audit `reseauPlatformActsAudit` est repris : chaque décision
 * écrit sa ligne, un geste sans effet n'écrit rien).
 */
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { PAGE_SIGNATORIES_MAX } from "@antia/social-domain/pages"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; handle: string }

const P = api.modules.pages.pages
const SIG = api.modules.pages.signatories
const ADMIN = api.modules.pages.admin
const GROUPS = api.modules.thematicGroups.thematicGroups

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 9, 15, 10, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string): Promise<Person> {
  vi.setSystemTime(Date.now() + 1000)
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  return { as, personId, handle }
}

async function verify(t: T, networkId: Id<"networks">, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("networkMemberships")
      .withIndex("by_network_and_person", (q) => q.eq("networkId", networkId).eq("personId", person.personId))
      .unique()
    await ctx.db.patch(membership!._id, { status: "verifiee" })
  })
}

async function makeOperator(t: T, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("operators", { personId: person.personId, role: "platform_operator", grantedAt: 1 })
  })
}

/** Un lien IDN de garantie 2 : l'identité forte qu'exige une page officielle. */
async function strongIdentity(t: T, person: Person): Promise<Id<"identityLinks">> {
  return await t.run(async (ctx) => await ctx.db.insert("identityLinks", { personId: person.personId, provider: "idn", subject: `idn-${person.handle}`, loa: 2, linkedAt: 1 }))
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

const codeOf = async (promise: Promise<unknown>) => engineErrorCode(await caught(promise))
const ruleOf = async (promise: Promise<unknown>) => engineErrorRule(await caught(promise))?.rule ?? null

async function journal(t: T, table: "pages" | "pageClaims", id: string) {
  return await t.run(async (ctx) => await ctx.db.query("engineAudit").withIndex("by_subject_at", (q) => q.eq("subjectTable", table).eq("subjectId", id)).take(20))
}

/** Une page de la racine dont Alice est l'administratrice. */
async function alicePage(t: T) {
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  await verify(t, root, alice)
  const { pageId, handle } = await alice.as.mutation(P.createPage, { networkId: root, name: "Association des Gabonais", ownerKind: "association" })
  return { root, testClosed, alice, pageId, handle }
}

describe("habiliter un signataire", () => {
  it("habiliter INVITE ; seule l'acceptation donne le droit ; décliner efface l'invitation", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    expect(await alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "bob", role: "signatory" })).toEqual({ personId: bob.personId, role: "signatory", invited: true })
    expect(await bob.as.query(SIG.myPageInvitations, { networkId: root })).toMatchObject([{ page: { pageId }, role: "signatory" }])
    expect(await codeOf(bob.as.query(SIG.listPageSignatories, { networkId: root, pageId }))).toBe("pageRoleRequired")
    expect(await bob.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: true })).toEqual({ role: "signatory" })
    expect((await bob.as.query(SIG.listPageSignatories, { networkId: root, pageId })).map((row) => ({ handle: row.handle, role: row.role, accepted: row.accepted }))).toEqual([
      { handle: "alice", role: "admin", accepted: true },
      { handle: "bob", role: "signatory", accepted: true },
    ])
    await alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "carol", role: "admin" })
    expect(await carol.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: false })).toEqual({ role: null })
    expect(await carol.as.query(SIG.myPageInvitations, { networkId: root })).toEqual([])
    expect(await codeOf(carol.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: true }))).toBe("notFound")
  })

  it("seul un administrateur habilite ou retire ; chaque décision est tracée — se retirer soi-même ne l'est pas", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    const bob = await enter(t, root, "bob")
    const carol = await enter(t, root, "carol")
    await alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "bob", role: "signatory" })
    await bob.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: true })
    expect(await codeOf(bob.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "carol", role: "signatory" }))).toBe("pageRoleRequired")
    expect(await codeOf(alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "alice", role: "signatory" }))).toBe("invalidArgument")
    expect(await codeOf(alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "personne", role: "signatory" }))).toBe("notFound")
    await alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "carol", role: "signatory" })
    await alice.as.mutation(SIG.revokePageRole, { networkId: root, pageId, personId: carol.personId })
    expect(await bob.as.mutation(SIG.revokePageRole, { networkId: root, pageId, personId: bob.personId })).toEqual({ revoked: true })
    expect((await journal(t, "pages", pageId)).map((row) => row.action)).toEqual(["page.signatory_grant", "page.signatory_grant", "page.signatory_revoke"])
    expect((await journal(t, "pages", pageId))[0]).toMatchObject({ capacity: "page_admin", actorPersonId: alice.personId })
  })

  it("le dernier administrateur vivant ne part ni ne se rétrograde ; avec un second, il le peut", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    const bob = await enter(t, root, "bob")
    expect(await ruleOf(alice.as.mutation(SIG.revokePageRole, { networkId: root, pageId, personId: alice.personId }))).toBe("PAGE_LAST_ADMIN")
    await alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "bob", role: "admin" })
    // Une invitation en attente n'est pas un administrateur vivant.
    expect(await ruleOf(alice.as.mutation(SIG.revokePageRole, { networkId: root, pageId, personId: alice.personId }))).toBe("PAGE_LAST_ADMIN")
    await bob.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: true })
    expect(await bob.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "alice", role: "signatory" })).toMatchObject({ role: "signatory" })
    expect(await ruleOf(bob.as.mutation(SIG.revokePageRole, { networkId: root, pageId, personId: bob.personId }))).toBe("PAGE_LAST_ADMIN")
  })

  it("une page compte au plus cinquante signataires, invitations comprises", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    await enter(t, root, "derniere")
    await t.run(async (ctx) => {
      for (let index = 1; index < PAGE_SIGNATORIES_MAX; index += 1) {
        const personId = await ctx.db.insert("persons", { authUserId: `auth-silencieux-${index}`, createdAt: 1, updatedAt: 1 })
        await ctx.db.insert("pageSignatories", { networkId: root, pageId, personId, role: "signatory", createdAt: 1, updatedAt: 1 })
      }
    })
    expect(await ruleOf(alice.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "derniere", role: "signatory" }))).toBe("PAGE_SIGNATORIES_FULL")
  })

  it("signer pour une page OFFICIELLE exige une identité forte — à l'habilitation, à l'acceptation, et à chaque acte", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const operator = await enter(t, root, "operatrice")
    const agent = await enter(t, root, "agent")
    const other = await enter(t, root, "autre")
    await makeOperator(t, operator)
    const { pageId } = await operator.as.mutation(ADMIN.createInstitutionPage, { networkId: root, name: "Ministère des Affaires étrangères", reason: "Création de la page du ministère." })
    expect(await ruleOf(operator.as.mutation(ADMIN.grantPageAdmin, { pageId, personId: agent.personId, reason: "Habilitation du chargé de communication." }))).toBe("PAGE_SIGNATORY_IDENTITY_REQUIRED")
    const link = await strongIdentity(t, agent)
    expect(await operator.as.mutation(ADMIN.grantPageAdmin, { pageId, personId: agent.personId, reason: "Habilitation du chargé de communication." })).toEqual({ invited: true })
    await agent.as.mutation(SIG.respondToPageInvitation, { networkId: root, pageId, accept: true })
    expect((await agent.as.mutation(P.publishAsPage, { networkId: root, pageId, body: "Communiqué du ministère" })).created).toBe(true)
    expect(await ruleOf(agent.as.mutation(SIG.grantPageRole, { networkId: root, pageId, handle: "autre", role: "signatory" }))).toBe("PAGE_SIGNATORY_IDENTITY_REQUIRED")
    expect(other.personId).toBeDefined()
    // Le lien IDN révoqué referme la signature.
    await t.run(async (ctx) => await ctx.db.patch(link, { revokedAt: 2 }))
    expect(await codeOf(agent.as.mutation(P.publishAsPage, { networkId: root, pageId, body: "Encore ?" }))).toBe("pageRoleRequired")
    expect((await journal(t, "pages", pageId)).map((row) => row.action)).toEqual(["page.create_official", "page.signatory_grant"])
  })
})

describe("la console des pages", () => {
  it("pose la confiance — « Officiel » à une institution seulement — et ne trace que ce qui change", async () => {
    const t = testConvex()
    const { root, pageId, handle } = await alicePage(t)
    const operator = await enter(t, root, "operatrice")
    await makeOperator(t, operator)
    expect(await ruleOf(operator.as.mutation(ADMIN.setPageTrust, { pageId, trust: "official", reason: "Promotion par erreur." }))).toBe("PAGE_TRUST_NOT_ALLOWED")
    expect(await operator.as.mutation(ADMIN.setPageTrust, { pageId, trust: "verified", reason: "Pièces vérifiées hors ligne." })).toEqual({ changed: true })
    expect(await operator.as.mutation(ADMIN.setPageTrust, { pageId, trust: "verified", reason: "Pièces vérifiées hors ligne." })).toEqual({ changed: false })
    expect((await operator.as.query(P.getPage, { networkId: root, handle }))?.badge).toBe("verified")
    expect(await journal(t, "pages", pageId)).toMatchObject([{ action: "page.trust_set", details: { previousTrust: "community", trust: "verified" } }])
  })

  it("change l'adresse d'une page — l'ancienne dans l'historique, refusée si prise, motif exigé", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    const operator = await enter(t, root, "operatrice")
    await makeOperator(t, operator)
    await alice.as.mutation(P.createPage, { networkId: root, name: "Deuxieme page", ownerKind: "community" })
    expect(await ruleOf(operator.as.mutation(ADMIN.setPageHandle, { pageId, handle: "agl", reason: "court" }))).toBe("DECISION_REASON_LENGTH")
    expect(await codeOf(operator.as.mutation(ADMIN.setPageHandle, { pageId, handle: "deuxieme-page", reason: "Adresse demandée par l'association." }))).toBe("handleUnavailable")
    expect(await operator.as.mutation(ADMIN.setPageHandle, { pageId, handle: "agl-lyon", reason: "Adresse demandée par l'association." })).toEqual({ handle: "agl-lyon" })
    expect(await alice.as.query(P.getPage, { networkId: root, handle: "association-des-gabonais" })).toBeNull()
    expect(await alice.as.query(P.getPage, { networkId: root, handle: "agl-lyon" })).not.toBeNull()
    const history = await t.run(async (ctx) => await ctx.db.query("pageIdentityHistory").withIndex("by_page_at", (q) => q.eq("pageId", pageId)).take(5))
    expect(history).toMatchObject([{ previous: { handle: "association-des-gabonais" }, actorPersonId: operator.personId }])
  })

  it("liste les pages d'un réseau à l'opérateur seul, état réel compris", async () => {
    const t = testConvex()
    const { root, alice, pageId } = await alicePage(t)
    const operator = await enter(t, root, "operatrice")
    await makeOperator(t, operator)
    expect(await codeOf(alice.as.query(ADMIN.paginatePages, { networkId: root, paginationOpts: { numItems: 10, cursor: null } }))).toBe("operatorRequired")
    await operator.as.mutation(ADMIN.setPageStatus, { pageId, status: "inactive", reason: "Retrait demandé par l'association." })
    expect((await operator.as.query(ADMIN.paginatePages, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([])
    expect((await operator.as.query(ADMIN.paginatePages, { networkId: root, status: "inactive", paginationOpts: { numItems: 10, cursor: null } })).page).toMatchObject([
      { pageId, status: "inactive", trust: "community" },
    ])
  })
})

describe("le groupe d'adhérents d'une page d'association (EXF-DG-26)", () => {
  it("seul un administrateur vivant de la page le crée ; la fiche porte la page ; la découverte rend les groupes d'une page", async () => {
    const t = testConvex()
    const { root, alice, pageId, handle } = await alicePage(t)
    const bob = await enter(t, root, "bob")
    expect(await codeOf(bob.as.mutation(GROUPS.create, { networkId: root, name: "Adhérents", associationPageId: pageId, idempotencyKey: "g-1" }))).toBe("pageRoleRequired")
    const { groupId } = await alice.as.mutation(GROUPS.create, { networkId: root, name: "Adhérents", associationPageId: pageId, idempotencyKey: "g-2" })
    await alice.as.mutation(GROUPS.create, { networkId: root, name: "Autre groupe", idempotencyKey: "g-3" })
    expect((await bob.as.query(GROUPS.getGroup, { networkId: root, groupId })).associationPage).toMatchObject({ pageId, handle })
    expect((await bob.as.query(GROUPS.discover, { networkId: root, associationPageId: pageId })).map((card) => card.groupId)).toEqual([groupId])
  })
})
