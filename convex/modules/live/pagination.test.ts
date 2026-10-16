// @vitest-environment edge-runtime
// Dupliqué de socle/convex/modules/direct/pagination.test.ts @ ad2e7fdc2 — adaptations : personnes et réseaux (graine des fondations, `enter`, `networkId` en argument : « Mes conférences » est celle d'UN réseau, index `by_network_host_status`) ; débit `live.create` (3 d'avance, 10 par heure) : l'amorçage espace ses créations de 6 min sur l'horloge simulée du harnais. Cas AJOUTÉ : la pagination d'un réseau ne rend jamais les conférences tenues dans un autre. Aucun cas retiré.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { testConvex } from "../../test.setup"
import { enter, joinAlso, type Person, seed, type T, T0, tick } from "./fixtures.setup"

const S = api.modules.live.sessions

/** Le seau `live.create` rend une création toutes les 6 min (10 par heure, 3 d'avance) : un amorçage espace les siennes. */
const CREATE_SPACING_MS = 6 * 60_000 + 1_000

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function host(): Promise<{ t: T; root: Id<"networks">; testClosed: Id<"networks">; alice: Person }> {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  return { t, root, testClosed, alice }
}

type MineStatus = "live" | "scheduled" | "ended"
type MineCursor = { status: MineStatus; cursor: string | null }

async function create(networkId: Id<"networks">, alice: Person, title: string): Promise<Id<"liveSessions">> {
  tick(CREATE_SPACING_MS)
  const { sessionId } = await alice.as.mutation(S.create, { networkId, title, audience: "public", chatMode: "open" })
  return sessionId
}

/**
 * Sème des sessions de l'hôte dans les trois statuts, dans l'ordre de
 * création `live` → `scheduled` → `ended`. Rend les identifiants créés.
 */
async function seedSessions(networkId: Id<"networks">, alice: Person, spec: { live?: number; scheduled?: number; ended?: number }): Promise<Id<"liveSessions">[]> {
  const created: Id<"liveSessions">[] = []
  const make = async (status: MineStatus, index: number) => {
    const sessionId = await create(networkId, alice, `${status} ${index}`)
    if (status === "live") {
      await alice.as.mutation(S.goLive, { networkId, sessionId })
    } else if (status === "ended") {
      await alice.as.mutation(S.end, { networkId, sessionId })
    }
    created.push(sessionId)
  }
  for (let i = 0; i < (spec.live ?? 0); i += 1) await make("live", i)
  for (let i = 0; i < (spec.scheduled ?? 0); i += 1) await make("scheduled", i)
  for (let i = 0; i < (spec.ended ?? 0); i += 1) await make("ended", i)
  return created
}

/** Parcourt `listMinePage` jusqu'au bout et rend ce qui a été vu, par page. */
async function paginateAll(
  networkId: Id<"networks">,
  alice: Person,
  limit: number,
  initialCursor?: MineCursor,
): Promise<{ pages: { sessionId: Id<"liveSessions">; status: MineStatus }[][]; seen: Id<"liveSessions">[] }> {
  const pages: { sessionId: Id<"liveSessions">; status: MineStatus }[][] = []
  let cursor: MineCursor | undefined = initialCursor
  for (let pageNumber = 0; pageNumber < 40; pageNumber += 1) {
    const page = await alice.as.query(S.listMinePage, { networkId, ...(cursor !== undefined ? { cursor } : {}), limit })
    pages.push(page.items.map((item) => ({ sessionId: item.sessionId, status: item.status })))
    if (page.nextCursor === null) break
    cursor = page.nextCursor
  }
  return { pages, seen: pages.flat().map((item) => item.sessionId) }
}

const expectExhaustive = (seen: Id<"liveSessions">[], expected: Id<"liveSessions">[]) => {
  expect(new Set(seen).size).toBe(seen.length)
  expect(new Set(seen)).toEqual(new Set(expected))
}

/**
 * Les cas ci-dessous ont TOUS un statut vide sur le chemin : c'est le cas
 * nominal (aucun direct `live` au moment de la lecture). Une exécution Convex
 * ne porte qu'une `.paginate()` ; le harnais l'impose comme le moteur déployé
 * (`MultiplePaginatedDatabaseQueries`).
 */
describe("pagination de l'activité Direct — statuts vides ou partiels", () => {
  it("rend une page vide et close pour un hôte sans aucune session", async () => {
    const { root, alice } = await host()
    await expect(alice.as.query(S.listMinePage, { networkId: root, limit: 8 })).resolves.toEqual({ items: [], nextCursor: null })
  })

  it("retrouve des sessions seulement terminées", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { ended: 3 })
    const { seen, pages } = await paginateAll(root, alice, 2)
    expectExhaustive(seen, expected)
    expect(pages.flat().every((item) => item.status === "ended")).toBe(true)
  })

  it("retrouve des sessions seulement programmées", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { scheduled: 3 })
    const { seen, pages } = await paginateAll(root, alice, 2)
    expectExhaustive(seen, expected)
    expect(pages.flat().every((item) => item.status === "scheduled")).toBe(true)
  })

  it("épuise le direct, saute le programmé vide et atteint les terminés, dans cet ordre", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { live: 3, ended: 4 })
    const { seen, pages } = await paginateAll(root, alice, 2)
    expectExhaustive(seen, expected)
    // Ordre déterministe : tout le direct avant le moindre terminé.
    const statuses = pages.flat().map((item) => item.status)
    const firstEnded = statuses.indexOf("ended")
    expect(statuses.slice(0, firstEnded).every((s) => s === "live")).toBe(true)
    expect(statuses.slice(firstEnded).every((s) => s === "ended")).toBe(true)
  })

  it("avec une limite supérieure à l'effectif, une page par statut peuplé suffit", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { live: 2, ended: 3 })
    const { seen, pages } = await paginateAll(root, alice, 50)
    expectExhaustive(seen, expected)
    // Le statut vide (programmé) est traversé côté serveur, sans page vide
    // rendue au client : deux pages, pas trois.
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(2)
    expect(pages[1]).toHaveLength(3)
  })

  it("retrouve, sans doublon, un direct terminé entre deux pages avant d'avoir été servi", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { live: 3 })
    const first = await alice.as.query(S.listMinePage, { networkId: root, limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor?.status).toBe("live")
    const served = new Set(first.items.map((item) => item.sessionId))
    const notYetServed = expected.filter((id) => !served.has(id))
    expect(notYetServed).toHaveLength(1)
    const moving = notYetServed[0]
    if (moving === undefined) throw new Error("session attendue")
    await alice.as.mutation(S.end, { networkId: root, sessionId: moving })

    const rest = await paginateAll(root, alice, 2, first.nextCursor ?? undefined)
    const seen = [...first.items.map((item) => item.sessionId), ...rest.seen]
    expectExhaustive(seen, expected)
    expect(rest.pages.flat().find((item) => item.sessionId === moving)?.status).toBe("ended")
  })
})

describe("listMineStatusPage — la seule pagination native de la chaîne", () => {
  it("pagine UN statut par curseur natif et dit quand il est épuisé", async () => {
    const { root, alice } = await host()
    const expected = await seedSessions(root, alice, { live: 3 })
    const first = await alice.as.query(S.listMineStatusPage, { networkId: root, status: "live", cursor: null, limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.isDone).toBe(false)
    expect(typeof first.continueCursor).toBe("string")
    const second = await alice.as.query(S.listMineStatusPage, { networkId: root, status: "live", cursor: first.continueCursor, limit: 2 })
    expect(second.items).toHaveLength(1)
    expect(second.isDone).toBe(true)
    expectExhaustive(
      [...first.items, ...second.items].map((item) => item.sessionId),
      expected,
    )
  })

  it("rend une page vide et close sur un statut sans session", async () => {
    const { root, alice } = await host()
    await seedSessions(root, alice, { live: 1 })
    const page = await alice.as.query(S.listMineStatusPage, { networkId: root, status: "ended", cursor: null, limit: 2 })
    expect(page.items).toEqual([])
    expect(page.isDone).toBe(true)
  })
})

describe("pagination de l'activité Direct", () => {
  it("traverse tous les statuts sans doublon ni plafond historique", async () => {
    const { root, alice } = await host()
    const expected: Id<"liveSessions">[] = []
    for (let index = 0; index < 13; index += 1) {
      const sessionId = await create(root, alice, `Conférence ${index}`)
      expected.push(sessionId)
      if (index < 4) {
        await alice.as.mutation(S.goLive, { networkId: root, sessionId })
      } else if (index < 9) {
        await alice.as.mutation(S.end, { networkId: root, sessionId })
      }
    }

    const { seen } = await paginateAll(root, alice, 2)
    expect(new Set(seen).size).toBe(seen.length)
    expect(new Set(seen)).toEqual(new Set(expected))
  })

  it("« Mes conférences » d'un réseau ne rend jamais celles tenues dans un autre", async () => {
    const { t, root, testClosed, alice } = await host()
    await joinAlso(t, testClosed, alice)
    const ici = await seedSessions(root, alice, { live: 1, ended: 1 })
    const ailleurs = await seedSessions(testClosed, alice, { live: 1, scheduled: 1 })

    expectExhaustive((await paginateAll(root, alice, 50)).seen, ici)
    expectExhaustive((await paginateAll(testClosed, alice, 50)).seen, ailleurs)
    expect((await alice.as.query(S.listMine, { networkId: root })).map((card) => card.sessionId).sort()).toEqual([...ici].sort())
  })
})
