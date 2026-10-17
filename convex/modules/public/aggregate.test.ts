// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest"

import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

type T = ReturnType<typeof testConvex>

afterEach(() => vi.useRealTimers())

async function fixture() {
  vi.useFakeTimers()
  const t = testConvex()
  const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  return { t, root }
}

async function insertPerson(t: T, networkId: Id<"networks">, index: number) {
  const now = Date.now()
  return t.run(async (ctx) => {
    const personId = await ctx.db.insert("persons", { authUserId: `aggregate-fixture-${index}`, handle: `mesure${index}`, displayName: `Mesure ${index}`, publishedAt: now, createdAt: now, updatedAt: now })
    await ctx.db.insert("networkMemberships", { networkId, personId, status: "declaree", role: "member", joinedAt: now, statusChangedAt: now })
    return personId
  })
}

async function post(t: T, root: Id<"networks">, authorPersonId: Id<"persons">, tag: string, visibility: "root" | "network" = "root", publishedAt = Date.now()) {
  return t.run((ctx) => ctx.db.insert("posts", { networkId: root, authorPersonId, body: `Mesure #${tag}`, audience: "public", visibility, onRoot: true, status: "published", tags: [tag], searchText: `mesure ${tag}`, publishedAt, createdAt: publishedAt, updatedAt: publishedAt }))
}

async function job(t: T, root: Id<"networks">) {
  return t.run((ctx) => ctx.db.query("publicAggregateJobs").withIndex("by_network", (q) => q.eq("networkId", root)).unique())
}

async function complete(t: T, root: Id<"networks">) {
  for (let n = 0; n < 40; n++) {
    const current = await job(t, root)
    if (!current || current.stage === "done") return
    await t.mutation(internal.modules.public.aggregate.step, { networkId: root, generation: current.generation, stage: current.stage, cursor: current.cursor })
  }
  throw new Error("La génération ne s'est pas terminée dans le harnais borné")
}

describe("PA8 — mesures publiques datées et cohortes prudentes", () => {
  it("compte seulement le choix public et ne diffuse aucun petit groupe de tags", async () => {
    const f = await fixture()
    const people = []
    for (let n = 0; n < 5; n++) people.push(await insertPerson(f.t, f.root, n))
    for (const personId of people) await post(f.t, f.root, personId, "national")
    for (let n = 0; n < 5; n++) await post(f.t, f.root, people[0]!, "petit")
    await post(f.t, f.root, people[0]!, "cache", "network")
    await post(f.t, f.root, people[0]!, "futur", "root", Date.now() + 1000)
    await f.t.mutation(internal.modules.public.aggregate.refresh, {})
    await complete(f.t, f.root)
    const snapshot = await f.t.query(api.modules.public.projections.snapshot, { networkId: f.root })
    expect(snapshot.publishedPosts).toBe(10)
    expect(snapshot.trends).toEqual([{ tag: "national", posts: 5 }])
    expect(snapshot.generatedAt).not.toBe(null)
    expect(snapshot.periodStart! < snapshot.periodEnd!).toBe(true)
    const state = await job(f.t, f.root)
    for (const personId of people) expect(JSON.stringify(state)).not.toContain(personId)
  })

  it("un refresh concurrent, un replay et une ancienne génération ne recomptent rien", async () => {
    const f = await fixture()
    const author = await insertPerson(f.t, f.root, 1)
    for (let n = 0; n < 26; n++) await post(f.t, f.root, author, "borne", "root", Date.now() - n)
    await f.t.mutation(internal.modules.public.aggregate.refresh, {})
    const first = (await job(f.t, f.root))!
    const args = { networkId: f.root, generation: first.generation, stage: first.stage, cursor: first.cursor }
    await f.t.mutation(internal.modules.public.aggregate.refresh, {})
    expect((await job(f.t, f.root))?.generation).toBe(first.generation)
    await f.t.mutation(internal.modules.public.aggregate.step, args)
    const counted = await job(f.t, f.root)
    expect(counted?.publishedPosts).toBe(25)
    await f.t.mutation(internal.modules.public.aggregate.step, args)
    expect(await job(f.t, f.root)).toEqual(counted)
    await complete(f.t, f.root)
    expect((await f.t.query(api.modules.public.projections.snapshot, { networkId: f.root })).publishedPosts).toBe(26)
    await f.t.mutation(internal.modules.public.aggregate.refresh, {})
    expect((await job(f.t, f.root))?.generation).toBe(first.generation + 1)
    await f.t.mutation(internal.modules.public.aggregate.step, args)
    expect((await job(f.t, f.root))?.publishedPosts).toBe(0)
  })

  it("les refus relus et une origine archivée ne sont pas des mesures publiques", async () => {
    const f = await fixture()
    const author = await insertPerson(f.t, f.root, 1)
    const postId = await post(f.t, f.root, author, "modere")
    await f.t.run((ctx) => ctx.db.insert("moderationContentStates", { networkId: f.root, targetKind: "post", targetId: postId, ownerPersonId: author, status: "removed", createdAt: Date.now(), updatedAt: Date.now() }))
    await f.t.mutation(internal.modules.public.aggregate.refresh, {})
    await complete(f.t, f.root)
    expect((await f.t.query(api.modules.public.projections.snapshot, { networkId: f.root })).publishedPosts).toBe(0)
    await f.t.run((ctx) => ctx.db.patch(f.root, { status: "archived" }))
    const before = await job(f.t, f.root)
    await f.t.mutation(internal.modules.public.aggregate.step, { networkId: f.root, generation: before!.generation, stage: "posts", cursor: null })
    expect(await job(f.t, f.root)).toEqual(before)
  })
})
