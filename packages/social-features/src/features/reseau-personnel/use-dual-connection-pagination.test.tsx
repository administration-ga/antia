// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-dual-connection-pagination.test.tsx @ ad2e7fdc2 — adaptations : mocks visant `graph.connections` du moteur (un seul graphe) ; réseau courant par l'enveloppe de test (`EngineTestWrapper`), `networkId` vérifié dans les arguments ; les deux cas du socle portés ; deux cas ajoutés pour les demandes reçues (un seul index paginé, présenté comme une paire au côté haut épuisé).
// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

type PageItem = { connectionId: string; at: number }
type NativePage = { page: PageItem[]; isDone: boolean; continueCursor: string }
type DualPage = { low: NativePage; high: NativePage }
type PaginationOpts = { cursor: string | null; numItems: number }
type MineArgs = { networkId: string; lowPaginationOpts: PaginationOpts; highPaginationOpts: PaginationOpts }
type PendingArgs = { networkId: string; paginationOpts: PaginationOpts }

const mocks = vi.hoisted(() => ({
  pages: new Map<string, DualPage>(),
  pending: new Map<string, NativePage>(),
  seen: [] as MineArgs[],
  seenPending: [] as PendingArgs[],
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      graph: {
        connections: {
          paginateMine: "mine",
          paginatePendingForMe: "pending",
        },
      },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string, args: MineArgs | PendingArgs | "skip") => {
    if (args === "skip") {
      return {
        data: undefined,
        isPending: false,
        isError: false,
        refetch: vi.fn(),
      }
    }
    if (reference === "pending" && "paginationOpts" in args) {
      mocks.seenPending.push(args)
      return {
        data: mocks.pending.get(args.paginationOpts.cursor ?? "start"),
        isPending: false,
        isError: false,
        refetch: vi.fn(),
      }
    }
    if (!("lowPaginationOpts" in args)) throw new Error(`arguments inattendus pour ${reference}`)
    mocks.seen.push(args)
    const key = `${args.lowPaginationOpts.cursor ?? "start"}|${args.highPaginationOpts.cursor ?? "start"}`
    return {
      data: mocks.pages.get(key),
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }
  },
}))

import { usePersonalConnections, usePersonalPendingConnections } from "./use-dual-connection-pagination"

beforeEach(() => {
  mocks.pages.clear()
  mocks.pending.clear()
  mocks.seen = []
  mocks.seenPending = []
})

describe("pagination à deux curseurs des relations", () => {
  it("avance les deux curseurs, déduplique et trie toutes les pages", async () => {
    mocks.pages.set("start|start", {
      low: {
        page: [{ connectionId: "a", at: 10 }],
        isDone: false,
        continueCursor: "low-2",
      },
      high: {
        page: [{ connectionId: "b", at: 20 }],
        isDone: false,
        continueCursor: "high-2",
      },
    })
    mocks.pages.set("low-2|high-2", {
      low: {
        page: [{ connectionId: "c", at: 15 }],
        isDone: true,
        continueCursor: "low-end",
      },
      high: {
        page: [{ connectionId: "b", at: 25 }],
        isDone: true,
        continueCursor: "high-end",
      },
    })

    const { result } = renderHook(() => usePersonalConnections({ pageSize: 2 }), { wrapper: EngineTestWrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items.map((item) => item.connectionId)).toEqual(["b", "c", "a"]))
    expect(result.current.hasMore).toBe(false)
    // UN graphe par réseau : chaque page est demandée DANS le réseau courant.
    expect(mocks.seen).toContainEqual({
      networkId: TEST_NETWORK_ID,
      lowPaginationOpts: { cursor: "low-2", numItems: 2 },
      highPaginationOpts: { cursor: "high-2", numItems: 2 },
    })
  })

  it("épuise automatiquement les pages avant de stabiliser un compteur", async () => {
    mocks.pages.set("start|start", {
      low: {
        page: [{ connectionId: "a", at: 10 }],
        isDone: false,
        continueCursor: "low-next",
      },
      high: { page: [], isDone: true, continueCursor: "high-end" },
    })
    mocks.pages.set("low-next|high-end", {
      low: {
        page: [{ connectionId: "b", at: 20 }],
        isDone: true,
        continueCursor: "low-end",
      },
      high: { page: [], isDone: true, continueCursor: "high-end" },
    })

    const { result } = renderHook(() => usePersonalConnections({ autoLoad: true, pageSize: 1 }), {
      wrapper: EngineTestWrapper,
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
      expect(result.current.isLoadingMore).toBe(false)
    })
    expect(result.current.items.map((item) => item.connectionId)).toEqual(["b", "a"])
  })
})

describe("demandes reçues — un seul index paginé", () => {
  it("suit le curseur natif unique et trie de la plus récente à la plus ancienne", async () => {
    mocks.pending.set("start", {
      page: [{ connectionId: "p1", at: 30 }],
      isDone: false,
      continueCursor: "p-2",
    })
    mocks.pending.set("p-2", {
      page: [
        { connectionId: "p2", at: 40 },
        { connectionId: "p1", at: 30 },
      ],
      isDone: true,
      continueCursor: "p-end",
    })

    const { result } = renderHook(() => usePersonalPendingConnections({ pageSize: 1 }), { wrapper: EngineTestWrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items.map((item) => item.connectionId)).toEqual(["p2", "p1"]))
    expect(result.current.hasMore).toBe(false)
    expect(mocks.seenPending).toContainEqual({
      networkId: TEST_NETWORK_ID,
      paginationOpts: { cursor: "p-2", numItems: 1 },
    })
    // La paire n'a qu'un côté : la requête des connexions n'est jamais sollicitée.
    expect(mocks.seen).toEqual([])
  })

  it("annonce la fin dès la première page quand l'index est épuisé, et masque une demande traitée", async () => {
    mocks.pending.set("start", {
      page: [
        { connectionId: "p1", at: 30 },
        { connectionId: "p2", at: 10 },
      ],
      isDone: true,
      continueCursor: "p-end",
    })

    const { result } = renderHook(() => usePersonalPendingConnections(), { wrapper: EngineTestWrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoading).toBe(false)

    act(() => result.current.remove("p1"))
    expect(result.current.items.map((item) => item.connectionId)).toEqual(["p2"])
  })
})
