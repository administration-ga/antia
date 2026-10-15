// @vitest-environment edge-runtime
/**
 * Revendications de page (EXF-AN-17) — tests neufs : le socle n'avait pas de
 * revendication. Le patron d'audit des décisions de modération est repris
 * (`moderation.report_decide` → `page.claim_decide`).
 */
import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { as: ReturnType<T["withIdentity"]>; personId: Id<"persons">; handle: string }

const P = api.modules.pages.pages
const C = api.modules.pages.claims
const ADMIN = api.modules.pages.admin

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 9, 15, 11, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function seed(t: T) {
  return await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
}

async function enter(t: T, rootId: Id<"networks">, handle: string, role: "member" | "network_moderator" = "member"): Promise<Person> {
  vi.setSystemTime(Date.now() + 1000)
  const as = t.withIdentity({ subject: `auth-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: rootId })
  if (role !== "member") {
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", rootId).eq("personId", personId))
        .unique()
      await ctx.db.patch(membership!._id, { role })
    })
  }
  return { as, personId, handle }
}

async function makeOperator(t: T, person: Person): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("operators", { personId: person.personId, role: "platform_operator", grantedAt: 1 })
  })
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

/** Un dépôt RÉEL du harnais, avec son type (le patch système le pose). */
async function storeBlob(t: T, contentType: string): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(64)], { type: contentType }))
    await (ctx.db as unknown as { patch: (table: "_storage", id: Id<"_storage">, value: { contentType: string }) => Promise<void> }).patch("_storage", storageId, { contentType })
    return storageId
  })
}

/** Une association IMPORTÉE, non revendiquée (aucun signataire), dans la racine. */
async function unclaimedAssociation(t: T, rootId: Id<"networks">): Promise<{ pageId: Id<"pages">; handle: string }> {
  const pageId = await t.run(
    async (ctx) =>
      await ctx.db.insert("pages", {
        networkId: rootId,
        handle: "association-de-lyon",
        name: "Association de Lyon",
        ownerKind: "association",
        trust: "community",
        trustRank: 0,
        visibility: "network",
        onRoot: true,
        status: "active",
        importRef: "asso-lyon",
        searchText: "Association de Lyon association-de-lyon",
        createdAt: 1,
        updatedAt: 1,
      }),
  )
  return { pageId, handle: "association-de-lyon" }
}

async function claim(t: T, person: Person, networkId: Id<"networks">, pageId: Id<"pages">, documents = 1) {
  const evidence = []
  for (let index = 0; index < documents; index += 1) evidence.push({ storageId: await storeBlob(t, "application/pdf"), mimeType: "application/pdf" })
  return await person.as.mutation(C.requestPageClaim, { networkId, pageId, note: "Je préside l'association.", evidence })
}

describe("revendiquer une page", () => {
  it("une page non revendiquée se revendique avec ses pièces ; une seule demande en attente ; la file est celle de la modération", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const presidente = await enter(t, root, "presidente")
    const moderator = await enter(t, root, "moderatrice", "network_moderator")
    const { pageId } = await unclaimedAssociation(t, root)
    const { claimId } = await claim(t, presidente, root, pageId, 2)
    expect(await ruleOf(claim(t, presidente, root, pageId))).toBe("PAGE_CLAIM_PENDING")
    expect(await codeOf(presidente.as.query(C.paginatePageClaims, { networkId: root, paginationOpts: { numItems: 10, cursor: null } }))).toBe("notFound")
    const queue = await moderator.as.query(C.paginatePageClaims, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })
    expect(queue.page).toMatchObject([{ claimId, status: "pending", evidenceCount: 2, note: "Je préside l'association.", claimant: { handle: "presidente" }, page: { pageId } }])
    // Les pièces : servies par la garde, retenues tant que l'analyse n'a pas parlé.
    const detail = await moderator.as.query(C.getPageClaim, { networkId: root, claimId })
    expect(detail.evidence).toEqual([
      { url: null, withheld: "fileScanPending" },
      { url: null, withheld: "fileScanPending" },
    ])
    expect((await presidente.as.query(C.paginateMyPageClaims, { networkId: root, paginationOpts: { numItems: 10, cursor: null } })).page.map((row) => row.claimId)).toEqual([claimId])
  })

  it("une page officielle ne se revendique pas ; une page tenue, par l'un de ses administrateurs seulement ; une vérifiée, jamais", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const alice = await enter(t, root, "alice")
    const bob = await enter(t, root, "bob")
    const operator = await enter(t, root, "operatrice")
    await makeOperator(t, operator)
    const official = await operator.as.mutation(ADMIN.createInstitutionPage, { networkId: root, name: "Consulat de Lyon", reason: "Import du poste consulaire." })
    expect(await ruleOf(claim(t, bob, root, official.pageId))).toBe("PAGE_NOT_CLAIMABLE")
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", alice.personId))
        .unique()
      await ctx.db.patch(membership!._id, { status: "verifiee" })
    })
    const held = await alice.as.mutation(P.createPage, { networkId: root, name: "Entreprise Alice", ownerKind: "company" })
    expect(await ruleOf(claim(t, bob, root, held.pageId))).toBe("PAGE_ALREADY_CLAIMED")
    expect((await claim(t, alice, root, held.pageId)).claimId).toBeDefined()
    await operator.as.mutation(ADMIN.setPageTrust, { pageId: held.pageId, trust: "verified", reason: "Registre du commerce vérifié." })
    expect(await ruleOf(claim(t, bob, root, held.pageId))).toBe("PAGE_ALREADY_VERIFIED")
  })

  it("les pièces : une à cinq, dépôts NEUFS du demandeur, d'un type admis", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const presidente = await enter(t, root, "presidente")
    const other = await enter(t, root, "autre")
    const { pageId } = await unclaimedAssociation(t, root)
    expect(await ruleOf(presidente.as.mutation(C.requestPageClaim, { networkId: root, pageId, evidence: [] }))).toBe("PAGE_CLAIM_EVIDENCE_COUNT")
    const executable = await storeBlob(t, "application/x-msdownload")
    expect(await ruleOf(presidente.as.mutation(C.requestPageClaim, { networkId: root, pageId, evidence: [{ storageId: executable, mimeType: "application/x-msdownload" }] }))).toBe(
      "UPLOAD_TYPE_NOT_ALLOWED",
    )
    // Une pièce déjà admise pour un autre dossier n'est plus « neuve ».
    const { claimId } = await claim(t, other, root, pageId)
    const used = await t.run(async (ctx) => (await ctx.db.get(claimId))!.evidenceStorageIds[0]!)
    expect(await codeOf(presidente.as.mutation(C.requestPageClaim, { networkId: root, pageId, evidence: [{ storageId: used, mimeType: "application/pdf" }] }))).toBe("notFound")
  })
})

describe("trancher une revendication", () => {
  it("validée : le demandeur devient administrateur, la page devient « Vérifié » ; la décision est motivée, tracée et définitive", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const presidente = await enter(t, root, "presidente")
    const moderator = await enter(t, root, "moderatrice", "network_moderator")
    const { pageId, handle } = await unclaimedAssociation(t, root)
    const { claimId } = await claim(t, presidente, root, pageId)
    expect(await codeOf(presidente.as.mutation(C.decidePageClaim, { networkId: root, claimId, decision: "approved", reason: "Je me valide." }))).toBe("notFound")
    expect(await ruleOf(moderator.as.mutation(C.decidePageClaim, { networkId: root, claimId, decision: "approved", reason: "ok" }))).toBe("DECISION_REASON_LENGTH")
    expect(await moderator.as.mutation(C.decidePageClaim, { networkId: root, claimId, decision: "approved", reason: "Statuts et mandat conformes." })).toEqual({ status: "approved" })
    expect(await presidente.as.query(P.getPage, { networkId: root, handle })).toMatchObject({ badge: "verified", viewer: { role: "admin" } })
    expect(await codeOf(moderator.as.mutation(C.decidePageClaim, { networkId: root, claimId, decision: "rejected", reason: "Changement d'avis." }))).toBe("conflict")
    const journal = await t.run(async (ctx) => await ctx.db.query("engineAudit").withIndex("by_subject_at", (q) => q.eq("subjectTable", "pageClaims").eq("subjectId", claimId)).take(5))
    expect(journal).toMatchObject([
      { action: "page.claim_decide", capacity: "network_moderator", actorPersonId: moderator.personId, details: { decision: "approved", previousTrust: "community", trust: "verified" } },
    ])
    // Plus revendicable : elle est vérifiée.
    const other = await enter(t, root, "autre")
    expect(await ruleOf(claim(t, other, root, pageId))).toBe("PAGE_ALREADY_VERIFIED")
  })

  it("rejetée : la page reste telle quelle ; la fiche se lit par la modération et le demandeur, personne d'autre", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const presidente = await enter(t, root, "presidente")
    const moderator = await enter(t, root, "moderatrice", "network_moderator")
    const curious = await enter(t, root, "curieux")
    const { pageId, handle } = await unclaimedAssociation(t, root)
    const { claimId } = await claim(t, presidente, root, pageId)
    expect(await codeOf(curious.as.query(C.getPageClaim, { networkId: root, claimId }))).toBe("notFound")
    await moderator.as.mutation(C.decidePageClaim, { networkId: root, claimId, decision: "rejected", reason: "Le mandat présenté est échu." })
    expect(await presidente.as.query(C.getPageClaim, { networkId: root, claimId })).toMatchObject({ status: "rejected", decisionReason: "Le mandat présenté est échu." })
    expect(await curious.as.query(P.getPage, { networkId: root, handle })).toMatchObject({ badge: "community", viewer: { role: null } })
  })

  it("retirer sa demande en attente purge ses pièces ; une demande tranchée ne se retire plus", async () => {
    const t = testConvex()
    const { root } = await seed(t)
    const presidente = await enter(t, root, "presidente")
    const { pageId } = await unclaimedAssociation(t, root)
    const { claimId } = await claim(t, presidente, root, pageId, 2)
    const documents = await t.run(async (ctx) => (await ctx.db.get(claimId))!.evidenceStorageIds)
    expect(await presidente.as.mutation(C.withdrawPageClaim, { networkId: root, claimId })).toEqual({ withdrawn: true })
    expect(await presidente.as.mutation(C.withdrawPageClaim, { networkId: root, claimId })).toEqual({ withdrawn: false })
    const left = await t.run(async (ctx) => {
      const blobs = await Promise.all(documents.map(async (id) => await ctx.db.system.get("_storage", id)))
      const scans = await Promise.all(documents.map(async (id) => await ctx.db.query("fileScans").withIndex("by_storageId", (q) => q.eq("storageId", id)).first()))
      return { blobs: blobs.filter((row) => row !== null).length, scans: scans.filter((row) => row !== null).length, kept: (await ctx.db.get(claimId))!.evidenceStorageIds.length }
    })
    expect(left).toEqual({ blobs: 0, scans: 0, kept: 0 })
  })
})
