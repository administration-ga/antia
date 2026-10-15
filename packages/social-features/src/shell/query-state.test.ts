// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/query-state.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle, module pur inchangé).
/**
 * query-state — la matrice d'états d'une liste (IC-07), vérifiée :
 *
 *  1. une query désactivée n'est JAMAIS « attente » ;
 *  2. une erreur prime sur tout le reste, et conserve les données détenues ;
 *  3. le squelette n'apparaît qu'en vraie attente, l'état vide qu'après réponse ;
 *  4. les adaptateurs TanStack et `usePaginatedQuery` retombent sur la même
 *     décision — et la pagination ne dit « vide » qu'à l'épuisement.
 */
import { describe, expect, it } from "vitest"
import {
  conserveDonneesEnErreur,
  deriveEtatListe,
  etatDePagination,
  etatDeQuery,
  montreElements,
  montreEtatVide,
  montreSquelette,
  type EtatListe,
  type EtatListeInput,
} from "./query-state"

function input(overrides: Partial<EtatListeInput> = {}): EtatListeInput {
  return {
    enabled: true,
    isPending: false,
    isFetching: false,
    isError: false,
    count: 0,
    ...overrides,
  }
}

describe("deriveEtatListe — la matrice", () => {
  const cases: Array<[string, Partial<EtatListeInput>, EtatListe]> = [
    ["désactivée, sans rien", { enabled: false, isPending: true }, "inactif"],
    ["désactivée, même en erreur", { enabled: false, isError: true }, "inactif"],
    ["désactivée, même avec données", { enabled: false, count: 3 }, "inactif"],
    ["premier chargement", { isPending: true, isFetching: true }, "attente"],
    ["premier chargement, hors ligne (paused)", { isPending: true, isFetching: false }, "attente"],
    ["réponse vide", { count: 0 }, "vide"],
    ["réponse pleine", { count: 4 }, "pret"],
    ["rafraîchissement avec données", { count: 4, isFetching: true }, "rafraichissement"],
    ["rafraîchissement d'une liste vide", { count: 0, isFetching: true }, "rafraichissement"],
    ["erreur sans données", { isError: true, count: 0 }, "erreur"],
    ["erreur après données (cache conservé)", { isError: true, count: 4 }, "erreur"],
    ["erreur pendant un rafraîchissement", { isError: true, isFetching: true, count: 2 }, "erreur"],
  ]

  for (const [label, overrides, expected] of cases) {
    it(`${label} → ${expected}`, () => {
      expect(deriveEtatListe(input(overrides))).toBe(expected)
    })
  }

  it("une query désactivée n'est JAMAIS « attente », quels que soient les drapeaux", () => {
    for (const isPending of [true, false]) {
      for (const isFetching of [true, false]) {
        for (const isError of [true, false]) {
          for (const count of [0, 1]) {
            expect(
              deriveEtatListe(input({ enabled: false, isPending, isFetching, isError, count })),
            ).toBe("inactif")
          }
        }
      }
    }
  })
})

describe("les décisions de rendu qui en découlent", () => {
  it("le squelette n'apparaît qu'en attente", () => {
    expect(montreSquelette("attente")).toBe(true)
    for (const etat of ["inactif", "erreur", "vide", "pret", "rafraichissement"] as const) {
      expect(montreSquelette(etat)).toBe(false)
    }
  })

  it("l'état vide n'est rendu qu'après une réponse « rien » — jamais sur une panne", () => {
    expect(montreEtatVide("vide", 0)).toBe(true)
    expect(montreEtatVide("erreur", 0)).toBe(false)
    expect(montreEtatVide("attente", 0)).toBe(false)
    expect(montreEtatVide("inactif", 0)).toBe(false)
    expect(montreEtatVide("pret", 0)).toBe(false)
  })

  it("l'état vide RESTE affiché pendant qu'une relecture tourne derrière", () => {
    expect(montreEtatVide("rafraichissement", 0)).toBe(true)
    expect(montreEtatVide("rafraichissement", 2)).toBe(false)
    expect(montreEtatVide("vide", 2)).toBe(false)
  })

  it("une erreur conserve les données détenues", () => {
    expect(conserveDonneesEnErreur("erreur", 3)).toBe(true)
    expect(conserveDonneesEnErreur("erreur", 0)).toBe(false)
    expect(conserveDonneesEnErreur("pret", 3)).toBe(false)
  })

  it("les éléments se montrent prêts, en rafraîchissement, ou conservés en erreur", () => {
    expect(montreElements("pret", 2)).toBe(true)
    expect(montreElements("rafraichissement", 2)).toBe(true)
    expect(montreElements("erreur", 2)).toBe(true)
    expect(montreElements("erreur", 0)).toBe(false)
    expect(montreElements("attente", 2)).toBe(false)
    expect(montreElements("inactif", 2)).toBe(false)
  })
})

describe("etatDeQuery — l'adaptateur TanStack", () => {
  it("déduit « désactivée » d'une query pending ET idle (TanStack v5)", () => {
    expect(
      etatDeQuery({ isPending: true, isFetching: false, isError: false, fetchStatus: "idle" }, 0),
    ).toBe("inactif")
  })

  it("distingue l'attente réelle (pending + fetching) de la query désactivée", () => {
    expect(
      etatDeQuery({ isPending: true, isFetching: true, isError: false, fetchStatus: "fetching" }, 0),
    ).toBe("attente")
    expect(
      etatDeQuery({ isPending: true, isFetching: false, isError: false, fetchStatus: "paused" }, 0),
    ).toBe("attente")
  })

  it("laisse l'appelant dire qu'il a passé « skip »", () => {
    expect(
      etatDeQuery(
        { isPending: true, isFetching: true, isError: false, fetchStatus: "fetching" },
        0,
        false,
      ),
    ).toBe("inactif")
  })

  it("rend « erreur » même quand des données sont conservées", () => {
    expect(
      etatDeQuery({ isPending: false, isFetching: false, isError: true, fetchStatus: "idle" }, 5),
    ).toBe("erreur")
  })

  it("se contente d'un `isLoading` de repli (mocks minimaux)", () => {
    expect(etatDeQuery({ isLoading: true }, 0)).toBe("attente")
    expect(etatDeQuery({ isLoading: false }, 0)).toBe("vide")
    expect(etatDeQuery({ isLoading: false }, 2)).toBe("pret")
    expect(etatDeQuery({ isLoading: false, isError: true }, 0)).toBe("erreur")
  })
})

describe("etatDePagination — usePaginatedQuery", () => {
  it("attend sur la première page", () => {
    expect(etatDePagination("LoadingFirstPage", 0)).toBe("attente")
  })

  it("ne dit « vide » qu'à l'ÉPUISEMENT — jamais tant qu'une page peut suivre", () => {
    expect(etatDePagination("CanLoadMore", 0)).toBe("pret")
    expect(etatDePagination("LoadingMore", 0)).toBe("attente")
    expect(etatDePagination("Exhausted", 0)).toBe("vide")
  })

  it("rend « prêt » ou « rafraîchissement » avec des éléments", () => {
    expect(etatDePagination("Exhausted", 3)).toBe("pret")
    expect(etatDePagination("CanLoadMore", 3)).toBe("pret")
    expect(etatDePagination("LoadingMore", 3)).toBe("rafraichissement")
  })
})
