// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest"
import { engineErrorCode } from "@antsia/social-contracts/errors"

import { api, internal } from "../../_generated/api"
import type { Doc, Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>
type Person = { personId: Id<"persons">; as: ReturnType<T["withIdentity"]> }
const LIST = api.modules.moderation.networkAppeals.paginate
const PAGE = { cursor: null, numItems: 20 }

async function member(t: T, root: Id<"networks">, handle: string, role: Doc<"networkMemberships">["role"]): Promise<Person> {
  const as = t.withIdentity({ subject: `network-appeals-${handle}` })
  const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
  await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
  await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
  await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
  await t.run(async (ctx) => {
    const row = await ctx.db.query("networkMemberships").withIndex("by_network_and_person", (q) => q.eq("networkId", root).eq("personId", personId)).unique()
    if (row) await ctx.db.patch(row._id, { role })
  })
  return { personId, as }
}

async function fixture() {
  const t = testConvex()
  const { root, testClosed: child } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const admin = await member(t, root, "admin.recours", "network_admin")
  const previous = await member(t, root, "ancien.recours", "network_admin")
  const defendant = await member(t, root, "defendeur.recours", "network_admin")
  return { t, root, child, admin, previous, defendant }
}

async function appealed(t: T, networkId: Id<"networks">, defendant: Person, previous: Person, extra: { appealLevel?: "network" | "platform"; reportNetworkId?: Id<"networks">; createdAt?: number } = {}) {
  const now = Date.now()
  return t.run(async (ctx) => {
    const postId = await ctx.db.insert("posts", { networkId: extra.reportNetworkId ?? networkId, authorPersonId: defendant.personId, body: "Corps privé à ne jamais copier", audience: "connections", visibility: "network", onRoot: false, status: "published", searchText: "corps prive", publishedAt: now, createdAt: now, updatedAt: now })
    const reportId = await ctx.db.insert("reports", { networkId: extra.reportNetworkId ?? networkId, target: { kind: "post", id: postId }, targetKind: "post", targetId: postId, ownerPersonId: defendant.personId, reporterPersonId: previous.personId, reason: "harassment", level: "team", status: "actioned", reviewedByPersonId: previous.personId, decisionReason: "Décision motivée de fixture", createdAt: now, updatedAt: now })
    const appealId = await ctx.db.insert("appeals", { networkId, reportId, personId: defendant.personId, reason: "Je demande un réexamen de la décision", level: extra.appealLevel ?? "network", status: "open", createdAt: extra.createdAt ?? now, updatedAt: now })
    return { postId, reportId, appealId }
  })
}

async function errorOf(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("PA8 — recours réseau réservés et indépendants", () => {
  it.each(["member", "network_moderator"] as const)("refuse la file au rôle %s", async (role) => {
    const f = await fixture()
    const actor = await member(f.t, f.root, `role.${role}`, role)
    expect(await errorOf(actor.as.query(LIST, { networkId: f.root, paginationOpts: PAGE }))).toBe("notFound")
    expect((await actor.as.query(api.modules.moderation.cases.myCapacity, { networkId: f.root })).canReviewAppeals).toBe(false)
  })

  it("sert un DTO fermé à l'administrateur distinct et réutilise la décision existante", async () => {
    const f = await fixture()
    const ids = await appealed(f.t, f.root, f.defendant, f.previous)
    await f.t.run((ctx) => ctx.db.insert("sanctions", { networkId: f.root, reportId: ids.reportId, personId: f.defendant.personId, target: { kind: "post", id: ids.postId }, kind: "warning", status: "active", reason: "Motif privé de sanction", createdAt: Date.now(), updatedAt: Date.now() }))
    const result = await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: PAGE })
    expect(result.page).toEqual([{ appealId: ids.appealId, reportId: ids.reportId, reason: "Je demande un réexamen de la décision", createdAt: expect.any(Number), decisionReason: "Décision motivée de fixture", sanctions: [{ kind: "warning", until: null }], canDecide: true }])
    for (const privateValue of [f.defendant.personId, f.previous.personId, ids.postId, "Corps privé à ne jamais copier", "Motif privé de sanction"]) expect(JSON.stringify(result)).not.toContain(privateValue)
    await f.admin.as.mutation(api.modules.moderation.cases.reviewNetworkAppeal, { networkId: f.root, appealId: ids.appealId, overturn: false, reason: "Décision confirmée après examen indépendant" })
    expect((await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: PAGE })).page).toEqual([])
  })

  it("indique l'incompatibilité au défendeur et à l'ancien décideur, et la mutation la refuse", async () => {
    const f = await fixture()
    const ids = await appealed(f.t, f.root, f.defendant, f.previous)
    for (const actor of [f.defendant, f.previous]) {
      expect((await actor.as.query(LIST, { networkId: f.root, paginationOpts: PAGE })).page[0]?.canDecide).toBe(false)
      expect(await errorOf(actor.as.mutation(api.modules.moderation.cases.reviewNetworkAppeal, { networkId: f.root, appealId: ids.appealId, overturn: true, reason: "Tentative de réexamen incompatible" }))).toBe("notFound")
    }
  })

  it("écarte recours plateforme, autre réseau et rapport incohérent dans son réseau", async () => {
    const f = await fixture()
    await appealed(f.t, f.root, f.defendant, f.previous, { appealLevel: "platform" })
    await appealed(f.t, f.child, f.defendant, f.previous)
    await appealed(f.t, f.root, f.defendant, f.previous, { reportNetworkId: f.child })
    expect((await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: PAGE })).page).toEqual([])
  })

  it("conserve le curseur d'une page brute vide après filtrage", async () => {
    const f = await fixture()
    const wanted = await appealed(f.t, f.root, f.defendant, f.previous, { createdAt: Date.now() - 1000 })
    await appealed(f.t, f.root, f.defendant, f.previous, { appealLevel: "platform", createdAt: Date.now() })
    const first = await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: { cursor: null, numItems: 1 } })
    expect(first.page).toEqual([])
    expect(first.isDone).toBe(false)
    const next = await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: { cursor: first.continueCursor, numItems: 1 } })
    expect(next.page.map((appeal) => appeal.appealId)).toEqual([wanted.appealId])
  })

  it("refuse un dossier de plus de cinq sanctions et les sanctions d'un autre réseau", async () => {
    const f = await fixture()
    const ids = await appealed(f.t, f.root, f.defendant, f.previous)
    const foreignSanction = await f.t.run((ctx) => ctx.db.insert("sanctions", { networkId: f.child, reportId: ids.reportId, personId: f.defendant.personId, target: { kind: "post", id: ids.postId }, kind: "warning", status: "active", reason: "Sanction de fixture", createdAt: Date.now(), updatedAt: Date.now() }))
    expect((await f.admin.as.query(LIST, { networkId: f.root, paginationOpts: PAGE })).page).toEqual([])
    await f.t.run(async (ctx) => {
      await ctx.db.patch(foreignSanction, { networkId: f.root })
      for (let n = 0; n < 5; n++) await ctx.db.insert("sanctions", { networkId: f.root, reportId: ids.reportId, personId: f.defendant.personId, target: { kind: "post", id: ids.postId }, kind: "warning", status: "active", reason: "Sanction de fixture", createdAt: Date.now(), updatedAt: Date.now() })
    })
    expect(await errorOf(f.admin.as.query(LIST, { networkId: f.root, paginationOpts: PAGE }))).toBe("policyRefused")
  })
})
