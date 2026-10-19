// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-relation-search.test.tsx @ ad2e7fdc2 — adaptations : mock visant `graph.connections.searchMine` du moteur ; réseau courant par l'enveloppe de test (`EngineTestWrapper`), `networkId` vérifié dans chaque requête envoyée ; cinq cas portés à l'identique.
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineTestWrapper, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

type SearchArgs = { networkId: string; query: string; limit: number } | "skip"

const mocks = vi.hoisted(() => ({
  calls: [] as SearchArgs[],
  response: {
    data: undefined as unknown[] | undefined,
    isPending: false,
    isError: false,
  },
  refetch: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      graph: { connections: { searchMine: "searchMine" } },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (_reference: string, args: SearchArgs) => {
    mocks.calls.push(args)
    // Une requête DÉSACTIVÉE reste `pending` en TanStack v5 (fetchStatus
    // idle) : le hook doit le masquer — c'est l'attente infinie d'IC-07.
    if (args === "skip") {
      return {
        data: undefined,
        isPending: true,
        isError: false,
        refetch: mocks.refetch,
      }
    }
    return { ...mocks.response, refetch: mocks.refetch }
  },
}))

import {
  RELATION_SEARCH_LIMIT,
  isRelationSearchTerm,
  useRelationSearch,
} from "./use-relation-search"

const serverCalls = () =>
  mocks.calls.filter((args): args is Exclude<SearchArgs, "skip"> => args !== "skip")

beforeEach(() => {
  vi.useFakeTimers()
  mocks.calls = []
  mocks.response = { data: undefined, isPending: false, isError: false }
  mocks.refetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useRelationSearch — seuil, pause de frappe, états honnêtes", () => {
  it("n'interroge jamais le serveur sous deux caractères, et n'attend pas", () => {
    expect(isRelationSearchTerm("a")).toBe(false)
    expect(isRelationSearchTerm(" ab ")).toBe(true)

    const { result } = renderHook(() => useRelationSearch("a"), { wrapper: EngineTestWrapper })
    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(serverCalls()).toEqual([])
    expect(result.current.enabled).toBe(false)
    expect(result.current.eligible).toBe(false)
    expect(result.current.isPending).toBe(false)
    expect(result.current.settled).toBe(false)
    expect(result.current.items).toEqual([])
  })

  it("attend la pause de frappe avant d'envoyer le terme ébarbé, puis se pose", () => {
    const hit = { connectionId: "c-26", displayName: "Élodie Famille26" }
    mocks.response = { data: [hit], isPending: false, isError: false }

    // Le champ naît vide, puis l'agent tape : c'est la frappe qui est retardée
    // (un terme présent AU MONTAGE part sans attendre — ce n'est pas de la
    // frappe).
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useRelationSearch(query),
      { initialProps: { query: "" }, wrapper: EngineTestWrapper },
    )
    rerender({ query: "  Élodie " })
    // Éligible dès la frappe — l'écran est en mode recherche — mais rien
    // n'est parti : le terme envoyé n'a pas encore atteint le seuil.
    expect(result.current.eligible).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(result.current.settled).toBe(false)
    expect(serverCalls()).toEqual([])

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(serverCalls()).toEqual([])

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(serverCalls()).toEqual([
      { networkId: TEST_NETWORK_ID, query: "Élodie", limit: RELATION_SEARCH_LIMIT },
    ])
    expect(result.current.enabled).toBe(true)
    expect(result.current.term).toBe("Élodie")
    expect(result.current.items).toEqual([hit])
    expect(result.current.settled).toBe(true)
  })

  it("une frappe rapide ne produit qu'une seule requête, sur le dernier terme", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useRelationSearch(query),
      { initialProps: { query: "a" }, wrapper: EngineTestWrapper },
    )
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ query: "ab" })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ query: "abc" })
    // Entre deux frappes : éligible, mais pas posé — l'écran ne conclut rien.
    expect(result.current.eligible).toBe(true)
    expect(result.current.settled).toBe(false)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(serverCalls()).toEqual([{ networkId: TEST_NETWORK_ID, query: "abc", limit: RELATION_SEARCH_LIMIT }])
    expect(result.current.term).toBe("abc")
  })

  it("expose l'attente puis l'erreur, et Réessayer relance la même requête", () => {
    mocks.response = { data: undefined, isPending: true, isError: false }
    const { result, rerender } = renderHook(() => useRelationSearch("zo", { limit: 5 }), { wrapper: EngineTestWrapper })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(serverCalls()).toEqual([{ networkId: TEST_NETWORK_ID, query: "zo", limit: 5 }])
    expect(result.current.isPending).toBe(true)
    expect(result.current.settled).toBe(false)
    expect(result.current.items).toEqual([])

    mocks.response = { data: undefined, isPending: false, isError: true }
    rerender()
    expect(result.current.isError).toBe(true)
    expect(result.current.settled).toBe(false)

    act(() => {
      result.current.refetch()
    })
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it("redescendre sous le seuil coupe la requête et vide les résultats", () => {
    mocks.response = { data: [{ connectionId: "c-1" }], isPending: false, isError: false }
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useRelationSearch(query),
      { initialProps: { query: "ab" }, wrapper: EngineTestWrapper },
    )
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.items).toHaveLength(1)

    rerender({ query: "" })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.eligible).toBe(false)
    expect(result.current.items).toEqual([])
    expect(mocks.calls[mocks.calls.length - 1]).toBe("skip")
  })
})
