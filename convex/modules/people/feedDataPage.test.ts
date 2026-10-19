// @vitest-environment edge-runtime
/** PA10 : pagination d'effacement indexée sur les vraies tables, sans session ni API publique. */
import { describe, expect, it } from "vitest"

import type { Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { testConvex } from "../../test.setup"
import { anonymizeReferences, directlyOwned, exportableRecord, shapeFor, type DataRecord } from "./dataInventory"
import { feedErasurePage, isFeedDataTable } from "./feedDataPage"

type FeedInput = Parameters<typeof feedErasurePage>[1]
type FeedRow = Awaited<ReturnType<typeof feedErasurePage>>["page"][number]
type IndexRead = { table: string; index: string }
const NOW = Date.UTC(2026, 9, 18, 12)

/**
 * La base reste celle de convex-test. Seul son initialiseur de requête est
 * gardé : une régression vers paginate/take/filter sans index fait échouer
 * le scénario, même si les quelques lignes de fixture donneraient le bon résultat.
 */
function requireIndexedQueries(db: MutationCtx["db"], reads: IndexRead[]): MutationCtx["db"] {
  return new Proxy(db, {
    get(target, key, receiver) {
      const method: unknown = Reflect.get(target, key, receiver)
      if (key !== "query") return typeof method === "function" ? method.bind(target) : method
      if (typeof method !== "function") throw new Error("Porte de requête absente")
      return (table: string) => {
        const initial: unknown = Reflect.apply(method, target, [table])
        if (!initial || typeof initial !== "object") throw new Error("Initialiseur de requête absent")
        return new Proxy(initial, {
          get(builder, step, builderReceiver) {
            const operation: unknown = Reflect.get(builder, step, builderReceiver)
            if (step !== "withIndex") {
              if (typeof operation === "function") return () => { throw new Error(`Balayage global interdit : ${table}`) }
              return operation
            }
            return (index: string, ...args: unknown[]) => {
              if (typeof operation !== "function") throw new Error("Porte d'index absente")
              reads.push({ table, index })
              return Reflect.apply(operation, builder, [index, ...args])
            }
          },
        })
      }
    },
  })
}

async function fixture() {
  const t = testConvex({ automaticSessions: false })
  const ids = await t.run(async ctx => {
    const root = await ctx.db.insert("networks", { slug: "feed-data-root", name: "Racine de recette", kind: "root", status: "active", membershipPolicy: "open", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: NOW, updatedAt: NOW })
    const closed = await ctx.db.insert("networks", { slug: "feed-data-closed", name: "Réseau de recette", kind: "closed", parentId: root, status: "active", membershipPolicy: "open", defaultVisibility: "network", reachValues: [], theme: "antsia", createdAt: NOW, updatedAt: NOW })
    const owner = await ctx.db.insert("persons", { authUserId: "feed-data-owner", createdAt: NOW, updatedAt: NOW })
    const other = await ctx.db.insert("persons", { authUserId: "feed-data-other", createdAt: NOW, updatedAt: NOW })
    const third = await ctx.db.insert("persons", { authUserId: "feed-data-third", createdAt: NOW, updatedAt: NOW })
    const anonymous = await ctx.db.insert("persons", { authUserId: "feed-data-anonymous", erasedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const firstPost = await ctx.db.insert("posts", { networkId: root, authorPersonId: owner, body: "Première source", audience: "public", visibility: "network", onRoot: true, status: "published", searchText: "premiere source", publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const secondPost = await ctx.db.insert("posts", { networkId: closed, authorPersonId: owner, body: "Deuxième source", audience: "public", visibility: "network", onRoot: false, status: "published", searchText: "deuxieme source", publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const foreignPost = await ctx.db.insert("posts", { networkId: root, authorPersonId: other, body: "Source étrangère", audience: "public", visibility: "network", onRoot: true, status: "published", searchText: "source etrangere", publishedAt: NOW, createdAt: NOW, updatedAt: NOW })
    const job = { phase: "erase" as const, requestedAt: NOW, dueAt: NOW, updatedAt: NOW, tableIndex: 0, cursor: null, changed: false, passes: 0, erasedRows: 0, identitySubjects: [], contacts: [] }
    const jobId = await ctx.db.insert("dataErasureJobs", { ...job, personId: owner, authUserId: "feed-data-owner" })
    const otherJobId = await ctx.db.insert("dataErasureJobs", { ...job, personId: other, authUserId: "feed-data-other" })
    return { root, closed, owner, other, third, anonymous, firstPost, secondPost, foreignPost, jobId, otherJobId }
  })
  return { t, ...ids }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

async function read(f: Fixture, table: FeedInput["table"], cursor: string | null = null, numItems = 2) {
  return await f.t.run(async ctx => {
    const indexes: IndexRead[] = []
    const result = await feedErasurePage({ db: requireIndexedQueries(ctx.db, indexes) }, { table, personId: f.owner, jobId: f.jobId, cursor, numItems, maximumBytesRead: 256 * 1024 })
    return { result, indexes }
  })
}

async function entry(f: Fixture, personId: Id<"persons">, postId: Id<"posts">) {
  return await f.t.run(async ctx => {
    const post = await ctx.db.get(postId)
    if (!post) throw new Error("Source de fixture absente")
    return await ctx.db.insert("feedEntries", { networkId: post.networkId, personId, scope: "pour_vous", postId, publishedAt: post.publishedAt, postCreationTime: post._creationTime, expiresAt: NOW + 86_400_000, createdAt: NOW })
  })
}

async function cursor(f: Fixture, personId: Id<"persons">, networkId: Id<"networks">, activePersonId?: Id<"persons">) {
  return await f.t.run(async ctx => ctx.db.insert("feedCursors", {
    networkId, personId, scope: "pour_vous", accessVersion: "fixture-private-access-version", generation: 1, status: "building", phase: "follows", step: 3, sourceDone: false,
    sourceCursor: "progression-source-privee", postCursor: "progression-post-privee", ...(activePersonId === undefined ? {} : { activePersonId }),
    windowStart: NOW - 86_400_000, cutoff: NOW, startedAt: NOW, updatedAt: NOW,
  }))
}

async function fanout(f: Fixture, postId: Id<"posts">) {
  return await f.t.run(async ctx => {
    const post = await ctx.db.get(postId)
    if (!post) throw new Error("Source de fixture absente")
    return await ctx.db.insert("feedFanoutJobs", { networkId: post.networkId, postId, generation: 1, status: "pending", phase: "self", step: 0, cursor: null, startedAt: NOW, updatedAt: NOW, expiresAt: NOW + 86_400_000 })
  })
}

async function markParents(f: Fixture, postIds: Id<"posts">[]) {
  await f.t.run(async ctx => {
    // Ordre d'insertion inverse de l'index : la progression doit suivre targetId.
    for (const postId of [...postIds].sort().reverse()) await ctx.db.insert("dataErasureTargets", { jobId: f.jobId, table: "posts", targetId: postId })
    await ctx.db.insert("dataErasureTargets", { jobId: f.otherJobId, table: "posts", targetId: f.foreignPost })
    await ctx.db.insert("dataErasureTargets", { jobId: f.jobId, table: "postComments", targetId: f.foreignPost })
  })
}

const dataRecord = (row: FeedRow): DataRecord => row as unknown as DataRecord

describe("PA10 — pagination personnelle des données de fil", () => {
  it("ne reconnaît que les trois tables de fil", () => {
    expect(["feedEntries", "feedCursors", "feedFanoutJobs"].every(isFeedDataTable)).toBe(true)
    expect(isFeedDataTable("posts")).toBe(false)
    expect(isFeedDataTable("persons")).toBe(false)
  })

  it("page les entrées possédées par by_person, sur plusieurs réseaux, sans destinataire étranger", async () => {
    const f = await fixture()
    await entry(f, f.other, f.firstPost)
    const own = [await entry(f, f.owner, f.firstPost), await entry(f, f.owner, f.secondPost), await entry(f, f.owner, f.foreignPost)]
    await entry(f, f.third, f.foreignPost)
    const first = await read(f, "feedEntries")
    expect(first.indexes).toEqual([{ table: "feedEntries", index: "by_person" }])
    expect(first.result.page.map(row => row._id)).toEqual(own.slice(0, 2))
    expect(first.result.isDone).toBe(false)
    const second = await read(f, "feedEntries", first.result.continueCursor)
    expect(second.indexes).toEqual([{ table: "feedEntries", index: "by_person" }])
    expect(second.result.page.map(row => row._id)).toEqual(own.slice(2))
    expect(second.result.isDone).toBe(false)
    const done = await read(f, "feedEntries", second.result.continueCursor)
    expect(done.indexes).toEqual([{ table: "dataErasureTargets", index: "by_job_table_target" }])
    expect(done.result).toMatchObject({ page: [], isDone: true })
  })

  it("reprend plusieurs pages du même parent, puis le parent suivant par by_post, même après suppression des posts", async () => {
    const f = await fixture(), ordered = [f.firstPost, f.secondPost].sort(), firstParent = ordered[0], secondParent = ordered[1]
    if (!firstParent || !secondParent) throw new Error("Parents de fixture absents")
    await markParents(f, ordered)
    const readers = await f.t.run(async ctx => {
      const ids = [f.other, f.third]
      for (let index = 0; index < 3; index++) ids.push(await ctx.db.insert("persons", { authUserId: `feed-data-reader-${index}`, createdAt: NOW, updatedAt: NOW }))
      return ids
    })
    const firstRows: Id<"feedEntries">[] = []
    for (const reader of readers) firstRows.push(await entry(f, reader, firstParent))
    const nextRow = await entry(f, f.other, secondParent)
    await entry(f, f.third, f.foreignPost)
    await f.t.run(async ctx => { await ctx.db.delete(firstParent); await ctx.db.delete(secondParent) })
    const owned = await read(f, "feedEntries")
    expect(owned.result.page).toEqual([])
    let progress = owned.result.continueCursor
    for (const expected of [firstRows.slice(0, 2), firstRows.slice(2, 4), firstRows.slice(4), [nextRow]]) {
      const page = await read(f, "feedEntries", progress)
      expect(page.indexes).toEqual([{ table: "dataErasureTargets", index: "by_job_table_target" }, { table: "feedEntries", index: "by_post" }])
      expect(page.result.page.map(row => row._id)).toEqual(expected)
      expect(page.result.isDone).toBe(false)
      progress = page.result.continueCursor
    }
    const done = await read(f, "feedEntries", progress)
    expect(done.result).toMatchObject({ page: [], isDone: true })
    expect(done.indexes).toEqual([{ table: "dataErasureTargets", index: "by_job_table_target" }])
  })

  it("les travaux de diffusion suivent uniquement les posts marqués de CE travail, sans phase de propriété personnelle", async () => {
    const f = await fixture(), ordered = [f.firstPost, f.secondPost].sort(), firstParent = ordered[0], secondParent = ordered[1]
    if (!firstParent || !secondParent) throw new Error("Parents de fixture absents")
    await markParents(f, ordered)
    const expected = [await fanout(f, firstParent), await fanout(f, secondParent)]
    await fanout(f, f.foreignPost)
    let progress: string | null = null
    for (const id of expected) {
      const page = await read(f, "feedFanoutJobs", progress)
      expect(page.indexes).toEqual([{ table: "dataErasureTargets", index: "by_job_table_target" }, { table: "feedFanoutJobs", index: "by_post" }])
      expect(page.result.page.map(row => row._id)).toEqual([id])
      expect(directlyOwned("feedFanoutJobs", dataRecord(page.result.page[0]!), f.owner)).toBe(false)
      progress = page.result.continueCursor
    }
    expect((await read(f, "feedFanoutJobs", progress)).result).toMatchObject({ page: [], isDone: true })
  })

  it("retourne les curseurs étrangers qui référencent activePersonId pour anonymisation, sans en donner la propriété", async () => {
    const f = await fixture()
    const ownCursor = await cursor(f, f.owner, f.root, f.other)
    const referenced = [await cursor(f, f.other, f.root, f.owner), await cursor(f, f.other, f.closed, f.owner), await cursor(f, f.third, f.root, f.owner)]
    await cursor(f, f.third, f.closed, f.other)
    const own = await read(f, "feedCursors")
    expect(own.indexes).toEqual([{ table: "feedCursors", index: "by_person" }])
    expect(own.result.page.map(row => row._id)).toEqual([ownCursor])
    expect(directlyOwned("feedCursors", dataRecord(own.result.page[0]!), f.owner)).toBe(true)
    let progress = own.result.continueCursor
    const rows: FeedRow[] = []
    let done = false
    for (let pass = 0; pass < 3; pass++) {
      const page = await read(f, "feedCursors", progress)
      expect(page.indexes).toEqual([{ table: "feedCursors", index: "by_active_person" }])
      rows.push(...page.result.page)
      if (page.result.isDone) { done = true; break }
      progress = page.result.continueCursor
    }
    expect(done).toBe(true)
    expect(rows.map(row => row._id)).toEqual(referenced)
    for (const row of rows) {
      const record = dataRecord(row)
      expect(directlyOwned("feedCursors", record, f.owner)).toBe(false)
      expect(exportableRecord("feedCursors", record, f.owner)).toBeNull()
      const anonymized = anonymizeReferences(record, shapeFor("feedCursors"), f.owner, f.anonymous) as Record<string, unknown>
      expect(anonymized.personId).toBe(record.personId)
      expect(anonymized).not.toHaveProperty("activePersonId")
      expect(anonymized.sourceCursor).toBe(record.sourceCursor)
    }
  })

  it("l'export du propriétaire ne contient aucune référence étrangère ni progression technique", async () => {
    const f = await fixture(), ownCursor = await cursor(f, f.owner, f.root, f.other)
    const entryId = await entry(f, f.owner, f.foreignPost), fanoutId = await fanout(f, f.firstPost)
    await f.t.run(async ctx => {
      const row = await ctx.db.get(ownCursor), entryRow = await ctx.db.get(entryId), fanoutRow = await ctx.db.get(fanoutId)
      if (!row || !entryRow || !fanoutRow) throw new Error("Données de fixture absentes")
      const projected = exportableRecord("feedCursors", dataRecord(row), f.owner)
      expect(projected).toMatchObject({ _id: row._id, networkId: f.root, personId: f.owner, scope: "pour_vous", status: "building", windowStart: row.windowStart, startedAt: row.startedAt })
      for (const field of ["activePersonId", "activePageId", "sourceCursor", "postCursor", "phase", "generation", "cutoff"]) expect(projected).not.toHaveProperty(field)
      expect(JSON.stringify(projected)).not.toContain(f.other)
      expect(exportableRecord("feedCursors", dataRecord(row), f.other)).toBeNull()
      expect(exportableRecord("feedEntries", dataRecord(entryRow), f.owner)).toBeNull()
      expect(exportableRecord("feedFanoutJobs", dataRecord(fanoutRow), f.owner)).toBeNull()
    })
  })

  it.each(["pas-du-json", "{}", JSON.stringify({ stage: "inconnu", rowCursor: null, lastParent: null }), JSON.stringify({ stage: "parents", rowCursor: null, lastParent: null })])("refuse le curseur de progression invalide %s", async value => {
    const f = await fixture()
    await expect(read(f, "feedCursors", value)).rejects.toThrow()
  })
})
